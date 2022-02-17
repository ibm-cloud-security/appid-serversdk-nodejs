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
const expect = chai.expect;
const should = chai.should();
let commonUtil = require("../lib/utils/common-util");
chai.use(require("chai-as-promised"));

describe("/lib/utils/common-util", function () {
    context('optionalChaining', () => {
        const stringName = 'testString';
        const sampleObj = {
            "name": "abod",
            "age": 30,
            "cars": {
                "car1": "Ford",
                "car2": "BMW",
                "car3": "Fiat"
            }
        }

        it('should successfully return the value of the property', () => {
            expect(commonUtil.optionalChaining(() => sampleObj.cars.car2)).to.equal("BMW");
        });

        it('should return undefined if property is not in the json object', () => {
            should.not.exist(commonUtil.optionalChaining(() => sampleObj.cars.car2.wheels));
        });

        it('should return the same value if a non object was passed', () => {
            expect(commonUtil.jsonToURLencodedForm(stringName)).to.equal(stringName);
            expect(commonUtil.jsonToURLencodedForm(32)).to.equal(32);
        });
    });

    context('objectKeysToLowerCase', () => {
        const mixedKeyCases = {
            "First-Name": "abod",
            "Age": 30,
            "CARS": {
                "car1": "Ford",
                "car2": "BMW",
                "car3": "Fiat"
            }
        }
        const lowerKeyCases = {
            "first-name": "abod",
            "age": 30,
            "cars": {
                "car1": "Ford",
                "car2": "BMW",
                "car3": "Fiat"
            }
        }

        it('should return the object keys in lowercases', () => {
            expect(commonUtil.objectKeysToLowerCase(mixedKeyCases)).to.deep.equal(lowerKeyCases);
        });
    });

    context('jsonToURLencodedForm', () => {
        const stringName = 'testString';
        const formData = {
            "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
            "apikey": "dummyAPIKEY-FCUIw1hgPp31iRjcYllURtWeelFBgHYm4-key"
        }

        const urlEncodedData = 'grant_type=urn%3Aibm%3Aparams%3Aoauth%3Agrant-type%3Aapikey&apikey=dummyAPIKEY-FCUIw1hgPp31iRjcYllURtWeelFBgHYm4-key';

        it('should successfully convert the formData to URLencoded format', () => {
            expect(commonUtil.jsonToURLencodedForm(formData)).to.equal(urlEncodedData);
        });

        it('should return the same value if a non object was passed', () => {
            expect(commonUtil.jsonToURLencodedForm(stringName)).to.equal(stringName);
            expect(commonUtil.jsonToURLencodedForm(32)).to.equal(32);
        });
    });

    context('parseJSON', () => {
        const validStringJson = '{"name":"abod","age":28,"car":"ford"}';
        const validJSON = {
            "name": "abod",
            "age": 28,
            "car": "ford"
        };
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