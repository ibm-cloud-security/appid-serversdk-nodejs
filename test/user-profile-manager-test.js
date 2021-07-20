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
const proxyquire = require("proxyquire");
const _ = require("underscore");
const Q = require("q");

const identityTokenSubIsSubject123 = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpPU0UifQ.eyJzdWIiOiJzdWJqZWN0MTIzIn0.QpodAz7eU9NU0gBu0oj4zaI0maa94jzbm4BEV2I_sURw9fvfpLLt3zxHi-C3ItlcHiMSyWWL6oGyrkX_25Z7GK2Taxx5ix4bsi-iYOzJQ-SP4sVaKJ5fRMLMpnRMwOQrOGmrzhf53mqVJ76XK58ZM0Sa7pxM92N1PQDxPXPSfxejhN2xISi-Zw4yotQCny-AGjj5xnfNAPiaYjVGy_xK3Y_8xTSZkGcjuJ76deK9SBf7u-wH92zWWhqtaN_mU4yAOyejG3Z1aSduWc-N6K7jhjMReJLowJChDN2hCmvJ5EISL7JkITmZWdrQW-ZSZ76JMQ0u_-ecnX6r_C4KG_fzDg";
const identityTokenSubIs123 = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpPU0UifQ.eyJzdWIiOiIxMjMifQ.enbXHtja8BJd9_hlIbCgwyMXl8o9s74yDlqH4_11h7xLVasDO8Yy4jNyhVmIIb8jpl4fQfjWjqaOJoD2TqgfhqwQ-tGRjzYYR-f0qAMb99pNDtLS9IFf1yHYM2y65UerZ8qTD4g2s-ZWPk7yvxPMQx-Nrvu-X2uUwvdBCBr02rXpsHdMbeLYA6iwUs58p5hMxOxf3yKrBcTpTJ4EE164BhruEU5HyHhqSM9DTVLvliuapFFIK4CGV3FjvrKnT38yWdxSWtd9ETC79bfBwWTsE0ykMzb7Nq3vA2O0C_pv5IUixkLtTCiT3s5m55WZaqxdFCvOe4BjAt6AWH7slwgZdg";

function requestMock(options, callback) {
	var authHeader = options.headers["Authorization"];

	if (authHeader.indexOf("return_error") > 0) {
		return callback(new Error("EXPECTED FAILURE"));
	} else if (authHeader.indexOf("return_code") > 0) {
		var statusCode = parseInt(authHeader.split("_")[2]);
		return callback(null, {
			statusCode: parseInt(statusCode)
		});
	} else if (authHeader.indexOf("userinfo_access_token") > 0) {
		options.sub = "123";
		return callback(null, {
			statusCode: 200
		}, options);
	} else {
		return callback(null, {
			statusCode: 200
		}, options);
	}
}

describe("/lib/user-profile-manager/user-profile-manager", function () {

	var UserProfileManager;

	before(function () {
		UserProfileManager = proxyquire("../lib/user-profile-manager/user-profile-manager", {
			"../utils/request-util": requestMock
		});
	});

	describe("#UserProfileManager.init", function () {
		it("Should not be able to init without options and VCAP_SERVICS", function () {
			UserProfileManager.init();
			// TODO: add validation that errors are printed to console
		});

		it("Should be able to init with options", function () {
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

		it("Should be able to init with VCAP_SERVICES (AdvancedMobileAccess)", function () {
			process.env.VCAP_SERVICES = JSON.stringify({
				AdvancedMobileAccess: [{
					credentials: {
						profilesUrl: "http://abcd"
					}
				}]
			});
			UserProfileManager.init();
		});

		it("Should be able to init with VCAP_SERVICES (appid)", function () {
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
	describe("#UserProfileManager.setAttribute", function () {
		it("Should validate all parameters are present", function (done) {

			var p1 = UserProfileManager.setAttribute();
			var p2 = UserProfileManager.setAttribute("accessToken");
			var p3 = UserProfileManager.setAttribute("accessToken", "name");

			Q.allSettled([p1, p2, p3]).spread(function (r1, r2, r3) {
				assert.equal(r1.state, "rejected");
				assert.equal(r2.state, "rejected");
				assert.equal(r3.state, "rejected");
				done();
			}).catch(function (e) {
				done(new Error(e));
			});
		});

		it("Should fail if there's an error", function (done) {
			var p1 = UserProfileManager.setAttribute("return_error", "name", "value");
			var p2 = UserProfileManager.setAttribute("return_code_401", "name", "value");
			var p3 = UserProfileManager.setAttribute("return_code_403", "name", "value");
			var p4 = UserProfileManager.setAttribute("return_code_404", "name", "value");
			var p5 = UserProfileManager.setAttribute("return_code_500", "name", "value");
			Q.allSettled([p1, p2, p3, p4, p5]).spread(function (r1, r2, r3, r4, r5) {
				assert.equal(r1.state, "rejected");
				assert.equal(r2.state, "rejected");
				assert.equal(r3.state, "rejected");
				assert.equal(r4.state, "rejected");
				assert.equal(r5.state, "rejected");
				done();
			}).catch(function (e) {
				done(new Error(e));
			});
		});

		it("Should send proper access token, url and value", function (done) {
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
			UserProfileManager.setAttribute("access_token", "name", "value").then(function (result) {
				assert.equal(result.url, "http://abcd/api/v1/attributes/name");
				assert.equal(result.method, "PUT");
				assert.equal(result.body, "value");
				assert.equal(result.headers["Authorization"], "Bearer access_token");
				done();
			}).catch(done);
		});
	});
	describe("#UserProfileManager.getAttribute", function () {
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
		it("Should validate all parameters are present", function (done) {

			var p1 = UserProfileManager.getAttribute();
			var p2 = UserProfileManager.getAttribute("accessToken");

			Q.allSettled([p1, p2]).spread(function (r1, r2) {
				assert.equal(r1.state, "rejected");
				assert.equal(r2.state, "rejected");
				done();
			}).catch(function (e) {
				done(new Error(e));
			});
		});

		it("Should fail if there's an error", function (done) {
			var p1 = UserProfileManager.getAttribute("return_error", "name");
			var p2 = UserProfileManager.getAttribute("return_code_401", "name");
			var p3 = UserProfileManager.getAttribute("return_code_403", "name");
			var p4 = UserProfileManager.getAttribute("return_code_404", "name");
			var p5 = UserProfileManager.getAttribute("return_code_500", "name");
			Q.allSettled([p1, p2, p3, p4, p5]).spread(function (r1, r2, r3, r4, r5) {
				assert.equal(r1.state, "rejected");
				assert.equal(r2.state, "rejected");
				assert.equal(r3.state, "rejected");
				assert.equal(r4.state, "rejected");
				assert.equal(r5.state, "rejected");
				done();
			}).catch(function (e) {
				done(new Error(e));
			});
		});

		it("Should send proper access token, url and value", function (done) {
			UserProfileManager.getAttribute("access_token", "name").then(function (result) {
				assert.equal(result.url, "http://abcd/api/v1/attributes/name");
				assert.equal(result.method, "GET");
				assert.equal(result.headers["Authorization"], "Bearer access_token");
				done();
			}).catch(done);

		});
	});

	describe("#UserProfileManager.deleteAttribute", function () {
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
		it("Should validate all parameters are present", function (done) {

			var p1 = UserProfileManager.deleteAttribute();
			var p2 = UserProfileManager.deleteAttribute("accessToken");

			Q.allSettled([p1, p2]).spread(function (r1, r2) {
				assert.equal(r1.state, "rejected");
				assert.equal(r2.state, "rejected");
				done();
			}).catch(function (e) {
				done(new Error(e));
			});
		});

		it("Should fail if there's an error", function (done) {
			var p1 = UserProfileManager.deleteAttribute("return_error", "name", "value");
			var p2 = UserProfileManager.deleteAttribute("return_code_401", "name", "value");
			var p3 = UserProfileManager.deleteAttribute("return_code_403", "name", "value");
			var p4 = UserProfileManager.deleteAttribute("return_code_404", "name", "value");
			var p5 = UserProfileManager.deleteAttribute("return_code_500", "name", "value");
			Q.allSettled([p1, p2, p3, p4, p5]).spread(function (r1, r2, r3, r4, r5) {
				assert.equal(r1.state, "rejected");
				assert.equal(r2.state, "rejected");
				assert.equal(r3.state, "rejected");
				assert.equal(r4.state, "rejected");
				assert.equal(r5.state, "rejected");
				done();
			}).catch(function (e) {
				done(new Error(e));
			});
		});

		it("Should send proper access token, url and value", function (done) {
			UserProfileManager.deleteAttribute("access_token", "name").then(function (result) {
				assert.equal(result.url, "http://abcd/api/v1/attributes/name");
				assert.equal(result.method, "DELETE");
				assert.equal(result.headers["Authorization"], "Bearer access_token");
				done();
			});
		});
	});

	describe("#UserProfileManager.getAllAttributes", function () {
		it("Should validate all parameters are present", function (done) {

			var p1 = UserProfileManager.getAllAttributes();

			Q.allSettled([p1]).spread(function (r1) {
				assert.equal(r1.state, "rejected");
				done();
			}).catch(function (e) {
				done(new Error(e));
			});
		});

		it("Should fail if there's an error", function (done) {
			var p1 = UserProfileManager.getAllAttributes("return_error");
			var p2 = UserProfileManager.getAllAttributes("return_code_401");
			var p3 = UserProfileManager.getAllAttributes("return_code_403");
			var p4 = UserProfileManager.getAllAttributes("return_code_404");
			var p5 = UserProfileManager.getAllAttributes("return_code_500");
			Q.allSettled([p1, p2, p3, p4, p5]).spread(function (r1, r2, r3, r4, r5) {
				assert.equal(r1.state, "rejected");
				assert.equal(r2.state, "rejected");
				assert.equal(r3.state, "rejected");
				assert.equal(r4.state, "rejected");
				assert.equal(r5.state, "rejected");
				done();
			}).catch(function (e) {
				done(new Error(e));
			});
		});

		it("Should send proper access token, url and value", function (done) {
			UserProfileManager.getAllAttributes("access_token").then(function (result) {
				assert.equal(result.url, "http://abcd/api/v1/attributes");
				assert.equal(result.method, "GET");
				assert.equal(result.headers["Authorization"], "Bearer access_token");
				done();
			});
		});
	});

	describe("#UserProfileManager.getUserInfo", function () {

		it("Should validate all parameters are present", function (done) {

			var p1 = UserProfileManager.getUserInfo();
			var p2 = UserProfileManager.getUserInfo("accessToken");

			Q.allSettled([p1, p2]).spread(function (r1, r2) {
				assert.equal(r1.state, "rejected");
				assert.equal(r2.state, "rejected");
				done();
			}).catch(function (e) {
				done(new Error(e));
			});
		});

		it("Should fail if there's an error", function (done) {
			var p1 = UserProfileManager.getUserInfo("return_error", identityTokenSubIs123);
			var p2 = UserProfileManager.getUserInfo("return_code_401", identityTokenSubIs123);
			var p3 = UserProfileManager.getUserInfo("return_code_403", identityTokenSubIs123);
			var p4 = UserProfileManager.getUserInfo("return_code_404", identityTokenSubIs123);
			var p5 = UserProfileManager.getUserInfo("return_code_500", identityTokenSubIs123);
			var p6 = UserProfileManager.getUserInfo("userinfo_access_token", identityTokenSubIsSubject123);
			var p7 = UserProfileManager.getUserInfo("userinfo_access_token", "malformed identityToken");
			var p8 = UserProfileManager.getUserInfo("userinfo_access_token", 8);
			Q.allSettled([p1, p2, p3, p4, p5, p6, p7, p8]).spread(function (r1, r2, r3, r4, r5, r6, r7, r8) {
				assert.equal(r1.state, "rejected");
				assert.equal(r2.state, "rejected");
				assert.equal(r3.state, "rejected");
				assert.equal(r4.state, "rejected");
				assert.equal(r5.state, "rejected");
				assert.equal(r6.state, "rejected");
				assert.equal(r7.state, "rejected");
				assert.equal(r8.state, "rejected");
				done();
			}).catch(function (e) {
				done(new Error(e));
			});
		});

		it("should send userinfo payload", function (done) {
			UserProfileManager.oauthServerUrl = "http://oauth";
			UserProfileManager.getUserInfo("userinfo_access_token", identityTokenSubIs123).then(function (result) {
				assert.equal(result.url, "http://oauth/userinfo");
				assert.equal(result.method, "GET");
				assert.equal(result.headers["Authorization"], "Bearer userinfo_access_token");
				assert.equal(result.sub, "123");
				done();
			}).catch(done);

		});

		it("should send uesrinfo payload - validating identity token ", function (done) {
			UserProfileManager.oauthServerUrl = "http://oauth";
			UserProfileManager.getUserInfo("userinfo_access_token", identityTokenSubIs123).then(function (result) {
				assert.equal(result.url, "http://oauth/userinfo");
				assert.equal(result.method, "GET");
				assert.equal(result.headers["Authorization"], "Bearer userinfo_access_token");
				assert.equal(result.sub, "123");
				done();
			}).catch(done);

		});
	});
});