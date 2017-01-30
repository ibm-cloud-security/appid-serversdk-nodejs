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

const publicKeyUtil = require("./publicKeyUtils");
const log4js = require('log4js');
const logger = log4js.getLogger("tokenUtils");
const Q = require('q');
const jwt = require("jsonwebtoken");

const APPID_ALLOW_EXPIRED_TOKENS = "APPID_ALLOW_EXPIRED_TOKENS";

module.exports = (function(){
	logger.debug("Initializing");
	var allowExpiredTokens = process.env.APPID_ALLOW_EXPIRED_TOKENS || false;
	if (allowExpiredTokens){
		logger.warn(APPID_ALLOW_EXPIRED_TOKENS, "is enabled. Make sure to disable it in production environments.");
	}

	function decodeAndValidate(tokenString){
		var publicKeyPem = publicKeyUtil.getPublicKeyPem();
		try {
			var decodedToken = jwt.verify(tokenString, publicKeyPem, {
				algorithms: ["RS256"],
				ignoreExpiration: allowExpiredTokens,
				json: true
			});
			return decodedToken;
		} catch (err){
			logger.debug("JWT error ::", err.message);
		}
	}

	function decode(tokenString){
		try {
			var decodedToken = jwt.decode(tokenString, {
				json: true
			});
			return decodedToken;
		} catch (err){
			logger.debug("JWT error ::", err.message);
		}
	}

	return {
		decodeAndValidate: decodeAndValidate,
		decode: decode
	}
}());