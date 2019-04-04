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

const TIMEOUT = 15 * 1000;

var events = require("events");
var eventEmitter = new events.EventEmitter();

module.exports = (function () {
	logger.debug("Initializing");
	let publicKeysJson = {};
	let isUpdateRequestPending = {};


  function getPublicKeyByKid(tokenKid, localPublicKeysEndpoint) {
	logger.debug("GetPublicKeyByKID endpoint", localPublicKeysEndpoint);
	if (publicKeysJson[localPublicKeysEndpoint]) {
	  var singlePublicKeysJson = publicKeysJson[localPublicKeysEndpoint];
	  for (var i = 0; i < singlePublicKeysJson.length; i++) {
		if (singlePublicKeysJson[i].kid === tokenKid) {
		  return singlePublicKeysJson[i];
		}
	  }
	}
	return null;
  }

	function _updatePublicKeys(publicKeysUrl) {
		let deferred = Q.defer();
		logger.debug("Getting public key from", publicKeysUrl);
		request({
			method: "GET",
			url: publicKeysUrl,
			json: true,
			timeout: TIMEOUT,
			headers: {"x-filter-type": "nodejs"}
		}, function (error, response, body) {
			
			if (error || response.statusCode !== 200) {
				if (typeof publicKeysJson[publicKeysUrl] === 'undefined') {
					deferred.reject("Failed to retrieve public keys.  All requests to protected endpoints will be rejected.");
				} else {
					deferred.reject("Failed to update public keys.");
				}
			} else {
				deferred.resolve(body.keys);
			}
		});
		return deferred.promise;
	}
	
	function getPublicKeyPemByKid(tokenKid, serverUrl) {
		let deferred = Q.defer();

		let localPublicKeysEndpoint = serverUrl + '/publickeys';
		let emitterEventName = "publicKeysUpdated" + localPublicKeysEndpoint; //needs to be unique
		if (tokenKid) {
			let publicKey = getPublicKeyByKid(tokenKid, localPublicKeysEndpoint);
			if (!publicKey) { // if not found, refresh public keys array
				eventEmitter.once(emitterEventName, function(error) {
					let publicKeys = getPublicKeyByKid(tokenKid, localPublicKeysEndpoint);
					if (publicKeys) {
						deferred.resolve(pemFromModExp(publicKeys.n, publicKeys.e));
					} else {
						if(!error) {
							deferred.reject("Public key not found for given token kid");
						} else {
							deferred.reject(error);
						}
					}
				});
				if (!isUpdateRequestPending[localPublicKeysEndpoint]) {
					isUpdateRequestPending[localPublicKeysEndpoint] = true;
					_updatePublicKeys(localPublicKeysEndpoint).then(function (keys) {
						publicKeysJson[localPublicKeysEndpoint] = keys;
						logger.info("Public keys updated");
						isUpdateRequestPending[localPublicKeysEndpoint] = false;
						eventEmitter.emit(emitterEventName, null, localPublicKeysEndpoint);
					}).catch(function (e) {
						let error = "updatePublicKeys error: " + e;
						logger.error(error);
						isUpdateRequestPending[localPublicKeysEndpoint] = false;
						eventEmitter.emit(emitterEventName, error, localPublicKeysEndpoint);
					});
				}
			} else {
				deferred.resolve(pemFromModExp(publicKey.n, publicKey.e));
			}
		} else {
			deferred.reject("Passed token does not have kid value.");
		}
		return deferred.promise;
	}
	
	return {
		getPublicKeyPemByKid
	};
}());