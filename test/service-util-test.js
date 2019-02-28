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

describe("/lib/strategies/webapp-strategy-config", () => {
	const mockCredentials = {
		credentials: {
			tenantId: 'test-tenant-id',
			clientId: 'test-client-id',
			secret: 'secret',
			oauthServerUrl: 'https://test-appid-oauth.bluemix.net/oauth/v3/test-tenant-id',
			redirectUri: "https://test-redirect-uri",
			preferredLocale: "test-preferred-locale"
		},
		oAuthCredentials: {
			tenantId: 'test-tenant-id',
			clientId: 'test-client-id',
			secret: 'secret',
			oAuthServerUrl: 'https://test-appid-oauth.bluemix.net/oauth/v3/test-tenant-id',
			redirectUri: "https://test-redirect-uri",
			preferredLocale: "test-preferred-locale"
		}
	};

	let ServiceConfig;

	before(() => {
		const { CLIENT_ID, TENANT_ID, SECRET, OAUTH_SERVER_URL, REDIRECT_URI } = require('../lib/utils/constants');
		const ServiceUtil = require('../lib/utils/service-util');
		ServiceConfig = function (options) {
			return ServiceUtil.loadConfig('WebAppStrategy', [
				TENANT_ID,
				CLIENT_ID,
				SECRET,
				OAUTH_SERVER_URL,
				REDIRECT_URI
			], options);
		};
	});

	beforeEach(function () {
		delete process.env.VCAP_SERVICES;
		delete process.env.VCAP_APPLICATION;
		delete process.env.redirectUri;
	});

	it("Should fail if there is no options argument or VCAP_SERVICES", (done) => {
		assert.throws(ServiceConfig, Error, 'Failed to initialize WebAppStrategy. Missing tenantId parameter.');
		done();
	});

	it("Should get config from options argument", (done) => {
		const config = new ServiceConfig(mockCredentials.credentials);
		assert.include(config.getConfig(), mockCredentials.credentials);
		done();
	});

  it("Should get config from options argument (with oAuthServerUrl)", (done) => {
	const config = new ServiceConfig(mockCredentials.oAuthCredentials);
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
		const { tenantId, clientId, secret, oauthServerUrl } = mockCredentials.credentials;
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

describe('/lib/strategies/api-strategy-config', () => {
	const mockCredentials = {
		credentials: {
			tenantId: 'test-tenant-id',
			oauthServerUrl: 'https://test-appid-oauth.bluemix.net/oauth/v3/test-tenant-id'
		},
		oAuthCredentials: {
			tenantId: 'test-tenant-id',
			oAuthServerUrl: 'https://test-appid-oauth.bluemix.net/oauth/v3/test-tenant-id'
		}
	};

	let ServiceConfig;

	before(() => {
		const { TENANT_ID, OAUTH_SERVER_URL } = require('../lib/utils/constants');
		const ServiceUtil = require('../lib/utils/service-util');
		ServiceConfig = function (options) {
			return ServiceUtil.loadConfig('APIStrategy', [
				TENANT_ID,
				OAUTH_SERVER_URL,
			], options);
		};
	});

	beforeEach(function () {
		delete process.env.VCAP_SERVICES;
	});


	it("Should fail if there is no options argument or VCAP_SERVICES", (done) => {
		assert.throws(ServiceConfig, Error, /Failed to initialize APIStrategy\. Missing/);
		done();
	});

	it("Should fail if there is no oauthServerUrl", (done) => {
		assert.throws(() => {
			ServiceConfig({
				tenantId: "abcd"
			});
		}, Error, /Failed to initialize APIStrategy\. Missing/);
		done();
	});

	it("Should fail if there is no tenantId", (done) => {
		assert.throws(() => {
			ServiceConfig({
				oauthServerUrl: "https://abcd.com"
			});
		}, Error, /Failed to initialize APIStrategy\. Missing/);
		done();
	});

	it("Should fail if there is a service endpoint and no version", (done) => {
		assert.throws(() => {
			ServiceConfig({
				tenantId: "abcd",
				appidServiceEndpoint:"zyxw"
			});
		}, Error, /Failed to initialize APIStrategy\. Missing/);
		done();
	});
	it("Should fail if there is a service endpoint and no tenant", (done) => {
		assert.throws(() => {
			ServiceConfig({
				version:"p",
				appidServiceEndpoint:"zyxw"
			});
		}, Error, /Failed to initialize APIStrategy\. Missing/);
		done();
	});
	it("Should success if there is a service endpoint tenant and version - endpoint with trailing slash", () => {
		const tenantId="abcd";
		const config = new ServiceConfig({
			tenantId,
			version:"3",
			appidServiceEndpoint:"zyxw/"
		});
		assert.isObject(config);
		assert.isObject(config.getConfig());
		assert.equal(config.getOAuthServerUrl(), 'zyxw/oauth/v3/abcd');
		assert.equal(config.getTenantId(), 'abcd');
	});
	it("Should success if there is a service endpoint tenant and version - endpoint without trailing slash", () => {
		const tenantId="abcd";
		const config = new ServiceConfig({
			tenantId,
			version:"3",
			appidServiceEndpoint:"zyxw"
		});
		assert.isObject(config);
		assert.isObject(config.getConfig());
		assert.equal(config.getOAuthServerUrl(), 'zyxw/oauth/v3/abcd');
		assert.equal(config.getTenantId(), 'abcd');
	});
	it("Should get config from options argument", (done) => {
		const config = new ServiceConfig(mockCredentials.credentials);
		assert.include(config.getConfig(), mockCredentials.credentials);
		done();
	});

  it("Should get config from options argument (with oAuthServerUrl)", (done) => {
	const config = new ServiceConfig(mockCredentials.oAuthCredentials);
	assert.include(config.getConfig(), mockCredentials.credentials);
	done();
  });

	it("Should succeed and get config from VCAP_SERVICES with AdvancedMobileAccess as the name", (done) => {
		const { tenantId, oauthServerUrl } = mockCredentials.credentials;
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
		const { tenantId, oauthServerUrl } = mockCredentials.credentials;
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

describe('/lib/token-manager/token-manager-config', () => {
	const mockCredentials = {
		credentials: {
			tenantId: 'test-tenant-id',
			clientId: 'test-client-id',
			secret: 'secret',
			oauthServerUrl: 'https://test-appid-oauth.bluemix.net/oauth/v3/test-tenant-id'
		},
		oAuthCredentials: {
			tenantId: 'test-tenant-id',
			clientId: 'test-client-id',
			secret: 'secret',
			oAuthServerUrl: 'https://test-appid-oauth.bluemix.net/oauth/v3/test-tenant-id'
		}
	};

	let ServiceConfig;

	before(() => {
		const { CLIENT_ID, TENANT_ID, SECRET, OAUTH_SERVER_URL } = require('../lib/utils/constants');
		const ServiceUtil = require('../lib/utils/service-util');
		ServiceConfig = function (options) {
			return ServiceUtil.loadConfig('TokenManager', [
				TENANT_ID,
				CLIENT_ID,
				SECRET,
				OAUTH_SERVER_URL
			], options);
		};
	});

	beforeEach(() => {
		delete process.env.VCAP_SERVICES;
	});

	it("Should fail if there is no options argument or VCAP_SERVICES", (done) => {
		assert.throws(ServiceConfig, Error, 'Failed to initialize TokenManager. Missing tenantId parameter.');
		done();
	});

	it("Should get config from options argument", (done) => {
		const config = new ServiceConfig(mockCredentials.credentials);
		assert.include(config.getConfig(), mockCredentials.credentials);
		done();
	});

	it("Should get config from options argument (with oAuthServerUrl)", (done) => {
		const config = new ServiceConfig(mockCredentials.oAuthCredentials);
		assert.include(config.getConfig(), mockCredentials.credentials);
		done();
	});

	it("Should get config from VCAP_SERVICES with AdvancedMobileAccess as the name", (done) => {
		process.env.VCAP_SERVICES = JSON.stringify({
			AdvancedMobileAccess: [mockCredentials]
		});
		const config = new ServiceConfig();
		assert.include(config.getConfig(), mockCredentials.credentials);
		done();
	});

	it("Should get config from VCAP_SERVICES with Appid as the name", (done) => {
		process.env.VCAP_SERVICES = JSON.stringify({
			AppID: [mockCredentials]
		});
		const config = new ServiceConfig();
		assert.include(config.getConfig(), mockCredentials.credentials);
		done();
	});
});
