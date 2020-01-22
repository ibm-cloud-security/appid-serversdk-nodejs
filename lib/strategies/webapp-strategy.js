/*
 Copyright 2017 IBM Corp.
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */
"use strict";
const log4js = require("log4js");
const request = require("request");
const Q = require("q");
const acceptLanguage = require('accept-language');
const constants = require('../utils/constants');
const TokenUtil = require("../utils/token-util");
const ServiceUtil = require('../utils/service-util');
const appIdSupportedLanguagesArray = require("../data/languagesCodesArray");

acceptLanguage.languages(appIdSupportedLanguagesArray);

const STRATEGY_NAME = "appid-webapp-strategy";
const logger = log4js.getLogger(STRATEGY_NAME);

function WebAppStrategy(options = {}) {
	logger.debug("Initializing");

	this.name = WebAppStrategy.STRATEGY_NAME;
	this.serviceConfig = new ServiceUtil.loadConfig('WebAppStrategy', [
		constants.CLIENT_ID,
		constants.TENANT_ID,
		constants.SECRET,
		constants.OAUTH_SERVER_URL,
		constants.REDIRECT_URI
	], options);
}

WebAppStrategy.STRATEGY_NAME = STRATEGY_NAME;
WebAppStrategy.DEFAULT_SCOPE = "appid_default";
WebAppStrategy.AUTH_CONTEXT = "APPID_AUTH_CONTEXT";
WebAppStrategy.SIGN_UP = "sign_up";
WebAppStrategy.CHANGE_PASSWORD = "change_password";
WebAppStrategy.CHANGE_DETAILS = "change_details";
WebAppStrategy.FORGOT_PASSWORD = "forgot_password";
WebAppStrategy.LANGUAGE = "language";
WebAppStrategy.STATE_PARAMETER = "STATE_PARAMETER";
WebAppStrategy.CLOUD_DIRECTORY_UPDATE_REQ = "cloud_directory_update_request";

const AUTHORIZATION_PATH = "/authorization";
const FORGOT_PASSWORD_PATH = "/cloud_directory/forgot_password";
const CHANGE_PASSWORD_PATH = "/cloud_directory/change_password";
const CHANGE_DETAILS_PATH = "/cloud_directory/change_details";
const GENERATE_CODE_PATH = "/cloud_directory/generate_code";
const LOGGING_PATH = "/activity_logging";
const TOKEN_PATH = "/token";
const USERNAME = "username";
const PASSWORD = "password";
const POST_METHOD = "POST";
const INVALID_GRANT = "invalid_grant";
const FORBIDDEN = "FORBIDDEN";
const CLOUD_DIRECTORY = "cloud_directory";
const LOCALE_PARAM_NAME = "language";
const LOGOUT_ACTIVITY = "logout";

function finishLogout(req) {
	delete req.session.returnTo;
	delete req.session[WebAppStrategy.AUTH_CONTEXT];
	delete req.session[WebAppStrategy.STATE_PARAMETER];
	delete req.session[WebAppStrategy.CLOUD_DIRECTORY_UPDATE_REQ];
	req.logout();
}

// legacy static version, does not log event to the auth server
WebAppStrategy.logout = function (req) {
	finishLogout(req);
};

// preferred non-static version, logs event to the auth server
WebAppStrategy.prototype.logout = function (req) {
	logAction(req, this.serviceConfig.getOAuthServerUrl(), LOGOUT_ACTIVITY);
	finishLogout(req);
};

WebAppStrategy.prototype.setPreferredLocale = function (req, language) {

	// Check that express-session is enabled
	if (!req.session) {
		logger.error("Can't find req.session. Ensure express-session middleware is in use. Default language will be used");
		return this.error(new Error("Can't find req.session"));
	}
	req.session[WebAppStrategy.LANGUAGE] = language;
};

WebAppStrategy.prototype.getPreferredLocale = function (req) {
	return (req.session && req.session[WebAppStrategy.LANGUAGE]) || this.serviceConfig.getPreferredLocale();
};

// .success(user, info) - call on auth success. user=object, info=object
// .fail(challenge, status) - call on auth failure. challenge=string, status=int
// .redirect(url, status) - call on redirect required. url=url, status=int
// .pass() - skip strategy processing
// .error(err) - error during strategy processing. err=Error obj

WebAppStrategy.prototype.authenticate = function (req, options = {}) {
	if (options.successRedirect) {
		req.session.returnTo = options.successRedirect;
	}

	// Check that express-session is enabled
	if (!req.session) {
		logger.error("Can't find req.session. Ensure express-session middleware is in use");
		return this.error(new Error("Can't find req.session"));
	}
	// RoP flow
	if (req.method === POST_METHOD) {
		if (req.body && Object.prototype.hasOwnProperty.call(req.body, USERNAME) &&
			Object.prototype.hasOwnProperty.call(req.body, PASSWORD)) {
			return handleRopFlow(options, req, this);
		}
	}
	if (options.show === WebAppStrategy.CHANGE_PASSWORD) {
		return handleChangePassword(req, options, this);
	}
	if (options.show === WebAppStrategy.CHANGE_DETAILS) {
		return handleChangeDetails(req, options, this);
	}
	if (options.show === WebAppStrategy.FORGOT_PASSWORD) {
		return handleForgotPassword(req, options, this);
	}
	if (req.query && req.query.error) {
		// Handle possible errors returned in callback
		var returnError = req.query.error_description || req.query.error;
		logger.warn("Error returned in callback ::", returnError);
		return this.fail(returnError);
	} else if (req.query && req.query.code) {
		// Handle grant code in callback
		return handleCallback(req, options, this);
	} else if (req.query && req.query.flow && (req.query.flow === WebAppStrategy.SIGN_UP ||
		req.query.flow === WebAppStrategy.FORGOT_PASSWORD)) {
		logger.debug("Finished " + req.query.flow + "flow");
		var url = req.session.returnTo || "/";
		delete req.session.returnTo;
		return this.redirect(url);
	} else {
		// Handle authorization request
		return handleAuthorization(req, options, this);
	}
};

WebAppStrategy.prototype.refreshTokens = function (req, refreshToken) {
	return refreshTokens(refreshToken, this).then(function (appIdAuthContext) {
		// Save authorization context to HTTP session
		req.session[WebAppStrategy.AUTH_CONTEXT] = appIdAuthContext;
	});
};

function handleChangePassword(req, options, strategy) {
	logger.debug("handleChangePassword");
	options = options || {};
	if (req.isUnauthenticated()) {
		strategy.fail(new Error("No identity token found."));
		return;
	}
	const appIdAuthContext = req.session[WebAppStrategy.AUTH_CONTEXT];
	if (!appIdAuthContext || appIdAuthContext.identityTokenPayload["amr"][0] !== CLOUD_DIRECTORY) {
		strategy.fail(new Error("The identity token was not retrieved using cloud directory idp."));
		return;
	}
	var userId = appIdAuthContext.identityTokenPayload["identities"][0]["id"];
	var changePasswordUrl = generateChangePasswordUrl(userId, req, strategy);
	logger.debug("handleChangePassword :: redirecting to", changePasswordUrl);
	req.session[WebAppStrategy.CLOUD_DIRECTORY_UPDATE_REQ] = true;
	strategy.redirect(changePasswordUrl);
}

function handleForgotPassword(req, options, strategy) {
	logger.debug("handleForgotPassword");
	if (options.successRedirect) {
		req.session[WebAppStrategy.ORIGINAL_URL] = options.successRedirect;
	}
	var forgotPasswordUrl = generateForgotPasswordUrl(req, strategy);
	logger.debug("handleForgotPassword :: redirecting to", forgotPasswordUrl);
	strategy.redirect(forgotPasswordUrl);
}

function handleChangeDetails(req, options, strategy) {
	logger.debug("handleChangeDetails");
	options = options || {};
	if (req.isUnauthenticated()) {
		strategy.fail(new Error("No identity token found."));
		return;
	}
	const appIdAuthContext = req.session[WebAppStrategy.AUTH_CONTEXT];
	if (!appIdAuthContext || appIdAuthContext.identityTokenPayload["amr"][0] !== CLOUD_DIRECTORY) {
		strategy.fail(new Error("The identity token was not retrieved using cloud directory idp."));
		return;
	}

	var generateCodeUrl = strategy.serviceConfig.getOAuthServerUrl() + GENERATE_CODE_PATH;
	request({
		'url': generateCodeUrl,
		'auth': {
			'bearer': appIdAuthContext.accessToken + ' ' + appIdAuthContext.identityToken
		}
	}, function (error, response, body) {
		if (!error) {
			if (response.statusCode === 200) {
				var code = body;
				var changeDetailsUrl = generateChangeDetailsUrl(code, req, strategy);
				logger.debug("handleChangeDetails :: redirecting to", changeDetailsUrl);
				req.session[WebAppStrategy.CLOUD_DIRECTORY_UPDATE_REQ] = true;
				strategy.redirect(changeDetailsUrl);
			} else {
				logger.error('generate code response not 200, got status:' + response.statusCode);
				strategy.fail(new Error('generate code: response status code:' + response.statusCode));
			}
		} else {
			logger.error('generate code request error: ' + error.message);
			strategy.fail(error);
		}
	});
}

function handleRopFlow(options, req, strategy) {
	logger.debug("handleRopFlow");
	var formData = {
		grant_type: "password",
		username: req.body[USERNAME],
		password: req.body[PASSWORD]
	};
	if (options.scope) {
		formData.scope = options.scope;
	}
	// If there's an existing anonymous access token on session - add it to the request POST body
	const appIdAuthContext = req.session[WebAppStrategy.AUTH_CONTEXT];
	if (appIdAuthContext && appIdAuthContext.accessTokenPayload["amr"][0] === "appid_anon") {
		logger.debug("handleRopFlow :: added anonymous access_token to POST body");
		formData["appid_access_token"] = appIdAuthContext.accessToken;
	}
	retrieveTokens(formData, strategy).then(function (appIdAuthContext) {
		// Save authorization context to HTTP session
		req.session[WebAppStrategy.AUTH_CONTEXT] = appIdAuthContext;
		logger.debug("completeRopFlow :: success", options);
		strategy.success(appIdAuthContext.identityTokenPayload || null);
	}).catch(strategy.fail);
}

function handleAuthorization(req, options = {}, strategy) {
	logger.debug("handleAuthorization");

	// If user is already authenticated and new login is not enforced - end processing
	if (isAuthenticated(req, options) && !options.forceLogin && !options.allowAnonymousLogin) {
		return strategy.success(req.session[WebAppStrategy.AUTH_CONTEXT].identityTokenPayload);
	}

	// if successRedirect was specified, persist using passport's returnTo session param
	req.session.returnTo = options.successRedirect || req.originalUrl;

	redirectForAuthorization(req, options, strategy);
}

function isAuthenticated(req, options = {}) {
	if (!req.session[WebAppStrategy.AUTH_CONTEXT]) {
		return false;
	}
	
	const allowExpiredTokensOnSession = options.hasOwnProperty("allowExpiredTokensOnSession") ?
	  options.allowExpiredTokensOnSession : false;
	if (!allowExpiredTokensOnSession && TokenUtil.isTokenExpired(req.session[WebAppStrategy.AUTH_CONTEXT].accessTokenPayload)) {
		return false;
	}
	
	return true;
}

function refreshTokens(refreshToken, strategy) {
	if (!refreshToken) {
		logger.debug("no refresh-token given");
		return Q.reject(new Error("no refresh-token"));
	}
	// try to obtain refresh tokens
	var formData = {
		"grant_type": "refresh_token",
		"refresh_token": refreshToken
	};
	logger.debug("obtain tokens using a refresh token, refreshToken=" + refreshToken);
	return retrieveTokens(formData, strategy);
}

function redirectForAuthorization(req, options, strategy) {
	options.allowCreateNewAnonymousUser = options.hasOwnProperty("allowCreateNewAnonymousUser") ?
		options.allowCreateNewAnonymousUser : true;
	options.failureRedirect = options.failureRedirect || "/";
	var authUrl = generateAuthorizationUrl(options, req, strategy);

	// If there's an existing anonymous access token on session - add it to the request url
	const appIdAuthContext = req.session[WebAppStrategy.AUTH_CONTEXT];
	if (appIdAuthContext && appIdAuthContext.accessTokenPayload["amr"][0] === "appid_anon") {
		logger.debug("handleAuthorization :: added anonymous access_token to url");
		authUrl += "&appid_access_token=" + appIdAuthContext.accessToken;
	}

	// If previous anonymous access token not found and new anonymous users are not allowed - fail
	if (!appIdAuthContext && options.allowAnonymousLogin === true && options.allowCreateNewAnonymousUser !== true) {
		logger.info("Previous anonymous user not found. Not allowed to create new anonymous users.");
		strategy.fail(new Error("Not allowed to create new anonymous users."));
		return;
	}

	const stateParameter = {state: TokenUtil.getRandomNumber()};
	authUrl += "&state=" + encodeURIComponent(stateParameter.state);
	req.session[WebAppStrategy.STATE_PARAMETER] = stateParameter;
	logger.debug("handleAuthorization :: redirecting to", authUrl);
	strategy.redirect(authUrl);
}

function handleCallback(req, options = {}, strategy) {
	logger.debug("handleCallback");
	options.failureRedirect = options.failureRedirect || "/";
	options.successReturnToOrRedirect = "/"; // fallback to req.session.returnTo
	const stateParameter = req.session[WebAppStrategy.STATE_PARAMETER];
	// Check for handleChangeDetails, handleForgotPassword callback from cloud directory
	const cloudDirectoryUpdate = req.session[WebAppStrategy.CLOUD_DIRECTORY_UPDATE_REQ];
	if (typeof cloudDirectoryUpdate !== "undefined" && cloudDirectoryUpdate === true) {
		delete req.session[WebAppStrategy.CLOUD_DIRECTORY_UPDATE_REQ];
		getTokens(req, options, strategy);
	} else if (typeof stateParameter === "undefined") {
		strategy.fail(new Error("Invalid session state"));
	} else if (stateParameter.state !== decodeURIComponent(req.query.state)) {
		strategy.fail(new Error("Invalid state parameter"));
	} else {
		getTokens(req, options, strategy);
	}
}

function getTokens(req, options, strategy) {
	var formData = {
		client_id: strategy.serviceConfig.getClientId(),
		grant_type: "authorization_code",
		redirect_uri: strategy.serviceConfig.getRedirectUri(),
		code: req.query.code
	};

	retrieveTokens(formData, strategy).then(function (appIdAuthContext) {
		// Save authorization context to HTTP session
		req.session[WebAppStrategy.AUTH_CONTEXT] = appIdAuthContext;
		delete req.session[WebAppStrategy.STATE_PARAMETER];
		logger.debug("completeAuthorizationFlow :: success", options);
		strategy.success(appIdAuthContext.identityTokenPayload || null);
	}).catch(strategy.fail);
}

function addLocaleToQuery(req, _url, strategy) {
	const localeToUse = strategy.getPreferredLocale(req);
	let url = _url;
	if (localeToUse) {
		url += "&" + LOCALE_PARAM_NAME + "=" + encodeURIComponent(localeToUse);
	} else {
		if (req && req.headers && req.headers['accept-language']) {
			let language = acceptLanguage.get(req.headers['accept-language']);
			url += "&" + LOCALE_PARAM_NAME + "=" + encodeURIComponent(language);
		}
	}
	return url;
}

function generateForgotPasswordUrl(req, strategy) {
	const serviceConfig = strategy.serviceConfig;
	const redirectUri = serviceConfig.getRedirectUri();
	const clientId = serviceConfig.getClientId();
	const forgotPasswordEndpoint = serviceConfig.getOAuthServerUrl() + FORGOT_PASSWORD_PATH;
	var forgotPasswordUrl = encodeURI(forgotPasswordEndpoint +
		"?client_id=" + clientId + "&redirect_uri=" + redirectUri);

	return addLocaleToQuery(req, forgotPasswordUrl, strategy);
}

function generateChangePasswordUrl(userId, req, strategy) {
	const serviceConfig = strategy.serviceConfig;
	const clientId = serviceConfig.getClientId();
	const changePasswordEndpoint = serviceConfig.getOAuthServerUrl() + CHANGE_PASSWORD_PATH;
	const redirectUri = serviceConfig.getRedirectUri();
	var changePasswordUrl = encodeURI(changePasswordEndpoint +
		"?client_id=" + clientId +
		"&redirect_uri=" + redirectUri +
		"&user_id=" + userId);

	return addLocaleToQuery(req, changePasswordUrl, strategy);
}

function generateChangeDetailsUrl(code, req, strategy) {
	const serviceConfig = strategy.serviceConfig;
	const clientId = serviceConfig.getClientId();
	const changeDetailsEndpoint = serviceConfig.getOAuthServerUrl() + CHANGE_DETAILS_PATH;
	const redirectUri = serviceConfig.getRedirectUri();
	var changeDetailsUrl = encodeURI(changeDetailsEndpoint +
		"?client_id=" + clientId +
		"&redirect_uri=" + redirectUri +
		"&code=" + code);

	return addLocaleToQuery(req, changeDetailsUrl, strategy);
}

function generateAuthorizationUrl(options, req, strategy) {
	const serviceConfig = strategy.serviceConfig;
	const clientId = serviceConfig.getClientId();
	const scope = WebAppStrategy.DEFAULT_SCOPE + (options.scope ? " " + options.scope : "");
	const authorizationEndpoint = serviceConfig.getOAuthServerUrl() + AUTHORIZATION_PATH;
	const redirectUri = serviceConfig.getRedirectUri();
	var responseType = "code";
	if (options.show === WebAppStrategy.SIGN_UP) {
		responseType = "sign_up";
	}
	var authUrl = encodeURI(authorizationEndpoint +
		"?client_id=" + clientId +
		"&response_type=" + responseType +
		"&redirect_uri=" + redirectUri +
		"&scope=" + scope);

	if (options.allowAnonymousLogin === true) {
		authUrl += "&idp=appid_anon";
	}

	return addLocaleToQuery(req, authUrl, strategy);
}

function retrieveTokens(formData, strategy) {
	logger.debug("retrieveTokens");
	return new Promise((resolve, reject) => {
		const serviceConfig = strategy.serviceConfig;
		const clientId = serviceConfig.getClientId();
		const secret = serviceConfig.getSecret();
		const tokenEndpoint = serviceConfig.getOAuthServerUrl() + TOKEN_PATH;
		const publicKeysEndpoint = serviceConfig.getOAuthServerUrl();
		request({
			method: "POST",
			url: tokenEndpoint,
			auth: {
				username: clientId,
				password: secret
			},
			formData: formData
		}, function (err, response, strBody) {
			if (err) {
				logger.error("Failed to obtain tokens ::", err);
				reject(err);
			} else if (response.statusCode !== 200) {
				try {
					logger.error("Failed to obtain tokens ::", response && response.statusCode, strBody);
					let body = strBody && JSON.parse(strBody);
					let loginErrMsg = "Failed to obtain tokens";

					if (body && (body.error === INVALID_GRANT || body["error_code"] === FORBIDDEN)) {
						loginErrMsg = body.error_description;
					}
					let loginError = new Error(loginErrMsg);
					loginError.statusCode = response && response.statusCode;
					loginError.code = (body.error || body["error_code"]).toLowerCase();
					return reject(loginError);
				} catch (e) {
					logger.error(e);
					return reject(new Error("Failed to obtain tokens"));
				}
			} else {
				let body = strBody && JSON.parse(strBody);
				const accessTokenString = body["access_token"];
				const identityTokenString = body["id_token"];
				const refreshToken = body["refresh_token"];

				// Parse access_token
				var appIdAuthorizationContext = {
					refreshToken: refreshToken
				};

				Promise.all([
					TokenUtil.decodeAndValidate(accessTokenString, publicKeysEndpoint),
					TokenUtil.decodeAndValidate(identityTokenString, publicKeysEndpoint)]).then(function (tokens) {
					if (tokens.length < 2 || !tokens[0] || !tokens[1]) {
						throw new Error("Invalid access/id token");
					}
					const [accessToken, idToken] = tokens;

					return TokenUtil.validateIssAndAud(accessToken, serviceConfig)
						.then(() => TokenUtil.validateIssAndAud(idToken, serviceConfig))
						.then(() => {
							appIdAuthorizationContext.accessToken = accessTokenString;
							appIdAuthorizationContext.accessTokenPayload = tokens[0];
							appIdAuthorizationContext.identityToken = identityTokenString;
							appIdAuthorizationContext.identityTokenPayload = tokens[1];
							logger.debug("authentication success");
							resolve(appIdAuthorizationContext);
						})
						.catch(err => {
							logger.error(err);
							throw new Error("token validation failed");
						});
				}).catch(function (error) {
					logger.debug("Authentication failed : " + error.message);
					reject(new Error("Authentication failed : " + error.message));
				});
			}
		});

	});
}

function logAction(req, url, activity) {
	logger.debug("logAction");
	const loggingEndpoint = url + LOGGING_PATH;
	const appIdAuthContext = req.session[WebAppStrategy.AUTH_CONTEXT];
	if (!appIdAuthContext || !appIdAuthContext.accessToken || !appIdAuthContext.identityToken) {
		logger.debug("no session tokens found for logging activity " + activity);
		return;
	}

	let requestData = {
		'eventName': activity,
		'id_token': appIdAuthContext.identityToken
	};

	request({
		'method': "POST",
		'url': loggingEndpoint,
		'json': requestData,
		'auth': {
			'bearer': appIdAuthContext.accessToken
		}
	}, function (error, response) {
		if (error) {
			logger.debug('logging request error: ' + error);
		} else {
			logger.debug('logging request ok: ' + response.statusCode);
		}
	});
}

/**
 * This method will trigger a REST HTTP call to the AppID server logoutSSO endpoint.
 * Bare in mind that SSO feature must be activated in the server side.
 * Calling the server SSO APIs will do nothing if you forgot to enable SSO in the server (tenant) configuration.
 * Once you enabled SSO login in the server side you can try the logout in the client side:
 * If you use the sample application , add a logout SSO UI widget , add to the app.js an express routing such as
 * app.get("/logoutSSO", function(req, res, next) {
 *	res.clearCookie("refreshToken");
 *	webAppStrategy.logoutSSO(req,res, { redirect_uri: "http://localhost:3000/niceGoodbyePage" , all_sessions: false });
 * });
 * @param req - the HTTP request
 * @param res - the HTTP response object (will be used to redirect)
 * @param options - need to contain at least the redirect_uri. all_sessions can logout all the users sessions at once.
 */
WebAppStrategy.prototype.logoutSSO = function (req, res, options = {}) {
	options.client_id = this.serviceConfig.getClientId();
	let queryParams = Object.keys(options).map(e => encodeURIComponent(e) + '=' + encodeURIComponent(options[e])).join('&');
	let oauthServerUrl = this.serviceConfig.getOAuthServerUrl();
	let url = `${oauthServerUrl}/cloud_directory/sso/logout?${queryParams}`;
	logger.debug('cleaning client session and calling server url:'+url);
	WebAppStrategy.logout(req);  // without logging to activity tracker since the server will be reporting it .
	res.redirect(url);
};

/**
 * Returns true if the token on the request's session has the required scopes.
 * @param req: The request containing the App ID token.
 * @param requiredScopes {String}: Scope names (not fullName) separated by spaces. For example: 'write read update'.
 * @returns {boolean}
 */
WebAppStrategy.hasScope = function (req, requiredScopes) {
  if (typeof requiredScopes !== 'string' || !requiredScopes.trim()) {
    logger.error('requiredScopes is either empty or not a string');
    return true;
  }
  if (!req || !req.session || !req.session[WebAppStrategy.AUTH_CONTEXT] ||
    !req.session[WebAppStrategy.AUTH_CONTEXT].accessTokenPayload ||
    typeof req.session[WebAppStrategy.AUTH_CONTEXT].accessTokenPayload.scope !== 'string') {
    logger.warn('access token scope could not be found on request\'s session');
    return false;
  }
  
  const suppliedScopes = req.session[WebAppStrategy.AUTH_CONTEXT].accessTokenPayload.scope;
  // get the required scopes as an array
  const requiredScopesArray = requiredScopes.split(" ").filter(scope => scope !== ""); // split by spaces and ignore empty required scopes
  // get the supplied scopes as an array while removing the prefix (app URI) since the required scopes aren't prefixed:
  const suppliedScopesArray = suppliedScopes.split(" ").map(fullScope => fullScope.split("/").pop());
  
  for (const requiredScope of requiredScopesArray) {
	if (!suppliedScopesArray.includes(requiredScope)) {
	  return false;
	}
  }
  return true;
};

module.exports = WebAppStrategy;
