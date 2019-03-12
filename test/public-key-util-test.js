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

const chai = require("chai");
const assert = chai.assert;
const proxyquire = require("proxyquire");
const testServerUrl = "https://mobileclientaccess.test.url/imf-authserver";
var requestCounter = 0;
var seqRequestCounter = 0;
const Q = require("q");

describe("/lib/utils/public-key-util", function () {
	console.log("Loading public-key-util-test.js");
	
	var PublicKeyUtil;
	
	before(function () {
		PublicKeyUtil = proxyquire("../lib/utils/public-key-util", {
			"request": requestMock
		});
	});
	
	this.timeout(5000);
	
	describe("setPublicKeysEndpoint", function () {
		it("Should set server public key endpoint", function (done) {
			PublicKeyUtil.setPublicKeysEndpoint(testServerUrl);
			try {
				assert.equal(testServerUrl + "/publickeys", PublicKeyUtil.getPublicKeysEndpoint());
				done();
			} catch (e) {
				done(e);
			}
		});
	});
	
	describe("getPublicKeyPemByKid", function () {
		
		it("public key dont have kid value", function (done) {
			var kid;
			PublicKeyUtil.getPublicKeyPemByKid(kid).then(function (publicKey) {
				done("should get to catch");
			}).catch(function (err) {
				assert.equal(err, "Passed token does not have kid value.");
				done();
			})
		});
		
		it("request to public keys endpoint failure", function (done) {
			PublicKeyUtil.setPublicKeysEndpoint(testServerUrl + "FAIL-PUBLIC-KEYs");
			var kid = "not_found_kid";
			PublicKeyUtil.getPublicKeyPemByKid(kid).then(function (publicKey) {
				done("should get reject");
			}).catch(function (err) {
				try {
					assert.equal(err, "updatePublicKeys error: Failed to retrieve public keys.  All requests to protected endpoints will be rejected.");
					done();
				} catch(e) {
					done(e);
				}
			});
		});
		
		it("request to public keys endpoint update failure", function (done) {
			PublicKeyUtil.setPublicKeysEndpoint(testServerUrl + "SUCCESS-PUBLIC-KEYs");
			var kid = "123";
			PublicKeyUtil.getPublicKeyPemByKid(kid).then(function () {
				PublicKeyUtil.setPublicKeysEndpoint(testServerUrl + "FAIL-PUBLIC-KEYs");
				kid = "not_found_kid";
				PublicKeyUtil.getPublicKeyPemByKid(kid).then(function () {
					done("should get reject");
				}).catch(function (err) {
					try {
						//assert.equal(err, "updatePublicKeys error: Failed to update public keys.");
                                                // different endpoint means there are no keys to update
					        assert.equal(err, "updatePublicKeys error: Failed to retrieve public keys.  All requests to protected endpoints will be rejected.");
						done();
					} catch(e) {
						done(e);
					}
				});
			}).catch(function (err) {
				done(err);
			});
		});
		
		it("two sequential request to public keys endpoint", function (done) {
			var PublicKeyUtilNew = proxyquire("../lib/utils/public-key-util", {
				"request": requestMock
			});
			PublicKeyUtilNew.setPublicKeysEndpoint(testServerUrl + "SEQUENTIAL-REQUEST-PUBLIC-KEYs");
			var kid = "123";
			PublicKeyUtilNew.getPublicKeyPemByKid(kid).then(function () {
				PublicKeyUtilNew.getPublicKeyPemByKid(kid).then(function () {
					assert.equal(1, seqRequestCounter, "more then one request triggered");
					done();
				}).catch(function (err) {
					done(err);
				});
			}).catch(function (err) {
				done(err);
			});
		});
		
		it("Should successfully retrieve public key from OAuth server", function (done) {
			PublicKeyUtil.setPublicKeysEndpoint(testServerUrl + "SUCCESS-PUBLIC-KEYs");
			var kid = "123";
			PublicKeyUtil.getPublicKeyPemByKid(kid).then(function (publicKey) {
				try {
					assert.isNotNull(publicKey);
					assert.isString(publicKey);
					assert.include(publicKey, "BEGIN RSA PUBLIC KEY");
					done();
				} catch (e) {
					done(e);
				}
			}).catch(function (err) {
				done(err);
			});
		});
	});
	
	describe("getPublicKeyPemMultipleRequests", function () {
		it("Should get public keys from multiple requests", function (done) {
			var PublicKeyUtilNew = proxyquire("../lib/utils/public-key-util", {
				"request": requestMock
			});
			PublicKeyUtilNew.setPublicKeysEndpoint(testServerUrl + "SETTIMEOUT-PUBLIC-KEYs");
			var requestArray = [];
			for (var i = 0; i < 5; i++) {
				requestArray.push(PublicKeyUtilNew.getPublicKeyPemByKid("123"));
			}
			Q.all(requestArray).then(function (publicKeysArray) {
				try {
					assert.equal(1, requestCounter, "more then one request triggered");
					for (var j = 0; j < 5; j++) {
						assert.isNotNull(publicKeysArray[j]);
						assert.isString(publicKeysArray[j]);
						assert.include(publicKeysArray[j], "BEGIN RSA PUBLIC KEY");
					}
					done();
				} catch (e) {
					done(e);
				}
			}).catch(function (err) {
				done(err);
			});
			
			
		});
	});
});

var requestMock = function (options, callback) {
	if (options.url.indexOf("FAIL-PUBLIC-KEY") >= 0 || options.url.indexOf("FAIL_REQUEST") >= 0) { // Used in public-key-util-test
		return callback(new Error("STUBBED_ERROR"), {statusCode: 0}, null);
	} else if (options.url.indexOf("SUCCESS-PUBLIC-KEY") !== -1) { // Used in public-key-util-test
		return callback(null, {statusCode: 200}, {"keys": [{"n": "1", "e": "2", "kid": "123"}]});
	} else if (options.formData && options.formData.code && options.formData.code.indexOf("FAILING_CODE") !== -1) { // Used in webapp-strategy-test
		return callback(new Error("STUBBED_ERROR"), {statusCode: 0}, null);
	} else if (options.formData && options.formData.code && options.formData.code.indexOf("WORKING_CODE") !== -1) { // Used in webapp-strategy-test
		return callback(null, {statusCode: 200}, JSON.stringify({
			"access_token": "access_token_mock",
			"id_token": "id_token_mock"
		}));
	} else if (options.followRedirect === false) {
		return callback(null, {
			statusCode: 302,
			headers: {
				location: "test-location?code=WORKING_CODE"
			}
		});
	} else if (options.url.indexOf("SETTIMEOUT-PUBLIC-KEYs") > -1) {
		requestCounter++;
		setTimeout(function () {
			return callback(null, {statusCode: 200}, {"keys": [{"n": "1", "e": "2", "kid": "123"}]});
		}, 3000);
	} else if(options.url.indexOf("SEQUENTIAL-REQUEST-PUBLIC-KEYs") > -1) {
		seqRequestCounter++;
		return callback(null, {statusCode: 200}, {"keys": [{"n": "1", "e": "2", "kid": "123"}]});
	} else {
		throw "Unhandled case!!!" + JSON.stringify(options);
	} 
};
