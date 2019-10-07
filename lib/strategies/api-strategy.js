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
const constants = require('../utils/constants');
const TokenUtil = require("../utils/token-util");
const ServiceUtil = require('../utils/service-util');
const PublicKeyUtil = require("../utils/public-key-util");

const ERROR = {
  INVALID_REQUEST: "invalid_request", // HTTP 400
  INVALID_TOKEN: "invalid_token", // HTTP 401
  INSUFFICIENT_SCOPE: "insufficient_scope" // HTTP 401
};

const AUTHORIZATION_HEADER = "Authorization";
const STRATEGY_NAME = "appid-api-strategy";
const BEARER = "Bearer";

const logger = log4js.getLogger(STRATEGY_NAME);

function ApiStrategy(options) {
  logger.debug("Initializing");
  options = options || {};
  this.name = ApiStrategy.STRATEGY_NAME;
  this.serviceConfig = new ServiceUtil.loadConfig('APIStrategy', [constants.OAUTH_SERVER_URL], options);
}

ApiStrategy.STRATEGY_NAME = STRATEGY_NAME;
ApiStrategy.DEFAULT_SCOPE = "appid_default";

/**
 *
 * @param req - an HTTP request object
 * @param options.scope - The required scopes, separated by spaces. For example: 'read write update'
 * @param options.audience - (optional) the application clientId, or the resource URI.
 * @returns {*}
 */
ApiStrategy.prototype.authenticate = function (req, options = {}) {
  var self = this;
  logger.debug("authenticate");
  
  if (options.scope && typeof options.scope !== 'string' || options.audience && typeof options.audience !== 'string') {
    return self.fail(buildWwwAuthenticateHeader('Illegal Scope', ERROR.INVALID_REQUEST), 400);
  }
  
  let requiredScopes = ApiStrategy.DEFAULT_SCOPE;
  if (options.scope && options.scope.trim()) { // if the required scopes are just whitespace, skip.
    // split by spaces and keep only non empty scopes. excluded default scope as it is always there
	const scopesArray = options.scope.split(" ").filter(scope => scope !== '' && scope !== ApiStrategy.DEFAULT_SCOPE);
    for (const requiredScope of scopesArray) {
	  requiredScopes += " " +  requiredScope;
	}
  }
  
  // Retrieve authorization header from request
  const authHeader = req.header(AUTHORIZATION_HEADER);
  if (!authHeader) {
	logger.warn("Authorization header not found");
	return self.fail(buildWwwAuthenticateHeader(requiredScopes, ERROR.INVALID_TOKEN), 401);
  }
  
  // Validate that first header component is Bearer
  const authHeaderComponents = authHeader.split(" ");
  if (authHeaderComponents[0].indexOf(BEARER) !== 0) {
	logger.warn("Malformed authorization header");
	return self.fail(buildWwwAuthenticateHeader(requiredScopes, ERROR.INVALID_TOKEN), 401);
  }
  
  // Validate header has exactly 2 or 3 components (Bearer, access_token, [id_token])
  if (authHeaderComponents.length !== 2 && authHeaderComponents.length !== 3) {
	logger.warn("Malformed authorization header");
	return self.fail(buildWwwAuthenticateHeader(requiredScopes, ERROR.INVALID_TOKEN), 401);
  }
  
  // Validate second header component is a valid access_token
  var accessTokenString = authHeaderComponents[1];
  
  // Decode and validate access_token
  TokenUtil.decodeAndValidate(accessTokenString, this.serviceConfig.getOAuthServerUrl()).then(function (accessToken) {
	if (!accessToken) {
	  logger.warn("Invalid access_token");
	  return self.fail(buildWwwAuthenticateHeader(requiredScopes, ERROR.INVALID_TOKEN), 401);
	}
	// Validate token contains required scopes
	const requiredScopesArray = requiredScopes.split(" ").filter(scope => scope !== "");
	const suppliedScopesArray = accessToken.scope.split(" ");
	for (const requiredScope of requiredScopesArray) {
	  if (!suppliedScopesArray.includes(requiredScope)) {
		logger.warn("access_token does not contain required scope. Expected ::", requiredScopes, " Received ::",
		  accessToken.scope);
		return self.fail(buildWwwAuthenticateHeader(requiredScopes, ERROR.INSUFFICIENT_SCOPE), 401);
	  }
	}

	// validate the audience section
	if (!accessToken.aud) {
		return self.fail(buildWwwAuthenticateHeader("access token missing audience section", ERROR.INVALID_TOKEN), 401);
	}
	if (!Array.isArray(accessToken.aud)) {
		return self.fail(buildWwwAuthenticateHeader("access token malformed audience array", ERROR.INVALID_TOKEN), 401);
	}
	if (options.audience && options.audience.trim()) {
		// audience is an array (currently we support only 1 item in the array)
		const requestAudience = options.audience.trim();
		const requiredList = requestAudience.split(' ');
		if (requiredList.length > 1) {
			return self.fail(buildWwwAuthenticateHeader("multiple audiences are not supported", ERROR.INVALID_REQUEST), 400);
		}
		const tokenAudience = accessToken.aud;
		if (!tokenAudience.includes(requestAudience)) {
			return self.fail(buildWwwAuthenticateHeader("audience mismatch. expected:" + tokenAudience +
			  " got:" + requestAudience, ERROR.INSUFFICIENT_SCOPE), 401);
		}
	}
	
	req.appIdAuthorizationContext = {
	  accessToken: accessTokenString,
	  accessTokenPayload: accessToken
	};
	
	// Decode and validate id_token
	var identityTokenString;
	var identityToken;
	if (authHeaderComponents.length === 3) {
	  identityTokenString = authHeaderComponents[2];
	  TokenUtil.decodeAndValidate(identityTokenString, self.serviceConfig.getOAuthServerUrl()).then(function (identityToken) {
		if (identityToken) {
		  req.appIdAuthorizationContext.identityToken = identityTokenString;
		  req.appIdAuthorizationContext.identityTokenPayload = identityToken;
		} else {
		  logger.warn("Invalid identity_token. Proceeding with access_token only");
		}
		logger.debug("authentication success");
		return self.success(identityToken || null);
	  }).catch(() => {
		logger.debug("authentication failed due to invalid identity token");
		return self.fail(buildWwwAuthenticateHeader(requiredScopes, ERROR.INVALID_TOKEN), 401);
	  });
	} else {
	  logger.debug("authentication success: identity_token not found. Proceeding with access_token only");
	  return self.success(identityToken || null);
	}
  }).catch(function () {
	logger.debug("authentication failed due to invalid access token");
	return self.fail(buildWwwAuthenticateHeader(requiredScopes, ERROR.INVALID_TOKEN), 401);
  });
  
  // .success(user, info) - call on auth success. user=object, info=object
  // .fail(challenge, status) - call on auth failure. challenge=string, status=int
  // .redirect(url, status) - call on redirect required. url=url, status=int
  // .pass() - skip strategy processing
  // .error(err) - error during strategy processing. err=Error obj
};

function buildWwwAuthenticateHeader(scope, error) {
  var msg = BEARER + " scope=\"" + scope + "\"";
  if (error) {
	msg += ", error=\"" + error + "\"";
  }
  return msg;
}

module.exports = ApiStrategy;
