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
const testServerUrl = "https://mobileclientaccess.ng.bluemix.net/imf-authserver";
const testTenantId = "dummy-tenant-id";


describe('/lib/utils/public-key-util', function(){
	console.log("Loading public-key-util-test.js");

	var PublicKeyUtil;

	before(function(){
		PublicKeyUtil = proxyquire("../lib/utils/public-key-util", {
			"request": require("./mocks/request-mock")
		});
	});

	this.timeout(5000);

	describe('#retrievePublicKey()', function(){
		it('Should fail retrieving public key from the server', function(done){
			PublicKeyUtil.retrievePublicKey(testTenantId, testServerUrl + "FAIL-PUBLIC-KEY").then(function(){
				done(new Error("This is impossible!!!"));
			}).catch(function(err){
				done();
			});
		});
	});

	describe("#getPublicKeyPem()", function(){
		it("Should fail to get previously retrieved public key", function(){
			var publicKey = PublicKeyUtil.getPublicKeyPem();
			assert.isUndefined(publicKey);
		});
	});

	describe('#retrievePublicKey()', function(){
		it('Should successfully retrieve public key from OAuth server', function(done){
			PublicKeyUtil.retrievePublicKey(testTenantId, testServerUrl + "SUCCESS-PUBLIC-KEY").then(function(){
				done();
			}).catch(function(err){
				done(new Error(err));
			});
		});
	});

	describe("#getPublicKeyPem()", function(){
		it("Should get previously retrieved public key", function(){
			var publicKey = PublicKeyUtil.getPublicKeyPem();
			assert.isNotNull(publicKey);
			assert.isString(publicKey);
			assert.include(publicKey, "BEGIN RSA PUBLIC KEY");
		});
	});
});
