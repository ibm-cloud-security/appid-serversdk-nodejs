const chai = require('chai');
const assert = chai.assert;

const Config = require("../lib/strategies/webapp-strategy-config");

describe('/lib/strategies/webapp-strategy-config', function(){

	beforeEach(function(){
		delete process.env.VCAP_SERVICES;
		delete process.env.VCAP_APPLICATION;
		delete process.env.redirectUri;
	});

 	describe("#getConfig(), #getTenantId(), #getClientId(), #getSecret(), #getAuthorizationEndpoint(), #getTokenEndpoint(), #getRedirectUri()", function(){
 		it("Should fail since there's no options argument nor VCAP_SERVICES", function(){
 			var config = new Config();
			assert.isObject(config);
			assert.isObject(config.getConfig());
		    assert.isUndefined(config.getTenantId());
		    assert.isUndefined(config.getClientId());
		    assert.isUndefined(config.getSecret());
		    assert.isUndefined(config.getAuthorizationEndpoint());
		    assert.isUndefined(config.getTokenEndpoint());
		    assert.isUndefined(config.getRedirectUri());

	    })

		it("Should succeed and get config from options argument", function(){
			var config = new Config({
				tenantId: "abcd",
				clientId: "clientId",
				secret: "secret",
				authorizationEndpoint: "authEndpoint",
				tokenEndpoint: "tokenEndpoint",
				redirectUri: "redirectUri"
			});
			assert.isObject(config);
			assert.isObject(config.getConfig());
			assert.equal(config.getTenantId(), "abcd");
			assert.equal(config.getClientId(), "clientId");
			assert.equal(config.getSecret(), "secret");
			assert.equal(config.getAuthorizationEndpoint(), "authEndpoint");
			assert.equal(config.getTokenEndpoint(), "tokenEndpoint");
			assert.equal(config.getRedirectUri(), "redirectUri");
		});

	    it("Should succeed and get config from VCAP_SERVICES", function(){
		    process.env.VCAP_SERVICES = JSON.stringify({
			    AdvancedMobileAccess: [
				    {
						credentials: {
							tenantId: "abcd",
							clientId: "clientId",
							secret: "secret",
							authorizationEndpoint: "authEndpoint",
							tokenEndpoint: "tokenEndpoint"
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
		    assert.equal(config.getAuthorizationEndpoint(), "authEndpoint");
		    assert.equal(config.getTokenEndpoint(), "tokenEndpoint");
		    assert.equal(config.getRedirectUri(), "redirectUri");
	    });

	    it("Should succeed and get redirectUri from VCAP_APPLICATION", function(){
		    process.env.VCAP_APPLICATION = JSON.stringify({
			    application_uris: [
			    	"abcd.com"
			    ]
		    });
		    var config = new Config();
		    assert.equal(config.getRedirectUri(), "https://abcd.com/ibm/bluemix/appid/callback");
	    });


    })
});
