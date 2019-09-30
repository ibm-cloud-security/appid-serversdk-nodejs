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
const proxyquire = require("proxyquire");
const tokenUtilsMock = require("./mocks/token-util-mock");

chai.use(require("chai-as-promised"));

const {assert} = chai;
const {expect} = chai;

const previousAccessToken = "test.previousAccessToken.test";

describe("/lib/strategies/webapp-strategy", () => {
  let WebAppStrategy;
  let webAppStrategy;
  before((done) => {
    WebAppStrategy = proxyquire("../lib/strategies/webapp-strategy", {
      "../utils/token-util": tokenUtilsMock,
      request: require("./mocks/request-mock")
    });
    webAppStrategy = new WebAppStrategy({
      tenantId: "tenantId",
      clientId: "clientId",
      secret: "secret",
      oauthServerUrl: "https://oauthServerUrlMock",
      redirectUri: "https://redirectUri"
    });
    done();
  });

  describe("#SSO ", () => {
    let resultRedirect = '';
    const redirectURL = "http://localhost:3000/somethingElse";

    beforeEach(() => {
      resultRedirect = '';
    });

    it("good callback", () => {
      const req = {
        session: {
          returnTo: 'ssss'
        },
        logout() {}
      };
      const res = {
        redirect(url) {
          resultRedirect = url;
        }
      };

      const options = {
        redirect_uri: redirectURL
      };
      webAppStrategy.logoutSSO(req, res, options);
      const uriEncodedCallBack = encodeURIComponent(redirectURL);
      const excpected =
        `https://oauthServerUrlMock/cloud_directory/sso/logout?redirect_uri=${uriEncodedCallBack}&client_id=clientId`;
      assert.equal(resultRedirect, excpected);
      assert.equal(req.session.returnTo, undefined); // expect session to be cleaned.
    });
  });


  describe("#setPreferredLocale", () => {
    it("Should fail if request doesn't have session", (done) => {
      let failed = false;
      webAppStrategy.error = (err) => {
        assert.equal(err.message, "Can't find req.session");
        failed = true;
      };

      webAppStrategy.setPreferredLocale({}, "fr");
      assert.equal(true, failed);
      done();
    });

    it("Should succeed if request has session", (done) => {
      const req = {
        session: {}
      };
      webAppStrategy.error = () => {};
      webAppStrategy.setPreferredLocale(req, "fr");
      assert.equal("fr", req.session["language"]);
      done();
    });
  });

  describe("#properties", () => {
    it("Should have all properties", () => {
      assert.isFunction(WebAppStrategy);
      assert.equal(WebAppStrategy.STRATEGY_NAME, "appid-webapp-strategy");
      assert.equal(WebAppStrategy.DEFAULT_SCOPE, "appid_default");
      assert.equal(WebAppStrategy.AUTH_CONTEXT, "APPID_AUTH_CONTEXT");
    });
  });

  describe("#logout", () => {
    it("Should be able to successfully logout", (done) => {
      const req = {
        logout() {
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

  describe("#authenticate()", () => {
    beforeEach(() => tokenUtilsMock.setValidateIssAndAudResponse(true));
    describe("refresh-token", () => {
      let req;

      beforeEach(() => {
        tokenUtilsMock.setValidateIssAndAudResponse(true);
        req = {
          session: {}
        };
      });

      function validateContext(done) {
        const context = req.session[WebAppStrategy.AUTH_CONTEXT];
        try {
          assert.equal(context.accessToken, "access_token_mock");
          assert.equal(context.refreshToken, "refresh_token_mock");
          assert.equal(context.refreshToken, "refresh_token_mock");
        } catch (e) {
          return done(e);
        }
        return done();
      }

      it("Should succeed if it has a valid refresh token", (done) => {
        webAppStrategy.refreshTokens(req, "WORKING_REFRESH_TOKEN").then(() => {
          validateContext(done);
        }).catch(done);
      });

      it("Should fail if it has no refresh token",
        () => expect(webAppStrategy.refreshTokens(req, null)).to.be.rejectedWith("no refresh"));

      it("Should fail for invalid refresh token",
        () => expect(webAppStrategy.refreshTokens(req, "INVALID_REFRESH_TOKEN")).to.be.rejectedWith("invalid grant"));

      it("Should keep the context empty for invalid refresh token", (done) => {
        webAppStrategy.refreshTokens(req, "INVALID_REFRESH_TOKEN").then(() => {
          done(new Error("should fail"));
        }).catch(() => {
          try {
            assert(!req.session[WebAppStrategy.AUTH_CONTEXT], "context shouldn't exist");
            done();
          } catch (e) {
            done(e);
          }
        });
      });
    });

    it("Should fail if request doesn't have session", (done) => {
      webAppStrategy.error = (err) => {
        assert.equal(err.message, "Can't find req.session");
        done();
      };

      webAppStrategy.authenticate({});
    });

    it("Should be able to detect unauthenticated request and redirect to authorization", (done) => {
      const req = {
        originalUrl: "originalUrl",
        session: {}
      };

      webAppStrategy.redirect = (url) => {
        // eslint-disable-next-line max-len
        assert.equal(url, "https://oauthServerUrlMock/authorization?client_id=clientId&response_type=code&redirect_uri=https://redirectUri&scope=appid_default&state=123456789");
        assert.equal(req.session.returnTo, "originalUrl");
        done();
      };

      webAppStrategy.authenticate(req, {});
    });

    it("Should be able to detect authenticated request and skip strategy", (done) => {
      const req = {
        isAuthenticated() {
          return true;
        },
        session: {}
      };
      req.session[WebAppStrategy.AUTH_CONTEXT] = {
        identityTokenPayload: {}
      };
      webAppStrategy.success = () => {
        done();
      };
      webAppStrategy.authenticate(req, {});
    });


    it("Should fail if error was returned in callback", (done) => {
      webAppStrategy.fail = () => {
        done();
      };
      webAppStrategy.authenticate({
        session: {},
        query: {
          error: "test error"
        }
      });
    });

    describe("handle RoP flow", () => {
      it("Should handle RoP flow successfully", (done) => {
        const req = {
          session: {},
          method: "POST",
          body: {
            username: "test_username",
            password: "good_password"
          }
        };
        webAppStrategy.fail = (err) => {
          done(err);
        };
        webAppStrategy.success = (user) => {
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
        webAppStrategy.authenticate(req);
      });

      it("Should handle RoP flow successfully with previous access token", (done) => {
        const session = {};
        const accessTokenPayload = {
          amr: ["appid_anon"]
        };
        const accessToken = previousAccessToken;
        const appIdAuthContext = {
          accessToken,
          accessTokenPayload
        };
        session[WebAppStrategy.AUTH_CONTEXT] = appIdAuthContext;
        const req = {
          session,
          method: "POST",
          body: {
            username: "test_username",
            password: "good_password"
          }
        };
        webAppStrategy.fail = (err) => {
          done(err);
        };
        webAppStrategy.success = (user) => {
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
        webAppStrategy.authenticate(req);
      });

      it("Should handle RoP flow successfully - check options", (done) => {
        const req = {
          session: {},
          method: "POST",
          body: {
            username: "test_username",
            password: "good_password"
          }
        };
        const options = {
          scope: "test_scope",
          successRedirect: "test_success_url",
          failureRedirect: "test_failure_url",
          failureFlash: true
        };
        webAppStrategy.fail = (err) => {
          done(err);
        };
        webAppStrategy.success = (user) => {
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
        webAppStrategy.authenticate(req, options);
      });

      it("Should handle RoP flow failure - bad credentials", (done) => {
        webAppStrategy.fail = (err) => {
          assert.equal(err.message, "wrong credentials");
          done();
        };
        const req = {
          session: {},
          method: "POST",
          body: {
            username: "test_username",
            password: "bad_password"
          }
        };
        webAppStrategy.authenticate(req);
      });

      it("Should handle RoP flow - request failure", (done) => {
        webAppStrategy.fail = (err) => {
          assert.equal(err.message, "REQUEST_ERROR");
          done();
        };
        const req = {
          session: {},
          method: "POST",
          body: {
            username: "request_error",
            password: "good_password"
          }
        };
        webAppStrategy.authenticate(req);
      });

      it("Should handle RoP flow - JSON parse failure", (done) => {
        webAppStrategy.fail = (err) => {
          assert.equal(err.message, "Failed to obtain tokens");
          done();
        };
        const req = {
          session: {},
          method: "POST",
          body: {
            username: "parse_error",
            password: "good_password"
          }
        };
        webAppStrategy.authenticate(req);
      });


      it("Happy SIGN_UP flow - check req.session.originalUrl = successRedirect", (done) => {
        const req = {
          session: {},
          isAuthenticated() {
            return false;
          },
          isUnauthenticated() {
            return true;
          }
        };

        webAppStrategy.redirect = (url) => {
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

    it("Should handle callback if request contains grant code. Fail due to missing state", (done) => {
      webAppStrategy.fail = (err) => {
        assert.equal(err.message, "Invalid session state");
        done();
      };
      const req = {
        session: {},
        query: {
          code: "FAILING_CODE"
        }
      };
      webAppStrategy.authenticate(req);
    });

    it("Should handle callback if request contains grant code and state. Invalid state parameter ", (done) => {
      webAppStrategy.fail = (err) => {
        assert.equal(err.message, "Invalid state parameter");
        done();
      };
      const req = {
        session: {},
        query: {
          code: "FAILING_CODE",
          state: "1234567"
        }
      };
      req.session[WebAppStrategy.STATE_PARAMETER] = {
        anonymousLogin: false,
        state: "123456789"
      };
      webAppStrategy.authenticate(req);
    });

    it("Should handle callback if request contains grant code and state. Fail due to tokenEndpoint error", (done) => {
      webAppStrategy.fail = (err) => {
        assert.equal(err.message, "STUBBED_ERROR");
        done();
      };
      const req = {
        session: {},
        query: {
          code: "FAILING_CODE",
          state: "123456789"
        }
      };
      req.session[WebAppStrategy.STATE_PARAMETER] = {
        anonymousLogin: false,
        state: "123456789"
      };
      webAppStrategy.authenticate(req);
    });

    it("Should handle callback if request contains grant code. Success with options.successRedirect", (done) => {
      const req = {
        session: {},
        query: {
          code: "WORKING_CODE",
          state: ""
        }
      };
      const options = {
        successRedirect: "redirectUri"
      };
      webAppStrategy.fail = (err) => {
        assert.equal(err.message, "Invalid state parameter");
        done();
      };
      webAppStrategy.success = (user) => {
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
      req.session[WebAppStrategy.STATE_PARAMETER] = {
        anonymousLogin: false,
        state: "123456789"
      };
      webAppStrategy.authenticate(req, options);
    });

    it("Should handle callback if request contains grant code. Success with original URL", (done) => {
      const req = {
        session: {
          returnTo: "originalUri"
        },
        query: {
          code: "WORKING_CODE",
          state: "123456789"
        }
      };
      const options = {};
      webAppStrategy.success = () => {
        try {
          assert(options.successReturnToOrRedirect);
          done();
        } catch (e) {
          done(e);
        }
      };
      req.session[WebAppStrategy.STATE_PARAMETER] = {
        anonymousLogin: false,
        state: "123456789"
      };
      webAppStrategy.authenticate(req, options);
    });

    it("Should fail if issuer validation is failing -Access Token", (done) => {
      tokenUtilsMock.setValidateIssAndAudResponse(false);
      webAppStrategy.success = () => {
        done('suppose to fail');
      };
      webAppStrategy.fail = (err) => {
        assert.equal(err.message, "Authentication failed : token validation failed");
        done();
      };
      const req = {
        session: {
          returnTo: "originalUri"
        },
        query: {
          code: "WORKING_CODE",
          state: "123456789"
        }
      };

      const options = {};
      req.session[WebAppStrategy.STATE_PARAMETER] = {
        anonymousLogin: false,
        state: "123456789"
      };
      webAppStrategy.authenticate(req, options);
    });
    it("Should fail if issuer validation is failing -id Token", (done) => {
      tokenUtilsMock.setValidateIssAndAudResponse(true);
      tokenUtilsMock.switchIssuerState();
      webAppStrategy.success = () => {
        done('suppose to fail');
      };
      webAppStrategy.fail = (err) => {
        assert.equal(err.message, "Authentication failed : token validation failed");
        done();
      };
      const req = {
        session: {
          returnTo: "originalUri"
        },
        query: {
          code: "WORKING_CODE",
          state: "123456789"
        }
      };

      const options = {};
      req.session[WebAppStrategy.STATE_PARAMETER] = {
        anonymousLogin: false,
        state: "123456789"
      };
      webAppStrategy.authenticate(req, options);
    });

    it("Should not be able to login with null identity token", (done) => {
      webAppStrategy.fail = (err) => {
        assert.equal(err.message, "Authentication failed : Invalid access/id token");
        done();
      };

      const req = {
        session: {
          returnTo: "originalUri"
        },
        query: {
          code: "NULL_ID_TOKEN",
          state: "123456789"
        }
      };

      const options = {};
      req.session[WebAppStrategy.STATE_PARAMETER] = {
        anonymousLogin: false,
        state: "123456789"
      };
      webAppStrategy.authenticate(req, options);
    });

    it("Should handle callback if request contains grant code. Success with redirect to /", (done) => {
      const req = {
        session: {},
        query: {
          code: "WORKING_CODE",
          state: "123456789"
        }
      };
      const options = {};
      webAppStrategy.success = () => {
        assert(options.successReturnToOrRedirect);
        done();
      };
      req.session[WebAppStrategy.STATE_PARAMETER] = {
        anonymousLogin: false,
        state: "123456789"
      };
      webAppStrategy.authenticate(req, options);
    });

    it("Should handle callback if request contains grant code. Success with redirect to successRedirect", (done) => {
      const req = {
        session: {}
      };
      const options = {
        successRedirect: "success-callback"
      };
      webAppStrategy.redirect = (url) => {
        // eslint-disable-next-line max-len
        assert.equal(url, "https://oauthServerUrlMock/authorization?client_id=clientId&response_type=code&redirect_uri=https://redirectUri&scope=appid_default&state=123456789");
        assert.equal(req.session.returnTo, "success-callback");
        done();
      };
      webAppStrategy.authenticate(req, options);
    });


    it("Should handle authorization redirect to App ID /authorization endpoint with default scope", (done) => {
      webAppStrategy.redirect = (url) => {
        // eslint-disable-next-line max-len
        assert.equal(url, encodeURI("https://oauthServerUrlMock/authorization?client_id=clientId&response_type=code&redirect_uri=https://redirectUri&scope=appid_default&state=123456789"));
        done();
      };
      webAppStrategy.authenticate({
        session: {},
        isAuthenticated() {
          return false;
        }
      });
    });

    it("Should handle authorization redirect to App ID /authorization endpoint with custom scope", (done) => {
      webAppStrategy.redirect = (url) => {
        // eslint-disable-next-line max-len
        assert.equal(url, encodeURI("https://oauthServerUrlMock/authorization?client_id=clientId&response_type=code&redirect_uri=https://redirectUri&scope=appid_default customScope&state=123456789"));
        done();
      };
      webAppStrategy.authenticate({
        session: {},
        isAuthenticated() {
          return false;
        }
      }, {
        scope: "customScope"
      });
    });

    it("Should inject anonymous access token into request url if one is present", (done) => {
      const req = {
        session: {}
      };
      req.session[WebAppStrategy.AUTH_CONTEXT] = {
        accessTokenPayload: {
          amr: ["appid_anon"]
        },
        accessToken: "test_access_token"
      };
      webAppStrategy.redirect = (url) => {
        try {
          assert.include(url, "appid_access_token=test_access_token");
          done();
        } catch (e) {
          done(e);
        }
      };

      webAppStrategy.authenticate(req, {
        forceLogin: true
      });
    });

    it("Should fail if previous anonymous access token is not found and anon user is not allowed", (done) => {
      const req = {
        session: {},
        isAuthenticated() {
          return false;
        }
      };

      webAppStrategy.fail = () => {
        done();
      };

      webAppStrategy.authenticate(req, {
        allowAnonymousLogin: true,
        allowCreateNewAnonymousUser: false
      });
    });

    it("Should be able to login anonymously", (done) => {
      const req = {
        session: {},
        isAuthenticated() {
          return false;
        }
      };

      webAppStrategy.redirect = (url) => {
        assert.include(url, "idp=appid_anon");
        done();
      };

      webAppStrategy.authenticate(req, {
        allowAnonymousLogin: true,
        allowCreateNewAnonymousUser: true
      });
    });

    it("Should show sign up screen", (done) => {
      const req = {
        session: {},
        isAuthenticated() {
          return false;
        }
      };

      webAppStrategy.redirect = (url) => {
        assert.include(url, "response_type=sign_up");
        done();
      };

      webAppStrategy.authenticate(req, {
        show: WebAppStrategy.SIGN_UP
      });
    });

    describe("change password tests", () => {
      it("user not authenticated", (done) => {
        const req = {
          session: {},
          isAuthenticated() {
            return false;
          },
          isUnauthenticated() {
            return true;
          }
        };

        webAppStrategy.fail = (error) => {
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

      it("user authenticated but not with cloud directory", (done) => {
        const req = {
          session: {
            APPID_AUTH_CONTEXT: {
              identityTokenPayload: {
                amr: ["not_cloud_directory"]
              }
            }
          },
          isAuthenticated() {
            return true;
          },
          isUnauthenticated() {
            return false;
          }
        };

        webAppStrategy.fail = (error) => {
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

      it("happy flow - user authenticated with cloud directory", (done) => {
        const req = {
          session: {
            APPID_AUTH_CONTEXT: {
              identityTokenPayload: {
                amr: ["cloud_directory"],
                identities: [{
                  id: "testUserId"
                }]
              }
            }
          },
          isAuthenticated() {
            return true;
          },
          isUnauthenticated() {
            return false;
          }
        };

        webAppStrategy.redirect = (url) => {
          assert.include(url,
            "/cloud_directory/change_password?client_id=clientId&redirect_uri=https://redirectUri&user_id=testUserId");
          done();
        };

        webAppStrategy.authenticate(req, {
          show: WebAppStrategy.CHANGE_PASSWORD
        });
      });
    });

    describe("change details tests", () => {
      it("user not authenticated", (done) => {
        const req = {
          session: {},
          isAuthenticated() {
            return false;
          },
          isUnauthenticated() {
            return true;
          }
        };

        webAppStrategy.fail = (error) => {
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

      it("user authenticated but not with cloud directory", (done) => {
        const req = {
          session: {
            APPID_AUTH_CONTEXT: {
              identityTokenPayload: {
                amr: ["not_cloud_directory"]
              }
            }
          },
          isAuthenticated() {
            return true;
          },
          isUnauthenticated() {
            return false;
          }
        };

        webAppStrategy.fail = (error) => {
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

      it("happy flow - user authenticated with cloud directory", (done) => {
        const req = {
          session: {
            APPID_AUTH_CONTEXT: {
              identityTokenPayload: {
                amr: ["cloud_directory"],
                identities: [{
                  id: "testUserId"
                }]
              }
            }
          },
          isAuthenticated() {
            return true;
          },
          isUnauthenticated() {
            return false;
          }
        };

        webAppStrategy.redirect = (url) => {
          assert.include(url,
            "/cloud_directory/change_details?client_id=clientId&redirect_uri=https://redirectUri&code=1234");
          done();
        };

        webAppStrategy.authenticate(req, {
          show: WebAppStrategy.CHANGE_DETAILS
        });
      });

      it("Bad flow - error on generate code request", (done) => {
        const req = {
          session: {
            APPID_AUTH_CONTEXT: {
              identityToken: "error",
              identityTokenPayload: {
                amr: ["cloud_directory"],
                identities: [{
                  id: "testUserId"
                }]
              }
            }
          },
          isAuthenticated() {
            return true;
          },
          isUnauthenticated() {
            return false;
          }
        };

        webAppStrategy.fail = (error) => {
          assert.include(error.message, "STUBBED_ERROR");
          done();
        };

        webAppStrategy.authenticate(req, {
          show: WebAppStrategy.CHANGE_DETAILS
        });
      });

      it("Bad flow - not 200 response on generate code request", (done) => {
        const req = {
          session: {
            APPID_AUTH_CONTEXT: {
              identityToken: "statusNot200",
              identityTokenPayload: {
                amr: ["cloud_directory"],
                identities: [{
                  id: "testUserId"
                }]
              }
            }
          },
          isAuthenticated() {
            return true;
          },
          isUnauthenticated() {
            return false;
          }
        };

        webAppStrategy.fail = (error) => {
          assert.include(error.message, "generate code: response status code:400");
          done();
        };

        webAppStrategy.authenticate(req, {
          show: WebAppStrategy.CHANGE_DETAILS
        });
      });
    });

    describe("forgot password tests", () => {
      it("Happy flow", (done) => {
        const req = {
          session: {
            APPID_AUTH_CONTEXT: {
              identityTokenPayload: {
                amr: ["cloud_directory"],
                identities: [{
                  id: "testUserId"
                }]
              }
            }
          },
          isAuthenticated() {
            return true;
          },
          isUnauthenticated() {
            return false;
          }
        };

        webAppStrategy.redirect = (url) => {
          assert.include(url, "/cloud_directory/forgot_password?client_id=clientId");
          done();
        };

        webAppStrategy.authenticate(req, {
          show: WebAppStrategy.FORGOT_PASSWORD
        });
      });

      describe("auto detection of local", () => {
        it("check detection", (done) => {
          const req = {
            headers: {
              "accept-language": "he,en;q=0.9,en-US;q=0.8"
            },
            session: {
              APPID_AUTH_CONTEXT: {
                identityTokenPayload: {
                  amr: ["cloud_directory"],
                  identities: [{
                    id: "testUserId"
                  }]
                }
              }
            },
            isAuthenticated() {
              return true;
            },
            isUnauthenticated() {
              return false;
            }
          };

          webAppStrategy.redirect = (url) => {
            assert.include(url,
              "/cloud_directory/forgot_password?client_id=clientId&redirect_uri=https://redirectUri&language=he");
            done();
          };

          webAppStrategy.authenticate(req, {
            show: WebAppStrategy.FORGOT_PASSWORD
          });
        });
      });

      it("Happy FORGOT_PASSWORD flow - check req.session.originalUrl = successRedirect", (done) => {
        const req = {
          session: {
            APPID_AUTH_CONTEXT: {
              identityTokenPayload: {
                amr: ["cloud_directory"],
                identities: [{
                  id: "testUserId"
                }]
              }
            }
          },
          isAuthenticated() {
            return true;
          },
          isUnauthenticated() {
            return false;
          }
        };

        webAppStrategy.redirect = (url) => {
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

    describe("Preferred locale tests", () => {
      const french = "fr";
      let req;

      beforeEach(() => {
        req = {
          isAuthenticated() {
            return false;
          },
          session: {}
        };
      });

      const checkDefaultLocale = (done) => (url) => {
        // eslint-disable-next-line max-len
        assert.equal(url, "https://oauthServerUrlMock/authorization?client_id=clientId&response_type=code&redirect_uri=https://redirectUri&scope=appid_default&state=123456789");
        assert.isUndefined(req.session[WebAppStrategy.LANGUAGE]);
        done();
      };

      const checkCustomLocaleFromSession = (done) => (url) => {
        // eslint-disable-next-line max-len
        assert.equal(url, `https://oauthServerUrlMock/authorization?client_id=clientId&response_type=code&redirect_uri=https://redirectUri&scope=appid_default&language=${french}&state=123456789`);
        assert.equal(req.session[WebAppStrategy.LANGUAGE], french);
        done();
      };

      const checkCustomLocaleFromInit = (done) => {
        const expectLang = french;
        return (url) => {
          // eslint-disable-next-line max-len
          assert.equal(url, `https://oauthServerUrlMock/authorization?client_id=clientId&response_type=code&redirect_uri=https://redirectUri&scope=appid_default&language=${expectLang}&state=123456789`);
          assert.isUndefined(req.session[WebAppStrategy.LANGUAGE]);
          assert.equal(webAppStrategy.serviceConfig.getPreferredLocale(), expectLang);
          done();
        };
      };

      const checkCustomLocaleFromInitAndSession = (done) => {
        const expectLang = "de";
        return (url) => {
          // eslint-disable-next-line max-len
          assert.equal(url, `https://oauthServerUrlMock/authorization?client_id=clientId&response_type=code&redirect_uri=https://redirectUri&scope=appid_default&language=${expectLang}&state=123456789`);
          assert.equal(req.session[WebAppStrategy.LANGUAGE], expectLang);
          assert.equal(webAppStrategy.serviceConfig.getPreferredLocale(), french);
          done();
        };
      };

      it("Should redirect to authorization with no locale, " +
        "overwrite it to 'fr' with setPreferredLocale and expect Should redirect to authorization with 'fr' custom locale",
        (done) => {
          webAppStrategy.redirect = checkDefaultLocale(done);
          webAppStrategy.authenticate(req, {});
        });

      it("Should redirect to authorization with custom preferred locale from session", (done) => {
        webAppStrategy.setPreferredLocale(req, french);
        webAppStrategy.redirect = checkCustomLocaleFromSession(done);
        webAppStrategy.authenticate(req, {});
      });

      it("Should redirect to authorization with custom preferred locale from init", (done) => {
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

      it("Should redirect to authorization with custom preferred locale from session even though it has one in init too",
        (done) => {
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

  describe("#hasScope()", () => {
    const req = {
      session: {}
    };

    it("Should return true: the two required custom scopes exist", () => {
      req.session[WebAppStrategy.AUTH_CONTEXT] = {
        accessTokenPayload: {
          scope: "app/scope1 app/scope2"
        }
      };

      assert.isTrue(WebAppStrategy.hasScope(req, "scope1 scope2"));
    });

    it("Should return false: only one of the two required scopes exists", () => {
      req.session[WebAppStrategy.AUTH_CONTEXT] = {
        accessTokenPayload: {
          scope: "app/scope1"
        }
      };

      assert.isFalse(WebAppStrategy.hasScope(req, "scope1 scope2"));
    });

    it("Should return true: default scope and custom scope required exist", () => {
      req.session[WebAppStrategy.AUTH_CONTEXT] = {
        accessTokenPayload: {
          scope: "openid app/subapp/scope1"
        }
      };

      assert.isTrue(WebAppStrategy.hasScope(req, "scope1 openid"));
    });

    it("Should return true: no scopes are required", () => {
      req.session[WebAppStrategy.AUTH_CONTEXT] = {
        accessTokenPayload: {
          scope: "openid app/subapp/scope1"
        }
      };

      assert.isTrue(WebAppStrategy.hasScope(req, ""));
    });

    it("Should return true: no scopes (whitespace) are required", () => {
      req.session[WebAppStrategy.AUTH_CONTEXT] = {
        accessTokenPayload: {
          scope: "openid app/subapp/scope1"
        }
      };

      assert.isTrue(WebAppStrategy.hasScope(req, "           "));
    });

    it("Should return false: no scope on access token, while a default scope is required", () => {
      req.session[WebAppStrategy.AUTH_CONTEXT] = {
        accessTokenPayload: {}
      };

      assert.isFalse(WebAppStrategy.hasScope(req, "openid"));
    });

    it("Should return true: non-string required scopes", () => {
      req.session[WebAppStrategy.AUTH_CONTEXT] = {
        accessTokenPayload: {
          scope: "openid"
        }
      };

      assert.isTrue(WebAppStrategy.hasScope(req, 42));
    });
  });
});
