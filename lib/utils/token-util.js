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
 * @type {{decodeAndValidate, decode, validateIssAzpAud, getRandomNumber}}
 */
module.exports = (function () {
	logger.debug("Initializing");

	function decode(tokenString, getHeader) {
		return jwt.decode(tokenString, {complete: getHeader});
	}

	function decodeAndValidate(tokenString) {
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

		publicKeyUtil.getPublicKeyPemByKid(tokenHeader.kid).then(function (publicKeyPem) {
			try {
				var decodedToken = jwt.verify(tokenString, publicKeyPem, {
					algorithms: alg,
					ignoreExpiration: allowExpiredTokens,
					json: true
				});
				decodedToken.version = tokenHeader.version;
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

    const issuerConversion = (originalIssuer, tenantId, version) => {
        if (originalIssuer.includes("bluemix.net")) {

            // Example: Convert "https://appid-oauth.stage1.ng.bluemix.net" into
            // "https://us-south.appid.test.cloud.ibm.com/oauth/v4/${tenantId}"
            let issuer = originalIssuer;
            issuer = issuer.replace("bluemix.net", "cloud.ibm.com"); // "https://appid-oauth.stage1.ng.cloud.ibm.com"
            issuer = issuer.replace("stage1", "test"); // "https://appid-oauth.test.ng.cloud.ibm.com"
            issuer = issuer.replace("ng", "us-south"); // "https://appid-oauth.test.us-south.cloud.ibm.com"

            const regionEnd = issuer.indexOf(".cloud.ibm.com");
            const regionStart = issuer.slice(0, regionEnd).lastIndexOf(".") + 1;
            const region = issuer.slice(regionStart, regionEnd);

            issuer = issuer.replace(`.${region}`, ""); // "https://appid-oauth.test.cloud.ibm.com"
            issuer = issuer.replace("appid-oauth", `${region}.appid`); // "https://us-south.appid.test.cloud.ibm.com"
            return `${issuer}/oauth/v${version}/${tenantId}`;
        }
        return originalIssuer;
    };

	function checkVersion(token) {
		logger.info(`token ${constants.APPID_SERVICE_VERSION}: ${token[constants.APPID_SERVICE_VERSION]}`);
		const version = token[constants.APPID_SERVICE_VERSION];
		if (version === undefined) {
			logger.info(`version is not included in token`);
			return null;
		} else if (Number.isInteger(version)) {
			logger.info(`token version is included valid`);
			return version;
		}
		return false;
	}

	function checkAud(token, clientId, version) {
		logger.info(`token ${constants.AUD}: ${token[constants.AUD]}`);
		if (version && version > 3) {
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

	function checkAzp(token, clientId) {
		logger.info(`token ${constants.AZP}: ${token[constants.AZP]}`);
		if (token[constants.AZP] !== clientId) {
			logger.error(`Expected post-v4 token ${constants.AZP} to be ${clientId}`);
			return false;
		}
		return true;
	}

	function checkIss(token, issuer, version) {
		const tokenIssuer = token[constants.ISS];
		let configIssuer = issuer;
		logger.info(`token ${constants.ISS}: ${tokenIssuer}`);

		if (version && version > 3) {
			if (issuer.slice(0, 8) !== "https://") {
				logger.error(`Expected token ${constants.ISS} to have the https protocol`);
				return false;
			}

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
	 *  @async
	 * validates the issuer and audience of a token
	 * @param {object} token the token that should ve validated
	 * @param {ServiceConfig} serviceConfig the server configuration
	 * @param {getOAuthServerUrl} serviceConfig.getOAuthServerUrl returns the server url
	 * @return {Promise<boolean|error>} true if the issuer is valid, reject with an error if it doesn't
	 */
	function validateIssAzpAud(token, serviceConfig) {
		return Promise.resolve()
			.then(()=> {

				logger.debug("Validating Iss, Azp, Aud claims");

				const version = checkVersion(token);
				if (version === false) {
					throw new Error(`Invalid token version: ${token[constants.APPID_SERVICE_VERSION]}`);
				}

				const clientId = serviceConfig.getClientId();
				if (!checkAud(token, clientId, version)) {
					throw new Error("Failed to validate audience claim.");
				}

				if (version && version >= 4 && !checkAzp(token, clientId)) {
					throw new Error("User defined clientId does not match token azp.");
				}

				const issuer = serviceConfig.getIssuer();
				if (issuer) {
					if (checkIss(token, issuer, version)) {
						logger.debug("Successfully validated Iss, Azp, Aud claims with user defined issuer");
						return true;
					} else {
						throw new Error("User defined issuer does not match token issuer.");
					}
				}

				// If issuer was not yet retrieved from AppId /oauth/{version}/{tenantId}/.well-known/openid-configuration
				return updateWellKnownIssuer(serviceConfig).then(retrievedIssuer => {
					if (checkIss(token, retrievedIssuer)) {
						logger.debug("Successfully validated Iss and Aud claims using a well known issuer. ");
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

	return {decodeAndValidate, decode, validateIssAzpAud, getRandomNumber};
}());
