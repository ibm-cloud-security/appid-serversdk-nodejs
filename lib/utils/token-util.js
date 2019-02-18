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

	function checkClaim(claim, token, expected) {

        console.log(token[claim]);
        console.log(expected);

		logger.info(`token ${claim}: ${token[claim]}`);
		if (token[claim] !== expected) {
			logger.error(`Expected token ${claim} to be ${expected}`);
			return false;
		}
		return true;
	}

    function checkAud(token, clientId) {
        logger.info(`token ${constants.AUD}: ${token[constants.AUD]}`);
        if (token[constants.AUD] !== clientId && Array.isArray(token[constants.AUD]) && !token[constants.AUD].includes(clientId)) {
            logger.error(`Expected token ${constants.AUD} to be ${clientId} or ["${clientId}"]`);
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
	function validateIssAndAud(token, serviceConfig) {
		return Promise.resolve()
			.then(()=>{

				logger.debug("Validating Iss and Aud claims");

				if (!checkAud(token, serviceConfig.getClientId())) {
					throw new Error("Failed to validate audience claim.");
				}

				console.log("GetIssuer");
                console.log(serviceConfig.getIssuer());

				// If configuration was initialized with user provided issuer.
                serviceConfig.getIssuer()
					.then(issuer => {
                        if (checkClaim(constants.ISS, token, issuer)) {
                            logger.debug("Succesfully validated Iss and Aud claims with user defined issuer");
                            return true;
                        } else {
                            throw new Error("User defined issuer does not match token issuer.");
                        }
					}).catch(err => {
                    	throw new Error("Unable to retrieve issuer");
					});
			});

	}

	function getRandomNumber() {
		return crypto.randomBytes(bytes).toString('base64').replace(/\//g, '_').replace(/\+/g, '-');
	}

	return {decodeAndValidate, decode, validateIssAndAud, getRandomNumber};
}());
