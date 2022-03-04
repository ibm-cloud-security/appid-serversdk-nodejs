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
                
                // GotJS doesn't allow Request Body with the GET OR DELETE Method by default.
                if(options.method === 'GET' || 'DELETE') {
                    if(options.body === null) {
                        delete options.body;
                    }
                    else {
                        options.allowGetBody = true;
                    }
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

                // receive a JSON body 
                // This is necessary for the ServerSDK only as we are expecting JSON response in all the calls 
                if (!options.responseType) {
                    options.responseType = 'json';
                }

                if (options.json) {
                    // Handle json param same as Request library used to handle, so If json is true, then body must be a JSON-serializable object.
                    if(typeof options.json == "boolean") {
                        options.responseType = 'json';
                    }
                    // Handle json Request as Request library used to do, so If json is true, then body must be a JSON-serializable object.
                    else {
                        options.body = JSON.stringify(options.json);
                    }
                    delete options.json;
                }

                // Handle json param same as Request library used to handle, so If json is false, then body must be Not a JSON-serializable object.
                if (typeof options.json == "boolean" && !options.json) {
                    delete options.json;
                    delete options.responseType;
                }

                // requests that encounter an error status code will be resolved with the response instead of throwing
                options.throwHttpErrors = false;

                // remove url from options 
                const url = options.url;
                delete options.url;

                // Main Request Call
                response = await got(url, options);
                body = parseJSON(response.body);

                if (response.error) {
                    error = response.error;
                }
                callback(error, response, body);
            } catch (err) {
                error = err;
                if (err.response && err.response.statusCode) {
                    statusCode = err.response.statusCode;
                }

                // If body is empty, then return the response details of the error object
                if(!body && err.response) {
                    response = err.response;
                    body = err.response.body;
                    response.statusCode = statusCode;
                }

                callback(error, response, body);
            }
        })();
    }

    return request;
}());