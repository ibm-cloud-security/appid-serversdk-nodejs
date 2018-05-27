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

module.exports = {
	decodeAndValidate: decodeAndValidate,
	decode: decode,
	validateToken: validateToken
}

const Q = require("q");

function decode(accessTokenString) {
	if (accessTokenString === "invalid_token") {
		return;
	} else if (accessTokenString === "bad_scope") {
		return {scope: "bad_scope"};
	} else if (accessTokenString === "null_scope") {
		return null;
	} else if (accessTokenString === "access_token_mock_test_scope") {
		return {scope: "test_scope"};
	} else if (accessTokenString === "id_token_mock_test_scope") {
		return {scope: "test_scope"};
	} else {
		return {scope: "appid_default"};
	}
}

function decodeAndValidate(accessTokenString) {
    var deferred = Q.defer();
    if (accessTokenString === "invalid_token") {
        deferred.resolve();
    } else if (accessTokenString === "bad_scope") {
        deferred.resolve({scope: "bad_scope"});
    } else if (accessTokenString === "null_scope") {
         deferred.resolve(null);
    } else if (accessTokenString === "access_token_mock_test_scope") {
         deferred.resolve({scope: "test_scope"});
    } else if (accessTokenString === "id_token_mock_test_scope") {
         deferred.resolve({scope: "test_scope"});
    } else {
         deferred.resolve({scope: "appid_default"});
    }
    return deferred.promise;
}

function validateToken(token, serviceConfig) {
	return true;
}