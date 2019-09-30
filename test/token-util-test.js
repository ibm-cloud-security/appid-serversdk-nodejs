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
const constants = require("./mocks/constants");

chai.use(require("chai-as-promised"));

const {assert} = chai;
const {expect} = chai;

describe("/lib/utils/token-util", () => {
  let TokenUtil;
  let reqEndpoint = "endpoint";
  let reqError;
  let reqresponse = {
    statusCode: 200
  };

  const utilsStub = {
    "./public-key-util": require("./mocks/public-key-util-mock"),
    request: (_, cb) => cb(reqError, reqresponse, {
      issuer: reqEndpoint
    })
  };
  let Config;

  before((done) => {
    TokenUtil = proxyquire("../lib/utils/token-util", utilsStub);

    const {
      CLIENT_ID,
      TENANT_ID,
      SECRET,
      OAUTH_SERVER_URL,
      REDIRECT_URI
    } = require('../lib/utils/constants');
    const ServiceUtil = require('../lib/utils/service-util');
    Config = function ConfigFunc(options) {
      return ServiceUtil.loadConfig('WebAppStrategy', [
        TENANT_ID,
        CLIENT_ID,
        SECRET,
        OAUTH_SERVER_URL,
        REDIRECT_URI
      ], options);
    };
    done();
  });

  describe("#decodeAndValidate()", () => {
    it("Should fail since token is expired",
      () => expect(TokenUtil.decodeAndValidate(constants.EXPIRED_ACCESS_TOKEN)).to.be.rejectedWith("jwt expired"));

    it("Should succeed since APPID_ALLOW_EXPIRED_TOKENS=true", () => {
      process.env[constants.APPID_ALLOW_EXPIRED_TOKENS] = true;
      TokenUtil.decodeAndValidate(constants.EXPIRED_ACCESS_TOKEN).then((decodedToken) => {
        assert.isObject(decodedToken);
      });
    });

    it("Should fail since token is malformed", () => {
      process.env[constants.APPID_ALLOW_EXPIRED_TOKENS] = true;
      return expect(TokenUtil.decodeAndValidate(constants.MALFORMED_ACCESS_TOKEN)).to.be.rejectedWith("invalid algorithm");
    });

    it("Should fail since header is empty in token", () => {
      process.env[constants.APPID_ALLOW_EXPIRED_TOKENS] = true;
      const decoded = TokenUtil.decodeAndValidate(constants.MALFORMED_ACCESS_TOKEN_WITHOUTHEADER);
      return expect(decoded).to.be.rejectedWith("JWT error, can not decode token");
    });

    it("Should succeed since token is valid", () => {
      TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN).then((decodedToken) => {
        assert.isObject(decodedToken);
      });
    });

    it("Token validation success pre-v4", () => {
      const config = new Config({
        tenantId: constants.TENANTID,
        clientId: constants.CLIENTID,
        secret: "secret",
        oauthServerUrl: constants.SERVER_URL,
        redirectUri: "redirectUri",
        issuer: constants.ISSUER
      });
      return TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN).then(
        (decodedToken) => TokenUtil.validateIssAndAud(decodedToken, config).then((res) => {
          assert(res, true);
        })
      );
    });

    it("Token validation success post-v4", () => {
      const config = new Config({
        tenantId: constants.TENANTID,
        clientId: constants.CLIENTID,
        secret: "secret",
        oauthServerUrl: constants.SERVER_URL,
        redirectUri: "redirectUri",
        issuer: constants.CONFIG_ISSUER
      });
      return TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN_V4).then(
        (decodedToken) => TokenUtil.validateIssAndAud(decodedToken, config).then((res) => {
          assert(res, true);
        })
      );
    });

    it("Token validation success post-v4 + convert bluemix.net to cloud.ibm.com", () => {
      const config = new Config({
        tenantId: constants.TENANTID,
        clientId: constants.CLIENTID,
        secret: "secret",
        oauthServerUrl: constants.SERVER_URL,
        redirectUri: "redirectUri",
        issuer: constants.CONFIG_ISSUER_BLUEMIX
      });
      return TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN_V4).then(
        (decodedToken) => TokenUtil.validateIssAndAud(decodedToken, config).then((res) => {
          assert(res, true);
        })
      );
    });

    it("Token validation failed, iss doesn't match", (done) => {
      const config = new Config({
        tenantId: constants.TENANTID,
        clientId: constants.CLIENTID,
        secret: "secret",
        oauthServerUrl: constants.SERVER_URL,
        redirectUri: "redirectUri",
        issuer: "nonMatchingIssuer"
      });
      TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN).then((decodedToken) => {
        TokenUtil.validateIssAndAud(decodedToken, config).then(() => {
          done("This test should fail.");
        }).catch(() => {
          done();
        });
      });
    });

    it("Token validation failed post-v4, iss needs https", (done) => {
      const config = new Config({
        tenantId: constants.TENANTID,
        clientId: constants.CLIENTID,
        secret: "secret",
        oauthServerUrl: constants.SERVER_URL,
        redirectUri: "redirectUri",
        issuer: constants.CONFIG_ISSUER_NO_HTTPS
      });
      TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN_V4).then((decodedToken) => {
        decodedToken.iss = constants.TOKEN_ISSUER_NO_HTTPS;
        TokenUtil.validateIssAndAud(decodedToken, config).then(() => {
          done("This test should fail.");
        }).catch(() => {
          done();
        });
      });
    });

    it("Token validation failed post-v4, invalid aud -- must be an array", (done) => {
      const config = new Config({
        tenantId: constants.TENANTID,
        clientId: constants.CLIENTID,
        secret: "secret",
        oauthServerUrl: constants.SERVER_URL,
        redirectUri: "redirectUri",
        issuer: constants.CONFIG_ISSUER
      });
      TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN).then((decodedToken) => {
        decodedToken.aud = constants.CLIENTID;
        TokenUtil.validateIssAndAud(decodedToken, config).then(() => {
          done("This test should fail.");
        }).catch(() => {
          done();
        });
      });
    });

    it("Token validation failed post-v4, invalid aud -- array doesn't have client ID", (done) => {
      const config = new Config({
        tenantId: constants.TENANTID,
        clientId: constants.CLIENTID,
        secret: "secret",
        oauthServerUrl: constants.SERVER_URL,
        redirectUri: "redirectUri",
        issuer: constants.CONFIG_ISSUER
      });
      TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN).then((decodedToken) => {
        decodedToken.aud = [constants.BAD_CLIENTID];
        TokenUtil.validateIssAndAud(decodedToken, config).then(() => {
          done("This test should fail.");
        }).catch(() => {
          done();
        });
      });
    });

    it("Token validation failed, invalid clientid", (done) => {
      const config = new Config({
        tenantId: constants.TENANTID,
        clientId: "clientId",
        secret: "secret",
        oauthServerUrl: constants.SERVER_URL,
        redirectUri: "redirectUri"
      });

      TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN).then((decodedToken) => {
        TokenUtil.validateIssAndAud(decodedToken, config).then(() => {
          done("This test should fail.");
        }).catch(() => {
          done();
        });
      });
    });

    it("Token validation failed, invalid serverurl", (done) => {
      const config = new Config({
        tenantId: constants.TENANTID,
        clientId: constants.CLIENTID,
        secret: "secret",
        oauthServerUrl: "http://mobileclientaccess/",
        redirectUri: "redirectUri"
      });
      TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN).then((decodedToken) => {
        TokenUtil.validateIssAndAud(decodedToken, config).then(() => {
          done("This test should fail.");
        }).catch(() => {
          done();
        });
      });
    });

    it("get issuer from well known", (done) => {
      reqEndpoint = "endpoint";
      const config = new Config({
        tenantId: constants.TENANTID,
        clientId: constants.CLIENTID,
        secret: "secret",
        oauthServerUrl: "http://mobileclientaccess/",
        redirectUri: "redirectUri"
      });
      TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN).then((decodedToken) => {
        decodedToken.iss = "endpoint";

        TokenUtil.validateIssAndAud(decodedToken, config).then(() => {
          done();
        }).catch((err) => {
          done(err);
        });
      });
    });

    it("get issuer from well known different endpoint", (done) => {
      reqEndpoint = "endpoint2";
      const config = new Config({
        tenantId: constants.TENANTID,
        clientId: constants.CLIENTID,
        secret: "secret",
        oauthServerUrl: "http://mobileclientaccess/",
        redirectUri: "redirectUri"
      });
      TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN).then((decodedToken) => {
        decodedToken.iss = "endpoint";

        TokenUtil.validateIssAndAud(decodedToken, config).then(() => {
          done("suppose to fail");
        }).catch(() => {
          done();
        });
      });
    });

    it("get issuer from well known returned error", (done) => {
      reqEndpoint = "endpoint";
      reqError = new Error(":(");
      const config = new Config({
        tenantId: constants.TENANTID,
        clientId: constants.CLIENTID,
        secret: "secret",
        oauthServerUrl: "http://mobileclientaccess/",
        redirectUri: "redirectUri"
      });
      TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN).then((decodedToken) => {
        decodedToken.iss = "endpoint";

        TokenUtil.validateIssAndAud(decodedToken, config).then(() => {
          done("suppose to fail");
          reqError = undefined;
        }).catch(() => {
          done();
          reqError = undefined;
        });
      });
    });

    it("get issuer from well known returned status code!= 200", (done) => {
      reqEndpoint = "endpoint";
      reqError = undefined;
      reqresponse = {
        statusCode: 404
      };
      const config = new Config({
        tenantId: constants.TENANTID,
        clientId: constants.CLIENTID,
        secret: "secret",
        oauthServerUrl: "http://mobileclientaccess/",
        redirectUri: "redirectUri"
      });
      TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN).then((decodedToken) => {
        decodedToken.iss = "endpoint";

        TokenUtil.validateIssAndAud(decodedToken, config).then(() => {
          done("suppose to fail");
          reqError = undefined;
        }).catch(() => {
          done();
          reqError = undefined;
        });
      });
    });
    it("get issuer from well known returned status code!= 200", (done) => {
      reqEndpoint = "endpoint";
      reqError = undefined;
      reqresponse = {
        statusCode: 404
      };
      const config = new Config({
        tenantId: constants.TENANTID,
        clientId: constants.CLIENTID,
        secret: "secret",
        oauthServerUrl: "http://mobileclientaccess/",
        redirectUri: "redirectUri"
      });
      TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN).then((decodedToken) => {
        decodedToken.iss = "endpoint";
        TokenUtil.validateIssAndAud(decodedToken, config).then(() => {
          done("suppose to fail");
          reqError = undefined;
        }).catch(() => {
          done();
          reqError = undefined;
        });
      });
    });

    it("get issuer from well known missing issuer", (done) => {
      reqEndpoint = undefined;
      reqError = undefined;
      reqresponse = {
        statusCode: 200
      };
      const config = new Config({
        tenantId: constants.TENANTID,
        clientId: constants.CLIENTID,
        secret: "secret",
        oauthServerUrl: "http://mobileclientaccess/",
        redirectUri: "redirectUri"
      });
      TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN).then((decodedToken) => {
        decodedToken.iss = "endpoint";

        TokenUtil.validateIssAndAud(decodedToken, config).then(() => {
          done("suppose to fail");
          reqError = undefined;
        }).catch(() => {
          done();
          reqError = undefined;
        });
      });
    });

    it("don't go to issuer endpoint when issuer exists", (done) => {
      reqEndpoint = "endpoint2";
      reqresponse = {
        statusCode: 200
      };
      reqError = undefined;
      const config = new Config({
        tenantId: constants.TENANTID,
        clientId: constants.CLIENTID,
        secret: "secret",
        oauthServerUrl: "http://mobileclientaccess/",
        redirectUri: "redirectUri",
        issuer: "endpoint"
      });
      TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN).then((decodedToken) => {
        decodedToken.iss = "endpoint";

        TokenUtil.validateIssAndAud(decodedToken, config).then(() => {
          // it is supposed to succeed even though the request returns endpoint 2
          // as the issuer since the config already have endpoint as the issuer
          done();
        }).catch((err) => {
          done(err);
        });
      });
    });
  });

  describe("#decode()", () => {
    it("Should return a valid decoded token", () => {
      const decodedToken = TokenUtil.decode(constants.ACCESS_TOKEN);
      assert.isObject(decodedToken);
      assert.property(decodedToken, "iss");
      assert.property(decodedToken, "tenant");
      assert.property(decodedToken, "aud");
      assert.property(decodedToken, "iat");
    });
  });
});
