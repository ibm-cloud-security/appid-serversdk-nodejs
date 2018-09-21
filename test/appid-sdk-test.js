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

describe('/lib/appid-sdk', function(){
	console.log("Loading appid-sdk-test.js");

	let AppIdSDK;

	before(function(){
		AppIdSDK = require("../lib/appid-sdk");
	});

	describe("#AppIdSDK", function(){
		it("Should return WebAppStrategy", (done) => {
			assert.isFunction(AppIdSDK.WebAppStrategy);
			done();
		});

		it('Should return APIStrategy', (done) => {
			assert.isFunction(AppIdSDK.APIStrategy);
			done();
		});

		it('Should return token manger', (done) => {
			assert.isFunction(AppIdSDK.TokenManager);
			done();
		});
	});
});
