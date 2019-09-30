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
const _ = require("underscore");
const UnauthorizedException = require("./unauthorized-exception");
const Utils = require("../utils/token-util");
const constants = require('../utils/constants');

const logger = log4js.getLogger("appid-user-manager");

const ATTRIBUTES_ENDPOINT = "/api/v1/attributes";
const USERINFO_ENDPOINT = "/userinfo";

const serviceUtils = require('../utils/service-util');

function handleRequest(accessToken, reqBody, method, url, action, deferred) {
  request({
    url,
    method,
    body: reqBody,
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  }, (err, response, body) => {
    if (err) {
      logger.error(err);
      return deferred.reject(new Error(`Failed to ${action}`));
    }
    if (response.statusCode === 401 || response.statusCode === 403) {
      return deferred.reject(new UnauthorizedException());
    }
    if (response.statusCode === 404) {
      return deferred.reject(new Error("Not found"));
    }
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return deferred.resolve(body ? JSON.parse(body) : null);
    }
    logger.error(err, response.headers);
    return deferred.reject(new Error("Unexpected error"));
  });
}

function UserProfileManager() {}

/**
 * Initialize user profile manager
 *
 * @param {Object} options The options object initializes the object with specific settings,
 * If you are uploading the application to IBM cloud, those credentials can be read from IBM
 * cloud and you can initialize this object without any options
 * @param {string} options.appidServiceEndpoint appid's service endpoint
 * @param {string} options.version appid's server version in a format if v3/v4
 * @param {string} options.tenantId your application tenantId
 * @param {string} options.oauthServerUrl appid's server url- needs to be provided if service endpoint isn't provided
 * @param {string} options.profilesUrl appid's user profile url - needs to be provided if service endpoint isn't provided
 *
 * @return {undefined}
 */
UserProfileManager.prototype.init = function init(options) {
  const opts = options || {};
  const vcapServices = JSON.parse(process.env[constants.VCAP_SERVICES] || "{}");
  let vcapServiceCredentials = {};

  // Find App ID service config
  const vals = Object.keys(vcapServices);
  for (let i = 0; i < vals.length; i++) {
    const propName = vals[i];
    // Checks if string starts with the service name
    if (propName.indexOf(constants.VCAP_SERVICES_SERVICE_NAME1) === 0 ||
      propName.indexOf(constants.VCAP_SERVICES_SERVICE_NAME2) === 0) {
      vcapServiceCredentials = vcapServices[propName][0][constants.VCAP_SERVICES_CREDENTIALS];
      break;
    }
  }
  try {
    const config = serviceUtils
      .loadConfig("user profile config", [constants.OAUTH_SERVER_URL, constants.USER_PROFILE_SERVER_URL], opts);
    this.userProfilesServerUrl = config.getUserProfile() || opts[constants.USER_PROFILE_SERVER_URL] ||
      vcapServiceCredentials[constants.USER_PROFILE_SERVER_URL];
    this.oauthServerUrl = config.getOAuthServerUrl() ||
      opts[constants.OAUTH_SERVER_URL] ||
      vcapServiceCredentials[constants.OAUTH_SERVER_URL];
  } catch (e) {
    logger.error("Failed to initialize user-manager.");
    logger.error("Ensure your node.js app is either bound to an App " +
      "ID service instance or pass required parameters to the constructor");
    logger.error(e);
    if (opts.throwIfFail) {
      throw e;
    }
  }
  logger.info(constants.USER_PROFILE_SERVER_URL, this.userProfilesServerUrl);
  logger.info(constants.OAUTH_SERVER_URL, this.oauthServerUrl);
};

UserProfileManager.prototype.setAttribute = function setAttribute(accessToken, attributeName, attributeValue) {
  const deferred = Q.defer();
  if (!_.isString(accessToken) || !_.isString(attributeName) || !_.isString(attributeValue)) {
    logger.error("setAttribute invalid invocation parameters");
    return Q.reject();
  }
  const profilesUrl = `${this.userProfilesServerUrl + ATTRIBUTES_ENDPOINT}/${attributeName}`;
  handleRequest(accessToken, attributeValue, "PUT", profilesUrl, "setAttribute", deferred);
  return deferred.promise;
};

UserProfileManager.prototype.getAttribute = function getAttribute(accessToken, attributeName) {
  const deferred = Q.defer();
  if (!_.isString(accessToken) || !_.isString(attributeName)) {
    logger.error("getAttribute invalid invocation parameters");
    return Q.reject();
  }
  logger.debug("Getting attribute ", attributeName);
  const profilesUrl = `${this.userProfilesServerUrl + ATTRIBUTES_ENDPOINT}/${attributeName}`;
  handleRequest(accessToken, null, "GET", profilesUrl, "getAttribute", deferred);
  return deferred.promise;
};

UserProfileManager.prototype.deleteAttribute = function deleteAttribute(accessToken, attributeName) {
  const deferred = Q.defer();
  if (!_.isString(accessToken) || !_.isString(attributeName)) {
    logger.error("deleteAttribute invalid invocation parameters");
    return Q.reject();
  }
  logger.debug("Deleting attribute", attributeName);
  const profilesUrl = `${this.userProfilesServerUrl + ATTRIBUTES_ENDPOINT}/${attributeName}`;
  handleRequest(accessToken, null, "DELETE", profilesUrl, "deleteAttribute", deferred);
  return deferred.promise;
};


UserProfileManager.prototype.getAllAttributes = function getAllAttributes(accessToken) {
  const deferred = Q.defer();
  if (!_.isString(accessToken)) {
    logger.error("getAllAttributes invalid invocation parameters");
    return Q.reject();
  }
  logger.debug("Getting all attributes");
  const profilesUrl = this.userProfilesServerUrl + ATTRIBUTES_ENDPOINT;
  handleRequest(accessToken, null, "GET", profilesUrl, "getAllAttributes", deferred);
  return deferred.promise;
};

/**
 * Retrieves user info using the provided accessToken
 *
 * @param {string} accessToken  - the accessToken string used for authorization
 * @param {string|undefined} identityToken  - an optional identity token. If provided, will be used to validate UserInfo response
 * @returns {Promise<JSON>} - the user info in json format
 */
UserProfileManager.prototype.getUserInfo = function getUserInfo(accessToken, identityToken) {
  const deferred = Q.defer();
  const internalDeferred = Q.defer();

  if (!_.isString(accessToken)) {
    logger.error("getUserinfo invalid invocation parameter");
    return Q.reject(new Error("Invalid invocation parameter type. Access token must be a string."));
  }

  logger.debug("Getting userinfo");

  const serverUrl = this.oauthServerUrl + USERINFO_ENDPOINT;
  handleRequest(accessToken, null, "GET", serverUrl, "getUserInfo", internalDeferred);

  internalDeferred.promise
    .then((userInfo) => {
      try {
        if (!(userInfo && userInfo.sub)) {
          throw new Error("Invalid user info response");
        }
        // If identity token is provided we must validate the subject matches the UserInfo response subject
        if (identityToken) {
          const payload = Utils.decode(identityToken);
          if (!payload) {
            throw new Error("Invalid Identity Token");
          }
          if (payload.sub && userInfo.sub !== payload.sub) {
            throw new Error("Possible token substitution attack. Rejecting request userInfoResponse.sub != identityToken.sub");
          }
        }
        return deferred.resolve(userInfo);
      } catch (e) {
        logger.error(`getUserInfo failed ${e.message}`);
        return deferred.reject(e);
      }
    })
    .catch(deferred.reject);

  return deferred.promise;
};

module.exports = new UserProfileManager();
