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

module.exports = (function(){
	logger.debug("Initializing");

	function decodeAndValidate(tokenString) {
        var deferred = Q.defer();
        var allowExpiredTokens = process.env.APPID_ALLOW_EXPIRED_TOKENS || false;
        if (allowExpiredTokens) {
            logger.warn(APPID_ALLOW_EXPIRED_TOKENS, "is enabled. Make sure to disable it in production environments.");
        }
        var accessToken = decode(tokenString, true);
        var accessTokenHeader = accessToken ? accessToken.header : null;
        if (!accessTokenHeader) {
            deferred.reject('JWT error, can not decode token');
        } else {
            publicKeyUtil.getPublicKeyPemByKid(accessTokenHeader.kid).then(function (publicKeyPem) {
                try {
                    var decodedToken = jwt.verify(tokenString, publicKeyPem, {
                        algorithms: ["RS256"],
                        ignoreExpiration: allowExpiredTokens,
                        json: true
                    });
                    return deferred.resolve(decodedToken);
                } catch (err) {
                    logger.debug("JWT error ::", err.message);
                    deferred.reject(err);
                }
            }).catch(function (err) {
                deferred.reject(err);
            });
        }
        return deferred.promise;
    }

	function decode(tokenString, getHeader){
		var decodedToken = jwt.decode(tokenString, {
            complete: getHeader
		});
		return decodedToken;
	}

	function getSubjectFromToken(token) {
		let parts = token.split('.');
		if (parts.length !== 3) {
			throw new Error("Malformed Token");
		}
		let payload64 = parts[1];
		let payload = Buffer.from(payload64, "base64");
		let json = JSON.parse(payload);
		return json.sub
	}

	return {
		getSubjectFromToken: getSubjectFromToken,
		decodeAndValidate: decodeAndValidate,
		decode: decode
	};
}());
