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

const publicKeyUtil = require("./public-key-util");
const log4js = require("log4js");
const logger = log4js.getLogger("appid-token-util");
const constants = require("./constants");
const Q = require("q");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const request = require("request");

const TIMEOUT = 15 * 1000;
const APPID_ALLOW_EXPIRED_TOKENS = "APPID_ALLOW_EXPIRED_TOKENS";
const alg = "RS256";
const bytes = 20;

module.exports = (function () {
	logger.debug("Initializing");

	function decode(tokenString, getHeader) {
		var decodedToken = jwt.decode(tokenString, { complete: getHeader });
		return decodedToken;
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

	function getWellKnownIssuer(serviceConfig) {
		//get /oauth/v3/{tenantId}/.well-known/openid-configuration
		const wellKnownEndpoint = `${serviceConfig.getOAuthServerUrl()}/.well-known/openid-configuration`;

		return new Promise(function(resolve, reject) {
			logger.debug("Getting issuer from: ", wellKnownEndpoint);
			request({
				method: "GET",
				url: wellKnownEndpoint,
				json: true,
				timeout: TIMEOUT,
			}, function (error, response, body) {
				if (error || response.statusCode !== 200) {
					const errmsg = "Failed to get issuer from well known endpoint";
					logger.error(errmsg, error);
					reject(errmsg);
				} else if (body.issuer) {
					logger.debug("Got ISSUER from well known endpoint: " + body.issuer);
					resolve(body.issuer);
				} else {
					const errmsg = "Failed to get issuer from well known endpoint, missing issuer field.";
					logger.error(errmsg);
					reject(errmsg);
				}
			});
		});
	}

	function checkClaim(claim, token, expected) {
		logger.info(`token ${claim}: ${token[claim]}`);
		if (token[claim] !== expected) {
			logger.error(`Expected token ${claim} to be ${expected}`);
			return false
		}
		return true;
	}

	function validateIssAndAud(token, serviceConfig) {
		return new Promise(function (resolve, reject) {
			logger.debug("Validating Iss and Aud claims");
			// Validate Audiance.
			if (!checkClaim(constants.AUD, token, serviceConfig.getClientId())) {
				let err = new Error("Failed to validate Audicance claim.");
				logger.error(err);
				reject(err);
				return;
			}

			// If configuration was initialized with user provided issuer.
			if (serviceConfig.getIssuer()) {
				if (checkClaim(constants.ISS, token, serviceConfig.getIssuer())) {
					logger.debug("Succesfully validated Iss and Aud claims with user defined issuer");
					resolve(true);
				} else {
					let err = new Error("User defined issuer does not match token issuer.");
					logger.error(err);
					reject(err);
				}
				return;
			}

			// Validate token issuer against the AppId well-known open id configuration.
			if (validateIssAndAud.wellKnownIssuer) {
				if (checkClaim(constants.ISS, token, validateIssAndAud.wellKnownIssuer)) {
					logger.debug("Succesfully validated Iss and Aud claims with well known issuer.");
					resolve(true);
				} else {
					let err = new Error("Invalid issuer.");
					logger.error(err);
					reject(err);
				}
				return;
			}

			// If issuer was not yet retrieved from AppId /oauth/{version}/{tenantId}/.well-known/openid-configuration
			return getWellKnownIssuer(serviceConfig).then(issuer => {
				validateIssAndAud.wellKnownIssuer = issuer;
				if (checkClaim(constants.ISS, token, validateIssAndAud.wellKnownIssuer)) {
					logger.debug("Succesfully validated Iss and Aud claims using a well known issuer. ");
					resolve(true);
				} else {
					let err = new Error("Invalid issuer from well know endpoint:");
					logger.error(err);
					reject(err);
				}
			}).catch(error => {
				let err = new Error("Failed to validate issuer. " + error);
				logger.error(err);
				reject(err);
				return;
			});

		});
	}

	function getRandomNumber() {
		return crypto.randomBytes(bytes).toString('base64').replace(/\//g,'_').replace(/\+/g,'-');
	}

	return { decodeAndValidate, decode, validateIssAndAud, getRandomNumber };
}());
