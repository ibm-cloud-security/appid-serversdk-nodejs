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

const log4js = require('log4js');
const logger = log4js.getLogger("publicKeyUtil");
const Q = require('q');
const request = require('request');
const pemFromModExp = require('rsa-pem-from-mod-exp');

const PUBLIC_KEY_PATH = "/imf-authserver/authorization/v1/apps/{tenantId}/publickey";
const TIMEOUT = 30 * 1000;

module.exports = (function(){
	logger.debug("Initializing");
	var tenantId = process.env.tenantId;
	var serverUrl = (process.env.serverUrl + PUBLIC_KEY_PATH).replace("{tenantId}", tenantId);
	var publicKeyJson;
	logger.debug("Public key URL", serverUrl);

	function retrievePublicKey(){
		var deferred = Q.defer();
		request({
			method: "GET",
			url: serverUrl,
			json: true,
			timeout: TIMEOUT
		}, function (error, response, body){
			if (error || response.statusCode != 200){
				logger.error("Failed to retrieve public key");
				return deferred.reject("Failed to retrieve public key");
			} else {
				publicKeyJson = body;
				return deferred.resolve();
			}
		});
		return deferred.promise;
	}

	function getPublicKeyJson(){
		if (publicKeyJson){
			return Q.resolve(publicKeyJson);
		} else {
			var deferred = Q.defer();
			retrievePublicKey().then(function(){
				return deferred.resolve(publicKeyJson);
			}).catch(function(error){
				return deferred.reject(error);
			});

			return deferred.promise;
		}
	}

	function getPublicKeyPem(){

		if (publicKeyJson){
			return Q.resolve(pemFromModExp(publicKeyJson.n, publicKeyJson.e));
		} else {
			var deferred = Q.defer();
			retrievePublicKey().then(function(){
				return deferred.resolve(pemFromModExp(publicKeyJson.n, publicKeyJson.e));
			}).catch(function(error){
				return deferred.reject(error);
			});

			return deferred.promise;
		}

	}

	return {
		retrievePublicKey: retrievePublicKey,
		getPublicKeyJson: getPublicKeyJson,
		getPublicKeyPem: getPublicKeyPem
	}
}());