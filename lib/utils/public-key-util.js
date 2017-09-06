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

var events = require("events");
var eventEmitter = new events.EventEmitter();

module.exports = (function () {
	logger.debug("Initializing");
	var publicKeysJson;
	var publicKeysEndpoint;
	var isUpdateRequestPending = false;
	
	function setPublicKeysEndpoint(serverUrl) {
		publicKeysEndpoint = serverUrl + PUBLIC_KEYS_PATH;
	}
	function getPublicKeysEndpoint() {
		return publicKeysEndpoint;
	}
	
	function updatePublicKeys(publicKeysEndpoint) {
		var deferred = Q.defer();
		logger.debug("Getting public key from", publicKeysEndpoint);
		request({
			method: "GET",
			url: publicKeysEndpoint,
			json: true,
			timeout: TIMEOUT
		}, function (error, response, body) {
			
			if (error || response.statusCode !== 200) {
				deferred.reject("Failed to retrieve public keys.  All requests to protected endpoints will be rejected.");
			} else {
				deferred.resolve(body.keys);
			}
		});
		return deferred.promise;
	}
	
	function getPublicKeyPemByKid(tokenKid) {
		var deferred = Q.defer();
		if (tokenKid) {
			var publicKey = getPublicKeyByKid(tokenKid);
			if (!publicKey) { // if not found, refresh public keys array
				eventEmitter.once("publicKeysUpdated", function() {
					var publicKey = getPublicKeyByKid(tokenKid);
					if (publicKey) {
						deferred.resolve(pemFromModExp(publicKey.n, publicKey.e));
					} else {
						deferred.reject("Public key not found for given token");
					}
				});
				
				if (!isUpdateRequestPending) {
					isUpdateRequestPending = true;
					updatePublicKeys(publicKeysEndpoint).then(function (keys) {
						publicKeysJson = keys;
						logger.info("Public keys updated");
						eventEmitter.emit("publicKeysUpdated");
						isUpdateRequestPending = false;
					}).catch(function (e) {
						logger.error(e);
						deferred.reject("updatePublicKeys error:" + e);
						eventEmitter.emit("publicKeysUpdated");
						isUpdateRequestPending = false;
					});
				}
				
			} else {
				deferred.resolve(pemFromModExp(publicKey.n, publicKey.e));
			}
		} else {
			deferred.reject("passed token does not have kid value.");
		}
		return deferred.promise;
	}
	
	function getPublicKeyByKid(tokenKid) {
		if (publicKeysJson) {
			for (var i = 0; i < publicKeysJson.length; i++) {
				if (publicKeysJson[i].kid === tokenKid) {
					return publicKeysJson[i];
				}
			}
		}
		return null;
	}
	
	return {
		setPublicKeysEndpoint: setPublicKeysEndpoint,
		getPublicKeysEndpoint: getPublicKeysEndpoint,
		getPublicKeyPemByKid: getPublicKeyPemByKid
	};
}());