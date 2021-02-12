const previousAccessToken = "test.previousAccessToken.test";
const { parseJSON } = require('../../lib/utils/common-util');

module.exports = function (reqUrl, reqParameters) {
	const reqBody = parseJSON(reqParameters.body || '');
	if (reqBody && reqBody.grant_type === "refresh_token") {
		if (reqBody.refresh_token === "WORKING_REFRESH_TOKEN") {
			return { 
				statusCode: 200, 
				body: JSON.stringify({
					"access_token": "access_token_mock",
					"id_token": "id_token_mock",
					"refresh_token": "refresh_token_mock"
				})
			};
		}
		if (reqBody.refresh_token === "INVALID_REFRESH_TOKEN") {
			return { 
				statusCode: 401, 
				body: JSON.stringify({
					error: "invalid_grant",
					"error_description": "invalid grant"
				})
			};
		}
	}
	if (reqUrl.indexOf("generate_code") >= 0) {
		if (reqParameters.headers.Authorization.indexOf("error") >= 0) {
			return { 
				statusCode: 0, 
				error: new Error("STUBBED_ERROR")
			};
		}
		if (reqParameters.headers.Authorization.indexOf("statusNot200") >= 0) {
			return { 
				statusCode: 400, 
				body: null
			};
		}
		return { 
			statusCode: 200, 
			body: "1234"
		};
	}
	if (reqUrl.indexOf("FAIL-PUBLIC-KEY") >= 0 || reqUrl.indexOf("FAIL_REQUEST") >= 0) { // Used in public-key-util-test
		return { 
			statusCode: 0, 
			error: new Error("STUBBED_ERROR")
		};
	} else if (reqUrl.indexOf("SUCCESS-PUBLIC-KEY") !== -1) { // Used in public-key-util-test
		return { 
			statusCode: 200, 
			body: {"n": 1, "e": 2}
		};
	} else if (reqBody && reqBody.code && reqBody.code.indexOf("FAILING_CODE") !== -1) { // Used in webapp-strategy-test
		return { 
			statusCode: 0, 
			error: new Error("STUBBED_ERROR")
		};
	} else if (reqBody && reqBody.code && reqBody.code.indexOf("WORKING_CODE") !== -1) { // Used in webapp-strategy-test
		return { 
			statusCode: 200, 
			body: JSON.stringify({
				"access_token": "access_token_mock",
				"id_token": "id_token_mock",
				"refresh_token": "refresh_token_mock"
			})
		};
	} else if (reqParameters.followRedirect === false) {
		return { 
			statusCode: 302,
			headers: {
				location: "test-location?code=WORKING_CODE"
			}
		};
	} else if (reqBody && reqBody.code && reqBody.code.indexOf("NULL_ID_TOKEN") !== -1) {
		return { 
			statusCode: 200,
			body: JSON.stringify({
				"access_token": "access_token_mock",
				"id_token": "null_scope",
				"refresh_token": "refresh_token_mock"
			})
		};
	} else if (reqBody.username === "test_username" && reqBody.password === "bad_password") {
		return { 
			statusCode: 401,
			body: JSON.stringify({
				error: "invalid_grant",
				"error_description": "wrong credentials"
			})
		};
	} else if (reqBody.username === "request_error") {
		return { 
			statusCode: 0,
			error: new Error("REQUEST_ERROR")
		};
	} else if (reqBody.username === "parse_error") {
		return { 
			statusCode: 401,
			body: JSON.stringify({
				error: "invalid_grant",
				"error_description": "wrong credentials"
			}) + "dddddd"
		};
	} else if (reqBody.username === "test_username" && reqBody.password === "good_password") {
		if (reqBody.scope) {
			return { 
				statusCode: 200,
				body: JSON.stringify({
					"access_token": "access_token_mock_test_scope",
					"id_token": "id_token_mock_test_scope",
					"refresh_token": "refrehs_token_test_scope"
				})
			};
		}
		if (reqBody.appid_access_token) {
			if (reqBody.appid_access_token === previousAccessToken) {
				return { 
					statusCode: 200,
					body: JSON.stringify({
						"access_token": "access_token_mock",
						"id_token": "id_token_mock",
						"previousAccessToken": previousAccessToken,
						"refresh_token": "refresh_token_mock"
					})
				};
			}
			return { 
				statusCode: 400,
				body: {}
			};
		}
		return { 
			statusCode: 200,
			body: JSON.stringify({
				"access_token": "access_token_mock",
				"id_token": "id_token_mock",
				"refresh_token": "refresh_token_mock"
			})
		};
	}

	throw "Unhandled case!!!" + JSON.stringify(options);
};