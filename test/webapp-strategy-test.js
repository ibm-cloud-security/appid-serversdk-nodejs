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

describe("/lib/strategies/webapp-strategy", function(){
	console.log("Loading webapp-strategy-test.js");

	var WebAppStrategy;
	var webAppStrategy;

	before(function(){
		WebAppStrategy = proxyquire("../lib/strategies/webapp-strategy", {
			"./../utils/token-util": require("./mocks/token-util-mock"),
			"request": requestMock
		});
		webAppStrategy = new WebAppStrategy({
			tenantId: "tenantId",
			clientId: "clientId",
			secret: "secret",
			oauthServerUrl: "https://oauthServerUrlMock",
			redirectUri: "https://redirectUri"
		});
	});

	describe("#properties", function(){
		it("Should have all properties", function(){
			assert.isFunction(WebAppStrategy);
			assert.equal(WebAppStrategy.STRATEGY_NAME, "appid-webapp-strategy");
			assert.equal(WebAppStrategy.DEFAULT_SCOPE, "appid_default");
			assert.equal(WebAppStrategy.ORIGINAL_URL, "APPID_ORIGINAL_URL");
			assert.equal(WebAppStrategy.AUTH_CONTEXT, "APPID_AUTH_CONTEXT");
		});
	});

	describe("#logout", function(){
		it("Should be able to successfully logout", function(done){
			var req = {
				logout: function(){
					assert.isUndefined(this[WebAppStrategy.ORIGINAL_URL]);
					assert.isUndefined(this[WebAppStrategy.AUTH_CONTEXT]);
					done();
				},
				session: {
					APPID_ORIGINAL_URL: "url",
					APPID_AUTH_CONTEXT: "context"
				}
			};
			WebAppStrategy.logout(req);
		});
	});

	describe("#ensureAuthenticated", function(){
		it("Should be able to detect unauthenticated request with explicit notAuthenticatedRedirect", function(done){
			var req = {
				isAuthenticated: function(){
					return false;
				},
				url: "originalUrl",
				session: {}
			};

			var res = {
				redirect: function (url) {
					assert.equal(url, "explicitUrl");
					assert.equal(req.session[WebAppStrategy.ORIGINAL_URL], "originalUrl");
					done();
				}
			};

			WebAppStrategy.ensureAuthenticated("explicitUrl")(req, res);
		});

		it("Should be able to detect unauthenticated request with default redirect", function(done){
			var req = {
				isAuthenticated: function(){
					return false;
				},
				url: "originalUrl",
				session: {}
			};

			var res = {
				redirect: function (url) {
					assert.equal(url, "/");
					assert.equal(req.session[WebAppStrategy.ORIGINAL_URL], "originalUrl");
					done();
				}
			};

			WebAppStrategy.ensureAuthenticated()(req, res);
		});

		it("Should be able to detect authenticated request and call next()", function(done){
			var req = {
				isAuthenticated: function(){
					return true;
				}
			};

			var next = function(){
				done();
			}

			WebAppStrategy.ensureAuthenticated()(req, null, next);
		});
	});

	describe("#authenticate()", function(){
		it("Should fail if request doesn't have session", function(done){
			webAppStrategy.error = function(err){
				assert.equal(err.message, "Can't find req.session");
				done();
			}

			webAppStrategy.authenticate({});
		});

		it("Should fail if error was returned in callback", function(done){
			webAppStrategy.fail = function(){
				done();
			};

			webAppStrategy.authenticate({
				session: {},
				query: {
					error: "test error"
				}
			});
		});

		it("Should handle callback if request contains grant code. Fail due to tokenEndpoint error", function(done){
			webAppStrategy.fail = function(err){
				assert.equal(err.message, "Failed to obtain tokens");
				done();
			}
			var req = {
				session: {},
				query: {
					code: "FAILING_CODE"
				}
			}
			webAppStrategy.authenticate(req);
		});

		it("Should handle callback if request contains grant code. Success with options.successRedirect", function(done){
			webAppStrategy.success = function(user){

				assert.equal(options.successRedirect, "redirectUri");
				assert.isObject(req.session[WebAppStrategy.AUTH_CONTEXT]);

				assert.isString(req.session[WebAppStrategy.AUTH_CONTEXT].accessToken);
				assert.equal(req.session[WebAppStrategy.AUTH_CONTEXT].accessToken, "access_token_mock");
				assert.isObject(req.session[WebAppStrategy.AUTH_CONTEXT].accessTokenPayload);
				assert.equal(req.session[WebAppStrategy.AUTH_CONTEXT].accessTokenPayload.scope, "appid_default");

				assert.isString(req.session[WebAppStrategy.AUTH_CONTEXT].identityToken);
				assert.equal(req.session[WebAppStrategy.AUTH_CONTEXT].identityToken, "id_token_mock");
				assert.isObject(req.session[WebAppStrategy.AUTH_CONTEXT].identityTokenPayload);
				assert.equal(req.session[WebAppStrategy.AUTH_CONTEXT].identityTokenPayload.scope, "appid_default");

				assert.isObject(user);
				assert.equal(user.scope, "appid_default");

				done();
			};

			var req = {
				session: {},
				query: {
					code: "WORKING_CODE"
				}
			};

			var options = {
				successRedirect: "redirectUri"
			};

			webAppStrategy.authenticate(req, options);
		});

		it("Should handle callback if request contains grant code. Success with WebAppStrategy.ORIGINAL_URL", function(done){
			webAppStrategy.success = function(){
				assert.equal(options.successRedirect, "originalUri");
				done();
			};

			var req = {
				session: {
					APPID_ORIGINAL_URL: "originalUri"
				},
				query: {
					code: "WORKING_CODE"
				}
			};

			var options = {};

			webAppStrategy.authenticate(req, options);
		});

		it("Should handle callback if request contains grant code. Success with redirect to /", function(done){
			webAppStrategy.success = function(){
				assert.equal(options.successRedirect, "/");
				done();
			};

			var req = {
				session: {
				},
				query: {
					code: "WORKING_CODE"
				}
			};

			var options = {};

			webAppStrategy.authenticate(req, options);
		});

		it("Should handle authorization redirect to AppID /authorization endpoint with default scope", function(done){
			webAppStrategy.redirect = function(url){
				assert.equal(url, encodeURI("https://oauthServerUrlMock/authorization?client_id=clientId&response_type=code&redirect_uri=https://redirectUri&scope=appid_default"));
				done();
			}
			webAppStrategy.authenticate({
				session: {}
			});
		});

		it("Should handle authorization redirect to AppID /authorization endpoint with custom scope", function(done){
			webAppStrategy.redirect = function(url){
				assert.equal(url, encodeURI("https://oauthServerUrlMock/authorization?client_id=clientId&response_type=code&redirect_uri=https://redirectUri&scope=appid_default customScope"));
				done();
			};
			webAppStrategy.authenticate({
				session: {}
			}, {
				scope: "customScope"
			});
		});

		it("Should inject anonymous access token into request url if present", function(done){
			var req = {
				session: {}
			};
			req.session[WebAppStrategy.AUTH_CONTEXT] =  {
				accessTokenPayload: {
					amr: ["appid_anon"]
				},
				accessToken: "test_access_token"
			};
			webAppStrategy.redirect = function(url){
				assert.include(url, "appid_access_token=test_access_token");
				done();
			};

			webAppStrategy.authenticate(req);
		});

		it("Should fail if previous anonymous access token is not found and anon user is not allowed", function(done){
			var req = {
				session: {}
			};

			webAppStrategy.fail = function(){
				done();
			};

			webAppStrategy.authenticate(req, {
				allowAnonymousLogin: true,
				allowCreateNewAnonymousUser: false
			});
		});

		it("Should be able to login anonymously", function(done){
			var req = {
				session: {}
			};

			webAppStrategy.redirect = function(url){
				assert.include(url, "idp=appid_anon");
				done();
			};

			webAppStrategy.authenticate(req, {
				allowAnonymousLogin: true,
				allowCreateNewAnonymousUser: true
			});
		});
	});
});


var requestMock = function (options, callback){
	if (options.url.indexOf("FAIL-PUBLIC-KEY") >=0  || options.url.indexOf("FAIL_REQUEST") >= 0){ // Used in public-key-util-test
		return callback(new Error("STUBBED_ERROR"), {statusCode: 0}, null);
	} else if (options.url.indexOf("SUCCESS-PUBLIC-KEY") !== -1){ // Used in public-key-util-test
		return callback(null, { statusCode: 200}, {"n":1, "e":2});
	} else if (options.formData && options.formData.code && options.formData.code.indexOf("FAILING_CODE") !== -1){ // Used in webapp-strategy-test
		return callback(new Error("STUBBED_ERROR"), {statusCode: 0}, null);
	} else if (options.formData && options.formData.code && options.formData.code.indexOf("WORKING_CODE") !== -1){ // Used in webapp-strategy-test
		return callback(null, {statusCode: 200}, JSON.stringify({
			"access_token": "access_token_mock",
			"id_token": "id_token_mock"
		}));
	} else if (options.followRedirect === false){
		return callback(null, {
			statusCode: 302,
			headers: {
				location: "test-location?code=WORKING_CODE"
			}
		});
	} else {
		throw "Unhandled case!!!" + JSON.stringify(options);
	}
};
