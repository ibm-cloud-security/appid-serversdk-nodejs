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

	function validateIssAndAud(token, serviceConfig) {
		logger.debug('Validating Iss and Aud claims');
		const checkClaim = (claim, expected) => {
			logger.info(`token ${claim}: ${token[claim]}`);
			if (token[claim] !== expected) {
				logger.error(`Expected token ${claim} to be ${expected}`);
				return false
			}
			return true;
		};
		return checkClaim(constants.ISS, serviceConfig.getOAuthServerUrl().split("/")[2]) &&
			checkClaim(constants.AUD, serviceConfig.getClientId());
	}

	function getRandomNumber() {
		return crypto.randomBytes(bytes).toString('base64').replace(/\//g,'_').replace(/\+/g,'-');
	}

	return { decodeAndValidate, decode, validateIssAndAud, getRandomNumber };
}());
