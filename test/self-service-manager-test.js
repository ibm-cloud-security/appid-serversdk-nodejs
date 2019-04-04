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
"use strict";
const chai = require("chai");
const assert = chai.assert;
const rewire = require("rewire");
const _ = require("underscore");
const Q = require("q");
const initError = "Failed to initialize self-service-manager.";

describe("/lib/self-service/self-service-manager", function () {
	console.log("Loading self-service-manager-test.js");
	
	var SelfServiceManager;
	
	before(function () {
		delete process.env["VCAP_SERVICES"];
		SelfServiceManager = rewire("../lib/self-service/self-service-manager");
	});
	
	describe("#SelfserviceManager constructor", function () {
		it("Should not be able to init without options and VCAP_SERVICS", function (done) {
			try {
				let test = new SelfServiceManager();
				done("This should throw");
			} catch (e) {
				try {
					assert.equal(e.message, initError);
					done();
				} catch (err) {
					done(err);
				}
			}
		});
		
		it("Should not be able to init with options with only tenantId", function (done) {
			try {
				let test = new SelfServiceManager({
					tenantId: "dummy_tenant"
				});
				done("This should throw");
			} catch (e) {
				try {
					assert.equal(e.message, initError);
					done();
				} catch (err) {
					done(err);
				}
			}
		});
		
		it("Should not be able to init with options with server with host not equal to appid-oauth", function (done) {
			try {
				let test = new SelfServiceManager({
					tenantId: "dummy_tenant",
					oauthServerUrl: "http://a.com"
				});
				done("This should throw");
			} catch (e) {
				try {
					assert.equal(e.message, initError);
					done();
				} catch (err) {
					done(err);
				}
			}
		});
		
		it("Should not be able to init with options with server with not /oauth/v3", function (done) {
			try {
				let test = new SelfServiceManager({
					tenantId: "dummy_tenant",
					oauthServerUrl: "http://appid-oauth.com/oauth/v123"
				});
				done("This should throw");
			} catch (e) {
				try {
					assert.equal(e.message, initError);
					done();
				} catch (err) {
					done(err);
				}
			}
		});
		
		it("Should be able to init with options with only managementUrl", function (done) {
			try {
				let selfServiceManager = new SelfServiceManager({
					managementUrl: "dummy_managementUrl"
				});
				assert.equal("dummy_managementUrl", selfServiceManager.managementUrl);
				done();
			} catch (e) {
				done(e);
			}
		});
		
		it("Should be able to init with options with only tenantId and oauthServerUrl", function (done) {
			try {
				let selfServiceManager = new SelfServiceManager({
					oauthServerUrl: "https://appid-oauth.com/oauth/v3",
					tenantId: "123"
				});
				assert.equal("https://appid-management.com/management/v4/123", selfServiceManager.managementUrl);
				done();
			} catch (e) {
				done(e);
			}
		});

	  it("Should be able to init with options with only tenantId and oAuthServerUrl", function (done) {
		try {
		  let selfServiceManager = new SelfServiceManager({
			oAuthServerUrl: "https://appid-oauth.com/oauth/v3",
			tenantId: "123"
		  });
		  assert.equal("https://appid-management.com/management/v4/123", selfServiceManager.managementUrl);
		  done();
		} catch (e) {
		  done(e);
		}
	  });
		
		it("Should be able to init with options check iamTokenUrl and iamApiKey", function (done) {
			try {
				let selfServiceManager = new SelfServiceManager({
					oauthServerUrl: "https://appid-oauth.com/oauth/v3",
					tenantId: "123",
					iamTokenUrl:"xxx",
					iamApiKey:"yyy"
				});
				assert.equal("https://appid-management.com/management/v4/123", selfServiceManager.managementUrl);
				assert.equal("xxx", selfServiceManager.iamTokenUrl);
				assert.equal("yyy", selfServiceManager.iamApiKey);
				done();
			} catch (e) {
				done(e);
			}
		});
		
		it("Should be able to init with VCAP_SERVICES (AdvancedMobileAccess)", function (done) {
			process.env.VCAP_SERVICES = JSON.stringify({
				AdvancedMobileAccess: [
					{
						credentials: {
							managementUrl: "dummy_managementUrl"
						}
					}
				]
			});
			try {
				let test = new SelfServiceManager();
				done();
			} catch (e) {
				done(e);
			}
			
		});
		it("Should be able to init with VCAP_SERVICES (appid) - check api key in VCAP", function (done) {
			const testApiKey = "testApiKey";
			process.env.VCAP_SERVICES = JSON.stringify({
				AppID: [
					{
						credentials: {
							oauthServerUrl: "https://appid-oauth.com/oauth/v3",
							tenantId: "123",
							apikey: testApiKey
						}
					}
				]
			});
			
			try {
				let selfServiceManager = new SelfServiceManager();
				assert.equal(testApiKey, selfServiceManager.iamApiKey);
				done();
			} catch (e) {
				done(e);
			}
		});
		
		it("Should be able to init with VCAP_SERVICES (appid)", function (done) {
			process.env.VCAP_SERVICES = JSON.stringify({
				AppID: [
					{
						credentials: {
							oauthServerUrl: "https://appid-oauth.com/oauth/v3",
							tenantId: "123"
						}
					}
				]
			});
			
			try {
				let selfServiceManager = new SelfServiceManager();
				assert.equal("https://appid-management.com/management/v4/123", selfServiceManager.managementUrl);
				done();
			} catch (e) {
				done(e);
			}
		});
	});
	
	describe("#SelfServiceManager.signUp", function () {
		let selfServiceManager;
		let testUserJson = {email: "testEmail"};
		let language = "en";
		let expectedQuery = {language: language};
		let testIamToken = "bearer axcvrd";
		let badIamApiKey = "badIamApiKey";
		let providedIamToken = "bearer 123";
		let _handleRequestRevert, _getIAMTokenRevert;
		
		let stubHandleRequest = function (iamToken, method, url, body, querys , action, deferred) {
			if (iamToken !== testIamToken ||
				method !== "POST" ||
				url !== "managementUrlTest/cloud_directory/sign_up" ||
				action !== "sign up" ||
				JSON.stringify(body) !== JSON.stringify(testUserJson) ||
				JSON.stringify(querys) !== JSON.stringify(expectedQuery)) {
				return deferred.reject("wrong input to _handleRequest in signUp API");
			}
			return deferred.resolve(testUserJson);
		};
		
		let stubGetIAMToken = function (iamToken, iamApiKey, iamTokenUrl) {
			if (!iamApiKey){
				if (iamToken !== providedIamToken) {
					return Q.reject("iamToken was not received to _getIAMToken function");
				} else {
					return Q.resolve(testIamToken);
				}
			}
			if (badIamApiKey === iamApiKey) {
				return Q.reject(new Error(badIamApiKey));
			}
			if (iamApiKey !== "testIamApiKey" || iamTokenUrl !== "https://iam.bluemix.net/oidc/token") {
				return Q.reject("wrong input to _getIAMToken in signUp API");
			}
			return Q.resolve(testIamToken);
		};
		before(function (done) {
			_handleRequestRevert = SelfServiceManager.__set__("_handleRequest", stubHandleRequest);
			_getIAMTokenRevert = SelfServiceManager.__set__("_getIAMToken", stubGetIAMToken);
			selfServiceManager = new SelfServiceManager({
				managementUrl: "managementUrlTest",
				iamApiKey: "testIamApiKey"
			});
			done();
		});
		after(function (done) {
			_handleRequestRevert();
			_getIAMTokenRevert();
			done();
		});
		
		it("Should successfully create new user", function (done) {
			selfServiceManager.signUp(testUserJson, language).then(function (user) {
				try {
					assert.equal(JSON.stringify(user), JSON.stringify(testUserJson));
					done();
				} catch (err) {
					done(err);
				}
			}).catch(function (err) {
				done(err);
			});
		});
		
		it("Should successfully create new user with provided iamToken", function (done) {
			let selfServiceManager2 = new SelfServiceManager({
				managementUrl: "managementUrlTest"
			});
			selfServiceManager2.signUp(testUserJson, language, providedIamToken).then(function (user) {
				try {
					assert.equal(JSON.stringify(user), JSON.stringify(testUserJson));
					done();
				} catch (err) {
					done(err);
				}
			}).catch(function (err) {
				done(err);
			});
		});
		
		it("Should reject on _getIAMToken", function (done) {
			let selfServiceManager2 = new SelfServiceManager({
				managementUrl: "managementUrlTest",
				iamApiKey: badIamApiKey
			});
			selfServiceManager2.signUp(testUserJson, language).then(function (user) {
				done("should reject");
			}).catch(function (err) {
				try{
					assert.equal(badIamApiKey, err.message);
					done();
				}catch (e) {
					done(e);
				}
			})
		});
		
		it("Should reject on _handleRequest", function (done) {
			selfServiceManager.signUp({}, language).then(function (user) {
				done("should reject");
			}).catch(function (err) {
				try {
					assert.equal("wrong input to _handleRequest in signUp API", err);
					done();
				} catch (e){
					done(e);
				}
			})
		});
	});
	
	describe("#SelfServiceManager.forgotPassword", function () {
		let selfServiceManager;
		let testEmail = "testEmail";
		let expectedBody = {email: testEmail};
		let language = "en";
		let expectedQuery = {language: language};
		let testIamToken = "bearer axcvrd";
		let badIamApiKey = "badIamApiKey";
		let providedIamToken = "bearer 123";
		let _handleRequestRevert, _getIAMTokenRevert;
		
		let stubHandleRequest = function (iamToken, method, url, body, querys , action, deferred) {
			if (iamToken !== testIamToken ||
				method !== "POST" ||
				url !== "managementUrlTest/cloud_directory/forgot_password" ||
				action !== "forgot password" ||
				JSON.stringify(body) !== JSON.stringify(expectedBody) ||
				JSON.stringify(querys) !== JSON.stringify(expectedQuery)) {
				return deferred.reject("wrong input to _handleRequest in forgotPassword API");
			}
			return deferred.resolve(testEmail);
		};
		
		let stubGetIAMToken = function (iamToken, iamApiKey, iamTokenUrl) {
			if (!iamApiKey){
				if (iamToken !== providedIamToken) {
					return Q.reject("iamToken was not received to _getIAMToken function");
				} else {
					return Q.resolve(testIamToken);
				}
			}
			if (badIamApiKey === iamApiKey) {
				return Q.reject(new Error(badIamApiKey));
			}
			if (iamApiKey !== "testIamApiKey" || iamTokenUrl !== "https://iam.bluemix.net/oidc/token") {
				return Q.reject("wrong input to _getIAMToken in forgotPassword API");
			}
			return Q.resolve(testIamToken);
		};
		before(function (done) {
			_handleRequestRevert = SelfServiceManager.__set__("_handleRequest", stubHandleRequest);
			_getIAMTokenRevert = SelfServiceManager.__set__("_getIAMToken", stubGetIAMToken);
			selfServiceManager = new SelfServiceManager({
				managementUrl: "managementUrlTest",
				iamApiKey: "testIamApiKey"
			});
			done();
		});
		after(function (done) {
			_handleRequestRevert();
			_getIAMTokenRevert();
			done();
		});
		
		it("Should successfully return user", function (done) {
			selfServiceManager.forgotPassword(testEmail, language).then(function (user) {
				try {
					assert.equal(JSON.stringify(user), JSON.stringify(testEmail));
					done();
				} catch (err) {
					done(err);
				}
			}).catch(function (err) {
				done(err);
			})
		});
		
		it("Should successfully return user with provided iamToken", function (done) {
			let selfServiceManager2 = new SelfServiceManager({
				managementUrl: "managementUrlTest"
			});
			selfServiceManager2.forgotPassword(testEmail, language, providedIamToken).then(function (user) {
				try {
					assert.equal(JSON.stringify(user), JSON.stringify(testEmail));
					done();
				} catch (err) {
					done(err);
				}
			}).catch(function (err) {
				done(err);
			})
		});
		
		it("Should reject on _getIAMToken", function (done) {
			let selfServiceManager = new SelfServiceManager({
				managementUrl: "managementUrlTest",
				iamApiKey: badIamApiKey
			});
			selfServiceManager.forgotPassword(testEmail, language).then(function (user) {
				done("should reject");
			}).catch(function (err) {
				try{
					assert.equal(badIamApiKey, err.message);
					done();
				}catch (e) {
					done(e);
				}
			})
		});
		
		it("Should reject on _handleRequest", function (done) {
			selfServiceManager.forgotPassword({}, language).then(function (user) {
				done("should reject");
			}).catch(function (err) {
				try {
					assert.equal("wrong input to _handleRequest in forgotPassword API", err);
					done();
				} catch (e){
					done(e);
				}
			})
		});
	});
	
	describe("#SelfServiceManager.resendNotification", function () {
		let selfServiceManager;
		let testUuid = "testUuid";
		let expectedBody = {uuid: testUuid};
		let language = "en";
		let expectedQuery = {language: language};
		let testIamToken = "bearer axcvrd";
		let badIamApiKey = "badIamApiKey";
		let providedIamToken = "bearer 123";
		let testTemplateName = "testTemplateName";
		let _handleRequestRevert, _getIAMTokenRevert;
		
		let stubHandleRequest = function (iamToken, method, url, body, queryObject , action, deferred) {
			if (iamToken !== testIamToken ||
				method !== "POST" ||
				url !== "managementUrlTest/cloud_directory/resend/testTemplateName" ||
				action !== "resend notification" ||
				JSON.stringify(body) !== JSON.stringify(expectedBody) ||
				JSON.stringify(queryObject) !== JSON.stringify(expectedQuery)) {
				return deferred.reject("wrong input to _handleRequest in resendNotification API");
			}
			return deferred.resolve(testUuid);
		};
		
		let stubGetIAMToken = function (iamToken, iamApiKey, iamTokenUrl) {
			if (!iamApiKey){
				if (iamToken !== providedIamToken) {
					return Q.reject("iamToken was not received to _getIAMToken function");
				} else {
					return Q.resolve(testIamToken);
				}
			}
			if (badIamApiKey === iamApiKey) {
				return Q.reject(new Error(badIamApiKey));
			}
			if (iamApiKey !== "testIamApiKey" || iamTokenUrl !== "https://iam.bluemix.net/oidc/token") {
				return Q.reject("wrong input to _getIAMToken in resendNotification API");
			}
			return Q.resolve(testIamToken);
		};
		before(function (done) {
			_handleRequestRevert = SelfServiceManager.__set__("_handleRequest", stubHandleRequest);
			_getIAMTokenRevert = SelfServiceManager.__set__("_getIAMToken", stubGetIAMToken);
			selfServiceManager = new SelfServiceManager({
				managementUrl: "managementUrlTest",
				iamApiKey: "testIamApiKey"
			});
			done();
		});
		
		after(function (done) {
			_handleRequestRevert();
			_getIAMTokenRevert();
			done();
		});
		
		it("Should successfully resend", function (done) {
			selfServiceManager.resendNotification(testUuid, testTemplateName, language).then(function (res) {
				try {
					assert.equal(JSON.stringify(res), JSON.stringify(testUuid));
					done();
				} catch (err) {
					done(err);
				}
			}).catch(function (err) {
				done(err);
			})
		});
		
		it("Should successfully resend with provided iamToken", function (done) {
			let selfServiceManager = new SelfServiceManager({
				managementUrl: "managementUrlTest"
			});
			selfServiceManager.resendNotification(testUuid, testTemplateName, language, providedIamToken).then(function (res) {
				try {
					assert.equal(JSON.stringify(res), JSON.stringify(testUuid));
					done();
				} catch (err) {
					done(err);
				}
			}).catch(function (err) {
				done(err);
			})
		});
		
		it("Should reject on _getIAMToken", function (done) {
			let selfServiceManager = new SelfServiceManager({
				managementUrl: "managementUrlTest",
				iamApiKey: badIamApiKey
			});
			selfServiceManager.resendNotification(testUuid, testTemplateName, language).then(function (user) {
				done("should reject");
			}).catch(function (err) {
				try{
					assert.equal(badIamApiKey, err.message);
					done();
				}catch (e) {
					done(e);
				}
			})
		});
		
		it("Should reject on _handleRequest", function (done) {
			selfServiceManager.resendNotification({}, testTemplateName ,language).then(function (user) {
				done("should reject");
			}).catch(function (err) {
				try {
					assert.equal("wrong input to _handleRequest in resendNotification API", err);
					done();
				} catch (e){
					done(e);
				}
			})
		});
	});
	
	describe("#SelfServiceManager.getSignUpConfirmationResult", function () {
		let selfServiceManager;
		let testContext = "testContext";
		let expectedBody = {context: testContext};
		let language = "en";
		let expectedQuery = {};
		let testIamToken = "bearer axcvrd";
		let badIamApiKey = "badIamApiKey";
		let providedIamToken = "bearer 123";
		let testTemplateName = "testTemplateName";
		let _handleRequestRevert, _getIAMTokenRevert;
		
		let stubHandleRequest = function (iamToken, method, url, body, queryObject , action, deferred) {
			if (iamToken !== testIamToken ||
				method !== "POST" ||
				url !== "managementUrlTest/cloud_directory/sign_up/confirmation_result" ||
				action !== "sign up result" ||
				JSON.stringify(body) !== JSON.stringify(expectedBody) ||
				JSON.stringify(queryObject) !== JSON.stringify(expectedQuery)) {
				return deferred.reject("wrong input to _handleRequest in getSignUpConfirmationResult API");
			}
			return deferred.resolve(testContext);
		};
		
		let stubGetIAMToken = function (iamToken, iamApiKey, iamTokenUrl) {
			if (!iamApiKey){
				if (iamToken !== providedIamToken) {
					return Q.reject("iamToken was not received to _getIAMToken function");
				} else {
					return Q.resolve(testIamToken);
				}
			}
			if (badIamApiKey === iamApiKey) {
				return Q.reject(new Error(badIamApiKey));
			}
			if (iamApiKey !== "testIamApiKey" || iamTokenUrl !== "https://iam.bluemix.net/oidc/token") {
				return Q.reject("wrong input to _getIAMToken in getSignUpConfirmationResult API");
			}
			return Q.resolve(testIamToken);
		};
		before(function (done) {
			_handleRequestRevert = SelfServiceManager.__set__("_handleRequest", stubHandleRequest);
			_getIAMTokenRevert = SelfServiceManager.__set__("_getIAMToken", stubGetIAMToken);
			selfServiceManager = new SelfServiceManager({
				managementUrl: "managementUrlTest",
				iamApiKey: "testIamApiKey"
			});
			done();
		});
		after(function (done) {
			_handleRequestRevert();
			_getIAMTokenRevert();
			done();
		});
		
		it("Should successfully get confirmation result", function (done) {
			selfServiceManager.getSignUpConfirmationResult(testContext).then(function (res) {
				try {
					assert.equal(JSON.stringify(res), JSON.stringify(testContext));
					done();
				} catch (err) {
					done(err);
				}
			}).catch(function (err) {
				done(err);
			})
		});
		
		it("Should successfully get confirmation result with provided iamToken", function (done) {
			let selfServiceManager = new SelfServiceManager({
				managementUrl: "managementUrlTest"
			});
			selfServiceManager.getSignUpConfirmationResult(testContext, providedIamToken).then(function (res) {
				try {
					assert.equal(JSON.stringify(res), JSON.stringify(testContext));
					done();
				} catch (err) {
					done(err);
				}
			}).catch(function (err) {
				done(err);
			})
		});
		
		it("Should reject on _getIAMToken", function (done) {
			let selfServiceManager = new SelfServiceManager({
				managementUrl: "managementUrlTest",
				iamApiKey: badIamApiKey
			});
			selfServiceManager.getSignUpConfirmationResult(testContext).then(function (user) {
				done("should reject");
			}).catch(function (err) {
				try{
					assert.equal(badIamApiKey, err.message);
					done();
				}catch (e) {
					done(e);
				}
			})
		});
		
		it("Should reject on _handleRequest", function (done) {
			selfServiceManager.getSignUpConfirmationResult({}).then(function (user) {
				done("should reject");
			}).catch(function (err) {
				try {
					assert.equal("wrong input to _handleRequest in getSignUpConfirmationResult API", err);
					done();
				} catch (e){
					done(e);
				}
			})
		});
	});
	
	describe("#SelfServiceManager.getForgotPasswordConfirmationResult", function () {
		let selfServiceManager;
		let testContext = "testContext";
		let expectedBody = {context: testContext};
		let language = "en";
		let expectedQuery = {};
		let testIamToken = "bearer axcvrd";
		let badIamApiKey = "badIamApiKey";
		let providedIamToken = "bearer 123";
		let testTemplateName = "testTemplateName";
		let _handleRequestRevert, _getIAMTokenRevert;
		
		let stubHandleRequest = function (iamToken, method, url, body, queryObject , action, deferred) {
			if (iamToken !== testIamToken ||
				method !== "POST" ||
				url !== "managementUrlTest/cloud_directory/forgot_password/confirmation_result" ||
				action !== "forgot password result" ||
				JSON.stringify(body) !== JSON.stringify(expectedBody) ||
				JSON.stringify(queryObject) !== JSON.stringify(expectedQuery)) {
				return deferred.reject("wrong input to _handleRequest in getForgotPasswordConfirmationResult API");
			}
			return deferred.resolve(testContext);
		};
		
		let stubGetIAMToken = function (iamToken, iamApiKey, iamTokenUrl) {
			if (!iamApiKey){
				if (iamToken !== providedIamToken) {
					return Q.reject("iamToken was not received to _getIAMToken function");
				} else {
					return Q.resolve(testIamToken);
				}
			}
			if (badIamApiKey === iamApiKey) {
				return Q.reject(new Error(badIamApiKey));
			}
			if (iamApiKey !== "testIamApiKey" || iamTokenUrl !== "https://iam.bluemix.net/oidc/token") {
				return Q.reject("wrong input to _getIAMToken in getForgotPasswordConfirmationResult API");
			}
			return Q.resolve(testIamToken);
		};
		before(function (done) {
			_handleRequestRevert = SelfServiceManager.__set__("_handleRequest", stubHandleRequest);
			_getIAMTokenRevert = SelfServiceManager.__set__("_getIAMToken", stubGetIAMToken);
			selfServiceManager = new SelfServiceManager({
				managementUrl: "managementUrlTest",
				iamApiKey: "testIamApiKey"
			});
			done();
		});
		after(function (done) {
			_handleRequestRevert();
			_getIAMTokenRevert();
			done();
		});
		
		it("Should successfully get confirmation result", function (done) {
			selfServiceManager.getForgotPasswordConfirmationResult(testContext).then(function (res) {
				try {
					assert.equal(JSON.stringify(res), JSON.stringify(testContext));
					done();
				} catch (err) {
					done(err);
				}
			}).catch(function (err) {
				done(err);
			})
		});
		
		it("Should successfully get confirmation result with provided iamToken", function (done) {
			let selfServiceManager = new SelfServiceManager({
				managementUrl: "managementUrlTest"
			});
			selfServiceManager.getForgotPasswordConfirmationResult(testContext, providedIamToken).then(function (res) {
				try {
					assert.equal(JSON.stringify(res), JSON.stringify(testContext));
					done();
				} catch (err) {
					done(err);
				}
			}).catch(function (err) {
				done(err);
			})
		});
		
		it("Should reject on _getIAMToken", function (done) {
			let selfServiceManager = new SelfServiceManager({
				managementUrl: "managementUrlTest",
				iamApiKey: badIamApiKey
			});
			selfServiceManager.getForgotPasswordConfirmationResult(testContext).then(function (user) {
				done("should reject");
			}).catch(function (err) {
				try{
					assert.equal(badIamApiKey, err.message);
					done();
				}catch (e) {
					done(e);
				}
			})
		});
		
		it("Should reject on _handleRequest", function (done) {
			selfServiceManager.getForgotPasswordConfirmationResult({}).then(function (user) {
				done("should reject");
			}).catch(function (err) {
				try {
					assert.equal("wrong input to _handleRequest in getForgotPasswordConfirmationResult API", err);
					done();
				} catch (e){
					done(e);
				}
			})
		});
	});
	
	describe("#SelfServiceManager.setUserNewPassword", function () {
		let selfServiceManager;
		let language = "en";
		let testUuid = "testUuid";
		let testNewPassword = "testNewPassword";
		let expectedBody = {uuid: testUuid, newPassword: testNewPassword};
		let expectedQuery = {language: language};
		let testIamToken = "bearer axcvrd";
		let badIamApiKey = "badIamApiKey";
		let providedIamToken = "bearer 123";
		let _getIAMTokenRevert, _handleRequestRevert;
		let testIpAddress = "127.0.0.1";
		
		let stubHandleRequest = function (iamToken, method, url, body, queryObject , action, deferred) {
			if (body.changedIpAddress) {
				if (body.changedIpAddress !== testIpAddress) {
					return deferred.reject("wrong ip address passed in setUserNewPassword API");
				} else {
					return deferred.resolve(testUuid);
				}
			}
			if (iamToken !== testIamToken ||
				method !== "POST" ||
				url !== "managementUrlTest/cloud_directory/change_password" ||
				action !== "change user password" ||
				JSON.stringify(body) !== JSON.stringify(expectedBody) ||
				JSON.stringify(queryObject) !== JSON.stringify(expectedQuery)) {
				return deferred.reject("wrong input to _handleRequest in setUserNewPassword API");
			}
			return deferred.resolve(testUuid);
		};
		
		let stubGetIAMToken = function (iamToken, iamApiKey, iamTokenUrl) {
			if (!iamApiKey){
				if (iamToken !== providedIamToken) {
					return Q.reject("iamToken was not received to _getIAMToken function");
				} else {
					return Q.resolve(testIamToken);
				}
			}
			if (badIamApiKey === iamApiKey) {
				return Q.reject(new Error(badIamApiKey));
			}
			if (iamApiKey !== "testIamApiKey" || iamTokenUrl !== "https://iam.bluemix.net/oidc/token") {
				return Q.reject("wrong input to _getIAMToken in setUserNewPassword API");
			}
			return Q.resolve(testIamToken);
		};
		before(function (done) {
			_handleRequestRevert = SelfServiceManager.__set__("_handleRequest", stubHandleRequest);
			_getIAMTokenRevert = SelfServiceManager.__set__("_getIAMToken", stubGetIAMToken);
			selfServiceManager = new SelfServiceManager({
				managementUrl: "managementUrlTest",
				iamApiKey: "testIamApiKey"
			});
			done();
		});
		after(function (done) {
			_handleRequestRevert();
			_getIAMTokenRevert();
			done();
		});
		
		it("Should successfully set new password", function (done) {
			selfServiceManager.setUserNewPassword(testUuid, testNewPassword, language).then(function (res) {
				try {
					assert.equal(JSON.stringify(res), JSON.stringify(testUuid));
					done();
				} catch (err) {
					done(err);
				}
			}).catch(function (err) {
				done(err);
			})
		});
		
		it("Should successfully set new password with ipAddress", function (done) {
			selfServiceManager.setUserNewPassword(testUuid, testNewPassword, language, testIpAddress).then(function (res) {
				try {
					assert.equal(JSON.stringify(res), JSON.stringify(testUuid));
					done();
				} catch (err) {
					done(err);
				}
			}).catch(function (err) {
				done(err);
			})
		});
		
		it("Should successfully set new password with provided iamToken", function (done) {
			let selfServiceManager = new SelfServiceManager({
				managementUrl: "managementUrlTest"
			});
			selfServiceManager.setUserNewPassword(testUuid, testNewPassword, language, null, providedIamToken).then(function (res) {
				try {
					assert.equal(JSON.stringify(res), JSON.stringify(testUuid));
					done();
				} catch (err) {
					done(err);
				}
			}).catch(function (err) {
				done(err);
			})
		});
		
		it("Should reject on _getIAMToken", function (done) {
			let selfServiceManager = new SelfServiceManager({
				managementUrl: "managementUrlTest",
				iamApiKey: badIamApiKey
			});
			selfServiceManager.setUserNewPassword(testUuid, testNewPassword, language).then(function (user) {
				done("should reject");
			}).catch(function (err) {
				try{
					assert.equal(badIamApiKey, err.message);
					done();
				}catch (e) {
					done(e);
				}
			})
		});
		
		it("Should reject on _handleRequest", function (done) {
			selfServiceManager.setUserNewPassword({}, testNewPassword, language).then(function (user) {
				done("should reject");
			}).catch(function (err) {
				try {
					assert.equal("wrong input to _handleRequest in setUserNewPassword API", err);
					done();
				} catch (e){
					done(e);
				}
			})
		});
	});
	
	describe("#SelfServiceManager.getUserDetails", function () {
		let selfServiceManager;
		let testUuid = "testUuid";
		let expectedBody = {};
		let expectedQuery = {};
		let testIamToken = "bearer axcvrd";
		let badIamApiKey = "badIamApiKey";
		let providedIamToken = "bearer 123";
		let _getIAMTokenRevert, _handleRequestRevert;
		
		let stubHandleRequest = function (iamToken, method, url, body, queryObject , action, deferred) {
			if (iamToken !== testIamToken ||
				method !== "GET" ||
				url !== "managementUrlTest/cloud_directory/Users/testUuid" ||
				action !== "get user details" ||
				JSON.stringify(body) !== JSON.stringify(expectedBody) ||
				JSON.stringify(queryObject) !== JSON.stringify(expectedQuery)) {
				return deferred.reject("wrong input to _handleRequest in getUserDetails API");
			}
			return deferred.resolve(testUuid);
		};
		
		let stubGetIAMToken = function (iamToken, iamApiKey, iamTokenUrl) {
			if (!iamApiKey){
				if (iamToken !== providedIamToken) {
					return Q.reject("iamToken was not received to _getIAMToken function");
				} else {
					return Q.resolve(testIamToken);
				}
			}
			if (badIamApiKey === iamApiKey) {
				return Q.reject(new Error(badIamApiKey));
			}
			if (iamApiKey !== "testIamApiKey" || iamTokenUrl !== "https://iam.bluemix.net/oidc/token") {
				return Q.reject("wrong input to _getIAMToken in getUserDetails API");
			}
			return Q.resolve(testIamToken);
		};
		before(function (done) {
			_handleRequestRevert = SelfServiceManager.__set__("_handleRequest", stubHandleRequest);
			_getIAMTokenRevert = SelfServiceManager.__set__("_getIAMToken", stubGetIAMToken);
			selfServiceManager = new SelfServiceManager({
				managementUrl: "managementUrlTest",
				iamApiKey: "testIamApiKey"
			});
			done();
		});
		
		after(function (done) {
			_handleRequestRevert();
			_getIAMTokenRevert();
			done();
		});
		
		it("Should successfully get user details", function (done) {
			selfServiceManager.getUserDetails(testUuid).then(function (res) {
				try {
					assert.equal(JSON.stringify(res), JSON.stringify(testUuid));
					done();
				} catch (err) {
					done(err);
				}
			}).catch(function (err) {
				done(err);
			})
		});
		
		it("Should successfully get user details with provided iamToken", function (done) {
			let selfServiceManager = new SelfServiceManager({
				managementUrl: "managementUrlTest"
			});
			selfServiceManager.getUserDetails(testUuid, providedIamToken).then(function (res) {
				try {
					assert.equal(JSON.stringify(res), JSON.stringify(testUuid));
					done();
				} catch (err) {
					done(err);
				}
			}).catch(function (err) {
				done(err);
			})
		});
		
		it("Should reject on _getIAMToken", function (done) {
			let selfServiceManager = new SelfServiceManager({
				managementUrl: "managementUrlTest",
				iamApiKey: badIamApiKey
			});
			selfServiceManager.getUserDetails(testUuid).then(function (user) {
				done("should reject");
			}).catch(function (err) {
				try{
					assert.equal(badIamApiKey, err.message);
					done();
				}catch (e) {
					done(e);
				}
			})
		});
		
		it("Should reject on _handleRequest", function (done) {
			selfServiceManager.getUserDetails({}).then(function (user) {
				done("should reject");
			}).catch(function (err) {
				try {
					assert.equal("wrong input to _handleRequest in getUserDetails API", err);
					done();
				} catch (e){
					done(e);
				}
			})
		});
	});
	
	describe("#SelfServiceManager.updateUserDetails", function () {
		let selfServiceManager;
		let testUuid = "testUuid";
		let expectedQuery = {};
		let testIamToken = "bearer axcvrd";
		let badIamApiKey = "badIamApiKey";
		let providedIamToken = "bearer 123";
		let testUserJson = {email: "testEmail"};
		let _handleRequestRevert, _getIAMTokenRevert;
		
		let stubHandleRequest = function (iamToken, method, url, body, queryObject , action, deferred) {
			if (iamToken !== testIamToken ||
				method !== "PUT" ||
				url !== "managementUrlTest/cloud_directory/Users/testUuid" ||
				action !== "update user details" ||
				JSON.stringify(body) !== JSON.stringify(testUserJson) ||
				JSON.stringify(queryObject) !== JSON.stringify(expectedQuery)) {
				return deferred.reject("wrong input to _handleRequest in updateUserDetails API");
			}
			return deferred.resolve(testUuid);
		};
		
		let stubGetIAMToken = function (iamToken, iamApiKey, iamTokenUrl) {
			if (!iamApiKey){
				if (iamToken !== providedIamToken) {
					return Q.reject("iamToken was not received to _getIAMToken function");
				} else {
					return Q.resolve(testIamToken);
				}
			}
			if (badIamApiKey === iamApiKey) {
				return Q.reject(new Error(badIamApiKey));
			}
			if (iamApiKey !== "testIamApiKey" || iamTokenUrl !== "https://iam.bluemix.net/oidc/token") {
				return Q.reject("wrong input to _getIAMToken in updateUserDetails API");
			}
			return Q.resolve(testIamToken);
		};
		before(function (done) {
			_handleRequestRevert = SelfServiceManager.__set__("_handleRequest", stubHandleRequest);
			_getIAMTokenRevert = SelfServiceManager.__set__("_getIAMToken", stubGetIAMToken);
			selfServiceManager = new SelfServiceManager({
				managementUrl: "managementUrlTest",
				iamApiKey: "testIamApiKey"
			});
			done();
		});
		
		after(function (done) {
			_handleRequestRevert();
			_getIAMTokenRevert();
			done();
		});
		
		it("Should successfully update user details", function (done) {
			selfServiceManager.updateUserDetails(testUuid, testUserJson).then(function (res) {
				try {
					assert.equal(JSON.stringify(res), JSON.stringify(testUuid));
					done();
				} catch (err) {
					done(err);
				}
			}).catch(function (err) {
				done(err);
			})
		});
		
		it("Should successfully update user details with provided iamToken", function (done) {
			let selfServiceManager = new SelfServiceManager({
				managementUrl: "managementUrlTest"
			});
			selfServiceManager.updateUserDetails(testUuid, testUserJson, providedIamToken).then(function (res) {
				try {
					assert.equal(JSON.stringify(res), JSON.stringify(testUuid));
					done();
				} catch (err) {
					done(err);
				}
			}).catch(function (err) {
				done(err);
			})
		});
		
		it("Should reject on _getIAMToken", function (done) {
			let selfServiceManager = new SelfServiceManager({
				managementUrl: "managementUrlTest",
				iamApiKey: badIamApiKey
			});
			selfServiceManager.updateUserDetails(testUuid, testUserJson).then(function (user) {
				done("should reject");
			}).catch(function (err) {
				try{
					assert.equal(badIamApiKey, err.message);
					done();
				}catch (e) {
					done(e);
				}
			})
		});
		
		it("Should reject on _handleRequest", function (done) {
			selfServiceManager.updateUserDetails({}, testUserJson).then(function (user) {
				done("should reject");
			}).catch(function (err) {
				try {
					assert.equal("wrong input to _handleRequest in updateUserDetails API", err);
					done();
				} catch (e){
					done(e);
				}
			})
		});
	});
	
	describe("test _getIAMToken function", function () {
		let _getIAMToken,stubRequestRevert;
		let testToken = "testToken";
		let netError = "netError";
		let badInputError = "badInputError";
		let testApiKey = "testApiKey";
		let testUrl = "testUrl";
		let error = new Error("bad input to iam request");
		let netErrorObject = new Error("network issue");
		let inputErrorBody = {error: "some bad input"};
		let expectedInput = {
			url:  testUrl,
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				"Accept": "application/json"
			},
			form : {
				"grant_type":"urn:ibm:params:oauth:grant-type:apikey",
				"apikey" : testApiKey
			}
		};
		
		let stubRequest = function (options, callback) {
			if (options.url === netError) {
				return callback(netErrorObject, {}, {});
			}
			if (options.url === badInputError) {
				return callback(null, {statusCode: 400}, inputErrorBody);
			}
			if (JSON.stringify(options) !== JSON.stringify(expectedInput)) {
				return callback(error, {}, {});
			}
			callback(null, {statusCode: 200}, JSON.stringify({"access_token": testToken}));
			
		};
		before(function (done) {
			_getIAMToken = SelfServiceManager.__get__("_getIAMToken");
			stubRequestRevert = SelfServiceManager.__set__("request", stubRequest);
			done();
		});
		after(function (done) {
			stubRequestRevert();
			done();
		});
		
		it("iamToken provided", function (done) {
			_getIAMToken(testToken).then(function (token) {
				try{
					assert.equal(testToken, token);
					done();
				}catch(e) {
					done(e);
				}
			}).catch(function (err) {
				done(err);
			});
		});
		
		it("no iamToken no iamApiKey", function (done) {
			_getIAMToken().then(function () {
				done("should not get here");
			}).catch(function (err) {
				try{
					assert.equal("You must pass 'iamToken' to self-service-manager APIs or specify 'iamApiKey' in selfServiceManager init options.", err);
					done();
				} catch (e) {
					done(e);
				}
			});
		});
		
		it("happy flow - should get iamToken from iam endpoint", function (done) {
			_getIAMToken(null, testApiKey, testUrl).then(function (token) {
				try{
					assert.equal(testToken, token);
					done();
				}catch(e) {
					done(e);
				}
			}).catch(function (err) {
				done(err);
			});
		});
		
		it("request failure network issue", function (done) {
			_getIAMToken(null, testApiKey, netError).then(function () {
				done("should not get here");
			}).catch(function (err) {
				try{
					assert.equal("network issue", err);
					done();
				} catch (e) {
					done(e);
				}
			});
		});
		
		it("request failure bad input", function (done) {
			_getIAMToken(null, testApiKey, badInputError).then(function () {
				done("should not get here");
			}).catch(function (err) {
				try{
					assert.equal(inputErrorBody, err);
					done();
				} catch (e) {
					done(e);
				}
			});
		});
	});
	
	describe("test _handleRequest function", function () {
		let _handleRequest;
		let testToken = "testToken";
		let netError = "netError";
		let badInputError = "badInputError";
		let badInputErrorBodyString = "badInputErrorBodyString";
		let badInputErrorBodyWithDetail = "badInputErrorBodyWithDetail";
		let badInputErrorBodyWithMessage = "badInputErrorBodyWithMessage";
		let testApiKey = "testApiKey";
		let testUrl = "testUrl";
		let error = new Error("bad input to iam request");
		let netErrorObject = new Error("network issue");
		let inputErrorBody = {error: "some bad input"};
		let inputErrorBodyString = "some error string";
		let inputErrorBodyDetail = {detail:"some detail", scimType: "some scimType"};
		let inputErrorBodyMessage = {message: "some message"};
		let body = {t:"t"};
		let queryObject = {r:"r"};
		let action = "action";
		let method = "POST";
		let successBody = {e:"e"};
		let stubRequestRevert;
		
		let expectedInput = {
			url: testUrl,
			method: method,
			qs: queryObject,
			json: body,
			headers: {
				"Authorization": "Bearer " + testToken
			}
		};
		let expectedInputForGet = {
			url: testUrl,
			method: "GET",
			qs: queryObject,
			json: true,
			headers: {
				"Authorization": "Bearer " + testToken
			}
		};
		
		let stubRequest = function (options, callback) {
			if (options.method === "GET") {
				if (JSON.stringify(options) !== JSON.stringify(expectedInputForGet)) {
					return callback(error, {}, {});
				}
				return callback(null, {statusCode: 200}, successBody);
			}
			if (options.url === netError) {
				return callback(netErrorObject, {}, {});
			}
			if (options.url === badInputError) {
				return callback(null, {statusCode: 400}, inputErrorBody);
			}
			if (options.url === badInputErrorBodyString) {
				return callback(null, {statusCode: 400}, inputErrorBodyString);
			}
			if (options.url === badInputErrorBodyWithDetail) {
				return callback(null, {statusCode: 400}, inputErrorBodyDetail);
			}
			if (options.url === badInputErrorBodyWithMessage) {
				return callback(null, {statusCode: 400}, inputErrorBodyMessage);
			}
			if (JSON.stringify(options) !== JSON.stringify(expectedInput)) {
				return callback(error, {}, {});
			}
			return callback(null, {statusCode: 200}, successBody);
			
		};
		before(function (done) {
			_handleRequest = SelfServiceManager.__get__("_handleRequest");
			stubRequestRevert = SelfServiceManager.__set__("request", stubRequest);
			done();
		});
		after(function(done){
			stubRequestRevert();
			done();
		});
		
		it("happy flow - should return success response", function (done) {
			let deferred = {
				resolve: function (inputBody) {
					try{
						assert.equal(successBody, inputBody);
						done();
					}catch(e) {
						done(e);
					}
				},
				reject: function (err) {
					done(err);
				}
			};
			_handleRequest(testToken, method, testUrl, body, queryObject , action, deferred);
			
		});
		
		it("request failure network issue", function (done) {
			let deferred = {
				resolve: function (result) {
					done("should reject");
				},
				reject: function (err) {
					try{
						assert.equal("general_error", err.code);
						assert.equal("Failed to " + action, err.message);
						done();
					}catch(e) {
						done(e);
					}
				}
			};
			_handleRequest(testToken, method, netError, body, queryObject , action, deferred);
		});
		
		it("request failure bad input", function (done) {
			let deferred = {
				resolve: function (body) {
					done("should reject");
					
				},
				reject: function (err) {
					try{
						assert.equal("some bad input", err.message);
						done();
					}catch(e) {
						done(e);
					}
				}
			};
			_handleRequest(testToken, method, badInputError, body, queryObject , action, deferred);
		});
		
		it("validate request with GET does not have body", function (done) {
			let deferred = {
				resolve: function (body) {
					try{
						assert.equal(successBody, body);
						done();
					}catch(e) {
						done(e);
					}
				},
				reject: function (err) {
					done(err);
				}
			};
			_handleRequest(testToken, "GET", testUrl, body, queryObject , action, deferred);
			
		});
		
		it("request failure bad input - body is not object", function (done) {
			let deferred = {
				resolve: function (body) {
					done("should reject");
				},
				reject: function (err) {
					try{
						assert.equal(inputErrorBodyString, err.message);
						done();
					}catch(e) {
						done(e);
					}
				}
			};
			_handleRequest(testToken, method, badInputErrorBodyString, body, queryObject , action, deferred);
		});
		
		it("request failure bad input - body with detail", function (done) {
			let deferred = {
				resolve: function (body) {
					done("should reject");
				},
				reject: function (err) {
					try{
						assert.equal(inputErrorBodyDetail.scimType, err.code);
						assert.equal(inputErrorBodyDetail.detail, err.message);
						done();
					}catch(e) {
						done(e);
					}
				}
			};
			_handleRequest(testToken, method, badInputErrorBodyWithDetail, body, queryObject , action, deferred);
		});
		
		it("request failure bad input - body with message", function (done) {
			let deferred = {
				resolve: function (body) {
					done("should reject");
				},
				reject: function (err) {
					try{
						assert.equal(inputErrorBodyMessage.message, err.message);
						done();
					}catch(e) {
						done(e);
					}
				}
			};
			_handleRequest(testToken, method, badInputErrorBodyWithMessage, body, queryObject , action, deferred);
		});
		
	});
	
});



