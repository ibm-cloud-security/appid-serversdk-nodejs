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
const Q = require("q");

const {assert} = chai;

// eslint-disable-next-line max-len
const identityTokenSubIsSubject123 = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpPU0UifQ.eyJzdWIiOiJzdWJqZWN0MTIzIn0.QpodAz7eU9NU0gBu0oj4zaI0maa94jzbm4BEV2I_sURw9fvfpLLt3zxHi-C3ItlcHiMSyWWL6oGyrkX_25Z7GK2Taxx5ix4bsi-iYOzJQ-SP4sVaKJ5fRMLMpnRMwOQrOGmrzhf53mqVJ76XK58ZM0Sa7pxM92N1PQDxPXPSfxejhN2xISi-Zw4yotQCny-AGjj5xnfNAPiaYjVGy_xK3Y_8xTSZkGcjuJ76deK9SBf7u-wH92zWWhqtaN_mU4yAOyejG3Z1aSduWc-N6K7jhjMReJLowJChDN2hCmvJ5EISL7JkITmZWdrQW-ZSZ76JMQ0u_-ecnX6r_C4KG_fzDg";
// eslint-disable-next-line max-len
const identityTokenSubIs123 = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpPU0UifQ.eyJzdWIiOiIxMjMifQ.enbXHtja8BJd9_hlIbCgwyMXl8o9s74yDlqH4_11h7xLVasDO8Yy4jNyhVmIIb8jpl4fQfjWjqaOJoD2TqgfhqwQ-tGRjzYYR-f0qAMb99pNDtLS9IFf1yHYM2y65UerZ8qTD4g2s-ZWPk7yvxPMQx-Nrvu-X2uUwvdBCBr02rXpsHdMbeLYA6iwUs58p5hMxOxf3yKrBcTpTJ4EE164BhruEU5HyHhqSM9DTVLvliuapFFIK4CGV3FjvrKnT38yWdxSWtd9ETC79bfBwWTsE0ykMzb7Nq3vA2O0C_pv5IUixkLtTCiT3s5m55WZaqxdFCvOe4BjAt6AWH7slwgZdg";

function requestMock(options, callback) {
  const authHeader = options.headers["Authorization"];

  if (authHeader.indexOf("return_error") > 0) {
    return callback(new Error("EXPECTED FAILURE"));
  }
  if (authHeader.indexOf("return_code") > 0) {
    const statusCode = parseInt(authHeader.split("_")[2], 10);
    return callback(null, {
      statusCode: parseInt(statusCode, 10)
    });
  }
  if (authHeader.indexOf("userinfo_access_token_no_body") > 0) {
    return callback(null, {
      statusCode: 200
    });
  }
  if (authHeader.indexOf("userinfo_access_token") > 0) {
    options.sub = "123";
    return callback(null, {
      statusCode: 200
    }, JSON.stringify(options));
  }
  return callback(null, {
    statusCode: 200
  }, JSON.stringify(options));
}

describe("/lib/user-profile-manager/user-profile-manager", () => {
  let UserProfileManager;

  before(() => {
    UserProfileManager = proxyquire("../lib/user-profile-manager/user-profile-manager", {
      request: requestMock
    });
  });

  describe("#UserProfileManager.init", () => {
    it("Should not be able to init without options and VCAP_SERVICS", () => {
      UserProfileManager.init();
      // TODO: add validation that errors are printed to console
    });

    it("Should be able to init with options", () => {
      UserProfileManager.init({
        profilesUrl: "dummyurl"
      });
    });

    it("Should fail if there is a service endpoint and no version", () => {
      delete process.env.VCAP_SERVICES;
      assert.throws(() => {
        UserProfileManager.init({
          tenantId: "abcd",
          throwIfFail: true,
          appidServiceEndpoint: "zyxw"
        });
      }, Error, /Failed to initialize APIStrategy\. Missing/);
    });
    it("Should fail if there is a service endpoint and no version", () => {
      delete process.env.VCAP_SERVICES;
      assert.throws(() => {
        UserProfileManager.init({
          tenantId: "abcd",
          throwIfFail: true,
          appidServiceEndpoint: "zyxw",
          version: "string_instead_number"
        });
      }, Error, /Failed to initialize APIStrategy\. Missing/);
    });
    it("Should fail if there is a service endpoint and no tenant", () => {
      delete process.env.VCAP_SERVICES;
      assert.throws(() => {
        UserProfileManager.init({
          version: "3",
          throwIfFail: true,
          appidServiceEndpoint: "zyxw"
        });
      }, Error, /Failed to initialize APIStrategy\. Missing/);
    });
    it("Should success if there is a service endpoint tenant and version - endpoint with trailing slash", () => {
      delete process.env.VCAP_SERVICES;
      const tenantId = "abcd";
      UserProfileManager.init({
        tenantId,
        version: "3",
        throwIfFail: true,
        appidServiceEndpoint: "zyxw/"
      });
    });

    it("Should be able to init with VCAP_SERVICE (invalid)", () => {
      process.env.VCAP_SERVICES = JSON.stringify({
        invalid: [{
          credentials: {
            profilesUrl: "http://abcd"
          }
        }]
      });
      UserProfileManager.init();
    });

    it("Should be able to init with VCAP_SERVICES (AdvancedMobileAccess)", () => {
      process.env.VCAP_SERVICES = JSON.stringify({
        AdvancedMobileAccess: [{
          credentials: {
            profilesUrl: "http://abcd"
          }
        }]
      });
      UserProfileManager.init();
    });

    it("Should be able to init with VCAP_SERVICES (appid)", () => {
      process.env.VCAP_SERVICES = JSON.stringify({
        AppID: [{
          credentials: {
            serverUrl: "http://abcd"
          }
        }]
      });
      UserProfileManager.init();
    });
  });
  describe("#UserProfileManager.setAttribute", () => {
    it("Should validate all parameters are present", (done) => {
      const p1 = UserProfileManager.setAttribute();
      const p2 = UserProfileManager.setAttribute("accessToken");
      const p3 = UserProfileManager.setAttribute("accessToken", "name");

      Q.allSettled([p1, p2, p3]).spread((r1, r2, r3) => {
        assert.equal(r1.state, "rejected");
        assert.equal(r2.state, "rejected");
        assert.equal(r3.state, "rejected");
        done();
      }).catch((e) => {
        done(new Error(e));
      });
    });

    it("Should fail if there's an error", (done) => {
      const p1 = UserProfileManager.setAttribute("return_error", "name", "value");
      const p2 = UserProfileManager.setAttribute("return_code_401", "name", "value");
      const p3 = UserProfileManager.setAttribute("return_code_403", "name", "value");
      const p4 = UserProfileManager.setAttribute("return_code_404", "name", "value");
      const p5 = UserProfileManager.setAttribute("return_code_500", "name", "value");
      Q.allSettled([p1, p2, p3, p4, p5]).spread((r1, r2, r3, r4, r5) => {
        assert.equal(r1.state, "rejected");
        assert.equal(r2.state, "rejected");
        assert.equal(r3.state, "rejected");
        assert.equal(r4.state, "rejected");
        assert.equal(r5.state, "rejected");
        done();
      }).catch((e) => {
        done(new Error(e));
      });
    });

    it("Should send proper access token, url and value", (done) => {
      process.env.VCAP_SERVICES = JSON.stringify({
        AppID: [{
          credentials: {
            tenantId: "abcd",
            clientId: "clientId",
            secret: "secret",
            oauthServerUrl: "http://abcd",
            profilesUrl: "http://abcd"
          }
        }]
      });
      UserProfileManager.init();
      UserProfileManager.setAttribute("access_token", "name", "value").then((result) => {
        assert.equal(result.url, "http://abcd/api/v1/attributes/name");
        assert.equal(result.method, "PUT");
        assert.equal(result.body, "value");
        assert.equal(result.headers["Authorization"], "Bearer access_token");
        done();
      }).catch(done);
    });
  });
  describe("#UserProfileManager.getAttribute", () => {
    process.env.VCAP_SERVICES = JSON.stringify({
      AppID: [{
        credentials: {
          tenantId: "abcd",
          clientId: "clientId",
          secret: "secret",
          oauthServerUrl: "http://abcd",
          profilesUrl: "http://abcd"
        }
      }]
    });
    it("Should validate all parameters are present", (done) => {
      const p1 = UserProfileManager.getAttribute();
      const p2 = UserProfileManager.getAttribute("accessToken");

      Q.allSettled([p1, p2]).spread((r1, r2) => {
        assert.equal(r1.state, "rejected");
        assert.equal(r2.state, "rejected");
        done();
      }).catch((e) => {
        done(new Error(e));
      });
    });

    it("Should fail if there's an error", (done) => {
      const p1 = UserProfileManager.getAttribute("return_error", "name");
      const p2 = UserProfileManager.getAttribute("return_code_401", "name");
      const p3 = UserProfileManager.getAttribute("return_code_403", "name");
      const p4 = UserProfileManager.getAttribute("return_code_404", "name");
      const p5 = UserProfileManager.getAttribute("return_code_500", "name");
      Q.allSettled([p1, p2, p3, p4, p5]).spread((r1, r2, r3, r4, r5) => {
        assert.equal(r1.state, "rejected");
        assert.equal(r2.state, "rejected");
        assert.equal(r3.state, "rejected");
        assert.equal(r4.state, "rejected");
        assert.equal(r5.state, "rejected");
        done();
      }).catch((e) => {
        done(new Error(e));
      });
    });

    it("Should send proper access token, url and value", (done) => {
      UserProfileManager.getAttribute("access_token", "name").then((result) => {
        assert.equal(result.url, "http://abcd/api/v1/attributes/name");
        assert.equal(result.method, "GET");
        assert.equal(result.headers["Authorization"], "Bearer access_token");
        done();
      }).catch(done);
    });
  });

  describe("#UserProfileManager.deleteAttribute", () => {
    process.env.VCAP_SERVICES = JSON.stringify({
      AppID: [{
        credentials: {
          tenantId: "abcd",
          clientId: "clientId",
          secret: "secret",
          oauthServerUrl: "http://abcd",
          profilesUrl: "http://abcd"
        }
      }]
    });
    it("Should validate all parameters are present", (done) => {
      const p1 = UserProfileManager.deleteAttribute();
      const p2 = UserProfileManager.deleteAttribute("accessToken");

      Q.allSettled([p1, p2]).spread((r1, r2) => {
        assert.equal(r1.state, "rejected");
        assert.equal(r2.state, "rejected");
        done();
      }).catch((e) => {
        done(new Error(e));
      });
    });

    it("Should fail if there's an error", (done) => {
      const p1 = UserProfileManager.deleteAttribute("return_error", "name", "value");
      const p2 = UserProfileManager.deleteAttribute("return_code_401", "name", "value");
      const p3 = UserProfileManager.deleteAttribute("return_code_403", "name", "value");
      const p4 = UserProfileManager.deleteAttribute("return_code_404", "name", "value");
      const p5 = UserProfileManager.deleteAttribute("return_code_500", "name", "value");
      Q.allSettled([p1, p2, p3, p4, p5]).spread((r1, r2, r3, r4, r5) => {
        assert.equal(r1.state, "rejected");
        assert.equal(r2.state, "rejected");
        assert.equal(r3.state, "rejected");
        assert.equal(r4.state, "rejected");
        assert.equal(r5.state, "rejected");
        done();
      }).catch((e) => {
        done(new Error(e));
      });
    });

    it("Should send proper access token, url and value", (done) => {
      UserProfileManager.deleteAttribute("access_token", "name").then((result) => {
        assert.equal(result.url, "http://abcd/api/v1/attributes/name");
        assert.equal(result.method, "DELETE");
        assert.equal(result.headers["Authorization"], "Bearer access_token");
        done();
      });
    });
  });

  describe("#UserProfileManager.getAllAttributes", () => {
    it("Should validate all parameters are present", (done) => {
      const p1 = UserProfileManager.getAllAttributes();

      Q.allSettled([p1]).spread((r1) => {
        assert.equal(r1.state, "rejected");
        done();
      }).catch((e) => {
        done(new Error(e));
      });
    });

    it("Should fail if there's an error", (done) => {
      const p1 = UserProfileManager.getAllAttributes("return_error");
      const p2 = UserProfileManager.getAllAttributes("return_code_401");
      const p3 = UserProfileManager.getAllAttributes("return_code_403");
      const p4 = UserProfileManager.getAllAttributes("return_code_404");
      const p5 = UserProfileManager.getAllAttributes("return_code_500");
      Q.allSettled([p1, p2, p3, p4, p5]).spread((r1, r2, r3, r4, r5) => {
        assert.equal(r1.state, "rejected");
        assert.equal(r2.state, "rejected");
        assert.equal(r3.state, "rejected");
        assert.equal(r4.state, "rejected");
        assert.equal(r5.state, "rejected");
        done();
      }).catch((e) => {
        done(new Error(e));
      });
    });

    it("Should send proper access token, url and value", (done) => {
      UserProfileManager.getAllAttributes("access_token").then((result) => {
        assert.equal(result.url, "http://abcd/api/v1/attributes");
        assert.equal(result.method, "GET");
        assert.equal(result.headers["Authorization"], "Bearer access_token");
        done();
      });
    });
  });

  describe("#UserProfileManager.getUserInfo", () => {
    it("Should validate all parameters are present", (done) => {
      const p1 = UserProfileManager.getUserInfo();
      const p2 = UserProfileManager.getUserInfo("accessToken");

      Q.allSettled([p1, p2]).spread((r1, r2) => {
        assert.equal(r1.state, "rejected");
        assert.equal(r2.state, "rejected");
        done();
      }).catch((e) => {
        done(new Error(e));
      });
    });

    it("Should fail if there's an error", (done) => {
      const p1 = UserProfileManager.getUserInfo("return_error", identityTokenSubIs123);
      const p2 = UserProfileManager.getUserInfo("return_code_401", identityTokenSubIs123);
      const p3 = UserProfileManager.getUserInfo("return_code_403", identityTokenSubIs123);
      const p4 = UserProfileManager.getUserInfo("return_code_404", identityTokenSubIs123);
      const p5 = UserProfileManager.getUserInfo("return_code_500", identityTokenSubIs123);
      const p6 = UserProfileManager.getUserInfo("userinfo_access_token", identityTokenSubIsSubject123);
      const p7 = UserProfileManager.getUserInfo("userinfo_access_token", "malformed identityToken");
      const p8 = UserProfileManager.getUserInfo("userinfo_access_token", 8);
      Q.allSettled([p1, p2, p3, p4, p5, p6, p7, p8]).spread((r1, r2, r3, r4, r5, r6, r7, r8) => {
        assert.equal(r1.state, "rejected");
        assert.equal(r2.state, "rejected");
        assert.equal(r3.state, "rejected");
        assert.equal(r4.state, "rejected");
        assert.equal(r5.state, "rejected");
        assert.equal(r6.state, "rejected");
        assert.equal(r7.state, "rejected");
        assert.equal(r8.state, "rejected");
        done();
      }).catch((e) => {
        done(new Error(e));
      });
    });

    it("should send userinfo payload", (done) => {
      UserProfileManager.oauthServerUrl = "http://oauth";
      UserProfileManager.getUserInfo("userinfo_access_token", identityTokenSubIs123).then((result) => {
        assert.equal(result.url, "http://oauth/userinfo");
        assert.equal(result.method, "GET");
        assert.equal(result.headers["Authorization"], "Bearer userinfo_access_token");
        assert.equal(result.sub, "123");
        done();
      }).catch(done);
    });

    it("should send null for undefined body", (done) => {
      UserProfileManager.oauthServerUrl = "http://oauth";
      UserProfileManager.getUserInfo("userinfo_access_token_no_body", identityTokenSubIs123).then(() => {
        done("Should fail for null body");
      }).catch((e) => {
        assert.equal(e.message, "Invalid user info response");
        done();
      });
    });

    it("should send userinfo payload without identity token", (done) => {
      UserProfileManager.oauthServerUrl = "http://oauth";
      UserProfileManager.getUserInfo("userinfo_access_token").then((result) => {
        assert.equal(result.url, "http://oauth/userinfo");
        assert.equal(result.method, "GET");
        assert.equal(result.headers["Authorization"], "Bearer userinfo_access_token");
        assert.equal(result.sub, "123");
        done();
      }).catch(done);
    });

    it("should send uesrinfo payload - validating identity token ", (done) => {
      UserProfileManager.oauthServerUrl = "http://oauth";
      UserProfileManager.getUserInfo("userinfo_access_token", identityTokenSubIs123).then((result) => {
        assert.equal(result.url, "http://oauth/userinfo");
        assert.equal(result.method, "GET");
        assert.equal(result.headers["Authorization"], "Bearer userinfo_access_token");
        assert.equal(result.sub, "123");
        done();
      }).catch(done);
    });
  });
});
