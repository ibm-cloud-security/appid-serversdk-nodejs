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

const chai = require('chai');
const assert = chai.assert;

const mockCredentials = {
	credentials: {
		tenantId: 'test-tenant-id',
		oauthServerUrl: 'https://test-appid-oauth.bluemix.net/oauth/v3/test-tenant-id'
	}
};

describe('/lib/strategies/api-strategy-config', () => {
	let ServiceConfig;

	before(function () {
		ServiceConfig = require("../lib/strategies/api-strategy-config");
	});

	beforeEach(function () {
		delete process.env.VCAP_SERVICES;
	});


	it("Should fail if there is no options argument or VCAP_SERVICES", (done) => {
		assert.throws(ServiceConfig, Error, 'Failed to initialize APIStrategy. Ensure proper credentials are provided.');
		done();
	});

	it("Should fail if there is no oauthServerUrl", (done) => {
		assert.throws(() => {
			ServiceConfig({
				tenantId: "abcd"
			});
		}, Error, 'Failed to initialize APIStrategy. Ensure proper credentials are provided.');
		done();
	});

	it("Should fail if there is no tenantId", (done) => {
		assert.throws(() => {
			ServiceConfig({
				oauthServerUrl: "https://abcd.com"
			});
		}, Error, 'Failed to initialize APIStrategy. Ensure proper credentials are provided.');
		done();
	});

	it("Should get config from options argument", (done) => {
		config = new ServiceConfig(mockCredentials.credentials);
		assert.include(config.getConfig(), mockCredentials.credentials);
		done();
	});

	it("Should succeed and get config from VCAP_SERVICES with AdvancedMobileAccess as the name", (done) => {
		const { tenantId, oauthServerUrl} = mockCredentials.credentials;
		process.env.VCAP_SERVICES = JSON.stringify({
			AdvancedMobileAccess: [{
				credentials: {
					tenantId,
					oauthServerUrl
				}
			}]
		});
		const config = new ServiceConfig();
		assert.isObject(config);
		assert.isObject(config.getConfig());
		assert.equal(config.getOAuthServerUrl(), oauthServerUrl);
		assert.equal(config.getTenantId(), tenantId);
		done();
	});

	it("Should succeed and get config from VCAP_SERVICES with Appid as the name", (done) => {
		const { tenantId, oauthServerUrl} = mockCredentials.credentials;
		process.env.VCAP_SERVICES = JSON.stringify({
			AppID: [{
				credentials: {
					tenantId,
					oauthServerUrl
				}
			}]
		});
		const config = new ServiceConfig();
		assert.isObject(config);
		assert.isObject(config.getConfig());
		assert.equal(config.getOAuthServerUrl(), oauthServerUrl);
		assert.equal(config.getTenantId(), tenantId);
		done();
	});
});