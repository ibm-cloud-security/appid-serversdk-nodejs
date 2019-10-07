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

describe("/lib/strategies/api-strategy", function () {
	console.log("Loading api-strategy-test.js");
	
	var APIStrategy = proxyquire("../lib/strategies/api-strategy", {
		"../utils/public-key-util": require("./mocks/public-key-util-mock"),
		"../utils/token-util": require("./mocks/token-util-mock")
	});
	var apiStrategy= new APIStrategy({
		oauthServerUrl: "serverUrl"
	});
	
	
	describe("#properties", function () {
		it("Should have all properties", function (done) {
			assert.isFunction(APIStrategy);
			assert.equal(APIStrategy.STRATEGY_NAME, "appid-api-strategy");
			assert.equal(APIStrategy.DEFAULT_SCOPE, "appid_default");
			done();
		});
	});
	
	describe("#authenticate()", function () {
		
		it("Should fail returning both default and custom scopes", function (done) {
			apiStrategy.fail = function (msg, status) {
				assert.equal(msg, "Bearer scope=\"appid_default custom_scope\", error=\"invalid_token\"");
				assert.equal(status, 401);
				done();
			};
			
			apiStrategy.authenticate({
				header: function () {
					return null;
				}
			}, {
				scope: "custom_scope"
			});
		});
		
		it("Should fail when there's no access token", function (done) {
			apiStrategy.fail = function (msg, status) {
				assert.equal(msg, 'Bearer scope="appid_default", error="invalid_token"');
				assert.equal(status, 401);
				done();
			};
			
			apiStrategy.authenticate({
				header: function () {
					return null;
				}
			});
		});
		
		it("Should fail when access token is not Bearer", function (done) {
			apiStrategy.fail = function (msg, status) {
				assert.equal(msg, 'Bearer scope="appid_default", error="invalid_token"');
				assert.equal(status, 401);
				done()
			};
			apiStrategy.authenticate({
				header: function () {
					return "Some Weird Stuff";
				}
			});
		});
		
		it("Should fail when access token is malformed", function (done) {
			apiStrategy.fail = function (msg, status) {
				assert.equal(msg, 'Bearer scope="appid_default", error="invalid_token"');
				assert.equal(status, 401);
				done()
			};
			apiStrategy.authenticate({
				header: function () {
					return "Bearer asd asd asd";
				}
			});
		});
		
		it("Should fail when access token cannot be decoded", function (done) {
			apiStrategy.fail = function (msg, status) {
				assert.equal(msg, 'Bearer scope="appid_default", error="invalid_token"');
				assert.equal(status, 401);
				done();
			}
			apiStrategy.authenticate({
				header: function () {
					return "Bearer invalid_token";
				}
			});
		});
		
		it("Should fail when access token scope does not contain required scope", function (done) {
			apiStrategy.fail = function (msg, status) {
				assert.equal(msg, 'Bearer scope="appid_default", error="insufficient_scope"');
				assert.equal(status, 401);
				done();
			}
			apiStrategy.authenticate({
				header: function () {
					return "Bearer bad_scope";
				}
			});
		});
		
		it("Should not fail when id token is not present", function (done) {
			var req = {
				header: function () {
					return "Bearer access_token";
				}
			};
			
			apiStrategy.success = function (idToken) {
				assert.isNull(idToken);
				assert.isObject(req.appIdAuthorizationContext);
				
				assert.isString(req.appIdAuthorizationContext.accessToken);
				assert.equal(req.appIdAuthorizationContext.accessToken, "access_token");
				assert.isObject(req.appIdAuthorizationContext.accessTokenPayload);
				assert.equal(req.appIdAuthorizationContext.accessTokenPayload.scope, "appid_default");
				
				assert.isUndefined(req.appIdAuthorizationContext.identityToken);
				assert.isUndefined(req.appIdAuthorizationContext.identityTokenPayload);
				
				done();
			};
			
			apiStrategy.authenticate(req);
		});
		
		it("Should not fail when id token is invalid", function (done) {
			var req = {
				header: function () {
					return "Bearer access_token invalid_token";
				}
			};
			
			apiStrategy.success = function (idToken) {
				assert.isNull(idToken);
				assert.isObject(req.appIdAuthorizationContext);
				
				assert.isString(req.appIdAuthorizationContext.accessToken);
				assert.equal(req.appIdAuthorizationContext.accessToken, "access_token");
				assert.isObject(req.appIdAuthorizationContext.accessTokenPayload);
				assert.equal(req.appIdAuthorizationContext.accessTokenPayload.scope, "appid_default");
				
				assert.isUndefined(req.appIdAuthorizationContext.identityToken);
				assert.isUndefined(req.appIdAuthorizationContext.identityTokenPayload);
				
				done();
			};
			
			apiStrategy.authenticate(req);
		});
		
		it("Should succeed when valid access and id tokens are present", function (done) {
			var req = {
				header: function () {
					return "Bearer access_token id_token";
				}
			};
			
			apiStrategy.success = function (idToken) {
				assert.isObject(req.appIdAuthorizationContext);
				
				assert.isString(req.appIdAuthorizationContext.accessToken);
				assert.equal(req.appIdAuthorizationContext.accessToken, "access_token");
				assert.isObject(req.appIdAuthorizationContext.accessTokenPayload);
				assert.equal(req.appIdAuthorizationContext.accessTokenPayload.scope, "appid_default");
				
				assert.isString(req.appIdAuthorizationContext.identityToken);
				assert.equal(req.appIdAuthorizationContext.identityToken, "id_token");
				assert.isObject(req.appIdAuthorizationContext.identityTokenPayload);
				assert.equal(req.appIdAuthorizationContext.identityTokenPayload.scope, "appid_default");
				
				assert.isObject(idToken);
				
				assert.equal(idToken.scope, "appid_default");
				done();
			};
			
			apiStrategy.authenticate(req);
		});
		
		it("should succeed when authenticating with 3 scopes, 2 of which are the required scopes", function (done) {
			apiStrategy.success = function (idToken) {
				assert.equal(req.appIdAuthorizationContext.accessTokenPayload.scope, "appid_default scope1 scope2 scope3");
				assert.equal(idToken.scope, "appid_default scope1 scope2 scope3");
				done();
			};
			
			let req = {
				header: function () {
					return "Bearer access_token_3_scopes id_token_3_scopes";
				}
			};
			apiStrategy.authenticate(req,
				{
					scope: "scope1 scope2",
					audience: "myClientId"
				});
		});
		
		it("should fail when authenticating without the required scopes", function (done) {
			apiStrategy.fail = function (msg, status) {
				assert.equal(msg, 'Bearer scope="appid_default scope1 scope2", error="insufficient_scope"');
				assert.equal(status, 401);
				done();
			};
			
			let req = {
				header: function () {
					return "Bearer access_token id_token";
				}
			};
			apiStrategy.authenticate(req,
				{
					scope: "scope1 scope2",
					audience: "myCliendId"
				});
		});
		
		it("should fail when authenticating without the required scopes", function (done) {
			apiStrategy.fail = function (msg, status) {
				assert.equal(msg, 'Bearer scope="appid_default scope1 scope2 scope3", error="insufficient_scope"');
				assert.equal(status, 401);
				done();
			};
			
			let req = {
				header: function () {
					return "Bearer access_token id_token";
				}
			};
			apiStrategy.authenticate(req,
				{
					scope: "scope1 scope2 scope3"
				});
		});
		
		it("should succeed when authenticating with *whitespace* as required scopes", function (done) {
			apiStrategy.success = function (idToken) {
				assert.equal(req.appIdAuthorizationContext.accessTokenPayload.scope, "appid_default scope1 scope2 scope3");
				assert.equal(idToken.scope, "appid_default scope1 scope2 scope3");
				done();
			};
			
			let req = {
				header: function () {
					return "Bearer access_token_3_scopes id_token_3_scopes";
				}
			};
			apiStrategy.authenticate(req,
				{
					scope: "    "
				});
		});
		
		it("should succeed when authenticating with the required scopes, while not passing audience", function (done) {
			apiStrategy.success = function (idToken) {
				assert.equal(req.appIdAuthorizationContext.accessTokenPayload.scope, "appid_default scope1 scope2 scope3");
				assert.equal(idToken.scope, "appid_default scope1 scope2 scope3");
				done();
			};
			
			let req = {
				header: function () {
					return "Bearer access_token_3_scopes id_token_3_scopes";
				}
			};
			apiStrategy.authenticate(req,
				{
					scope: "scope1 scope2"
				});
		});
		
		it("should fail with BAD_REQUEST when the required scope is not a string", function (done) {
			apiStrategy.fail = function (msg, status) {
				assert.equal(status, 400);
				done();
			};
			
			let req = {
				header: function () {
					return "Bearer access_token id_token";
				}
			};
			apiStrategy.authenticate(req,
				{
					scope: 42,
					audience: "app"
				});
		});
		
		it("should fail with BAD_REQUEST when the required (non-null) audience is not a string", function (done) {
			apiStrategy.fail = function (msg, status) {
				assert.equal(status, 400);
				done();
			};
			
			let req = {
				header: function () {
					return "Bearer access_token id_token";
				}
			};
			apiStrategy.authenticate(req,
				{
					scope: "scope1",
					audience: 42
				});
		});
		
		it("should fail with BAD_REQUEST when sending several audiences ", function (done) {
			apiStrategy.fail = function (msg, status) {
				assert(msg.indexOf("multiple audiences are not supported") > 1, true);
				assert.equal(status, 400);
				done();
			};
			
			let req = {
				header: function () {
					return "Bearer access_token id_token";
				}
			};
			apiStrategy.authenticate(req,
				{
					scope: "appid_default",
					audience: "item1 item2"
				});
		});
		
		it("should fail with AUTH failure when request wrong audience value", function (done) {
			apiStrategy.fail = function (msg, status) {
				assert(msg.indexOf("audience mismatch") > 1, true);
				assert.equal(status, 401);
				done();
			};
			
			let req = {
				header: function () {
					return "Bearer access_token_3_scopes id_token";
				}
			};
			apiStrategy.authenticate(req,
				{
					scope: "scope1 scope2",
					audience: "myBadClientId"
				});
		});
		
	});
});
