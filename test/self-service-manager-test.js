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
const rewire = require("rewire");
const Q = require("q");

const {
  assert
} = chai;

const initError = "Failed to initialize self-service-manager.";

describe("/lib/self-service/self-service-manager", () => {
  let SelfServiceManager;

  before(() => {
    delete process.env["VCAP_SERVICES"];
    SelfServiceManager = rewire("../lib/self-service/self-service-manager");
  });

  describe("#SelfserviceManager constructor", () => {
    it("Should not be able to init without options and VCAP_SERVICS", (done) => {
      try {
        const test = new SelfServiceManager();
        assert.isUndefined(test);
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

    it("Should not be able to init with options with only tenantId", (done) => {
      try {
        const test = new SelfServiceManager({
          tenantId: "dummy_tenant"
        });
        assert.isUndefined(test);
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

    it("Should not be able to init with options with server with host not equal to appid-oauth", (done) => {
      try {
        const test = new SelfServiceManager({
          tenantId: "dummy_tenant",
          oauthServerUrl: "http://a.com"
        });
        assert.isUndefined(test);
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

    it("Should not be able to init with options with server with not /oauth/v3", (done) => {
      try {
        const test = new SelfServiceManager({
          tenantId: "dummy_tenant",
          oauthServerUrl: "http://appid-oauth.com/oauth/v123"
        });
        assert.isUndefined(test);
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

    it("Should be able to init with options with only managementUrl", (done) => {
      try {
        const selfServiceManager = new SelfServiceManager({
          managementUrl: "dummy_managementUrl"
        });
        assert.equal("dummy_managementUrl", selfServiceManager.managementUrl);
        done();
      } catch (e) {
        done(e);
      }
    });

    it("Should be able to init with options with only tenantId and oauthServerUrl", (done) => {
      try {
        const selfServiceManager = new SelfServiceManager({
          oauthServerUrl: "https://appid-oauth.com/oauth/v3",
          tenantId: "123"
        });
        assert.equal("https://appid-management.com/management/v4/123", selfServiceManager.managementUrl);
        done();
      } catch (e) {
        done(e);
      }
    });

    it("Should be able to init with options with only tenantId and oAuthServerUrl", (done) => {
      try {
        const selfServiceManager = new SelfServiceManager({
          oAuthServerUrl: "https://appid-oauth.com/oauth/v3",
          tenantId: "123"
        });
        assert.equal("https://appid-management.com/management/v4/123", selfServiceManager.managementUrl);
        done();
      } catch (e) {
        done(e);
      }
    });

    it("Should be able to init with options check iamTokenUrl and iamApiKey", (done) => {
      try {
        const selfServiceManager = new SelfServiceManager({
          oauthServerUrl: "https://appid-oauth.com/oauth/v3",
          tenantId: "123",
          iamTokenUrl: "xxx",
          iamApiKey: "yyy"
        });
        assert.equal("https://appid-management.com/management/v4/123", selfServiceManager.managementUrl);
        assert.equal("xxx", selfServiceManager.iamTokenUrl);
        assert.equal("yyy", selfServiceManager.iamApiKey);
        done();
      } catch (e) {
        done(e);
      }
    });

    it("Should be able to init with VCAP_SERVICES (AdvancedMobileAccess)", (done) => {
      process.env.VCAP_SERVICES = JSON.stringify({
        AdvancedMobileAccess: [{
          credentials: {
            managementUrl: "dummy_managementUrl"
          }
        }]
      });
      try {
        const test = new SelfServiceManager();
        assert.equal(test.managementUrl, "dummy_managementUrl");
        done();
      } catch (e) {
        done(e);
      }
    });
    it("Should be able to init with VCAP_SERVICES (appid) - check api key in VCAP", (done) => {
      const testApiKey = "testApiKey";
      process.env.VCAP_SERVICES = JSON.stringify({
        AppID: [{
          credentials: {
            oauthServerUrl: "https://appid-oauth.com/oauth/v3",
            tenantId: "123",
            apikey: testApiKey
          }
        }]
      });

      try {
        const selfServiceManager = new SelfServiceManager();
        assert.equal(testApiKey, selfServiceManager.iamApiKey);
        done();
      } catch (e) {
        done(e);
      }
    });

    it("Should be able to init with VCAP_SERVICES (appid)", (done) => {
      process.env.VCAP_SERVICES = JSON.stringify({
        AppID: [{
          credentials: {
            oauthServerUrl: "https://appid-oauth.com/oauth/v3",
            tenantId: "123"
          }
        }]
      });

      try {
        const selfServiceManager = new SelfServiceManager();
        assert.equal("https://appid-management.com/management/v4/123", selfServiceManager.managementUrl);
        done();
      } catch (e) {
        done(e);
      }
    });
  });

  describe("#SelfServiceManager.signUp", () => {
    let selfServiceManager;
    const testUserJson = {
      email: "testEmail"
    };
    const language = "en";
    const expectedQuery = {
      language
    };
    const testIamToken = "bearer axcvrd";
    const badIamApiKey = "badIamApiKey";
    const providedIamToken = "bearer 123";
    let _handleRequestRevert,
      _getIAMTokenRevert;

    const stubHandleRequest = function stubHandleRequest(iamToken, method, url, body, querys, action, deferred) {
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

    const stubGetIAMToken = function stubGetIAMToken(iamToken, iamApiKey, iamTokenUrl) {
      if (!iamApiKey) {
        if (iamToken !== providedIamToken) {
          return Q.reject("iamToken was not received to _getIAMToken function");
        }
        return Q.resolve(testIamToken);
      }
      if (badIamApiKey === iamApiKey) {
        return Q.reject(new Error(badIamApiKey));
      }
      if (iamApiKey !== "testIamApiKey" || iamTokenUrl !== "https://iam.bluemix.net/oidc/token") {
        return Q.reject("wrong input to _getIAMToken in signUp API");
      }
      return Q.resolve(testIamToken);
    };
    before((done) => {
      _handleRequestRevert = SelfServiceManager.__set__("_handleRequest", stubHandleRequest);
      _getIAMTokenRevert = SelfServiceManager.__set__("_getIAMToken", stubGetIAMToken);
      selfServiceManager = new SelfServiceManager({
        managementUrl: "managementUrlTest",
        iamApiKey: "testIamApiKey"
      });
      done();
    });
    after((done) => {
      _handleRequestRevert();
      _getIAMTokenRevert();
      done();
    });

    it("Should successfully create new user", (done) => {
      selfServiceManager.signUp(testUserJson, language).then((user) => {
        try {
          assert.equal(JSON.stringify(user), JSON.stringify(testUserJson));
          done();
        } catch (err) {
          done(err);
        }
      }).catch((err) => {
        done(err);
      });
    });

    it("Should successfully create new user with provided iamToken", (done) => {
      const selfServiceManager2 = new SelfServiceManager({
        managementUrl: "managementUrlTest"
      });
      selfServiceManager2.signUp(testUserJson, language, providedIamToken).then((user) => {
        try {
          assert.equal(JSON.stringify(user), JSON.stringify(testUserJson));
          done();
        } catch (err) {
          done(err);
        }
      }).catch((err) => {
        done(err);
      });
    });

    it("Should reject on _getIAMToken", (done) => {
      const selfServiceManager2 = new SelfServiceManager({
        managementUrl: "managementUrlTest",
        iamApiKey: badIamApiKey
      });
      selfServiceManager2.signUp(testUserJson, language).then(() => {
        done("should reject");
      }).catch((err) => {
        try {
          assert.equal(badIamApiKey, err.message);
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it("Should reject on _handleRequest", (done) => {
      selfServiceManager.signUp({}, language).then(() => {
        done("should reject");
      }).catch((err) => {
        try {
          assert.equal("wrong input to _handleRequest in signUp API", err);
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  });

  describe("#SelfServiceManager.forgotPassword", () => {
    let selfServiceManager;
    const testEmail = "testEmail";
    const expectedBody = {
      email: testEmail
    };
    const language = "en";
    const expectedQuery = {
      language
    };
    const testIamToken = "bearer axcvrd";
    const badIamApiKey = "badIamApiKey";
    const providedIamToken = "bearer 123";
    let _handleRequestRevert,
      _getIAMTokenRevert;

    const stubHandleRequest = function stubHandleRequest(iamToken, method, url, body, querys, action, deferred) {
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

    const stubGetIAMToken = function stubGetIAMToken(iamToken, iamApiKey, iamTokenUrl) {
      if (!iamApiKey) {
        if (iamToken !== providedIamToken) {
          return Q.reject("iamToken was not received to _getIAMToken function");
        }
        return Q.resolve(testIamToken);
      }
      if (badIamApiKey === iamApiKey) {
        return Q.reject(new Error(badIamApiKey));
      }
      if (iamApiKey !== "testIamApiKey" || iamTokenUrl !== "https://iam.bluemix.net/oidc/token") {
        return Q.reject("wrong input to _getIAMToken in forgotPassword API");
      }
      return Q.resolve(testIamToken);
    };
    before((done) => {
      _handleRequestRevert = SelfServiceManager.__set__("_handleRequest", stubHandleRequest);
      _getIAMTokenRevert = SelfServiceManager.__set__("_getIAMToken", stubGetIAMToken);
      selfServiceManager = new SelfServiceManager({
        managementUrl: "managementUrlTest",
        iamApiKey: "testIamApiKey"
      });
      done();
    });
    after((done) => {
      _handleRequestRevert();
      _getIAMTokenRevert();
      done();
    });

    it("Should successfully return user", (done) => {
      selfServiceManager.forgotPassword(testEmail, language).then((user) => {
        try {
          assert.equal(JSON.stringify(user), JSON.stringify(testEmail));
          done();
        } catch (err) {
          done(err);
        }
      }).catch((err) => {
        done(err);
      });
    });

    it("Should successfully return user with provided iamToken", (done) => {
      const selfServiceManager2 = new SelfServiceManager({
        managementUrl: "managementUrlTest"
      });
      selfServiceManager2.forgotPassword(testEmail, language, providedIamToken).then((user) => {
        try {
          assert.equal(JSON.stringify(user), JSON.stringify(testEmail));
          done();
        } catch (err) {
          done(err);
        }
      }).catch((err) => {
        done(err);
      });
    });

    it("Should reject on _getIAMToken", (done) => {
      const selfServiceManager2 = new SelfServiceManager({
        managementUrl: "managementUrlTest",
        iamApiKey: badIamApiKey
      });
      selfServiceManager2.forgotPassword(testEmail, language).then(() => {
        done("should reject");
      }).catch((err) => {
        try {
          assert.equal(badIamApiKey, err.message);
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it("Should reject on _handleRequest", (done) => {
      selfServiceManager.forgotPassword({}, language).then(() => {
        done("should reject");
      }).catch((err) => {
        try {
          assert.equal("wrong input to _handleRequest in forgotPassword API", err);
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  });

  describe("#SelfServiceManager.resendNotification", () => {
    let selfServiceManager;
    const testUuid = "testUuid";
    const expectedBody = {
      uuid: testUuid
    };
    const language = "en";
    const expectedQuery = {
      language
    };
    const testIamToken = "bearer axcvrd";
    const badIamApiKey = "badIamApiKey";
    const providedIamToken = "bearer 123";
    const testTemplateName = "testTemplateName";
    let _handleRequestRevert,
      _getIAMTokenRevert;

    const stubHandleRequest = (iamToken, method, url, body, queryObject, action, deferred) => {
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

    const stubGetIAMToken = (iamToken, iamApiKey, iamTokenUrl) => {
      if (!iamApiKey) {
        if (iamToken !== providedIamToken) {
          return Q.reject("iamToken was not received to _getIAMToken function");
        }
        return Q.resolve(testIamToken);
      }
      if (badIamApiKey === iamApiKey) {
        return Q.reject(new Error(badIamApiKey));
      }
      if (iamApiKey !== "testIamApiKey" || iamTokenUrl !== "https://iam.bluemix.net/oidc/token") {
        return Q.reject("wrong input to _getIAMToken in resendNotification API");
      }
      return Q.resolve(testIamToken);
    };
    before((done) => {
      _handleRequestRevert = SelfServiceManager.__set__("_handleRequest", stubHandleRequest);
      _getIAMTokenRevert = SelfServiceManager.__set__("_getIAMToken", stubGetIAMToken);
      selfServiceManager = new SelfServiceManager({
        managementUrl: "managementUrlTest",
        iamApiKey: "testIamApiKey"
      });
      done();
    });

    after((done) => {
      _handleRequestRevert();
      _getIAMTokenRevert();
      done();
    });

    it("Should successfully resend", (done) => {
      selfServiceManager.resendNotification(testUuid, testTemplateName, language).then((res) => {
        try {
          assert.equal(JSON.stringify(res), JSON.stringify(testUuid));
          done();
        } catch (err) {
          done(err);
        }
      }).catch((err) => {
        done(err);
      });
    });

    it("Should successfully resend with provided iamToken", (done) => {
      const selfServiceManager2 = new SelfServiceManager({
        managementUrl: "managementUrlTest"
      });
      selfServiceManager2.resendNotification(testUuid, testTemplateName, language, providedIamToken).then((res) => {
        try {
          assert.equal(JSON.stringify(res), JSON.stringify(testUuid));
          done();
        } catch (err) {
          done(err);
        }
      }).catch((err) => {
        done(err);
      });
    });

    it("Should reject on _getIAMToken", (done) => {
      const selfServiceManager2 = new SelfServiceManager({
        managementUrl: "managementUrlTest",
        iamApiKey: badIamApiKey
      });
      selfServiceManager2.resendNotification(testUuid, testTemplateName, language).then(() => {
        done("should reject");
      }).catch((err) => {
        try {
          assert.equal(badIamApiKey, err.message);
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it("Should reject on _handleRequest", (done) => {
      selfServiceManager.resendNotification({}, testTemplateName, language).then(() => {
        done("should reject");
      }).catch((err) => {
        try {
          assert.equal("wrong input to _handleRequest in resendNotification API", err);
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  });

  describe("#SelfServiceManager.getSignUpConfirmationResult", () => {
    let selfServiceManager;
    const testContext = "testContext";
    const expectedBody = {
      context: testContext
    };
    const expectedQuery = {};
    const testIamToken = "bearer axcvrd";
    const badIamApiKey = "badIamApiKey";
    const providedIamToken = "bearer 123";
    let _handleRequestRevert,
      _getIAMTokenRevert;

    const stubHandleRequest = (iamToken, method, url, body, queryObject, action, deferred) => {
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

    const stubGetIAMToken = (iamToken, iamApiKey, iamTokenUrl) => {
      if (!iamApiKey) {
        if (iamToken !== providedIamToken) {
          return Q.reject("iamToken was not received to _getIAMToken function");
        }
        return Q.resolve(testIamToken);
      }
      if (badIamApiKey === iamApiKey) {
        return Q.reject(new Error(badIamApiKey));
      }
      if (iamApiKey !== "testIamApiKey" || iamTokenUrl !== "https://iam.bluemix.net/oidc/token") {
        return Q.reject("wrong input to _getIAMToken in getSignUpConfirmationResult API");
      }
      return Q.resolve(testIamToken);
    };
    before((done) => {
      _handleRequestRevert = SelfServiceManager.__set__("_handleRequest", stubHandleRequest);
      _getIAMTokenRevert = SelfServiceManager.__set__("_getIAMToken", stubGetIAMToken);
      selfServiceManager = new SelfServiceManager({
        managementUrl: "managementUrlTest",
        iamApiKey: "testIamApiKey"
      });
      done();
    });
    after((done) => {
      _handleRequestRevert();
      _getIAMTokenRevert();
      done();
    });

    it("Should successfully get confirmation result", (done) => {
      selfServiceManager.getSignUpConfirmationResult(testContext).then((res) => {
        try {
          assert.equal(JSON.stringify(res), JSON.stringify(testContext));
          done();
        } catch (err) {
          done(err);
        }
      }).catch((err) => {
        done(err);
      });
    });

    it("Should successfully get confirmation result with provided iamToken", (done) => {
      const selfServiceManager2 = new SelfServiceManager({
        managementUrl: "managementUrlTest"
      });
      selfServiceManager2.getSignUpConfirmationResult(testContext, providedIamToken).then((res) => {
        try {
          assert.equal(JSON.stringify(res), JSON.stringify(testContext));
          done();
        } catch (err) {
          done(err);
        }
      }).catch((err) => {
        done(err);
      });
    });

    it("Should reject on _getIAMToken", (done) => {
      const selfServiceManager2 = new SelfServiceManager({
        managementUrl: "managementUrlTest",
        iamApiKey: badIamApiKey
      });
      selfServiceManager2.getSignUpConfirmationResult(testContext).then(() => {
        done("should reject");
      }).catch((err) => {
        try {
          assert.equal(badIamApiKey, err.message);
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it("Should reject on _handleRequest", (done) => {
      selfServiceManager.getSignUpConfirmationResult({}).then(() => {
        done("should reject");
      }).catch((err) => {
        try {
          assert.equal("wrong input to _handleRequest in getSignUpConfirmationResult API", err);
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  });

  describe("#SelfServiceManager.getForgotPasswordConfirmationResult", () => {
    let selfServiceManager;
    const testContext = "testContext";
    const expectedBody = {
      context: testContext
    };
    const expectedQuery = {};
    const testIamToken = "bearer axcvrd";
    const badIamApiKey = "badIamApiKey";
    const providedIamToken = "bearer 123";
    let _handleRequestRevert,
      _getIAMTokenRevert;

    const stubHandleRequest = (iamToken, method, url, body, queryObject, action, deferred) => {
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

    const stubGetIAMToken = (iamToken, iamApiKey, iamTokenUrl) => {
      if (!iamApiKey) {
        if (iamToken !== providedIamToken) {
          return Q.reject("iamToken was not received to _getIAMToken function");
        }
        return Q.resolve(testIamToken);
      }
      if (badIamApiKey === iamApiKey) {
        return Q.reject(new Error(badIamApiKey));
      }
      if (iamApiKey !== "testIamApiKey" || iamTokenUrl !== "https://iam.bluemix.net/oidc/token") {
        return Q.reject("wrong input to _getIAMToken in getForgotPasswordConfirmationResult API");
      }
      return Q.resolve(testIamToken);
    };
    before((done) => {
      _handleRequestRevert = SelfServiceManager.__set__("_handleRequest", stubHandleRequest);
      _getIAMTokenRevert = SelfServiceManager.__set__("_getIAMToken", stubGetIAMToken);
      selfServiceManager = new SelfServiceManager({
        managementUrl: "managementUrlTest",
        iamApiKey: "testIamApiKey"
      });
      done();
    });
    after((done) => {
      _handleRequestRevert();
      _getIAMTokenRevert();
      done();
    });

    it("Should successfully get confirmation result", (done) => {
      selfServiceManager.getForgotPasswordConfirmationResult(testContext).then((res) => {
        try {
          assert.equal(JSON.stringify(res), JSON.stringify(testContext));
          done();
        } catch (err) {
          done(err);
        }
      }).catch((err) => {
        done(err);
      });
    });

    it("Should successfully get confirmation result with provided iamToken", (done) => {
      const selfServiceManager2 = new SelfServiceManager({
        managementUrl: "managementUrlTest"
      });
      selfServiceManager2.getForgotPasswordConfirmationResult(testContext, providedIamToken).then((res) => {
        try {
          assert.equal(JSON.stringify(res), JSON.stringify(testContext));
          done();
        } catch (err) {
          done(err);
        }
      }).catch((err) => {
        done(err);
      });
    });

    it("Should reject on _getIAMToken", (done) => {
      const selfServiceManager2 = new SelfServiceManager({
        managementUrl: "managementUrlTest",
        iamApiKey: badIamApiKey
      });
      selfServiceManager2.getForgotPasswordConfirmationResult(testContext).then(() => {
        done("should reject");
      }).catch((err) => {
        try {
          assert.equal(badIamApiKey, err.message);
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it("Should reject on _handleRequest", (done) => {
      selfServiceManager.getForgotPasswordConfirmationResult({}).then(() => {
        done("should reject");
      }).catch((err) => {
        try {
          assert.equal("wrong input to _handleRequest in getForgotPasswordConfirmationResult API", err);
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  });

  describe("#SelfServiceManager.setUserNewPassword", () => {
    let selfServiceManager;
    const language = "en";
    const testUuid = "testUuid";
    const testNewPassword = "testNewPassword";
    const expectedBody = {
      uuid: testUuid,
      newPassword: testNewPassword
    };
    const expectedQuery = {
      language
    };
    const testIamToken = "bearer axcvrd";
    const badIamApiKey = "badIamApiKey";
    const providedIamToken = "bearer 123";
    let _getIAMTokenRevert,
      _handleRequestRevert;
    const testIpAddress = "127.0.0.1";

    const stubHandleRequest = (iamToken, method, url, body, queryObject, action, deferred) => {
      if (body.changedIpAddress) {
        if (body.changedIpAddress !== testIpAddress) {
          return deferred.reject("wrong ip address passed in setUserNewPassword API");
        }
        return deferred.resolve(testUuid);
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

    const stubGetIAMToken = (iamToken, iamApiKey, iamTokenUrl) => {
      if (!iamApiKey) {
        if (iamToken !== providedIamToken) {
          return Q.reject("iamToken was not received to _getIAMToken function");
        }
        return Q.resolve(testIamToken);
      }
      if (badIamApiKey === iamApiKey) {
        return Q.reject(new Error(badIamApiKey));
      }
      if (iamApiKey !== "testIamApiKey" || iamTokenUrl !== "https://iam.bluemix.net/oidc/token") {
        return Q.reject("wrong input to _getIAMToken in setUserNewPassword API");
      }
      return Q.resolve(testIamToken);
    };
    before((done) => {
      _handleRequestRevert = SelfServiceManager.__set__("_handleRequest", stubHandleRequest);
      _getIAMTokenRevert = SelfServiceManager.__set__("_getIAMToken", stubGetIAMToken);
      selfServiceManager = new SelfServiceManager({
        managementUrl: "managementUrlTest",
        iamApiKey: "testIamApiKey"
      });
      done();
    });
    after((done) => {
      _handleRequestRevert();
      _getIAMTokenRevert();
      done();
    });

    it("Should successfully set new password", (done) => {
      selfServiceManager.setUserNewPassword(testUuid, testNewPassword, language).then((res) => {
        try {
          assert.equal(JSON.stringify(res), JSON.stringify(testUuid));
          done();
        } catch (err) {
          done(err);
        }
      }).catch((err) => {
        done(err);
      });
    });

    it("Should successfully set new password with ipAddress", (done) => {
      selfServiceManager.setUserNewPassword(testUuid, testNewPassword, language, testIpAddress).then((res) => {
        try {
          assert.equal(JSON.stringify(res), JSON.stringify(testUuid));
          done();
        } catch (err) {
          done(err);
        }
      }).catch((err) => {
        done(err);
      });
    });

    it("Should successfully set new password with provided iamToken", (done) => {
      const selfServiceManager2 = new SelfServiceManager({
        managementUrl: "managementUrlTest"
      });
      selfServiceManager2.setUserNewPassword(testUuid, testNewPassword, language, null, providedIamToken).then((res) => {
        try {
          assert.equal(JSON.stringify(res), JSON.stringify(testUuid));
          done();
        } catch (err) {
          done(err);
        }
      }).catch((err) => {
        done(err);
      });
    });

    it("Should reject on _getIAMToken", (done) => {
      const selfServiceManager2 = new SelfServiceManager({
        managementUrl: "managementUrlTest",
        iamApiKey: badIamApiKey
      });
      selfServiceManager2.setUserNewPassword(testUuid, testNewPassword, language).then(() => {
        done("should reject");
      }).catch((err) => {
        try {
          assert.equal(badIamApiKey, err.message);
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it("Should reject on _handleRequest", (done) => {
      selfServiceManager.setUserNewPassword({}, testNewPassword, language).then(() => {
        done("should reject");
      }).catch((err) => {
        try {
          assert.equal("wrong input to _handleRequest in setUserNewPassword API", err);
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  });

  describe("#SelfServiceManager.getUserDetails", () => {
    let selfServiceManager;
    const testUuid = "testUuid";
    const expectedBody = {};
    const expectedQuery = {};
    const testIamToken = "bearer axcvrd";
    const badIamApiKey = "badIamApiKey";
    const providedIamToken = "bearer 123";
    let _getIAMTokenRevert,
      _handleRequestRevert;

    const stubHandleRequest = (iamToken, method, url, body, queryObject, action, deferred) => {
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

    const stubGetIAMToken = (iamToken, iamApiKey, iamTokenUrl) => {
      if (!iamApiKey) {
        if (iamToken !== providedIamToken) {
          return Q.reject("iamToken was not received to _getIAMToken function");
        }
        return Q.resolve(testIamToken);
      }
      if (badIamApiKey === iamApiKey) {
        return Q.reject(new Error(badIamApiKey));
      }
      if (iamApiKey !== "testIamApiKey" || iamTokenUrl !== "https://iam.bluemix.net/oidc/token") {
        return Q.reject("wrong input to _getIAMToken in getUserDetails API");
      }
      return Q.resolve(testIamToken);
    };
    before((done) => {
      _handleRequestRevert = SelfServiceManager.__set__("_handleRequest", stubHandleRequest);
      _getIAMTokenRevert = SelfServiceManager.__set__("_getIAMToken", stubGetIAMToken);
      selfServiceManager = new SelfServiceManager({
        managementUrl: "managementUrlTest",
        iamApiKey: "testIamApiKey"
      });
      done();
    });

    after((done) => {
      _handleRequestRevert();
      _getIAMTokenRevert();
      done();
    });

    it("Should successfully get user details", (done) => {
      selfServiceManager.getUserDetails(testUuid).then((res) => {
        try {
          assert.equal(JSON.stringify(res), JSON.stringify(testUuid));
          done();
        } catch (err) {
          done(err);
        }
      }).catch((err) => {
        done(err);
      });
    });

    it("Should successfully get user details with provided iamToken", (done) => {
      const selfServiceManager2 = new SelfServiceManager({
        managementUrl: "managementUrlTest"
      });
      selfServiceManager2.getUserDetails(testUuid, providedIamToken).then((res) => {
        try {
          assert.equal(JSON.stringify(res), JSON.stringify(testUuid));
          done();
        } catch (err) {
          done(err);
        }
      }).catch((err) => {
        done(err);
      });
    });

    it("Should reject on _getIAMToken", (done) => {
      const selfServiceManager2 = new SelfServiceManager({
        managementUrl: "managementUrlTest",
        iamApiKey: badIamApiKey
      });
      selfServiceManager2.getUserDetails(testUuid).then(() => {
        done("should reject");
      }).catch((err) => {
        try {
          assert.equal(badIamApiKey, err.message);
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it("Should reject on _handleRequest", (done) => {
      selfServiceManager.getUserDetails({}).then(() => {
        done("should reject");
      }).catch((err) => {
        try {
          assert.equal("wrong input to _handleRequest in getUserDetails API", err);
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  });

  describe("#SelfServiceManager.updateUserDetails", () => {
    let selfServiceManager;
    const testUuid = "testUuid";
    const expectedQuery = {};
    const testIamToken = "bearer axcvrd";
    const badIamApiKey = "badIamApiKey";
    const providedIamToken = "bearer 123";
    const testUserJson = {
      email: "testEmail"
    };
    let _handleRequestRevert,
      _getIAMTokenRevert;

    const stubHandleRequest = (iamToken, method, url, body, queryObject, action, deferred) => {
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

    const stubGetIAMToken = (iamToken, iamApiKey, iamTokenUrl) => {
      if (!iamApiKey) {
        if (iamToken !== providedIamToken) {
          return Q.reject("iamToken was not received to _getIAMToken function");
        }
        return Q.resolve(testIamToken);
      }
      if (badIamApiKey === iamApiKey) {
        return Q.reject(new Error(badIamApiKey));
      }
      if (iamApiKey !== "testIamApiKey" || iamTokenUrl !== "https://iam.bluemix.net/oidc/token") {
        return Q.reject("wrong input to _getIAMToken in updateUserDetails API");
      }
      return Q.resolve(testIamToken);
    };
    before((done) => {
      _handleRequestRevert = SelfServiceManager.__set__("_handleRequest", stubHandleRequest);
      _getIAMTokenRevert = SelfServiceManager.__set__("_getIAMToken", stubGetIAMToken);
      selfServiceManager = new SelfServiceManager({
        managementUrl: "managementUrlTest",
        iamApiKey: "testIamApiKey"
      });
      done();
    });

    after((done) => {
      _handleRequestRevert();
      _getIAMTokenRevert();
      done();
    });

    it("Should successfully update user details", (done) => {
      selfServiceManager.updateUserDetails(testUuid, testUserJson).then((res) => {
        try {
          assert.equal(JSON.stringify(res), JSON.stringify(testUuid));
          done();
        } catch (err) {
          done(err);
        }
      }).catch((err) => {
        done(err);
      });
    });

    it("Should successfully update user details with provided iamToken", (done) => {
      const selfServiceManager2 = new SelfServiceManager({
        managementUrl: "managementUrlTest"
      });
      selfServiceManager2.updateUserDetails(testUuid, testUserJson, providedIamToken).then((res) => {
        try {
          assert.equal(JSON.stringify(res), JSON.stringify(testUuid));
          done();
        } catch (err) {
          done(err);
        }
      }).catch((err) => {
        done(err);
      });
    });

    it("Should reject on _getIAMToken", (done) => {
      const selfServiceManager2 = new SelfServiceManager({
        managementUrl: "managementUrlTest",
        iamApiKey: badIamApiKey
      });
      selfServiceManager2.updateUserDetails(testUuid, testUserJson).then(() => {
        done("should reject");
      }).catch((err) => {
        try {
          assert.equal(badIamApiKey, err.message);
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it("Should reject on _handleRequest", (done) => {
      selfServiceManager.updateUserDetails({}, testUserJson).then(() => {
        done("should reject");
      }).catch((err) => {
        try {
          assert.equal("wrong input to _handleRequest in updateUserDetails API", err);
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  });

  describe("test _getIAMToken function", () => {
    let _getIAMToken,
      stubRequestRevert;
    const testToken = "testToken";
    const netError = "netError";
    const badInputError = "badInputError";
    const testApiKey = "testApiKey";
    const testUrl = "testUrl";
    const error = new Error("bad input to iam request");
    const netErrorObject = new Error("network issue");
    const inputErrorBody = {
      error: "some bad input"
    };
    const expectedInput = {
      url: testUrl,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json"
      },
      form: {
        grant_type: "urn:ibm:params:oauth:grant-type:apikey",
        apikey: testApiKey
      }
    };

    const stubRequest = (options, callback) => {
      if (options.url === netError) {
        return callback(netErrorObject, {}, {});
      }
      if (options.url === badInputError) {
        return callback(null, {
          statusCode: 400
        }, inputErrorBody);
      }
      if (JSON.stringify(options) !== JSON.stringify(expectedInput)) {
        return callback(error, {}, {});
      }
      return callback(null, {
        statusCode: 200
      }, JSON.stringify({
        access_token: testToken
      }));
    };
    before((done) => {
      _getIAMToken = SelfServiceManager.__get__("_getIAMToken");
      stubRequestRevert = SelfServiceManager.__set__("request", stubRequest);
      done();
    });
    after((done) => {
      stubRequestRevert();
      done();
    });

    it("iamToken provided", (done) => {
      _getIAMToken(testToken).then((token) => {
        try {
          assert.equal(testToken, token);
          done();
        } catch (e) {
          done(e);
        }
      }).catch((err) => {
        done(err);
      });
    });

    it("no iamToken no iamApiKey", (done) => {
      _getIAMToken().then(() => {
        done("should not get here");
      }).catch((err) => {
        try {
          assert.equal("You must pass 'iamToken' to self-service-manager APIs or " +
            "specify 'iamApiKey' in selfServiceManager init options.", err.message);
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it("happy flow - should get iamToken from iam endpoint", (done) => {
      _getIAMToken(null, testApiKey, testUrl).then((token) => {
        try {
          assert.equal(testToken, token);
          done();
        } catch (e) {
          done(e);
        }
      }).catch((err) => {
        done(err);
      });
    });

    it("request failure network issue", (done) => {
      _getIAMToken(null, testApiKey, netError).then(() => {
        done("should not get here");
      }).catch((err) => {
        try {
          assert.equal("network issue", err);
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it("request failure bad input", (done) => {
      _getIAMToken(null, testApiKey, badInputError).then(() => {
        done("should not get here");
      }).catch((err) => {
        try {
          assert.equal(inputErrorBody, err);
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  });

  describe("test _handleRequest function", () => {
    let _handleRequest;
    const testToken = "testToken";
    const netError = "netError";
    const badInputError = "badInputError";
    const badInputErrorBodyString = "badInputErrorBodyString";
    const badInputErrorBodyWithDetail = "badInputErrorBodyWithDetail";
    const badInputErrorBodyWithMessage = "badInputErrorBodyWithMessage";
    const testUrl = "testUrl";
    const error = new Error("bad input to iam request");
    const netErrorObject = new Error("network issue");
    const inputErrorBody = {
      error: "some bad input"
    };
    const inputErrorBodyString = "some error string";
    const inputErrorBodyDetail = {
      detail: "some detail",
      scimType: "some scimType"
    };
    const inputErrorBodyMessage = {
      message: "some message"
    };
    const body = {
      t: "t"
    };
    const queryObject = {
      r: "r"
    };
    const action = "action";
    const method = "POST";
    const successBody = {
      e: "e"
    };
    let stubRequestRevert;

    const expectedInput = {
      url: testUrl,
      method,
      qs: queryObject,
      json: body,
      headers: {
        Authorization: `Bearer ${testToken}`
      }
    };
    const expectedInputForGet = {
      url: testUrl,
      method: "GET",
      qs: queryObject,
      json: true,
      headers: {
        Authorization: `Bearer ${testToken}`
      }
    };

    const stubRequest = (options, callback) => {
      if (options.method === "GET") {
        if (JSON.stringify(options) !== JSON.stringify(expectedInputForGet)) {
          return callback(error, {}, {});
        }
        return callback(null, {
          statusCode: 200
        }, successBody);
      }
      if (options.url === netError) {
        return callback(netErrorObject, {}, {});
      }
      if (options.url === badInputError) {
        return callback(null, {
          statusCode: 400
        }, inputErrorBody);
      }
      if (options.url === badInputErrorBodyString) {
        return callback(null, {
          statusCode: 400
        }, inputErrorBodyString);
      }
      if (options.url === badInputErrorBodyWithDetail) {
        return callback(null, {
          statusCode: 400
        }, inputErrorBodyDetail);
      }
      if (options.url === badInputErrorBodyWithMessage) {
        return callback(null, {
          statusCode: 400
        }, inputErrorBodyMessage);
      }
      if (JSON.stringify(options) !== JSON.stringify(expectedInput)) {
        return callback(error, {}, {});
      }
      return callback(null, {
        statusCode: 200
      }, successBody);
    };
    before((done) => {
      _handleRequest = SelfServiceManager.__get__("_handleRequest");
      stubRequestRevert = SelfServiceManager.__set__("request", stubRequest);
      done();
    });
    after((done) => {
      stubRequestRevert();
      done();
    });

    it("happy flow - should return success response", (done) => {
      const deferred = {
        resolve(inputBody) {
          try {
            assert.equal(successBody, inputBody);
            done();
          } catch (e) {
            done(e);
          }
        },
        reject(err) {
          done(err);
        }
      };
      _handleRequest(testToken, method, testUrl, body, queryObject, action, deferred);
    });

    it("request failure network issue", (done) => {
      const deferred = {
        resolve() {
          done("should reject");
        },
        reject(err) {
          try {
            assert.equal("general_error", err.code);
            assert.equal(`Failed to ${action}`, err.message);
            done();
          } catch (e) {
            done(e);
          }
        }
      };
      _handleRequest(testToken, method, netError, body, queryObject, action, deferred);
    });

    it("request failure bad input", (done) => {
      const deferred = {
        resolve() {
          done("should reject");
        },
        reject(err) {
          try {
            assert.equal("some bad input", err.message);
            done();
          } catch (e) {
            done(e);
          }
        }
      };
      _handleRequest(testToken, method, badInputError, body, queryObject, action, deferred);
    });

    it("validate request with GET does not have body", (done) => {
      const deferred = {
        resolve(resolveBody) {
          try {
            assert.equal(successBody, resolveBody);
            done();
          } catch (e) {
            done(e);
          }
        },
        reject(err) {
          done(err);
        }
      };
      _handleRequest(testToken, "GET", testUrl, body, queryObject, action, deferred);
    });

    it("request failure bad input - body is not object", (done) => {
      const deferred = {
        resolve() {
          done("should reject");
        },
        reject(err) {
          try {
            assert.equal(inputErrorBodyString, err.message);
            done();
          } catch (e) {
            done(e);
          }
        }
      };
      _handleRequest(testToken, method, badInputErrorBodyString, body, queryObject, action, deferred);
    });

    it("request failure bad input - body with detail", (done) => {
      const deferred = {
        resolve() {
          done("should reject");
        },
        reject(err) {
          try {
            assert.equal(inputErrorBodyDetail.scimType, err.code);
            assert.equal(inputErrorBodyDetail.detail, err.message);
            done();
          } catch (e) {
            done(e);
          }
        }
      };
      _handleRequest(testToken, method, badInputErrorBodyWithDetail, body, queryObject, action, deferred);
    });

    it("request failure bad input - body with message", (done) => {
      const deferred = {
        resolve() {
          done("should reject");
        },
        reject(err) {
          try {
            assert.equal(inputErrorBodyMessage.message, err.message);
            done();
          } catch (e) {
            done(e);
          }
        }
      };
      _handleRequest(testToken, method, badInputErrorBodyWithMessage, body, queryObject, action, deferred);
    });
  });
});
