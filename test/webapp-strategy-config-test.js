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

describe("/lib/strategies/webapp-strategy-config", function () {
	console.log("Loading webapp-strategy-config-test.js");

	var Config;

	before(function () {
		Config = require("../lib/strategies/webapp-strategy-config");
	});

	beforeEach(function () {
		delete process.env.VCAP_SERVICES;
		delete process.env.VCAP_APPLICATION;
		delete process.env.redirectUri;
	});

	describe("#getConfig(), #getTenantId(), #getClientId(), #getSecret(), #getAuthorizationEndpoint(), #getTokenEndpoint(), #getRedirectUri()", function () {
		it("Should fail since there's no options argument nor VCAP_SERVICES", function () {
			var config = new Config();
			assert.isObject(config);
			assert.isObject(config.getConfig());
			assert.isUndefined(config.getTenantId());
			assert.isUndefined(config.getClientId());
			assert.isUndefined(config.getSecret());
			assert.isUndefined(config.getOAuthServerUrl());
			assert.isUndefined(config.getRedirectUri());

		});

		it("Should succeed and get config from options argument", function () {
			var config = new Config({
				tenantId: "abcd",
				clientId: "clientId",
				secret: "secret",
				oauthServerUrl: "oauthServerUrl",
				redirectUri: "redirectUri"
			});
			assert.isObject(config);
			assert.isObject(config.getConfig());
			assert.equal(config.getTenantId(), "abcd");
			assert.equal(config.getClientId(), "clientId");
			assert.equal(config.getSecret(), "secret");
			assert.equal(config.getOAuthServerUrl(), "oauthServerUrl");
			assert.equal(config.getRedirectUri(), "redirectUri");
		});

		it("Should succeed and get config from VCAP_SERVICES (AdvancedMobileAccess)", function () {
			process.env.VCAP_SERVICES = JSON.stringify({
				AdvancedMobileAccess: [
					{
						credentials: {
							tenantId: "abcd",
							clientId: "clientId",
							secret: "secret",
							oauthServerUrl: "http://abcd"
						}
					}
				]
			});

			process.env.redirectUri = "redirectUri";

			var config = new Config();
			assert.isObject(config);
			assert.isObject(config.getConfig());
			assert.equal(config.getTenantId(), "abcd");
			assert.equal(config.getClientId(), "clientId");
			assert.equal(config.getSecret(), "secret");
			assert.equal(config.getOAuthServerUrl(), "http://abcd");
			assert.equal(config.getRedirectUri(), "redirectUri");
		});
		it("Should succeed and get config from VCAP_SERVICES (Appid)", function () {
			process.env.VCAP_SERVICES = JSON.stringify({
				AppID: [
					{
						credentials: {
							tenantId: "abcd",
							clientId: "clientId",
							secret: "secret",
							oauthServerUrl: "http://abcd"
						}
					}
				]
			});

			process.env.redirectUri = "redirectUri";

			var config = new Config();
			assert.isObject(config);
			assert.isObject(config.getConfig());
			assert.equal(config.getTenantId(), "abcd");
			assert.equal(config.getClientId(), "clientId");
			assert.equal(config.getSecret(), "secret");
			assert.equal(config.getOAuthServerUrl(), "http://abcd");
			assert.equal(config.getRedirectUri(), "redirectUri");
		});

		it("Should succeed and get redirectUri from VCAP_APPLICATION", function () {
			process.env.VCAP_APPLICATION = JSON.stringify({
				"application_uris": [
					"abcd.com"
				]
			});
			var config = new Config();
			assert.equal(config.getRedirectUri(), "https://abcd.com/ibm/bluemix/appid/callback");
		});
	})
});
