const chai = require('chai');
const assert = chai.assert;

describe('/lib/strategies/api-strategy-config', function(){
	console.log("Loading api-strategy-config-test.js");

	var Config;

	before(function(){
		Config = require("../lib/strategies/api-strategy-config");
	});

	beforeEach(function(){
		delete process.env.VCAP_SERVICES;
		delete process.env.VCAP_APPLICATION;
		delete process.env.redirectUri;
	});

 	describe("#getConfig(), #getTenantId, #getServerUrl", function(){
 		it("Should fail since there's no options argument nor VCAP_SERVICES", function(){
 			var config = new Config();
			assert.isObject(config);
			assert.isObject(config.getConfig());
			assert.isUndefined(config.getTenantId());
			assert.isUndefined(config.getServerUrl());
		})

		it("Should succeed and get config from options argument", function(){
			var config = new Config({
				tenantId: "abcd",
				serverUrl: "http://abcd"
			});
			assert.isObject(config);
			assert.isObject(config.getConfig());
			assert.equal(config.getTenantId(), "abcd");
			assert.equal(config.getServerUrl(), "http://abcd");
		});

	    it("Should succeed and get config from VCAP_SERVICES", function(){
			process.env.VCAP_SERVICES = JSON.stringify({
			    AdvancedMobileAccess: [
				    {
						credentials: {
							tenantId: "abcd",
							serverUrl: "http://abcd"
						}
				    }
			    ]
		    });

	    	var config = new Config();
		    assert.isObject(config);
		    assert.isObject(config.getConfig());
		    assert.equal(config.getTenantId(), "abcd");
		    assert.equal(config.getServerUrl(), "http://abcd");
	    });

    })
});
