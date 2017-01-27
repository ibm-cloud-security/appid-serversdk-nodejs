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

const publicKeyUtil = require("./publicKeyUtil");
const log4js = require('log4js');
const logger = log4js.getLogger("tokenUtils");
const Q = require('q');
const jwt = require("jsonwebtoken");
const cache = require("node-cache");

module.exports = (function(){
	logger.debug("Initializing");

	function decodeAndValidate(tokenString){
		var deferred = Q.defer();
		publicKeyUtil.getPublicKeyPem().then(function(publicKeyPem){
			try {
				logger.warn("WARNING!!! DISABLE IGNORE EXPIRATION!!!");
				var decodedToken = jwt.verify(tokenString, publicKeyPem, {
					algorithms: ["RS256"],
					ignoreExpiration: true
				});
				return deferred.resolve(decodedToken);
			} catch (err){
				logger.error(err.message);
				return deferred.reject(err.message);
			}
		});
		return deferred.promise;
	}

	return {
		decodeAndValidate: decodeAndValidate
	}
}());