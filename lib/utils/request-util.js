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


/*
 This function will wrap the GotJS promise call in a function Callback
 So it can be a drop-in replacement for the deprecated request library
*/

const got = require('got');
const {
    objectKeysToLowerCase,
    optionalChaining,
    parseJSON,
    jsonToURLencodedForm,
    createFormData
} = require('./common-util');

module.exports = (function () {

    // Drop-in replacement for the deprecated request library
    function request(options, callback) {
        let error = null;
        let response = null;
        let body = null;

        (async () => {
            try {
                if (options.method !== 'GET') {
                    options.headers = options.headers || {};

                    options.headers = objectKeysToLowerCase(options.headers);
                    options.headers["content-type"] = options.headers["content-type"] || 'application/json';
                }

                if (options.qs) {
                    options.searchParams = options.qs;
                    delete options.qs;
                }

                if (options.form) {
                    if (options.headers["content-type"] === 'application/x-www-form-urlencoded') {
                        options.body = jsonToURLencodedForm(options.form);
                    } else {
                        options.body = JSON.stringify(options.form);
                    }
                    delete options.form;
                }

                if (options.auth) {
                    const authBearer = optionalChaining(() => options.auth.bearer);
                    if (authBearer) {
                        options.headers["Authorization"] = `Bearer ${authBearer}`;
                        delete options.auth;
                    }

                    const authUsername = optionalChaining(() => options.auth.username);
                    const authPassword = optionalChaining(() => options.auth.password);
                    if (authUsername && authPassword) {
                        options.headers["Authorization"] = "Basic " + Buffer.from(`${authUsername}:${authPassword}`).toString("base64");
                        delete options.auth;
                    }
                }

                if (options.formData) {
                    options.body = createFormData(options.formData);

                    // Remove the default content-type
                    if (options.headers && options.headers["content-type"] === 'application/json') {
                        delete options.headers["content-type"];
                    }

                    delete options.formData;
                }

                if (options.json) {
                    options.body = JSON.stringify(options.json);
                    delete options.json;
                }

                // requests that encounter an error status code will be resolved with the response instead of throwing
                options.throwHttpErrors = false;

                // receive a JSON body 
                options.responseType = 'json';

                // remove url from options 
                const url = options.url;

                // Main Request Call
                response = await got(url, options);
                body = parseJSON(response.body);

                if (response.error) {
                    error = response.error;
                }
                callback(error, response, body);
            } catch (err) {
                error = err;
                statusCode = err.statusCode;
                response = {
                    statusCode
                };
                callback(error, response, body);
            }
        })();
    }

    return request;
}());