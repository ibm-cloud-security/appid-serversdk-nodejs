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

const mockCredentials = {
	credentials: {
		tenantId: 'test-tenant-id',
		clientId: 'test-client-id',
		secret: 'secret',
		oauthServerUrl: 'https://test-appid-oauth.bluemix.net/oauth/v3/test-tenant-id',
		redirectUri: "https://test-redirect-uri",
		preferredLocale: "test-preferred-locale"
	}
};

describe("/lib/strategies/webapp-strategy-config", () => {
	let ServiceConfig;

	before(() => {
		ServiceConfig = require("../lib/strategies/webapp-strategy-config");
	});

	beforeEach(function () {
		delete process.env.VCAP_SERVICES;
		delete process.env.VCAP_APPLICATION;
		delete process.env.redirectUri;
	});

	it("Should fail if there is no options argument or VCAP_SERVICES", (done) => {
		assert.throws(ServiceConfig, Error, 'Failed to initialize WebAppStrategy. Ensure proper credentials are provided.');
		done();
	});

	it("Should get config from options argument", (done) => {
		const config = new ServiceConfig(mockCredentials.credentials);
		assert.include(config.getConfig(), mockCredentials.credentials);
		done();
	});

	it("Should get config from VCAP_SERVICES with AdvancedMobileAccess as the name", (done) => {
		const { tenantId, clientId, secret, oauthServerUrl, redirectUri } = mockCredentials.credentials;
		process.env.VCAP_SERVICES = JSON.stringify({
			AdvancedMobileAccess: [
				{
					credentials: {
						tenantId,
						clientId,
						secret,
						oauthServerUrl
					}
				}
			]
		});

		process.env.redirectUri = redirectUri;

		const config = new ServiceConfig();
		assert.isObject(config);
		assert.isObject(config.getConfig());
		assert.equal(config.getTenantId(), tenantId);
		assert.equal(config.getClientId(), clientId);
		assert.equal(config.getSecret(), secret);
		assert.equal(config.getOAuthServerUrl(), oauthServerUrl);
		assert.equal(config.getRedirectUri(), redirectUri);
		done();
	});

	it("Should get config from VCAP_SERVICES with Appid as the name", (done) => {
		const { tenantId, clientId, secret, oauthServerUrl, redirectUri } = mockCredentials.credentials;
		process.env.VCAP_SERVICES = JSON.stringify({
			AppID: [
				{
					credentials: {
						tenantId,
						clientId,
						secret,
						oauthServerUrl
					}
				}
			]
		});

		process.env.redirectUri = redirectUri;

		const config = new ServiceConfig();
		assert.isObject(config);
		assert.isObject(config.getConfig());
		assert.equal(config.getTenantId(), tenantId);
		assert.equal(config.getClientId(), clientId);
		assert.equal(config.getSecret(), secret);
		assert.equal(config.getOAuthServerUrl(), oauthServerUrl);
		assert.equal(config.getRedirectUri(), redirectUri);
		done();
	});

	it("Should get redirectUri from VCAP_APPLICATION", (done) => {
		const { tenantId, clientId, secret, oauthServerUrl} = mockCredentials.credentials;
		process.env.VCAP_APPLICATION = JSON.stringify({
			"application_uris": [
				"abcd.com"
			]
		});
		const config = new ServiceConfig({
			tenantId,
			clientId,
			secret,
			oauthServerUrl
		});
		assert.equal(config.getRedirectUri(), "https://abcd.com/ibm/bluemix/appid/callback");
		done();
	});
});
