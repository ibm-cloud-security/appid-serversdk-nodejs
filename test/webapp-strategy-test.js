const chai = require('chai');
const assert = chai.assert;
const proxyquire = require("proxyquire");

describe.only('/lib/strategies/webapp-strategy', function(){
	console.log("Loading webapp-strategy-test.js");

	var WebAppStrategy;
	var webAppStrategy;

	before(function(){
		WebAppStrategy = proxyquire("../lib/strategies/webapp-strategy", {
			"./../utils/token-util": require("./mocks/token-util-mock")
		});
		webAppStrategy = new WebAppStrategy({
			tenantId: "tenantId",
			clientId: "clientId",
			secret: "secret",
			authorizationEndpoint: "https://authorizationEndpoint",
			tokenEndpoint: "https://tokenEndpoint",
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
		})
	});

	describe("#logout", function(done){
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

	describe("#ensureAuthenticated", function(done){
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

			WebAppStrategy.ensureAuthenticated()(req, null, next());
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
			done()
		});

		it("Should handle callback if request contains grant code. Success with options.successRedirect", function(done){
			done()
		});

		it("Should handle callback if request contains grant code. Success with WebAppStrategy.ORIGINAL_URL", function(done){
			done()
		});

		it("Should handle callback if request contains grant code. Success with redirect to /", function(done){
			done()
		});

		it("Should handle authorization", function(done){
			webAppStrategy.redirect = function(url){
				assert.equal(url, "https://authorizationEndpoint?client_id=clientId&response_type=code&redirect_uri=https://redirectUri&scope=appid_default");
				done();
			}
			webAppStrategy.authenticate({
				session: {}
			});
		});

	});
});
