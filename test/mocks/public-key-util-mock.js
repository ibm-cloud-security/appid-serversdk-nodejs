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

const pemFromModExp = require("rsa-pem-from-mod-exp");
const constants = require("./constants");
const Q = require("q");

module.exports = {
	retrievePublicKeys: function(){
        var deferred = Q.defer();
        deferred.resolve();
		return deferred.promise;
    },

    getPublicKeyPemByKid: function () {
        var deferred = Q.defer();
        deferred.resolve(pemFromModExp(constants.DEV_PUBLIC_KEYS[0].n, constants.DEV_PUBLIC_KEYS[0].e));
        return deferred.promise;
	}
}