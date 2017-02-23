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
const proxyquire = require("proxyquire");

const APPID_ALLOW_EXPIRED_TOKENS = "APPID_ALLOW_EXPIRED_TOKENS";
const ACCESS_TOKEN = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpPU0UiLCJqcGsiOnsiYWxnIjoiUlNBIiwibW9kIjoiQUtTZDA4R3ViajR3a2ZWTmN5MWcyYUREMlNQNHJTQXhxcVNwcTNCeVRRdzFBNE5SbE5fMm9ieWFVX05TQTBvMmtCV0xEWDNiTk80dHlCcWROSHpjRWhZdU1XYWFmdGV1clB4OV9MaTZOZzRIeE1na19NdWNDcVBlckRONnBmNklHeEp4V1hVVDNSOTQ5WEpHdFBOVndSQ2V5MWloZUZjVXA1TTRMR1p4SGZaZmtnX1lWSE91NUZzeDZmMGFMMlFfNlFiVUVsZTJaa3dIejlHaDhPTG9MY1ZxX3lCazliSFY0NkRZUXdOazNfcFFjZDh0Z214cFJZRUQ2WDJPN1BkakVtNk5VNlpFMTdtZXV4MEpfVEtVcHlaekNVZU1ZeW9RYnVDMktzY0hPNkticGtUSmFVZy1PeWdOSUFOX0Z3eTdobGpDWFZBczA1TGdJVmRqcEhpREJyTSIsImV4cCI6IkFRQUIifX0.eyJpc3MiOiJsb2NhbGhvc3Q6NjAxMiIsImV4cCI6MTQ4NTE4OTgzNCwiYXVkIjoiZTFkMDBjMTgtMTRiOS00MzQ1LTg0YzUtMDYzODMzNDMxYTEwIiwic3ViIjoiMWM5YWRmZmItMDY0ZC00YzY2LThlZDItYmJjMTJiZjkzZjU4IiwiaWF0IjoxNDg1MTg2MjM0LCJhdXRoQnkiOiJmYWNlYm9vayIsInNjb3BlIjoiZGVmYXVsdCJ9.RpLGYHOoEvomVoxIklAeDg7aMjVTsfGWJhGubhX8IIVGaoElMXu5ufT1E6G7AradOL3hm7yAvwguaBtE4CQkLIxA_3iCIJPKa-cHwSivQ4o96yTNOlqtAMK_f8-nh0zcVcCQNMe8HRBvFZuTtrL2Lx_KTQiYTeHyQ3QykIn9XGcEW6p8k2zx0IU574FZgLPH6-uOjFlZu4i5uDufCLX0lbEYJ5H6_EIh9uyyC436JfP0R5awHkUGTmkkj25ddhJXVCOgsUv-AUUfGKak3Wn5NhnEbUQdgUvU2yQqz41qDzGRqH81le-siFEDyPi4ls8SfXaP-c4V4qofugN0LrGmOg";

describe("/lib/utils/token-util", function(){
	console.log("Loading token-util-test.js");
	var TokenUtil;

	before(function(){
		TokenUtil = proxyquire("../lib/utils/token-util", {
			"./public-key-util": require("./mocks/public-key-util-mock")
		});
	});

	describe("#decodeAndValidate()", function(){
		it("Should return undefined since token is expired", function(){
			var decodedToken = TokenUtil.decodeAndValidate(ACCESS_TOKEN);
			assert.isUndefined(decodedToken);
		});

		it("Should succeed since APPID_ALLOW_EXPIRED_TOKENS=true", function(){
			process.env[APPID_ALLOW_EXPIRED_TOKENS] = true;
			var decodedToken = TokenUtil.decodeAndValidate(ACCESS_TOKEN);
			assert.isObject(decodedToken);
		});
	});

	describe("#decode()", function(){
		it("Should return a valid decoded token", function(){
			var decodedToken = TokenUtil.decode(ACCESS_TOKEN);
			assert.isObject(decodedToken);
			assert.property(decodedToken, "iss");
			assert.property(decodedToken, "sub");
			assert.property(decodedToken, "aud");
			assert.property(decodedToken, "iat");
		});
	});


});
