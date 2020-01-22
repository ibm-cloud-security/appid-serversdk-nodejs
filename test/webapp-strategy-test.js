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
const expect = chai.expect;
const proxyquire = require("proxyquire");
const defaultLocale = "en";
const previousAccessToken = "test.previousAccessToken.test";
chai.use(require("chai-as-promised"));
const tokenUtilsMock=require("./mocks/token-util-mock");
describe("/lib/strategies/webapp-strategy", function () {
	console.log("Loading webapp-strategy-test.js");
	
	var WebAppStrategy;
	var webAppStrategy;
	before(function () {
		WebAppStrategy = proxyquire("../lib/strategies/webapp-strategy", {
			"../utils/token-util": tokenUtilsMock,
			"request": require("./mocks/request-mock")
		});
		webAppStrategy = new WebAppStrategy({
			tenantId: "tenantId",
			clientId: "clientId",
			secret: "secret",
			oauthServerUrl: "https://oauthServerUrlMock",
			redirectUri: "https://redirectUri"
		});
	});

	describe("#SSO ", () => {
		let resultRedirect='';
		const redirectURL =  "http://localhost:3000/somethingElse";

		beforeEach( () => {
			resultRedirect='';
		});

		it("good callback" , () => {
			let req = {
				session: { returnTo : 'ssss'},
				logout : function(req) {}
			};
			let res = {
				redirect : function (url) {
					resultRedirect = url;
				}
			};

			let options = { redirect_uri: redirectURL};
			webAppStrategy.logoutSSO(req,res, options);
			const uriEncodedCallBack = encodeURIComponent(redirectURL);
			const excpected = `https://oauthServerUrlMock/cloud_directory/sso/logout?redirect_uri=${uriEncodedCallBack}&client_id=clientId`;
			assert.equal(resultRedirect, excpected);
			assert.equal(req.session.returnTo , undefined); // expect session to be cleaned.
		});

	});

	
	describe("#setPreferredLocale", function () {
		it("Should fail if request doesn't have session", function (done) {
			var failed = false;
			webAppStrategy.error = function (err) {
				assert.equal(err.message, "Can't find req.session");
				failed = true;
				
			};
			
			webAppStrategy.setPreferredLocale({}, "fr");
			assert.equal(true, failed);
			done();
			
		});
		
		it("Should succeed if request has session", function (done) {
			var failed = false;
			var req = {session: {}};
			webAppStrategy.error = function (err) {
				failed = true;
			};
			
			webAppStrategy.setPreferredLocale(req, "fr");
			assert.equal("fr", req.session["language"]);
			done();
		});
	});
	
	describe("#properties", function () {
		it("Should have all properties", function () {
			assert.isFunction(WebAppStrategy);
			assert.equal(WebAppStrategy.STRATEGY_NAME, "appid-webapp-strategy");
			assert.equal(WebAppStrategy.DEFAULT_SCOPE, "appid_default");
			assert.equal(WebAppStrategy.AUTH_CONTEXT, "APPID_AUTH_CONTEXT");
		});
	});
	
	describe("#logout", function () {
		it("Should be able to successfully logout", function (done) {
			var req = {
				logout: function () {
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
	
	describe("#authenticate()", function () {
		beforeEach(()=>tokenUtilsMock.setValidateIssAndAudResponse(true));
		describe("refresh-token", function () {

			var req;

			beforeEach(function () {
				tokenUtilsMock.setValidateIssAndAudResponse(true);
				req = {
					session: {}
				}
			});

			function validateContext(done) {
				var context = req.session[WebAppStrategy.AUTH_CONTEXT];
				try {
					assert.equal(context.accessToken, "access_token_mock");
					assert.equal(context.refreshToken, "refresh_token_mock");
					assert.equal(context.refreshToken, "refresh_token_mock");
				} catch (e) {
					return done(e);
				}
				done();
			}

			it("Should succeed if it has a valid refresh token", function (done) {
				webAppStrategy.refreshTokens(req, "WORKING_REFRESH_TOKEN").then(function () {
					validateContext(done);
				}).catch(done);
			});

			it("Should fail if it has no refresh token", function () {
				return expect(webAppStrategy.refreshTokens(req, null)).to.be.rejectedWith("no refresh");
			});

			it("Should fail for invalid refresh token", function () {
				return expect(webAppStrategy.refreshTokens(req, "INVALID_REFRESH_TOKEN")).to.be.rejectedWith("invalid grant");
			});

			it("Should keep the context empty for invalid refresh token", function (done) {
				webAppStrategy.refreshTokens(req, "INVALID_REFRESH_TOKEN").then(function () {
					done(new Error("should fail"));
				}).catch(function () {
					try {
						assert(!req.session[WebAppStrategy.AUTH_CONTEXT], "context shouldn't exist");
						done();
					} catch (e) {
						done(e);
					}
				});
			});
		});

		it("Should fail if request doesn't have session", function (done) {
			webAppStrategy.error = function (err) {
				assert.equal(err.message, "Can't find req.session");
				done();
			};
			
			webAppStrategy.authenticate({});
		});
		
		it("Should be able to detect unauthenticated request and redirect to authorization", function (done) {
			var req = {
				originalUrl: "originalUrl",
				session: {}
			};
			
			webAppStrategy.redirect = function (url) {
				assert.equal(url, "https://oauthServerUrlMock/authorization?client_id=clientId&response_type=code&redirect_uri=https://redirectUri&scope=appid_default&state=123456789");
				assert.equal(req.session.returnTo, "originalUrl");
				done();
			};
			
			webAppStrategy.authenticate(req, {});
		});
	  
		it("Should not succeed when already authenticated with an expired token (default is allowExpiredTokensOnSession=false)", function (done) {
		  const req = {
			session: {
			  APPID_AUTH_CONTEXT: {
				accessTokenPayload: {
				  exp: 12, // smaller than Date.now() -> expired
				  amr: []
				}
			  }
			}
		  };
		  
		  webAppStrategy.success = function () {
			  assert.fail('authentication should not have succeeded.');
		  };
		  
		  webAppStrategy.redirect = function () {
			  done();
		  };
		  
		  webAppStrategy.authenticate(req, {});
		});
	  
		it("Should fail when already authenticated with an expired token, when allowExpiredTokensOnSession=false", function (done) {
		  const req = {
			session: {
			  APPID_AUTH_CONTEXT: {
				accessTokenPayload: {
				  exp: 12, // smaller than Date.now() -> expired
				  amr: []
				}
			  }
			}
		  };
		  
		  webAppStrategy.success = function () {
			assert.fail('authentication shouln\'t have succeeded.');
		  };
		  
		  webAppStrategy.redirect = function () {
			done();
		  };
		  
		  webAppStrategy.authenticate(req, {allowExpiredTokensOnSession: false});
		});
		
		it("Should succeed when already authenticated with an unexpired token, when allowExpiredTokensOnSession=false", function (done) {
		  const req = {
			session: {
			  APPID_AUTH_CONTEXT: {
				accessTokenPayload: {
				  exp: Date.now() / 1000 + 30, // valid, expires after 30 seconds
				  amr: []
				}
			  }
			}
		  };
		  
		  webAppStrategy.success = function () {
			done();
		  };
		  
		  webAppStrategy.redirect = function () {
			assert.fail('authentication should have succeeded.');
		  };
		  
		  webAppStrategy.authenticate(req, {allowExpiredTokensOnSession: false});
		});
		
		it("Should be able to detect authenticated request and skip strategy", function (done) {
			var req = {
				isAuthenticated: function () {
					return true;
				},
				session: {}
			};
			req.session[WebAppStrategy.AUTH_CONTEXT] = {
				identityTokenPayload: {},
				accessTokenPayload: {
					exp: Date.now() / 1000 + 30 // valid, expires after 30 seconds
				}
			};
			
			webAppStrategy.success = function () {
				done();
			};
			
			webAppStrategy.authenticate(req, {});
		});
		
		
		it("Should fail if error was returned in callback", function (done) {
			webAppStrategy.fail = function () {
				done();
			};
			
			webAppStrategy.authenticate({
				session: {},
				query: {
					error: "test error"
				}
			});
		});



		describe("handle RoP flow", function () {
			it("Should handle RoP flow successfully", function (done) {
				webAppStrategy.fail = function (err) {
					done(err);
				};
				webAppStrategy.success = function (user) {
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
					method: "POST",
					body: {
						username: "test_username",
						password: "good_password"
					}
				};
				webAppStrategy.authenticate(req);
			});
			
			it("Should handle RoP flow successfully with previous access token", function (done) {
				webAppStrategy.fail = function (err) {
					done(err);
				};
				webAppStrategy.success = function (user) {
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
				var session = {};
				var accessTokenPayload = {
					amr: ["appid_anon"]
				};
				var accessToken = previousAccessToken;
				var appIdAuthContext = {
					accessToken: accessToken,
					accessTokenPayload: accessTokenPayload
				};
				session[WebAppStrategy.AUTH_CONTEXT] = appIdAuthContext;
				var req = {
					session: session,
					method: "POST",
					body: {
						username: "test_username",
						password: "good_password"
					}
				};
				webAppStrategy.authenticate(req);
			});
			
			it("Should handle RoP flow successfully - check options", function (done) {
				webAppStrategy.fail = function (err) {
					done(err);
				};
				webAppStrategy.success = function (user) {
					assert.equal(options.successRedirect, "test_success_url");
					assert.equal(options.failureRedirect, "test_failure_url");
					assert.equal(options.failureFlash, true);
					assert.isObject(req.session[WebAppStrategy.AUTH_CONTEXT]);
					assert.isString(req.session[WebAppStrategy.AUTH_CONTEXT].accessToken);
					assert.equal(req.session[WebAppStrategy.AUTH_CONTEXT].accessToken, "access_token_mock_test_scope");
					assert.isObject(req.session[WebAppStrategy.AUTH_CONTEXT].accessTokenPayload);
					assert.equal(req.session[WebAppStrategy.AUTH_CONTEXT].accessTokenPayload.scope, "test_scope");
					assert.isString(req.session[WebAppStrategy.AUTH_CONTEXT].identityToken);
					assert.equal(req.session[WebAppStrategy.AUTH_CONTEXT].identityToken, "id_token_mock_test_scope");
					assert.isObject(req.session[WebAppStrategy.AUTH_CONTEXT].identityTokenPayload);
					assert.equal(req.session[WebAppStrategy.AUTH_CONTEXT].identityTokenPayload.scope, "test_scope");
					assert.isObject(user);
					assert.equal(user.scope, "test_scope");
					done();
				};
				var req = {
					session: {},
					method: "POST",
					body: {
						username: "test_username",
						password: "good_password"
					}
				};
				var options = {
					scope: "test_scope",
					successRedirect: "test_success_url",
					failureRedirect: "test_failure_url",
					failureFlash: true
				};
				webAppStrategy.authenticate(req, options);
			});
			
			it("Should handle RoP flow failure - bad credentials", function (done) {
				webAppStrategy.fail = function (err) {
					assert.equal(err.message, "wrong credentials");
					done();
				};
				var req = {
					session: {},
					method: "POST",
					body: {
						username: "test_username",
						password: "bad_password"
					}
				};
				webAppStrategy.authenticate(req);
			});
			
			it("Should handle RoP flow - request failure", function (done) {
				webAppStrategy.fail = function (err) {
					assert.equal(err.message, "REQUEST_ERROR");
					done();
				};
				var req = {
					session: {},
					method: "POST",
					body: {
						username: "request_error",
						password: "good_password"
					}
				};
				webAppStrategy.authenticate(req);
			});
			
			it("Should handle RoP flow - JSON parse failure", function (done) {
				webAppStrategy.fail = function (err) {
					assert.equal(err.message, "Failed to obtain tokens");
					done();
				};
				var req = {
					session: {},
					method: "POST",
					body: {
						username: "parse_error",
						password: "good_password"
					}
				};
				webAppStrategy.authenticate(req);
			});
			
			
			it("Happy SIGN_UP flow - check req.session.originalUrl = successRedirect", function (done) {
				var req = {
					session: {},
					isAuthenticated: function () {
						return false;
					},
					isUnauthenticated: function () {
						return true;
					}
				};
				
				webAppStrategy.redirect = function (url) {
					assert.equal(req.session.returnTo, "success-redirect");
					assert.include(url, "response_type=sign_up");
					done();
				};
				
				webAppStrategy.authenticate(req, {
					show: WebAppStrategy.SIGN_UP,
					successRedirect: "success-redirect"
				});
				
			});
		});
		
		it("Should handle callback if request contains grant code. Fail due to missing state", function (done) {
			webAppStrategy.fail = function (err) {
				assert.equal(err.message, "Invalid session state");
				done();
			};
			var req = {
				session: {},
				query: {
					code: "FAILING_CODE"
				}
			};
			webAppStrategy.authenticate(req);
		});
		
		it("Should handle callback if request contains grant code and state. Invalid state parameter ", function (done) {
			webAppStrategy.fail = function (err) {
				assert.equal(err.message, "Invalid state parameter");
				done();
			};
			var req = {
				session: {},
				query: {
					code: "FAILING_CODE",
					state: "1234567"
				}
			};
			req.session[WebAppStrategy.STATE_PARAMETER] = { anonymousLogin : false , state : "123456789" };
			webAppStrategy.authenticate(req);
		});

		it("Should handle callback if request contains grant code and state. Fail due to tokenEndpoint error", function (done) {
			webAppStrategy.fail = function (err) {
				assert.equal(err.message, "STUBBED_ERROR");
				done();
			};
			var req = {
				session: {},
				query: {
					code: "FAILING_CODE",
					state: "123456789"
				}
			};
			req.session[WebAppStrategy.STATE_PARAMETER] = { anonymousLogin : false , state : "123456789" };
			webAppStrategy.authenticate(req);
		});

		it("Should handle callback if request contains grant code. Success with options.successRedirect", function (done) {
			webAppStrategy.fail = function (err) {
				assert.equal(err.message, "Invalid state parameter");
				done();
			};
			webAppStrategy.success = function (user) {
				
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
					code: "WORKING_CODE",
					state: ""
				}
			};
			
			var options = {
				successRedirect: "redirectUri"
			};
			req.session[WebAppStrategy.STATE_PARAMETER] = { anonymousLogin : false , state : "123456789" };
			webAppStrategy.authenticate(req, options);
		});
		
		it("Should handle callback if request contains grant code. Success with original URL", function (done) {
			webAppStrategy.success = function () {
				try {
					assert(options.successReturnToOrRedirect);
					done();
				} catch (e) {
					done(e);
				}
			};
			
			var req = {
				session: {
					returnTo: "originalUri"
				},
				query: {
					code: "WORKING_CODE",
					state: "123456789"
				}
			};
			
			var options = {};
			req.session[WebAppStrategy.STATE_PARAMETER] = { anonymousLogin : false , state : "123456789" };
			webAppStrategy.authenticate(req, options);
		});

		it("Should fail if issuer validation is failing -Access Token", function (done) {
			tokenUtilsMock.setValidateIssAndAudResponse(false);
			webAppStrategy.success = function () {
				done('suppose to fail');
			};
			webAppStrategy.fail = function (err) {
				assert.equal(err.message, "Authentication failed : token validation failed");
				done();

			};
			var req = {
				session: {
					returnTo: "originalUri"
				},
				query: {
					code: "WORKING_CODE",
					state: "123456789"
				}
			};

			var options = {};
			req.session[WebAppStrategy.STATE_PARAMETER] = { anonymousLogin : false , state : "123456789" };
			webAppStrategy.authenticate(req, options);
		});
		it("Should fail if issuer validation is failing -id Token", function (done) {
			tokenUtilsMock.setValidateIssAndAudResponse(true);
			tokenUtilsMock.switchIssuerState();
			webAppStrategy.success = function () {
				done('suppose to fail');
			};
			webAppStrategy.fail = function (err) {
				assert.equal(err.message, "Authentication failed : token validation failed");
				done();

			};
			var req = {
				session: {
					returnTo: "originalUri"
				},
				query: {
					code: "WORKING_CODE",
					state: "123456789"
				}
			};

			var options = {};
			req.session[WebAppStrategy.STATE_PARAMETER] = { anonymousLogin : false , state : "123456789" };
			webAppStrategy.authenticate(req, options);
		});
		
		it("Should not be able to login with null identity token", function (done) {
			webAppStrategy.fail = function (err) {
				assert.equal(err.message, "Authentication failed : Invalid access/id token");
				done();
			};
			
			var req = {
				session: {
					returnTo: "originalUri"
				},
				query: {
					code: "NULL_ID_TOKEN",
					state : "123456789"
				}
			};
			
			var options = {};
			req.session[WebAppStrategy.STATE_PARAMETER] = { anonymousLogin : false , state : "123456789" };
			webAppStrategy.authenticate(req, options);
		});
		
		it("Should handle callback if request contains grant code. Success with redirect to /", function (done) {
			webAppStrategy.success = function () {
				assert(options.successReturnToOrRedirect);
				done();
			};
			
			var req = {
				session: {},
				query: {
					code: "WORKING_CODE",
					state : "123456789"
				}
			};
			
			var options = {};
			req.session[WebAppStrategy.STATE_PARAMETER] = { anonymousLogin : false , state : "123456789" };
			webAppStrategy.authenticate(req, options);
		});
		
		it("Should handle callback if request contains grant code. Success with redirect to successRedirect", function (done) {
			webAppStrategy.redirect = function (url) {
				assert.equal(url, "https://oauthServerUrlMock/authorization?client_id=clientId&response_type=code&redirect_uri=https://redirectUri&scope=appid_default&state=123456789");
				assert.equal(req.session.returnTo, "success-callback");
				done();
			};
			
			var req = {
				session: {}
			};
			
			var options = {
				successRedirect: "success-callback"
			};
			
			webAppStrategy.authenticate(req, options);
		});
		
		
		it("Should handle authorization redirect to App ID /authorization endpoint with default scope", function (done) {
			webAppStrategy.redirect = function (url) {
				assert.equal(url, encodeURI("https://oauthServerUrlMock/authorization?client_id=clientId&response_type=code&redirect_uri=https://redirectUri&scope=appid_default&state=123456789"));
				done();
			}
			webAppStrategy.authenticate({
				session: {},
				isAuthenticated: function () {
					return false;
				}
			});
		});
		
		it("Should handle authorization redirect to App ID /authorization endpoint with custom scope", function (done) {
			webAppStrategy.redirect = function (url) {
				assert.equal(url, encodeURI("https://oauthServerUrlMock/authorization?client_id=clientId&response_type=code&redirect_uri=https://redirectUri&scope=appid_default customScope&state=123456789"));
				done();
			};
			webAppStrategy.authenticate({
				session: {},
				isAuthenticated: function () {
					return false;
				}
			}, {
				scope: "customScope"
			});
		});
		
		it("Should inject anonymous access token into request url if one is present", function (done) {
			var req = {
				session: {}
			};
			req.session[WebAppStrategy.AUTH_CONTEXT] = {
				accessTokenPayload: {
					amr: ["appid_anon"],
					exp: Date.now() / 1000 + 30 // valid, expires after 30 seconds
				},
				accessToken: "test_access_token"
			};
			webAppStrategy.redirect = function (url) {
				try {
					assert.include(url, "appid_access_token=test_access_token");
					done();
				} catch (e) {
					done(e);
				}
			};
			
			webAppStrategy.authenticate(req, {forceLogin: true});
		});
		
		it("Should fail if previous anonymous access token is not found and anon user is not allowed", function (done) {
			var req = {
				session: {},
				isAuthenticated: function () {
					return false;
				}
			};
			
			webAppStrategy.fail = function () {
				done();
			};
			
			webAppStrategy.authenticate(req, {
				allowAnonymousLogin: true,
				allowCreateNewAnonymousUser: false
			});
		});
		
		it("Should be able to login anonymously", function (done) {
			var req = {
				session: {},
				isAuthenticated: function () {
					return false;
				}
			};
			
			webAppStrategy.redirect = function (url) {
				assert.include(url, "idp=appid_anon");
				done();
			};
			
			webAppStrategy.authenticate(req, {
				allowAnonymousLogin: true,
				allowCreateNewAnonymousUser: true
			});
		});
		
		it("Should show sign up screen", function (done) {
			var req = {
				session: {},
				isAuthenticated: function () {
					return false;
				}
			};
			
			webAppStrategy.redirect = function (url) {
				assert.include(url, "response_type=sign_up");
				done();
			};
			
			webAppStrategy.authenticate(req, {
				show: WebAppStrategy.SIGN_UP
			});
		});
		
		describe("change password tests", function () {
			it("user not authenticated", function (done) {
				var req = {
					session: {},
					isAuthenticated: function () {
						return false;
					},
					isUnauthenticated: function () {
						return true;
					}
				};
				
				webAppStrategy.fail = function (error) {
					try {
						assert.equal(error.message, "No identity token found.");
						done();
					} catch (e) {
						done(e);
					}
				};
				
				webAppStrategy.authenticate(req, {
					show: WebAppStrategy.CHANGE_PASSWORD
				});
			});
			
			it("user authenticated but not with cloud directory", function (done) {
				var req = {
					session: {APPID_AUTH_CONTEXT: {identityTokenPayload: {amr: ["not_cloud_directory"]}}},
					isAuthenticated: function () {
						return true;
					},
					isUnauthenticated: function () {
						return false;
					}
				};
				
				webAppStrategy.fail = function (error) {
					try {
						assert.equal(error.message, "The identity token was not retrieved using cloud directory idp.");
						done();
					} catch (e) {
						done(e);
					}
				};
				
				webAppStrategy.authenticate(req, {
					show: WebAppStrategy.CHANGE_PASSWORD
				});
			});
			
			it("happy flow - user authenticated with cloud directory", function (done) {
				var req = {
					session: {
						APPID_AUTH_CONTEXT: {
							identityTokenPayload: {
								amr: ["cloud_directory"],
								identities: [{id: "testUserId"}]
							}
						}
					},
					isAuthenticated: function () {
						return true;
					},
					isUnauthenticated: function () {
						return false;
					}
				};
				
				webAppStrategy.redirect = function (url) {
					assert.include(url, "/cloud_directory/change_password?client_id=clientId&redirect_uri=https://redirectUri&user_id=testUserId");
					done();
				};
				
				webAppStrategy.authenticate(req, {
					show: WebAppStrategy.CHANGE_PASSWORD
				});
			});
		});
		
		describe("change details tests", function () {
			it("user not authenticated", function (done) {
				var req = {
					session: {},
					isAuthenticated: function () {
						return false;
					},
					isUnauthenticated: function () {
						return true;
					}
				};
				
				webAppStrategy.fail = function (error) {
					try {
						assert.equal(error.message, "No identity token found.");
						done();
					} catch (e) {
						done(e);
					}
				};
				
				webAppStrategy.authenticate(req, {
					show: WebAppStrategy.CHANGE_DETAILS
				});
			});
			
			it("user authenticated but not with cloud directory", function (done) {
				var req = {
					session: {APPID_AUTH_CONTEXT: {identityTokenPayload: {amr: ["not_cloud_directory"]}}},
					isAuthenticated: function () {
						return true;
					},
					isUnauthenticated: function () {
						return false;
					}
				};
				
				webAppStrategy.fail = function (error) {
					try {
						assert.equal(error.message, "The identity token was not retrieved using cloud directory idp.");
						done();
					} catch (e) {
						done(e);
					}
				};
				
				webAppStrategy.authenticate(req, {
					show: WebAppStrategy.CHANGE_DETAILS
				});
			});
			
			it("happy flow - user authenticated with cloud directory", function (done) {
				var req = {
					session: {
						APPID_AUTH_CONTEXT: {
							identityTokenPayload: {
								amr: ["cloud_directory"],
								identities: [{id: "testUserId"}]
							}
						}
					},
					isAuthenticated: function () {
						return true;
					},
					isUnauthenticated: function () {
						return false;
					}
				};
				
				webAppStrategy.redirect = function (url) {
					assert.include(url, "/cloud_directory/change_details?client_id=clientId&redirect_uri=https://redirectUri&code=1234");
					done();
				};
				
				webAppStrategy.authenticate(req, {
					show: WebAppStrategy.CHANGE_DETAILS
				});
			});
			
			it("Bad flow - error on generate code request", function (done) {
				var req = {
					session: {
						APPID_AUTH_CONTEXT: {
							identityToken: "error",
							identityTokenPayload: {
								amr: ["cloud_directory"],
								identities: [{id: "testUserId"}]
							}
						}
					},
					isAuthenticated: function () {
						return true;
					},
					isUnauthenticated: function () {
						return false;
					}
				};
				
				webAppStrategy.fail = function (error) {
					assert.include(error.message, "STUBBED_ERROR");
					done();
				};
				
				webAppStrategy.authenticate(req, {
					show: WebAppStrategy.CHANGE_DETAILS
				});
			});
			
			it("Bad flow - not 200 response on generate code request", function (done) {
				var req = {
					session: {
						APPID_AUTH_CONTEXT: {
							identityToken: "statusNot200",
							identityTokenPayload: {
								amr: ["cloud_directory"],
								identities: [{id: "testUserId"}]
							}
						}
					},
					isAuthenticated: function () {
						return true;
					},
					isUnauthenticated: function () {
						return false;
					}
				};
				
				webAppStrategy.fail = function (error) {
					assert.include(error.message, "generate code: response status code:400");
					done();
				};
				
				webAppStrategy.authenticate(req, {
					show: WebAppStrategy.CHANGE_DETAILS
				});
			});
		});
		
		describe("forgot password tests", function () {
			it("Happy flow", function (done) {
				var req = {
					session: {
						APPID_AUTH_CONTEXT: {
							identityTokenPayload: {
								amr: ["cloud_directory"],
								identities: [{id: "testUserId"}]
							}
						}
					},
					isAuthenticated: function () {
						return true;
					},
					isUnauthenticated: function () {
						return false;
					}
				};
				
				webAppStrategy.redirect = function (url) {
					assert.include(url, "/cloud_directory/forgot_password?client_id=clientId");
					done();
				};
				
				webAppStrategy.authenticate(req, {
					show: WebAppStrategy.FORGOT_PASSWORD
				});
				
			});
			
			describe("auto detection of local", function () {
				
				it("check detection", function (done) {
					var req = {
						headers: {
							"accept-language": "he,en;q=0.9,en-US;q=0.8"
						},
						session: {
							APPID_AUTH_CONTEXT: {
								identityTokenPayload: {
									amr: ["cloud_directory"],
									identities: [{id: "testUserId"}]
								}
							}
						},
						isAuthenticated: function () {
							return true;
						},
						isUnauthenticated: function () {
							return false;
						}
					};
					
					webAppStrategy.redirect = function (url) {
						assert.include(url, "/cloud_directory/forgot_password?client_id=clientId&redirect_uri=https://redirectUri&language=he");
						done();
					};
					
					webAppStrategy.authenticate(req, {
						show: WebAppStrategy.FORGOT_PASSWORD
					});
					
				});
			});
			
			it("Happy FORGOT_PASSWORD flow - check req.session.originalUrl = successRedirect", function (done) {
				var req = {
					session: {
						APPID_AUTH_CONTEXT: {
							identityTokenPayload: {
								amr: ["cloud_directory"],
								identities: [{id: "testUserId"}]
							}
						}
					},
					isAuthenticated: function () {
						return true;
					},
					isUnauthenticated: function () {
						return false;
					}
				};
				
				webAppStrategy.redirect = function (url) {
					assert.equal(req.session.returnTo, "success-redirect");
					assert.include(url, "/cloud_directory/forgot_password?client_id=clientId");
					done();
				};
				
				webAppStrategy.authenticate(req, {
					show: WebAppStrategy.FORGOT_PASSWORD,
					successRedirect: "success-redirect"
				});
				
			});
			
		});
		
		describe("Preferred locale tests", function () {
			const french = "fr";
			var req;
			
			beforeEach(function () {

				req = {
					isAuthenticated: function () {
						return false;
					},
					session: {}
				};
			});
			
			var checkDefaultLocale = function (done) {
				return function (url) {
					assert.equal(url, "https://oauthServerUrlMock/authorization?client_id=clientId&response_type=code&redirect_uri=https://redirectUri&scope=appid_default&state=123456789");
					assert.isUndefined(req.session[WebAppStrategy.LANGUAGE]);
					done();
				}
			};
			
			var checkCustomLocaleFromSession = function (done) {
				return function (url) {
					assert.equal(url, "https://oauthServerUrlMock/authorization?client_id=clientId&response_type=code&redirect_uri=https://redirectUri&scope=appid_default&language=" + french + "&state=123456789");
					assert.equal(req.session[WebAppStrategy.LANGUAGE], french);
					done();
				}
			};
			
			var checkCustomLocaleFromInit = function (done) {
				var expect = french;
				return function (url) {
					assert.equal(url, "https://oauthServerUrlMock/authorization?client_id=clientId&response_type=code&redirect_uri=https://redirectUri&scope=appid_default&language=" + expect + "&state=123456789");
					assert.isUndefined(req.session[WebAppStrategy.LANGUAGE]);
					assert.equal(webAppStrategy.serviceConfig.getPreferredLocale(), expect);
					done();
				}
			};
			
			var checkCustomLocaleFromInitAndSession = function (done) {
				var expect = "de";
				return function (url) {
					assert.equal(url, "https://oauthServerUrlMock/authorization?client_id=clientId&response_type=code&redirect_uri=https://redirectUri&scope=appid_default&language=" + expect + "&state=123456789");
					assert.equal(req.session[WebAppStrategy.LANGUAGE], expect);
					assert.equal(webAppStrategy.serviceConfig.getPreferredLocale(), french);
					done();
				}
			};
			
			it("Should redirect to authorization with no locale, overwrite it to 'fr' with setPreferredLocale and expect Should redirect to authorization with 'fr' custom locale", function (done) {
				
				webAppStrategy.redirect = checkDefaultLocale(done);
				webAppStrategy.authenticate(req, {});
			});
			
			it("Should redirect to authorization with custom preferred locale from session", function (done) {
				
				webAppStrategy.setPreferredLocale(req, french);
				webAppStrategy.redirect = checkCustomLocaleFromSession(done);
				webAppStrategy.authenticate(req, {});
			});
			
			it("Should redirect to authorization with custom preferred locale from init", function (done) {
				
				webAppStrategy = new WebAppStrategy({
					tenantId: "tenantId",
					clientId: "clientId",
					secret: "secret",
					oauthServerUrl: "https://oauthServerUrlMock",
					redirectUri: "https://redirectUri",
					preferredLocale: french
				});
				
				webAppStrategy.redirect = checkCustomLocaleFromInit(done);
				webAppStrategy.authenticate(req, {});
			});
			
			it("Should redirect to authorization with custom preferred locale from session even though it has one in init too", function (done) {
				
				webAppStrategy = new WebAppStrategy({
					tenantId: "tenantId",
					clientId: "clientId",
					secret: "secret",
					oauthServerUrl: "https://oauthServerUrlMock",
					redirectUri: "https://redirectUri",
					preferredLocale: french
				});
				
				webAppStrategy.setPreferredLocale(req, "de");
				webAppStrategy.redirect = checkCustomLocaleFromInitAndSession(done);
				webAppStrategy.authenticate(req, {});
			});
		});
	});
  
  describe("#hasScope()", function () {
	const req = {
	  session: {}
	};
	
	it("Should return true: the two required custom scopes exist", function () {
	  req.session[WebAppStrategy.AUTH_CONTEXT] = {
		accessTokenPayload: {
		  scope: "app/scope1 app/scope2"
		}
	  };
	  
	  assert.isTrue(WebAppStrategy.hasScope(req, "scope1 scope2"));
	});
	
	it("Should return false: only one of the two required scopes exists", function () {
	  req.session[WebAppStrategy.AUTH_CONTEXT] = {
		accessTokenPayload: {
		  scope: "app/scope1"
		}
	  };
	  
	  assert.isFalse(WebAppStrategy.hasScope(req, "scope1 scope2"));
	});
  
    it("Should return true: default scope and custom scope required exist", function () {
	  req.session[WebAppStrategy.AUTH_CONTEXT] = {
	    accessTokenPayload: {
		  scope: "openid app/subapp/scope1"
	    }
	  };
	
	  assert.isTrue(WebAppStrategy.hasScope(req, "scope1 openid"));
    });
  
    it("Should return true: no scopes are required", function () {
	  req.session[WebAppStrategy.AUTH_CONTEXT] = {
	    accessTokenPayload: {
		  scope: "openid app/subapp/scope1"
	    }
	  };
	
	  assert.isTrue(WebAppStrategy.hasScope(req, ""));
    });
  
    it("Should return true: no scopes (whitespace) are required", function () {
	  req.session[WebAppStrategy.AUTH_CONTEXT] = {
	    accessTokenPayload: {
		  scope: "openid app/subapp/scope1"
	    }
	  };
	
	  assert.isTrue(WebAppStrategy.hasScope(req, "           "));
    });
  
    it("Should return false: no scope on access token, while a default scope is required", function () {
	  req.session[WebAppStrategy.AUTH_CONTEXT] = {
	    accessTokenPayload: {}
	  };
	
	  assert.isFalse(WebAppStrategy.hasScope(req, "openid"));
    });
  
    it("Should return true: non-string required scopes", function () {
	  req.session[WebAppStrategy.AUTH_CONTEXT] = {
	    accessTokenPayload: {
		  scope: "openid"
	    }
	  };
	
	  assert.isTrue(WebAppStrategy.hasScope(req, 42));
    });
  });
});