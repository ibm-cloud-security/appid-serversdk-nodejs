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

const {assert} = chai;

// let AppIdSDK = require('../lib/appid-sdk');

describe('/lib/appid-sdk', () => {
  let AppIdSDK;

	before(() => {
		AppIdSDK = require("../lib/appid-sdk");
	});

	describe("#AppIdSDK", () => {
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

		it('Should process environment variable for log4js', (done) => {
			process.env.LOG4JS_CONFIG = JSON.stringify({
				appenders: {
				  out: {
					type: "console"
				  }
				},
				categories: {
				  default: {
            appenders: [
              "out"
            ],
            level: "fatal"
				  }
				}
			});
      delete require.cache[require.resolve("../lib/appid-sdk")];
      AppIdSDK = require("../lib/appid-sdk");
      done();
    });

		it('Should skip environment variable for log4js when invalid', (done) => {
      process.env.LOG4JS_CONFIG = "invalid";
      delete require.cache[require.resolve("../lib/appid-sdk")];
      AppIdSDK = require("../lib/appid-sdk");
      done();
		});
	});
});
