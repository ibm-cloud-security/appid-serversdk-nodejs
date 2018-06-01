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
const Q = require("q");
const jwt = require("jsonwebtoken");

const APPID_ALLOW_EXPIRED_TOKENS = "APPID_ALLOW_EXPIRED_TOKENS";
const alg = "RS256";

module.exports = (function(){
	logger.debug("Initializing");

	function decode(tokenString, getHeader){
		var decodedToken = jwt.decode(tokenString,{complete: getHeader});
		return decodedToken;
	}

	function decodeAndValidate(tokenString,serviceConfig) {
		var deferred = Q.defer();
		if(!serviceConfig || serviceConfig ===""){
			deferred.reject("Invalid service configuration");
			return deferred.promise;
		}

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
				var decodedToken = jwt.verify(tokenString, publicKeyPem, { algorithms: alg, ignoreExpiration: allowExpiredTokens, json: true});
				if (decodedToken.tenant !== serviceConfig.getTenantId()) {
					deferred.reject("JWT error, invalid tenantId");
				}else {
					deferred.resolve(decodedToken);
				}
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
		if (token.iss !== serviceConfig.getOAuthServerUrl().split("/")[2]) {
			return false;
		} else if (token.aud !== serviceConfig.getClientId()) {
			return false;
		}
		return true;
	}

	return {decodeAndValidate, decode, validateIssAndAud};
}());