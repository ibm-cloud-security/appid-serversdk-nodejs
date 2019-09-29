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
const Q = require("q");
const chai = require("chai");
const proxyquire = require("proxyquire");

const {assert} = chai;

const testServerUrl = "https://mobileclientaccess.test.url/imf-authserver";
let requestCounter = 0;
let seqRequestCounter = 0;

const requestMock = function requestMock(options, callback) {
  if (options.url.indexOf("FAIL-PUBLIC-KEY") >= 0 || options.url.indexOf("FAIL_REQUEST") >= 0) {
    // Used in public-key-util-test
    return callback(new Error("STUBBED_ERROR"), {
      statusCode: 0
    }, null);
  }
  if (options.url.indexOf("SUCCESS-PUBLIC-KEY") !== -1) {
    // Used in public-key-util-test
    return callback(null, {
      statusCode: 200
    }, {
      keys: [{
        n: "1",
        e: "2",
        kid: "123"
      }]
    });
  }
  if (options.formData && options.formData.code && options.formData.code.indexOf("FAILING_CODE") !== -1) {
    // Used in webapp-strategy-test
    return callback(new Error("STUBBED_ERROR"), {
      statusCode: 0
    }, null);
  }
  if (options.formData && options.formData.code && options.formData.code.indexOf("WORKING_CODE") !== -1) {
    // Used in webapp-strategy-test
    return callback(null, {
      statusCode: 200
    }, JSON.stringify({
      access_token: "access_token_mock",
      id_token: "id_token_mock"
    }));
  }
  if (options.followRedirect === false) {
    return callback(null, {
      statusCode: 302,
      headers: {
        location: "test-location?code=WORKING_CODE"
      }
    });
  }
  if (options.url.indexOf("SETTIMEOUT-PUBLIC-KEYs") > -1) {
    requestCounter++;
    return setTimeout(() => callback(null, {
      statusCode: 200
    }, {
      keys: [{
        n: "1",
        e: "2",
        kid: "123"
      }]
    }), 3000);
  }
  if (options.url.indexOf("SEQUENTIAL-REQUEST-PUBLIC-KEYs") > -1) {
    seqRequestCounter++;
    return callback(null, {
      statusCode: 200
    }, {
      keys: [{
        n: "1",
        e: "2",
        kid: "123"
      }]
    });
  }
  throw new Error(`Unhandled case!!!${JSON.stringify(options)}`);
};

describe("/lib/utils/public-key-util", function publicKeyUtil() {
  let PublicKeyUtil;

  before(() => {
    PublicKeyUtil = proxyquire("../lib/utils/public-key-util", {
      request: requestMock
    });
  });

  this.timeout(5000);

  describe("getPublicKeyPemByKid", () => {
    it("public key dont have kid value", (done) => {
      const kid = undefined;
      PublicKeyUtil.getPublicKeyPemByKid(kid).then(() => {
        done("should get to catch");
      }).catch((err) => {
        assert.equal(err, "Passed token does not have kid value.");
        done();
      });
    });

    it("request to public keys endpoint failure", (done) => {
      const kid = "not_found_kid";
      PublicKeyUtil.getPublicKeyPemByKid(kid, `${testServerUrl}FAIL-PUBLIC-KEYs`).then(() => {
        done("should get reject");
      }).catch((err) => {
        try {
          assert.equal(err,
            "updatePublicKeys error: Failed to retrieve public keys. All requests to protected endpoints will be rejected.");
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it("request to public keys endpoint update failure", (done) => {
      let kid = "123";
      PublicKeyUtil.getPublicKeyPemByKid(kid, `${testServerUrl}SUCCESS-PUBLIC-KEYs`).then(() => {
        kid = "not_found_kid";
        PublicKeyUtil.getPublicKeyPemByKid(kid, `${testServerUrl}FAIL-PUBLIC-KEYs`).then(() => {
          done("should get reject");
        }).catch((err) => {
          try {
            assert.equal(err,
              "updatePublicKeys error: Failed to retrieve public keys. All requests to protected endpoints will be rejected.");
            done();
          } catch (e) {
            done(e);
          }
        });
      }).catch((err) => {
        done(err);
      });
    });

    it("two sequential request to public keys endpoint", (done) => {
      const PublicKeyUtilNew = proxyquire("../lib/utils/public-key-util", {
        request: requestMock
      });
      const kid = "123";
      PublicKeyUtilNew.getPublicKeyPemByKid(kid, `${testServerUrl}SEQUENTIAL-REQUEST-PUBLIC-KEYs`).then(() => {
        PublicKeyUtilNew.getPublicKeyPemByKid(kid, `${testServerUrl}SEQUENTIAL-REQUEST-PUBLIC-KEYs`).then(() => {
          assert.equal(1, seqRequestCounter, "more then one request triggered");
          done();
        }).catch((err) => {
          done(err);
        });
      }).catch((err) => {
        done(err);
      });
    });

    it("Should successfully retrieve public key from OAuth server", (done) => {
      const kid = "123";
      PublicKeyUtil.getPublicKeyPemByKid(kid, `${testServerUrl}SUCCESS-PUBLIC-KEYs`).then((publicKey) => {
        try {
          assert.isNotNull(publicKey);
          assert.isString(publicKey);
          assert.include(publicKey, "BEGIN RSA PUBLIC KEY");
          done();
        } catch (e) {
          done(e);
        }
      }).catch((err) => {
        done(err);
      });
    });
  });

  describe("getPublicKeyPemMultipleRequests", () => {
    it("Should get public keys from multiple requests", (done) => {
      const PublicKeyUtilNew = proxyquire("../lib/utils/public-key-util", {
        request: requestMock
      });
      const requestArray = [];
      for (let i = 0; i < 5; i++) {
        requestArray.push(PublicKeyUtilNew.getPublicKeyPemByKid("123", `${testServerUrl}SETTIMEOUT-PUBLIC-KEYs`));
      }
      Q.all(requestArray).then((publicKeysArray) => {
        try {
          assert.equal(1, requestCounter, "more then one request triggered");
          for (let j = 0; j < 5; j++) {
            assert.isNotNull(publicKeysArray[j]);
            assert.isString(publicKeysArray[j]);
            assert.include(publicKeysArray[j], "BEGIN RSA PUBLIC KEY");
          }
          done();
        } catch (e) {
          done(e);
        }
      }).catch((err) => {
        done(err);
      });
    });
  });
});
