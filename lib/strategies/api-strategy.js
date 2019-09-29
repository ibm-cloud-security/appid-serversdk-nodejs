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

const ERROR = {
  INVALID_REQUEST: "invalid_request", // HTTP 400
  INVALID_TOKEN: "invalid_token", // HTTP 401
  INSUFFICIENT_SCOPE: "insufficient_scope" // HTTP 401
};

const AUTHORIZATION_HEADER = "Authorization";
const STRATEGY_NAME = "appid-api-strategy";
const BEARER = "Bearer";

const logger = log4js.getLogger(STRATEGY_NAME);

function buildWwwAuthenticateHeader(scope, error) {
  let msg = `${BEARER} scope="${scope}"`;
  if (error) {
    msg += `, error="${error}"`;
  }
  return msg;
}

function ApiStrategy(opts) {
  logger.debug("Initializing");
  const options = opts || {};
  this.name = ApiStrategy.STRATEGY_NAME;
  this.serviceConfig = new ServiceUtil.loadConfig('APIStrategy', [constants.OAUTH_SERVER_URL], options);
}

ApiStrategy.STRATEGY_NAME = STRATEGY_NAME;
ApiStrategy.DEFAULT_SCOPE = "appid_default";

/**
 * @param {Request} req Request object
 * @param {Object} [options] Options to use
 * @param {string} [options.scope] The required scopes, seperated by spaces. For example: 'read write update'
 * @param {string} [options.audience] The resource URI. If not provided, then options.scope need to be the full (prefixed) scopes.
 *
 * @returns {*} Any
 */
ApiStrategy.prototype.authenticate = function authenticate(req, options = {}) {
  const self = this;
  logger.debug("authenticate");
  if ((options.scope && typeof options.scope !== 'string') || (options.audience && typeof options.audience !== 'string')) {
    return self.fail(buildWwwAuthenticateHeader('Illegal Scope', ERROR.INVALID_REQUEST), 400);
  }
  let requiredScopes = ApiStrategy.DEFAULT_SCOPE;
  if (options.scope && options.scope.trim()) { // if the required scopes are just whitespace, skip.
    // if no audience is provided, we write the required scopes without adding prefixes
    // to send them with wwwAuthenticateHeader, and to be backward-compatible.
    const prefix = options.audience ? `${options.audience}/` : "";
    const scopesArray = options.scope.split(" ").filter((scope) => scope !== '');
    for (let i = 0; i < scopesArray.length; i++) {
      requiredScopes += ` ${prefix}${scopesArray[i]}`;
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
  const accessTokenString = authHeaderComponents[1];

  // Decode and validate access_token
  return TokenUtil.decodeAndValidate(accessTokenString, this.serviceConfig.getOAuthServerUrl()).then((accessToken) => {
    if (!accessToken) {
      logger.warn("Invalid access_token");
      return self.fail(buildWwwAuthenticateHeader(requiredScopes, ERROR.INVALID_TOKEN), 401);
    }
    // Validate token contains required scopes
    const requiredScopesArray = requiredScopes.split(" ").filter((scope) => scope !== "");
    const suppliedScopesArray = accessToken.scope.split(" ");
    for (let i = 0; i < requiredScopesArray.length; i++) {
      if (!suppliedScopesArray.includes(requiredScopesArray[i])) {
        logger.warn("access_token does not contain required scope. Expected ::", requiredScopes, " Received ::",
          accessToken.scope);
        return self.fail(buildWwwAuthenticateHeader(requiredScopes, ERROR.INSUFFICIENT_SCOPE), 401);
      }
    }
    req.appIdAuthorizationContext = {
      accessToken: accessTokenString,
      accessTokenPayload: accessToken
    };
    // Decode and validate id_token
    if (authHeaderComponents.length === 3) {
      const identityTokenString = authHeaderComponents[2];
      return TokenUtil.decodeAndValidate(identityTokenString, self.serviceConfig.getOAuthServerUrl()).then((identityToken) => {
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
    }
    logger.debug("authentication success: identity_token not found. Proceeding with access_token only");
    return self.success(null);
  }).catch(() => {
    logger.debug("authentication failed due to invalid access token");
    return self.fail(buildWwwAuthenticateHeader(requiredScopes, ERROR.INVALID_TOKEN), 401);
  });
  // .success(user, info) - call on auth success. user=object, info=object
  // .fail(challenge, status) - call on auth failure. challenge=string, status=int
  // .redirect(url, status) - call on redirect required. url=url, status=int
  // .pass() - skip strategy processing
  // .error(err) - error during strategy processing. err=Error obj
};

module.exports = ApiStrategy;
