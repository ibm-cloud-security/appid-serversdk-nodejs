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
const expect = chai.expect;
let commonUtil = require("../lib/utils/common-util");
chai.use(require("chai-as-promised"));

describe("/lib/utils/common-util", function () {
	context('jsonToURLencodedForm', () => {
		const formData = {
			"grant_type": "urn:ibm:params:oauth:grant-type:apikey",
			"apikey": "2hntsFCUIw1hgPp31iRjcYllURtWeelFBgHYm4-ol3XB"
		}

		const urlEncodedData = 'grant_type=urn%3Aibm%3Aparams%3Aoauth%3Agrant-type%3Aapikey&apikey=2hntsFCUIw1hgPp31iRjcYllURtWeelFBgHYm4-ol3XB';

        it('should successfully convert the formData to URLencoded format', () => {
            expect(commonUtil.jsonToURLencodedForm(formData)).to.equal(urlEncodedData);
        });
    });
	
	context('parseJSON', () => {
		const validStringJson = '{"name":"abod","age":28,"car":"ford"}';
		const validJSON = {"name":"abod","age":28,"car":"ford"};
		const htmlError = "<div>Internal Server Error</div>";

        it('should successfully return parsed JSON', () => {
            expect(commonUtil.parseJSON(validStringJson)).to.deep.equal(validJSON);
        });
        it('should return the exact JSON', () => {
            expect(commonUtil.parseJSON(validJSON)).to.deep.equal(validJSON);
        });
		
		it('should return the exact text - Invalid JSON case', () => {
            expect(commonUtil.parseJSON(htmlError)).to.deep.equal(htmlError);
        });
    });
});
