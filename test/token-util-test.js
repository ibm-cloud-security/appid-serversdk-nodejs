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
chai.use(require("chai-as-promised"));
const proxyquire = require("proxyquire");
const constants = require("./mocks/constants");


describe("/lib/utils/token-util", function () {
	console.log("Loading token-util-test.js");
	var TokenUtil;
	var ServiceConfig;
	var serviceConfig;
	//let createDynamicIssuer=(endpoint)=>(_,cb)=>cb(undefined,{statusCode:200},{issuer:endpoint});
	let reqEndpoint = "endpoint";
	let reqError;
	let reqresponse = {statusCode: 200};

	let utilsStub = {
		"./public-key-util": require("./mocks/public-key-util-mock"),
		"request": (_, cb) => cb(reqError, reqresponse, {issuer: reqEndpoint})
	};
	var Config;

	before(function () {
		TokenUtil = proxyquire("../lib/utils/token-util", utilsStub);

		const {CLIENT_ID, TENANT_ID, SECRET, OAUTH_SERVER_URL, REDIRECT_URI} = require('../lib/utils/constants');
		const ServiceUtil = require('../lib/utils/service-util');
		ServiceConfig = function (options) {
			return ServiceUtil.loadConfig('APIStrategy', [
				TENANT_ID,
				OAUTH_SERVER_URL
			], options);
		};
		serviceConfig = new ServiceConfig({
			oauthServerUrl: constants.SERVER_URL,
			tenantId: constants.TENANTID,
			issuer: constants.SERVER_URL
		});
		Config = function (options) {
			return ServiceUtil.loadConfig('WebAppStrategy', [
				TENANT_ID,
				CLIENT_ID,
				SECRET,
				OAUTH_SERVER_URL,
				REDIRECT_URI
			], options);
		};
	});

	describe("#decodeAndValidate()", function () {

		it("Should fail since token is expired", function () {
			return expect(TokenUtil.decodeAndValidate(constants.EXPIRED_ACCESS_TOKEN)).to.be.rejectedWith("jwt expired");
		});

		it("Should succeed since APPID_ALLOW_EXPIRED_TOKENS=true", function () {
			process.env[constants.APPID_ALLOW_EXPIRED_TOKENS] = true;
			TokenUtil.decodeAndValidate(constants.EXPIRED_ACCESS_TOKEN).then(function (decodedToken) {
				assert.isObject(decodedToken);
			});
		});

		it("Should fail since token is malformed", function () {
			process.env[constants.APPID_ALLOW_EXPIRED_TOKENS] = true;
			return expect(TokenUtil.decodeAndValidate(constants.MALFORMED_ACCESS_TOKEN)).to.be.rejectedWith("invalid algorithm");
		});

		it("Should fail since header is empty in token", function () {
			process.env[constants.APPID_ALLOW_EXPIRED_TOKENS] = true;
			return expect(TokenUtil.decodeAndValidate(constants.MALFORMED_ACCESS_TOKEN_WITHOUTHEADER)).to.be.rejectedWith("JWT error, can not decode token");
		});

		it("Should succeed since token is valid", function () {
			TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN).then(function (decodedToken) {
				assert.isObject(decodedToken);
			});
		});

		it("Token validation success pre-v4", function () {
            const config = new Config({
                tenantId: constants.TENANTID,
                clientId: constants.CLIENTID,
                secret: "secret",
                oauthServerUrl: constants.SERVER_URL,
                redirectUri: "redirectUri",
                issuer: constants.ISSUER
            });
            return TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN).then(function (decodedToken) {
                return TokenUtil.validateIssAzpAud(decodedToken, config).then((res) => {
                    assert(res, true);
                });
            });
        });

        it("Token validation success post-v4", function () {
            const config = new Config({
                tenantId: constants.TENANTID,
                clientId: constants.CLIENTID,
                secret: "secret",
                oauthServerUrl: constants.SERVER_URL,
                redirectUri: "redirectUri",
                issuer: constants.CONFIG_ISSUER
            });
            return TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN).then(function (decodedToken) {
                decodedToken.version = 4;
                decodedToken.aud = [constants.CLIENTID];
                decodedToken.iss = constants.TOKEN_ISSUER;
                decodedToken.azp = constants.CLIENTID;
                return TokenUtil.validateIssAzpAud(decodedToken, config).then((res) => {
                    assert(res, true);
                });
            });
        });

        it("Token validation success post-v4 + convert bluemix.net to cloud.ibm.com", function () {
            const config = new Config({
                tenantId: constants.TENANTID,
                clientId: constants.CLIENTID,
                secret: "secret",
                oauthServerUrl: constants.SERVER_URL,
                redirectUri: "redirectUri",
                issuer: constants.CONFIG_ISSUER_BLUEMIX
            });
            return TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN).then(function (decodedToken) {
                decodedToken.version = 4;
                decodedToken.aud = [constants.CLIENTID];
                decodedToken.iss = constants.TOKEN_ISSUER;
                decodedToken.azp = constants.CLIENTID;
                return TokenUtil.validateIssAzpAud(decodedToken, config).then((res) => {
                    assert(res, true);
                });
            });
        });

        it("Token validation failed, iss doesn't match", function (done) {
            const config = new Config({
                tenantId: constants.TENANTID,
                clientId: constants.CLIENTID,
                secret: "secret",
                oauthServerUrl: constants.SERVER_URL,
                redirectUri: "redirectUri",
                issuer: "nonMatchingIssuer"
            });
            TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN).then(function (decodedToken) {
                TokenUtil.validateIssAzpAud(decodedToken, config).then((res) => {
                    done("This test should fail.");
                }).catch(err => {
                    done();
                });
            });
        });

        it("Token validation failed post-v4, iss needs https", function () {
            const config = new Config({
                tenantId: constants.TENANTID,
                clientId: constants.CLIENTID,
                secret: "secret",
                oauthServerUrl: constants.SERVER_URL,
                redirectUri: "redirectUri",
                issuer: constants.CONFIG_ISSUER_NO_HTTPS
            });
			TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN).then(function (decodedToken) {
                decodedToken.version = 4;
                decodedToken.aud = [constants.CLIENTID];
                decodedToken.iss = constants.TOKEN_ISSUER_NO_HTTPS;
                decodedToken.azp = constants.CLIENTID;
				TokenUtil.validateIssAzpAud(decodedToken, config).then((res) => {
					done("This test should fail.");
				}).catch(err => {
					done();
				});
			});
        });

        it("Token validation failed post-v4, invalid aud -- must be an array", function () {
            const config = new Config({
                tenantId: constants.TENANTID,
                clientId: constants.CLIENTID,
                secret: "secret",
                oauthServerUrl: constants.SERVER_URL,
                redirectUri: "redirectUri",
                issuer: constants.CONFIG_ISSUER
            });
            TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN).then(function (decodedToken) {
                decodedToken.version = 4;
                decodedToken.aud = constants.CLIENTID;
                decodedToken.iss = constants.TOKEN_ISSUER;
                decodedToken.azp = constants.CLIENTID;
                TokenUtil.validateIssAzpAud(decodedToken, config).then((res) => {
                    done("This test should fail.");
                }).catch(err => {
                    done();
                });
            });
        });

        it("Token validation failed post-v4, invalid aud -- array doesn't have client ID", function () {
            const config = new Config({
                tenantId: constants.TENANTID,
                clientId: constants.CLIENTID,
                secret: "secret",
                oauthServerUrl: constants.SERVER_URL,
                redirectUri: "redirectUri",
                issuer: constants.CONFIG_ISSUER
            });
            TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN).then(function (decodedToken) {
                decodedToken.version = 4;
                decodedToken.aud = [constants.BAD_CLIENTID];
                decodedToken.iss = constants.TOKEN_ISSUER;
                decodedToken.azp = constants.CLIENTID;
                TokenUtil.validateIssAzpAud(decodedToken, config).then((res) => {
                    done("This test should fail.");
                }).catch(err => {
                    done();
                });
            });
        });

        it("Token validation failed post-v4, invalid azp -- must match clientId", function () {
            const config = new Config({
                tenantId: constants.TENANTID,
                clientId: constants.CLIENTID,
                secret: "secret",
                oauthServerUrl: constants.SERVER_URL,
                redirectUri: "redirectUri",
                issuer: constants.CONFIG_ISSUER
            });
            TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN).then(function (decodedToken) {
                decodedToken.version = 4;
                decodedToken.aud = [constants.CLIENTID];
                decodedToken.iss = constants.TOKEN_ISSUER;
                decodedToken.azp = constants.BAD_CLIENTID;
                TokenUtil.validateIssAzpAud(decodedToken, config).then((res) => {
                    done("This test should fail.");
                }).catch(err => {
                    done();
                });
            });
        });

		it("Token validation failed, invalid clientid", function (done) {
			const config = new Config({
				tenantId: constants.TENANTID,
				clientId: "clientId",
				secret: "secret",
				oauthServerUrl: constants.SERVER_URL,
				redirectUri: "redirectUri"
			});

			TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN).then(function (decodedToken) {
				TokenUtil.validateIssAzpAud(decodedToken, config).then((res) => {
					done("This test should fail.");
				}).catch(err => {
					done();
				});
			});
		});

		it("Token validation failed, invalid serverurl", function (done) {
			const config = new Config({
				tenantId: constants.TENANTID,
				clientId: constants.CLIENTID,
				secret: "secret",
				oauthServerUrl: "http://mobileclientaccess/",
				redirectUri: "redirectUri"
			});
			TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN).then(function (decodedToken) {
				TokenUtil.validateIssAzpAud(decodedToken, config).then((res) => {
					done("This test should fail.");
				}).catch(err => {
					done();
				});
			});
		});

        it("Token validation failed, invalid version", function (done) {
            const config = new Config({
                tenantId: constants.TENANTID,
                clientId: constants.CLIENTID,
                secret: "secret",
                oauthServerUrl: constants.SERVER_URL,
                redirectUri: "redirectUri",
                issuer: constants.ISSUER
            });
            TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN).then(function (decodedToken) {
                decodedToken.version = "badVersion";

                TokenUtil.validateIssAzpAud(decodedToken, config).then((res) => {
                    done("This test should fail.");
                }).catch(err => {
                    done();
                });
            });
        });

		it("get issuer from well known", function (done) {
			reqEndpoint = "endpoint";
			const config = new Config({
				tenantId: constants.TENANTID,
				clientId: constants.CLIENTID,
				secret: "secret",
				oauthServerUrl: "http://mobileclientaccess/",
				redirectUri: "redirectUri"
			});
			TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN).then(function (decodedToken) {
				decodedToken.iss = "endpoint";

				TokenUtil.validateIssAzpAud(decodedToken, config).then((res) => {

					done();
				}).catch(err => {
					done(err);
				});
			});
		});

		it("get issuer from well known different endpoint", function (done) {
			reqEndpoint = "endpoint2";
			const config = new Config({
				tenantId: constants.TENANTID,
				clientId: constants.CLIENTID,
				secret: "secret",
				oauthServerUrl: "http://mobileclientaccess/",
				redirectUri: "redirectUri"
			});
			TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN).then(function (decodedToken) {
				decodedToken.iss = "endpoint";

				TokenUtil.validateIssAzpAud(decodedToken, config).then((res) => {
					done("suppose to fail");
				}).catch(err => {
					done();

				});
			});
		});

		it("get issuer from well known returned error", function (done) {
			reqEndpoint = "endpoint";
			reqError = new Error(":(");
			const config = new Config({
				tenantId: constants.TENANTID,
				clientId: constants.CLIENTID,
				secret: "secret",
				oauthServerUrl: "http://mobileclientaccess/",
				redirectUri: "redirectUri"
			});
			TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN).then(function (decodedToken) {
				decodedToken.iss = "endpoint";

				TokenUtil.validateIssAzpAud(decodedToken, config).then((res) => {

					done("suppose to fail");
					reqError = undefined;
				}).catch(err => {
					done();
					reqError = undefined;
				});
			});
		});

		it("get issuer from well known returned status code!= 200", function (done) {
			reqEndpoint = "endpoint";
			reqError = undefined;
			reqresponse = {statusCode: 404};
			const config = new Config({
				tenantId: constants.TENANTID,
				clientId: constants.CLIENTID,
				secret: "secret",
				oauthServerUrl: "http://mobileclientaccess/",
				redirectUri: "redirectUri"
			});
			TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN).then(function (decodedToken) {
				decodedToken.iss = "endpoint";

				TokenUtil.validateIssAzpAud(decodedToken, config).then((res) => {

					done("suppose to fail");
					reqError = undefined;
				}).catch(err => {
					done();
					reqError = undefined;
				});
			});
		});

		it("get issuer from well known missing issuer", function (done) {
			reqEndpoint = undefined;
			reqError = undefined;
			reqresponse = {statusCode: 200};
			const config = new Config({
				tenantId: constants.TENANTID,
				clientId: constants.CLIENTID,
				secret: "secret",
				oauthServerUrl: "http://mobileclientaccess/",
				redirectUri: "redirectUri"
			});
			TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN).then(function (decodedToken) {
				decodedToken.iss = "endpoint";

				TokenUtil.validateIssAzpAud(decodedToken, config).then((res) => {

					done("suppose to fail");
					reqError = undefined;
				}).catch(err => {
					done();
					reqError = undefined;
				});
			});
		});

		it("don't go to issuer endpoint when issuer exists", function (done) {
			reqEndpoint = "endpoint2";
			reqresponse = {statusCode: 200};
			reqError = undefined;
			const config = new Config({
				tenantId: constants.TENANTID,
				clientId: constants.CLIENTID,
				secret: "secret",
				oauthServerUrl: "http://mobileclientaccess/",
				redirectUri: "redirectUri",
				issuer: "endpoint"
			});
			TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN).then(function (decodedToken) {
				decodedToken.iss = "endpoint";

				TokenUtil.validateIssAzpAud(decodedToken, config).then((res) => {
					//it supposes to succeed even though the request returns endpoint 2 as the issuer since the config already have endpoint as the issuer
					done();
				}).catch(err => {
					done(err);
				});
			});
		});


	});

	describe("#decode()", function () {
		it("Should return a valid decoded token", function () {
			const decodedToken = TokenUtil.decode(constants.ACCESS_TOKEN);
			assert.isObject(decodedToken);
			assert.property(decodedToken, "iss");
			assert.property(decodedToken, "tenant");
			assert.property(decodedToken, "aud");
			assert.property(decodedToken, "iat");
		});
	});
});
