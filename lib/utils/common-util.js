/*
 Copyright 2021 IBM Corp.
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

const FormData = require('form-data');

module.exports = (function () {

    function objectKeysToLowerCase(input) {
        if (typeof input !== 'object') return input;
        if (Array.isArray(input)) return input.map(objectKeysToLowerCase);
        return Object.keys(input).reduce(function (newObj, key) {
            let val = input[key];
            let newVal = (typeof val === 'object') ? objectKeysToLowerCase(val) : val;
            newObj[key.toLowerCase()] = newVal;
            return newObj;
        }, {});
    };

    // Null safe operator
    function optionalChaining(fn, defaultVal) {
        try {
            return fn();
        } catch (e) {
            return defaultVal;
        }
    }

    function jsonToURLencodedForm(srcjson) {
        if (typeof srcjson !== "object") {
            return srcjson;
        }

        let u = encodeURIComponent;
        let urljson = "";
        let keys = Object.keys(srcjson);
        for (var i = 0; i < keys.length; i++) {
            urljson += u(keys[i]) + "=" + u(srcjson[keys[i]]);
            if (i < (keys.length - 1)) urljson += "&";
        }
        return urljson;
    }

    function parseJSON(jsonStr) {
        try {
            var json = JSON.parse(jsonStr);
            return json;
        } catch (e) {
            return jsonStr;
        }
    }


    const createFormData = object => Object.keys(object).reduce((formData, key) => {
        formData.append(key, object[key]);
        return formData;
    }, new FormData());


    const parseFormData = (form) => form._streams.reduce((result, line) => {
        if (typeof line === 'string') {
            let matches = line.match(/name="(.+)"/);
            let key;


            if (typeof line.match(/name="(.+)"/) !== 'undefined') {
                matches = line.match(/name="(.+)"/);

                if (matches && matches.length > 0) {
                    key = matches[1];
                }
            }


            if (key) {
                result._currentKey = key;
            } else if (line !== '\\r\\n') {
                result[result._currentKey] = line;
                delete result._currentKey;
            }
        }

        return result;
    }, {});

    return {
        objectKeysToLowerCase,
        optionalChaining,
        jsonToURLencodedForm,
        parseJSON,
        createFormData,
        parseFormData
    };

}());