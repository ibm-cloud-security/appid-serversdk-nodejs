const got = require('got');
const { objectKeysToLowerCase, getSafe, parseJSON, jsonToURLencodedForm } = require('./common-util');

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

                if(options.qs) {
                    options.searchParams = options.qs;
                    delete options.qs;
                }
                
                if(options.form) {
                    if(options.headers["content-type"] === 'application/x-www-form-urlencoded') {
                        options.body = jsonToURLencodedForm(options.form);
                    }
                    else {
                        options.body = JSON.stringify(options.form);
                    }
                    delete options.form;
                }
                
                if(options.auth){
                    const authBearer = getSafe(() => options.auth.bearer);
                    if(authBearer) {
                        options.headers["Authorization"] = `Bearer ${authBearer}`;
                        delete options.auth;
                    }

                    const authUsername = getSafe(() => options.auth.username);
                    const authPassword = getSafe(() => options.auth.password);
                    if(authUsername && authPassword) {
                        options.headers["Authorization"] = "Basic " + Buffer.from(`${authUsername}:${authPassword}`).toString("base64");
                        delete options.auth;
                    }
                }

                if(options.formData) {
                    options.body = JSON.stringify(options.formData);
                    delete options.formData;
                }

                if(options.json) {
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
                body = parseJSON(response?.body);
                
                if(response.error) {
                    error = response.error;
                }
                callback(error, response, body);
            } catch (err) {
                error = err;
                statusCode = err.statusCode;
                response = {statusCode}
                callback(error, response, body);
            }
        })();
    }

    return request;
}());