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

describe("/lib/user-manager/user-user-manager", function () {
	console.log("Loading user-manager-test.js");

	var UserManager;

	before(function () {
		UserManager = proxyquire("../lib/user-manager/user-manager", {
			"request": requestMock
		});
	});

	describe("#UserManager.init", function () {
		it("Should not be able to init without options and VCAP_SERVICS", function () {
			UserManager.init();
			// TODO: add validation that errors are printed to console
		});

		it("Should be able to init with options", function () {
			UserManager.init({
				profilesUrl: "dummyurl"
			});
		});

		it("Should be able to init with VCAP_SERVICES (AdvancedMobileAccess)", function () {
			process.env.VCAP_SERVICES = JSON.stringify({
				AdvancedMobileAccess: [
					{
						credentials: {
							profilesUrl: "http://abcd"
						}
					}
				]
			});
			UserManager.init();
		});

		it("Should be able to init with VCAP_SERVICES (appid)", function () {
			process.env.VCAP_SERVICES = JSON.stringify({
				AppID: [
					{
						credentials: {
							serverUrl: "http://abcd"
						}
					}
				]
			});
			UserManager.init();
		});
	});
	describe("#UserManager.setAttribute", function () {
		it("Should validate all parameters are present", function (done) {

			var p1 = UserManager.setAttribute();
			var p2 = UserManager.setAttribute("accessToken");
			var p3 = UserManager.setAttribute("accessToken", "name");

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
			var p1 = UserManager.setAttribute("return_error", "name", "value");
			var p2 = UserManager.setAttribute("return_code_401", "name", "value");
			var p3 = UserManager.setAttribute("return_code_403", "name", "value");
			var p4 = UserManager.setAttribute("return_code_404", "name", "value");
			var p5 = UserManager.setAttribute("return_code_500", "name", "value");
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
				AppID: [
					{
						credentials: {
							tenantId: "abcd",
							clientId: "clientId",
							secret: "secret",
							oauthServerUrl: "http://abcd",
							profilesUrl: 'http://abcd'
						}
					}
				]
			});
			UserManager.init();
			UserManager.setAttribute("access_token", "name", "value").then(function (result) {
				assert.equal(result.url, "http://abcd/api/v1/attributes/name");
				assert.equal(result.method, "PUT");
				assert.equal(result.body, "value");
				assert.equal(result.headers["Authorization"], "Bearer access_token");
				done();
			}).catch(done);
		});
	});
	describe("#UserManager.getAttribute", function () {
		process.env.VCAP_SERVICES = JSON.stringify({
			AppID: [
				{
					credentials: {
						tenantId: "abcd",
						clientId: "clientId",
						secret: "secret",
						oauthServerUrl: "http://abcd",
						profilesUrl: 'http://abcd'
					}
				}
			]
		});
		it("Should validate all parameters are present", function (done) {

			var p1 = UserManager.getAttribute();
			var p2 = UserManager.getAttribute("accessToken");

			Q.allSettled([p1, p2]).spread(function (r1, r2) {
				assert.equal(r1.state, "rejected");
				assert.equal(r2.state, "rejected");
				done();
			}).catch(function (e) {
				done(new Error(e));
			});
		});

		it("Should fail if there's an error", function (done) {
			var p1 = UserManager.getAttribute("return_error", "name");
			var p2 = UserManager.getAttribute("return_code_401", "name");
			var p3 = UserManager.getAttribute("return_code_403", "name");
			var p4 = UserManager.getAttribute("return_code_404", "name");
			var p5 = UserManager.getAttribute("return_code_500", "name");
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
			UserManager.getAttribute("access_token", "name").then(function (result) {
				assert.equal(result.url, "http://abcd/api/v1/attributes/name");
				assert.equal(result.method, "GET");
				assert.equal(result.headers["Authorization"], "Bearer access_token");
				done();
			}).catch(done);

		});
	});

	describe("#UserManager.deleteAttribute", function () {
		process.env.VCAP_SERVICES = JSON.stringify({
			AppID: [
				{
					credentials: {
						tenantId: "abcd",
						clientId: "clientId",
						secret: "secret",
						oauthServerUrl: "http://abcd",
						profilesUrl: 'http://abcd'
					}
				}
			]
		});
		it("Should validate all parameters are present", function (done) {

			var p1 = UserManager.deleteAttribute();
			var p2 = UserManager.deleteAttribute("accessToken");

			Q.allSettled([p1, p2]).spread(function (r1, r2) {
				assert.equal(r1.state, "rejected");
				assert.equal(r2.state, "rejected");
				done();
			}).catch(function (e) {
				done(new Error(e));
			});
		});

		it("Should fail if there's an error", function (done) {
			var p1 = UserManager.deleteAttribute("return_error", "name", "value");
			var p2 = UserManager.deleteAttribute("return_code_401", "name", "value");
			var p3 = UserManager.deleteAttribute("return_code_403", "name", "value");
			var p4 = UserManager.deleteAttribute("return_code_404", "name", "value");
			var p5 = UserManager.deleteAttribute("return_code_500", "name", "value");
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
			UserManager.deleteAttribute("access_token", "name").then(function (result) {
				assert.equal(result.url, "http://abcd/api/v1/attributes/name");
				assert.equal(result.method, "DELETE");
				assert.equal(result.headers["Authorization"], "Bearer access_token");
				done();
			});
		});
	});

	describe("#UserManager.getAllAttributes", function () {
		it("Should validate all parameters are present", function (done) {

			var p1 = UserManager.getAllAttributes();

			Q.allSettled([p1]).spread(function (r1) {
				assert.equal(r1.state, "rejected");
				done();
			}).catch(function (e) {
				done(new Error(e));
			});
		});

		it("Should fail if there's an error", function (done) {
			var p1 = UserManager.getAllAttributes("return_error");
			var p2 = UserManager.getAllAttributes("return_code_401");
			var p3 = UserManager.getAllAttributes("return_code_403");
			var p4 = UserManager.getAllAttributes("return_code_404");
			var p5 = UserManager.getAllAttributes("return_code_500");
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
			UserManager.getAllAttributes("access_token").then(function (result) {
				assert.equal(result.url, "http://abcd/api/v1/attributes");
				assert.equal(result.method, "GET");
				assert.equal(result.headers["Authorization"], "Bearer access_token");
				done();
			});
		});
	});

	describe("#UserManager.getUserInfo", function () {

		let identityTokenSubject123 = "Q.eyJzdWIiOiIxMjMifQ.e";

		it("Should validate all parameters are present", function (done) {

			var p1 = UserManager.getUserInfo();
			var p2 = UserManager.getUserInfo("accessToken");

			Q.allSettled([p1, p2]).spread(function (r1, r2) {
				assert.equal(r1.state, "rejected");
				assert.equal(r2.state, "rejected");
				done();
			}).catch(function (e) {
				done(new Error(e));
			});
		});

		it("Should fail if there's an error", function (done) {
			var p1 = UserManager.getUserInfo("return_error", identityTokenSubject123);
			var p2 = UserManager.getUserInfo("return_code_401", identityTokenSubject123);
			var p3 = UserManager.getUserInfo("return_code_403", identityTokenSubject123);
			var p4 = UserManager.getUserInfo("return_code_404", identityTokenSubject123);
			var p5 = UserManager.getUserInfo("return_code_500", identityTokenSubject123);
			var p6 = UserManager.getUserInfo("userinfo_access_token", "ifQ.eyJzdWIiOiJzdWJqZWN0MTIzIn0.Q");
			var p7 = UserManager.getUserInfo("userinfo_access_token", "malfored identityToken");
			Q.allSettled([p1, p2, p3, p4, p5, p6, p7]).spread(function (r1, r2, r3, r4, r5, r6, r7) {
				assert.equal(r1.state, "rejected");
				assert.equal(r2.state, "rejected");
				assert.equal(r3.state, "rejected");
				assert.equal(r4.state, "rejected");
				assert.equal(r5.state, "rejected");
				assert.equal(r6.state, "rejected");
				assert.equal(r7.state, "rejected");
				done();
			}).catch(function (e) {
				done(new Error(e));
			});
		});

		it("should send userinfo payload", function (done) {
			UserManager.oauthServerUrl = "http://oauth"
			UserManager.getUserInfo("userinfo_access_token", identityTokenSubject123).then(function (result) {
				assert.equal(result.url, "http://oauth/userinfo");
				assert.equal(result.method, "GET");
				assert.equal(result.headers["Authorization"], "Bearer userinfo_access_token");
				assert.equal(result.sub, "123");
				done();
			}).catch(done);

		});

		it("should send uesrinfo payload - validating identity token ", function (done) {
			UserManager.oauthServerUrl = "http://oauth"
			UserManager.getUserInfo("userinfo_access_token", identityTokenSubject123).then(function (result) {
				assert.equal(result.url, "http://oauth/userinfo");
				assert.equal(result.method, "GET");
				assert.equal(result.headers["Authorization"], "Bearer userinfo_access_token");
				assert.equal(result.sub, "123");
				done();
			}).catch(done);

		});
	});
});

function requestMock(options, callback) {
	var authHeader = options.headers["Authorization"];
	console.log(authHeader);
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
		}, JSON.stringify(options));
	} else {
		return callback(null, {
			statusCode: 200
		}, JSON.stringify(options));
	}
}
