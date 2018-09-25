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


describe("/lib/utils/token-util", function() {
	console.log("Loading token-util-test.js");
	var TokenUtil;
	var ServiceConfig;
	var serviceConfig;
	var Config;

	before(function () {
		TokenUtil = proxyquire("../lib/utils/token-util", {
			"./public-key-util": require("./mocks/public-key-util-mock")
		});
		const { CLIENT_ID, TENANT_ID, SECRET, OAUTH_SERVER_URL, REDIRECT_URI } = require('../lib/utils/constants');
		const ServiceUtil = require('../lib/utils/service-util');
		ServiceConfig = function (options) {
			return ServiceUtil.loadConfig('APIStrategy', [
				TENANT_ID,
				OAUTH_SERVER_URL
			], options);
		};
		serviceConfig = new ServiceConfig({
			oauthServerUrl: constants.SERVER_URL,
			tenantId: constants.TENANTID
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

		it("Token validation success", function () {
			const config = new Config({
				tenantId: constants.TENANTID,
				clientId: constants.CLIENTID,
				secret: "secret",
				oauthServerUrl: constants.SERVER_URL,
				redirectUri: "redirectUri"
			});
			TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN).then(function (decodedToken) {
				assert(TokenUtil.validateIssAndAud(decodedToken, config), true);
			});
		});

		it("Token validation failed, invalid clientid ", function () {
			const config = new Config({
				tenantId: constants.TENANTID,
				clientId: "clientId",
				secret: "secret",
				oauthServerUrl: constants.SERVER_URL,
				redirectUri: "redirectUri"
			});
			TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN).then(function (decodedToken) {
				assert(TokenUtil.validateIssAndAud(decodedToken, config), false);
			});
		});

		it("Token validation failed, invalid serverurl", function () {
			const config = new Config({
				tenantId: constants.TENANTID,
				clientId: constants.CLIENTID,
				secret: "secret",
				oauthServerUrl: "http://mobileclientaccess/",
				redirectUri: "redirectUri"
			});
			TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN).then(function (decodedToken) {
				assert(TokenUtil.validateIssAndAud(decodedToken, config), false);
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
