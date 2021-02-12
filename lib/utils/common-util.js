const got = require('got');

module.exports = (function () {

    // Drop-in replacement for the deprecated request library
    function request(options, callback) {
        let error = null;
        let response = null;
        let body = null;

        (async () => {
            try {
                if (options.method !== 'GET') {
                    if(!options.headers)
                        options.headers = {};
                    
                    options.headers['Content-type'] = 'application/json';
                }

                if(options.qs) {
                    options.searchParams = options.qs;
                    delete options.qs;
                }
                
                if(options.form) {
                    // options.body = jsonToURLencodedForm(options.form);
                    options.body = JSON.stringify(options.form);
                    delete options.form;
                }

                if(options.auth.bearer) {
                    options.headers["Authorization"] = `Bearer ${options.auth.bearer}`;
                    delete options.auth;
                }

                if(options.auth.username && options.auth.password) {
                    options.headers["Authorization"] = "Basic " + Buffer.from(`${options.auth.username}:${options.auth.password}`).toString("base64");
                    delete options.auth;
                }

                if(options.formData) {
                    options.body = JSON.stringify(options.formData);
                    delete options.formData;
                }

                if(options.json) {
                    options.body = JSON.stringify(options.json);
                    delete options.json;
                }

                // stringify object and array bodies
                if (options.json === true && options.body && (typeof options.body === 'object' || Array.isArray(options.body))) {
                    options.headers = options.headers || {};
                    options.headers['Content-Type'] = 'application/json';
                    options.body = JSON.stringify(options.body);
                }

                // requests that encounter an error status code will be resolved with the response instead of throwing
                options.throwHttpErrors = false;

                // receive a JSON body 
                options.responseType = 'json';

                // remove url from options 
                const url = options.url;

                response = await got(url, options);
                body = response?.body;
                
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

    function jsonToURLencodedForm(srcjson){
        if(typeof srcjson !== "object")
            if(typeof console !== "undefined"){
            console.log("\"srcjson\" is not a JSON object");
            return null;
        }
    
        let u = encodeURIComponent;
        let urljson = "";
        let keys = Object.keys(srcjson);
        for(var i=0; i <keys.length; i++){
            urljson += u(keys[i]) + "=" + u(srcjson[keys[i]]);
            if(i < (keys.length-1))urljson+="&";
        }
        return urljson;
    }

    function parseJSON(jsonObj) {
		try {
			var json = JSON.parse(jsonObj);
			return json;
		} catch (e) {
			return jsonObj;
		}
	}	
    
    return {
        jsonToURLencodedForm,
        parseJSON,
        request
    };

}());