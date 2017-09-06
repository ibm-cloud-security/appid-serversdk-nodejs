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

const log4js = require("log4js");
const logger = log4js.getLogger("appid-public-key-util");
const Q = require("q");
const request = require("request");
const pemFromModExp = require("rsa-pem-from-mod-exp");

const PUBLIC_KEYS_PATH = "/publickeys";
const TIMEOUT = 15 * 1000;

module.exports = (function(){
	logger.debug("Initializing");
	var publicKeysJson = null;
	var savedServerUrl = null;
	var tokensReqArray = new Array();

	function retrievePublicKeys(serverUrl){
        var deferred = Q.defer();
        tokensReqArray.push(deferred);
        if(tokensReqArray.length === 1) {
            savedServerUrl = serverUrl;
            serverUrl = serverUrl + PUBLIC_KEYS_PATH;
            logger.debug("Getting public key from", serverUrl);
            request({
                method: "GET",
                url: serverUrl,
                json: true,
                timeout: TIMEOUT
            }, function (error, response, body) {
                var p;
                if (error || response.statusCode !== 200) {
                    while (p = tokensReqArray.pop()) {
                        p.reject("Failed to retrieve public keys");
                    }
                    logger.error("Failed to retrieve public keys. All requests to protected endpoints will be rejected.");
                    return deferred.reject("Failed to retrieve public keys");
                } else {
                    publicKeysJson = body.keys;
                    logger.info("Public keys retrieved");
                    while (p = tokensReqArray.pop()) {
                        p.resolve();
                    }
                    return deferred.resolve();
                }
            });
        }
		return deferred.promise;
	}

	function getPublicKeyPemBykid(token_kid) {
        var deferred = Q.defer();
		if (token_kid) {
            var publicKey = getPublicKeyByKid(token_kid);
            if (!publicKey) { // if not found, refresh public keys array
                retrievePublicKeys(savedServerUrl).then(function () {
                    publicKey = getPublicKeyByKid(token_kid);
                    if (publicKey) {
                        deferred.resolve(pemFromModExp(publicKey.n, publicKey.e));
                    } else {
                        deferred.reject("Public key for kid: " + token_kid + " not found. All requests to protected endpoints will be rejected");
                    }
                }).catch(function(err){
                    deferred.reject(err);
                });
            } else {
                deferred.resolve(pemFromModExp(publicKey.n, publicKey.e));
            }
		} else {
            deferred.reject("Public key not found. All requests to protected endpoints will be rejected");
        }
        return deferred.promise;
	}

	function getPublicKeyByKid(token_kid) {
        if (publicKeysJson) {
            for (var i=0; i< publicKeysJson.length; i++) {
                if (publicKeysJson[i].kid === token_kid) {
                    return publicKeysJson[i];
                }
            }
        }
    }

	return {
		retrievePublicKeys: retrievePublicKeys,
        getPublicKeyPemBykid: getPublicKeyPemBykid
	};
}());