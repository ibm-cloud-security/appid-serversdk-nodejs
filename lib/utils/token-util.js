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

const request = require("request");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const Q = require("q");
const log4js = require("log4js");
const publicKeyUtil = require("./public-key-util");
const constants = require("./constants");

const logger = log4js.getLogger("appid-token-util");
const TIMEOUT = 15 * 1000;//15 seconds
const APPID_ALLOW_EXPIRED_TOKENS = "APPID_ALLOW_EXPIRED_TOKENS";
const alg = "RS256";
const bytes = 20;
/**
 *
 * @type {{decodeAndValidate, decode, validateIssAndAud, getRandomNumber}}
 */
module.exports = (function () {
  logger.debug("Initializing");
  
  function decode(tokenString, getHeader) {
	return jwt.decode(tokenString, {complete: getHeader});
  }
  
  function decodeAndValidate(tokenString, serverUrl) {
	var deferred = Q.defer();
	
	var allowExpiredTokens = process.env.APPID_ALLOW_EXPIRED_TOKENS || false;
	if (allowExpiredTokens) {
	  logger.warn(APPID_ALLOW_EXPIRED_TOKENS, "is enabled. Make sure to disable it in production environments.");
	}
	var token = decode(tokenString, true);
	var tokenHeader = token ? token.header : null;
	
	if (!tokenHeader) {
	  deferred.reject("JWT error, can not decode token");
	  return deferred.promise;
	}
	
	publicKeyUtil.getPublicKeyPemByKid(tokenHeader.kid, serverUrl).then(function (publicKeyPem) {
	  try {
		var decodedToken = jwt.verify(tokenString, publicKeyPem, {
		  algorithms: alg,
		  ignoreExpiration: allowExpiredTokens,
		  json: true
		});
		decodedToken.ver = tokenHeader.ver;
		deferred.resolve(decodedToken);
	  } catch (err) {
		logger.debug("JWT error ::", err.message);
		deferred.reject(err);
	  }
	}).catch(function (err) {
	  deferred.reject(err);
	});
	
	return deferred.promise;
  }
  
  
  /** getOauthServer
   @name getOAuthServerUrl
   @function
   @return {String} appid's server endpoint
   */
  /**
   * @async
   * return the issuer from the wellknown endpoint
   * @param {ServiceConfig} serviceConfig the server configuration
   * @param {getOAuthServerUrl} serviceConfig.getOAuthServerUrl returns the server url
   * @return {Promise<string>} the issuer as a string or an error if the issuer wasn't  found
   */
  function updateWellKnownIssuer(serviceConfig) {
	const wellKnownEndpoint = `${serviceConfig.getOAuthServerUrl()}/.well-known/openid-configuration`;
	
	//get /oauth/v3/{tenantId}/.well-known/openid-configuration
	
	
	return new Promise(function (resolve, reject) {
	  request({
		method: "GET",
		url: wellKnownEndpoint,
		json: true,
		timeout: TIMEOUT
	  }, function (error, response, body) {
		if (error || response.statusCode !== 200) {
		  const errmsg = "Failed to get issuer from well known endpoint";
		  logger.error(errmsg, error);
		  reject(errmsg);
		} else if (body.issuer) {
		  logger.debug("Got ISSUER from well known endpoint: " + body.issuer);
		  serviceConfig.setIssuer(body.issuer);
		  resolve(body.issuer);
		} else {
		  const errmsg = "Failed to get issuer from well known endpoint, missing issuer field.";
		  logger.error(errmsg);
		  reject(errmsg);
		}
	  });
	});
  }
  
  const issuerConversion = (issuer, tenantId, version) => {
	if (issuer.includes('bluemix.net')) {
	  const regionEnd = issuer.indexOf('.bluemix.net');
	  const regionStart = issuer.slice(0, regionEnd).lastIndexOf('.') + 1;
	  let region = issuer.slice(regionStart, regionEnd);
	  region = region.replace('ng', 'us-south'); // change only bluemix region w/different ibmcloud version
	  
	  const test = issuer.includes('stage1') ? 'test.' : '';
	  return `https://${region}.appid.${test}cloud.ibm.com/oauth/v${version}/${tenantId}`;
	}
	return issuer;
  };
  
  function getVersion(token) {
	logger.info(`token ${constants.VERSION}: ${token[constants.VERSION]}`);
	const version = token[constants.VERSION];
	if (version === undefined) {
	  logger.info(`token version is undefined, will treat token as v3`);
	  return 3;
	} else if (Number.isInteger(version)) {
	  logger.info(`token version is valid`);
	  return version;
	}
	throw new Error(`Invalid token version: ${token[constants.VERSION]}`);
  }
  
  function checkAud(token, clientId, version) {
	logger.info(`token ${constants.AUD}: ${token[constants.AUD]}`);
	if (version && version >= 4) {
	  if (!Array.isArray(token[constants.AUD])) {
		logger.error(`Expected post-v4 token ${constants.AUD} to be an array`);
		return false;
	  }
	  if (!token[constants.AUD].includes(clientId)) {
		logger.error(`Expected post-v4 token ${constants.AUD} to include ${clientId} in its array`);
		return false;
	  }
	} else if (token[constants.AUD] !== clientId) {
	  logger.error(`Expected pre-v4 token ${constants.AUD} to be ${clientId}`);
	  return false;
	}
	return true;
  }
  
  function checkIss(token, issuer, version) {
	const tokenIssuer = token[constants.ISS];
	let configIssuer = issuer;
	logger.info(`token ${constants.ISS}: ${tokenIssuer}`);
	
	if (version && version >= 4) {
	  const tenantId = token[constants.TENANT];
	  configIssuer = issuerConversion(issuer, tenantId, version);
	}
	
	if (tokenIssuer !== configIssuer) {
	  logger.error(`Expected token ${constants.ISS} to be ${configIssuer}`);
	  return false;
	}
	return true;
  }
	
	/**
	 * Checks if the "exp" field in the provided token is expired.
	 * @param tokenPayload: decoded access token Json.
	 * @returns {boolean}: true if expired, false if not expired.
	 */
  function isTokenExpired(tokenPayload) {
  	if (!tokenPayload || !tokenPayload[constants.EXP]) {
	    logger.error(`invalid access token payload: `, tokenPayload);
	    throw new Error('invalid token payload.');
  	}
  	if (Date.now() >= tokenPayload[constants.EXP] * 1000) {
  		logger.info('token expired.', tokenPayload);
  		return true;
  	}
  	return false;
  }
  
  /**
   *  @async
   * validates the issuer and audience of a token
   * @param {object} token the token that should ve validated
   * @param {ServiceConfig} serviceConfig the server configuration
   * @param {getOAuthServerUrl} serviceConfig.getOAuthServerUrl returns the server url
   * @return {Promise<boolean|error>} true if the issuer is valid, reject with an error if it doesn't
   */
  function validateIssAndAud(token, serviceConfig) {
	return Promise.resolve()
	  .then(() => {
		
		logger.debug("Validating Iss and Aud claims");
		
		const version = getVersion(token);
		
		const clientId = serviceConfig.getClientId();
		if (!checkAud(token, clientId, version)) {
		  throw new Error("Failed to validate audience claim.");
		}
		
		const issuer = serviceConfig.getIssuer();
		if (issuer) {
		  if (checkIss(token, issuer, version)) {
			logger.debug("Successfully validated Iss and Aud claims with user defined issuer");
			return true;
		  } else {
			throw new Error("User defined issuer does not match token issuer.");
		  }
		}
		
		// If issuer was not yet retrieved from AppId /oauth/{version}/{tenantId}/.well-known/openid-configuration
		return updateWellKnownIssuer(serviceConfig).then(retrievedIssuer => {
		  if (checkIss(token, retrievedIssuer, version)) {
			logger.debug("Successfully validated Iss and Aud claims with a well-known issuer");
			return true;
		  } else {
			throw new Error("Invalid issuer from well-known endpoint");
		  }
		});
	  });
  }
  
  function getRandomNumber() {
	return crypto.randomBytes(bytes).toString('base64').replace(/\//g, '_').replace(/\+/g, '-');
  }
  
  return {decodeAndValidate, decode, validateIssAndAud, getRandomNumber, isTokenExpired};
}());
