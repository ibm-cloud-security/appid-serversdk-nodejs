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

const log4js = require("log4js");
const request = require("request");
const Q = require("q");
const TokenUtil = require("./../utils/token-util");
const ServiceConfig = require("./webapp-strategy-config");

const STRATEGY_NAME = "appid-webapp-strategy";
const logger = log4js.getLogger(STRATEGY_NAME);

function WebAppStrategy(options) {
	logger.debug("Initializing");
	options = options || {};
	this.name = WebAppStrategy.STRATEGY_NAME;
	this.serviceConfig = new ServiceConfig(options);
}

WebAppStrategy.STRATEGY_NAME = STRATEGY_NAME;
WebAppStrategy.DEFAULT_SCOPE = "appid_default";
WebAppStrategy.ORIGINAL_URL = "APPID_ORIGINAL_URL";
WebAppStrategy.AUTH_CONTEXT = "APPID_AUTH_CONTEXT";

const AUTHORIZATION_PATH = "/authorization";
const TOKEN_PATH = "/token";

WebAppStrategy.ensureAuthenticated = function(loginUrl){
	return function(req, res, next){
		if (req.isAuthenticated()){
			return next();
		} else {
			req.session[WebAppStrategy.ORIGINAL_URL] = req.url;
			res.redirect(loginUrl || "/");
		}
	}
}

WebAppStrategy.logout = function(req){
	delete req.session[WebAppStrategy.ORIGINAL_URL];
	delete req.session[WebAppStrategy.AUTH_CONTEXT];
	req.logout();
}

// .success(user, info) - call on auth success. user=object, info=object
// .fail(challenge, status) - call on auth failure. challenge=string, status=int
// .redirect(url, status) - call on redirect required. url=url, status=int
// .pass() - skip strategy processing
// .error(err) - error during strategy processing. err=Error obj

WebAppStrategy.prototype.authenticate = function(req, options) {
	options = options || {};

	// Check that express-session is enabled
	if (!req.session){
		logger.error("Can't find req.session. Ensure express-session middleware is in use");
		return this.error(new Error("Can't find req.session"));
	}

	if (req.query && req.query.error){
		// Handle possible errors returned in callback
		logger.warn("Error returned in callback ::", req.query.error);
		return this.fail();
	} else if (req.query && req.query.code){
		// Handle grant code in callback
		return handleCallback(req, options, this);
	} else {
		// Handle authorization request
		return handleAuthorization(req, options, this);
	}
};

function handleAuthorization(req, options, strategy){
	logger.debug("handleAuthorization");
	options = options || {};
	options.allowCreateNewAnonymousUser = options.hasOwnProperty("allowCreateNewAnonymousUser") ? options.allowCreateNewAnonymousUser : true;
	options.failureRedirect = options.failureRedirect || "/";
	var authUrl = generateAuthorizationUrl(options, strategy);

	// If there's an existing anonymous access token on session - add it to the request url
	const appIdAuthContext = req.session[WebAppStrategy.AUTH_CONTEXT];
	if (appIdAuthContext && appIdAuthContext.accessTokenPayload["amr"][0] === "appid_anon"){
		logger.debug("handleAuthorization :: added anonymous access_token to url");
		authUrl += "&appid_access_token=" + appIdAuthContext.accessToken;
	}

	// If previous anonymous access token not found and new anonymous users are not allowed - fail
	if (!appIdAuthContext && options.allowAnonymousLogin === true && options.allowCreateNewAnonymousUser !== true){
		logger.info("Previous anonymous user not found. Not allowed to create new anonymous users.");
		strategy.fail(new Error("Not allowed to create new anonymous users."));
		return;
	}

	logger.debug("handleAuthorization :: redirecting to", authUrl);
	strategy.redirect(authUrl);
}


function handleCallback(req, options, strategy) {
	logger.debug("handleCallback");
	options = options || {};
	options.failureRedirect = options.failureRedirect || "/";
	const code = req.query.code;
	retrieveTokens(options, strategy, code).then(function(appIdAuthContext){
		// Save authorization context to HTTP session
		req.session[WebAppStrategy.AUTH_CONTEXT] = appIdAuthContext;

		// Find correct successRedirect
		if (options.successRedirect) {
			options.successRedirect = options.successRedirect;
		} else if (req.session && req.session[WebAppStrategy.ORIGINAL_URL]) {
			options.successRedirect = req.session[WebAppStrategy.ORIGINAL_URL];
		} else {
			options.successRedirect = "/";
		}

		logger.debug("completeAuthorizationFlow :: success");
		strategy.success(TokenUtil.decode(appIdAuthContext.identityToken) || null);
	}).catch(strategy.fail);
}


function generateAuthorizationUrl(options, strategy){
	const serviceConfig = strategy.serviceConfig;
	const clientId = serviceConfig.getClientId();
	const scope = WebAppStrategy.DEFAULT_SCOPE + (options.scope ? " " + options.scope : "");
	const authorizationEndpoint = serviceConfig.getOAuthServerUrl() + AUTHORIZATION_PATH;
	const redirectUri = serviceConfig.getRedirectUri();
	var authUrl = encodeURI(authorizationEndpoint +
		"?client_id=" + clientId +
		"&response_type=code" +
		"&redirect_uri=" + redirectUri +
		"&scope=" + scope);

	if (options.allowAnonymousLogin === true){
		authUrl += "&idp=appid_anon";
	}

	return authUrl;
}

function retrieveTokens(options, strategy, grantCode){
	logger.debug("retrieveTokens");
	var deferred = Q.defer();
	options = options || {};
	const serviceConfig = strategy.serviceConfig;

	const clientId = serviceConfig.getClientId();
	const secret = serviceConfig.getSecret();
	const tokenEndpoint = serviceConfig.getOAuthServerUrl() + TOKEN_PATH;
	const redirectUri = serviceConfig.getRedirectUri();

	request({
		method: "POST",
		url: tokenEndpoint,
		auth: {
			username: clientId,
			password: secret
		},
		formData: {
			"client_id": clientId,
			"grant_type": "authorization_code",
			"redirect_uri": redirectUri,
			"code": grantCode
		}
	}, function (err, response, body) {
		if (err || response.statusCode !== 200){
			logger.error("Failed to obtain tokens ::", err, response.statusCode, body);
			deferred.reject(new Error("Failed to obtain tokens"));
		} else {
			body = JSON.parse(body);
			const accessTokenString = body["access_token"];
			const identityTokenString = body["id_token"];

			// Parse access_token
			var appIdAuthorizationContext = {
				accessToken: accessTokenString,
				accessTokenPayload: TokenUtil.decode(accessTokenString)
			};

			// Parse id_token
			if (identityTokenString) {
				appIdAuthorizationContext.identityToken = identityTokenString;
				appIdAuthorizationContext.identityTokenPayload = TokenUtil.decode(identityTokenString);
			}
			logger.debug("retrieveTokens :: tokens retrieved");

			deferred.resolve(appIdAuthorizationContext);
		}
	});

	return deferred.promise;
}

module.exports = WebAppStrategy;
