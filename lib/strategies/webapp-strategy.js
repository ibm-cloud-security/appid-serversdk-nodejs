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
const constants = require('../utils/constants');
const TokenUtil = require("../utils/token-util");
const ServiceUtil = require('../utils/service-util');
const PublicKeyUtil = require("../utils/public-key-util");
const acceptLanguage = require('accept-language');
const appIdSupportedLanguagesArray = require("../data/languagesCodesArray");
acceptLanguage.languages(appIdSupportedLanguagesArray);

const STRATEGY_NAME = "appid-webapp-strategy";
const logger = log4js.getLogger(STRATEGY_NAME);

function WebAppStrategy(options) {
	logger.debug("Initializing");
	options = options || {};
	this.name = WebAppStrategy.STRATEGY_NAME;
	this.serviceConfig = new ServiceUtil.loadConfig('WebAppStrategy', [
		constants.CLIENT_ID,
		constants.TENANT_ID,
		constants.SECRET,
		constants.OAUTH_SERVER_URL,
		constants.REDIRECT_URI
	], options);
	PublicKeyUtil.setPublicKeysEndpoint(this.serviceConfig.getOAuthServerUrl());
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
const TOKEN_PATH = "/token";
const USERNAME = "username";
const PASSWORD = "password";
const POST_METHOD = "POST";
const INVALID_GRANT = "invalid_grant";
const FORBIDDEN = "FORBIDDEN";
const CLOUD_DIRECTORY = "cloud_directory";
const LOCALE_PARAM_NAME = "language";

WebAppStrategy.logout = function (req) {
	delete req.session.returnTo;
	delete req.session[WebAppStrategy.AUTH_CONTEXT];
	delete req.session[WebAppStrategy.STATE_PARAMETER];
	delete req.session[WebAppStrategy.CLOUD_DIRECTORY_UPDATE_REQ];
	req.logout();
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

WebAppStrategy.prototype.authenticate = function (req, options) {
	options = options || {};

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
		if (req.body && Object.prototype.hasOwnProperty.call(req.body, USERNAME) && Object.prototype.hasOwnProperty.call(req.body, PASSWORD)) {
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
	} else if (req.query && req.query.flow && (req.query.flow === WebAppStrategy.SIGN_UP || req.query.flow === WebAppStrategy.FORGOT_PASSWORD)) {
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

function handleAuthorization(req, options, strategy) {
	logger.debug("handleAuthorization");
	options = options || {};
	// If user is already authenticated and new login is not enforced - end processing
	if (isAuthenticated(req) && !options.forceLogin && !options.allowAnonymousLogin) {
		return strategy.success(req.session[WebAppStrategy.AUTH_CONTEXT].identityTokenPayload);
	}

	// if successRedirect was specified, persist using passport's returnTo session param
	req.session.returnTo = options.successRedirect || req.originalUrl;

	redirectForAuthorization(req, options, strategy);
}

function isAuthenticated(req) {
	return req.session[WebAppStrategy.AUTH_CONTEXT];
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
	options.allowCreateNewAnonymousUser = options.hasOwnProperty("allowCreateNewAnonymousUser") ? options.allowCreateNewAnonymousUser : true;
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

	const stateParameter = { state: TokenUtil.getRandomNumber() };
	authUrl += "&state=" + encodeURIComponent(stateParameter.state);
	req.session[WebAppStrategy.STATE_PARAMETER] = stateParameter;
	logger.debug("handleAuthorization :: redirecting to", authUrl);
	strategy.redirect(authUrl);
}

function handleCallback(req, options, strategy) {
	logger.debug("handleCallback");
	options = options || {};
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
	var deferred = Q.defer();
	const serviceConfig = strategy.serviceConfig;
	const clientId = serviceConfig.getClientId();
	const secret = serviceConfig.getSecret();
	const tokenEndpoint = serviceConfig.getOAuthServerUrl() + TOKEN_PATH;

	request({
		method: "POST",
		url: tokenEndpoint,
		auth: {
			username: clientId,
			password: secret
		},
		formData: formData
	}, function (err, response, body) {
		if (err) {
			logger.error("Failed to obtain tokens ::", err);
			deferred.reject(err);
		} else if (response.statusCode !== 200) {
			try {
				logger.error("Failed to obtain tokens ::", response && response.statusCode, body);
				body = body && JSON.parse(body);
				let loginErrMsg = "Failed to obtain tokens";

				if (body && (body.error === INVALID_GRANT || body["error_code"] === FORBIDDEN)) {
					loginErrMsg = body.error_description;
				}
				let loginError = new Error(loginErrMsg);
				loginError.statusCode = response && response.statusCode;
				loginError.code = (body.error || body["error_code"]).toLowerCase();
				deferred.reject(loginError);
			} catch (e) {
				deferred.reject(new Error("Failed to obtain tokens"));
			}
		} else {
			body = JSON.parse(body);
			const accessTokenString = body["access_token"];
			const identityTokenString = body["id_token"];
			const refreshToken = body["refresh_token"];

			// Parse access_token
			var appIdAuthorizationContext = {
				refreshToken: refreshToken
			};

			Promise.all([
				TokenUtil.decodeAndValidate(accessTokenString),
				TokenUtil.decodeAndValidate(identityTokenString)]).then(function (tokens) {
				if (tokens.length < 2 || !tokens[0] || !tokens[1]) {
					throw new Error("Invalid access/id token");
				}

				if (!TokenUtil.validateIssAndAud(tokens[0], serviceConfig)) {
					throw new Error("Access token validation failed");
				}

				if (!TokenUtil.validateIssAndAud(tokens[1], serviceConfig)) {
					throw new Error("Id token validation failed");
				}
				appIdAuthorizationContext.accessToken = accessTokenString;
				appIdAuthorizationContext.accessTokenPayload = tokens[0];
				appIdAuthorizationContext.identityToken = identityTokenString;
				appIdAuthorizationContext.identityTokenPayload = tokens[1];
				logger.debug("authentication success");
				deferred.resolve(appIdAuthorizationContext);
			}).catch(function (error) {
				logger.debug("Authentication failed : " + error.message);
				deferred.reject(new Error("Authentication failed : " + error.message));
			});
		}
	});
	return deferred.promise;
}

function addLocaleToQuery(req, url, strategy) {
	const localeToUse = strategy.getPreferredLocale(req);
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

module.exports = WebAppStrategy;
