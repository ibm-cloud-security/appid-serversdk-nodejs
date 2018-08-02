const chai = require("chai");
const assert = chai.assert;

const mockCredentials = {
	credentials: {
		tenantId: 'test-tenant-id',
		clientId: 'test-client-id',
		secret: 'secret',
		oauthServerUrl: 'https://test-appid-oauth.bluemix.net/oauth/v3/test-tenant-id'
	}
};

describe('/lib/token-manager/token-manager-config', () => {
	let ServiceConfig;

	before(() => {
		ServiceConfig = require("../lib/token-manager/token-manager-config");
	});

	beforeEach(() => {
		delete process.env.VCAP_SERVICES;
	});

	it("Should fail if there is no options argument or VCAP_SERVICES", (done) => {
		try {
			new ServiceConfig();
		} catch (error) {
			assert.equal(error.message, 'Failed to initialize token manager');
			done();
		}
	});

	it("Should get config from options argument", (done) => {
		config = new ServiceConfig(mockCredentials.credentials);
		assert.deepEqual(config.getConfig(), mockCredentials.credentials);
		done();
	});

	it("Should get config from VCAP_SERVICES with AdvancedMobileAccess as the name", (done) => {
		process.env.VCAP_SERVICES = JSON.stringify({
			AdvancedMobileAccess: [mockCredentials]
		});
		config = new ServiceConfig();
		assert.deepEqual(config.getConfig(), mockCredentials.credentials);
		done();
	});

	it("Should get config from VCAP_SERVICES with Appid as the name", (done) => {
		process.env.VCAP_SERVICES = JSON.stringify({
			AppID: [mockCredentials]
		});
		config = new ServiceConfig();
		assert.deepEqual(config.getConfig(), mockCredentials.credentials);
		done();
	});
});