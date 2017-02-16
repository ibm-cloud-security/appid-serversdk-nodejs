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
			assert.isUndefined(config.getOAuthServerUrl());
		})

		it("Should succeed and get config from options argument", function(){
			var config = new Config({
				tenantId: "abcd",
				oauthServerUrl: "http://abcd"
			});
			assert.isObject(config);
			assert.isObject(config.getConfig());
			assert.equal(config.getTenantId(), "abcd");
			assert.equal(config.getOAuthServerUrl(), "http://abcd");
		});

	    it("Should succeed and get config from VCAP_SERVICES", function(){
			process.env.VCAP_SERVICES = JSON.stringify({
			    AdvancedMobileAccess: [
				    {
						credentials: {
							tenantId: "abcd",
							oauthServerUrl: "http://abcd"
						}
				    }
			    ]
		    });

	    	var config = new Config();
		    assert.isObject(config);
		    assert.isObject(config.getConfig());
		    assert.equal(config.getTenantId(), "abcd");
		    assert.equal(config.getOAuthServerUrl(), "http://abcd");
	    });

    })
});
