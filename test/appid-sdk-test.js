const chai = require('chai');
const assert = chai.assert;

describe('/lib/appid-sdk', function(){
	console.log("Loading appid-sdk-test.js");

	var AppIdSDK;

	before(function(){
		AppIdSDK = require("../lib/appid-sdk");
	})

	describe("#AppIdSDK", function(){
		it("Should return APIStrategy and WebAppStrategy", function(){
			assert.isFunction(AppIdSDK.WebAppStrategy);
			assert.isFunction(AppIdSDK.APIStrategy);
		});
	});
});
