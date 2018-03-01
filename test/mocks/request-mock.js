const previousAccessToken = "test.previousAccessToken.test";

module.exports = function (options, callback) {
	if (options.formData && options.formData.grant_type === "refresh_token") {
		if (options.formData.refresh_token === "WORKING_REFRESH_TOKEN") {
			return callback(null, {statusCode: 200}, JSON.stringify({
				"access_token": "access_token_mock",
				"id_token": "id_token_mock",
				"refresh_token": "refresh_token_mock"
			}));
		}
		if (options.formData.refresh_token === "INVALID_REFRESH_TOKEN") {
			return callback(null, {statusCode: 401}, JSON.stringify({
				error: "invalid_grant",
				"error_description": "invalid grant"
			}));
		}
	}
	if (options.url.indexOf("generate_code") >= 0) {
		if (options.auth.bearer.indexOf("error") >= 0) {
			return callback(new Error("STUBBED_ERROR"), {statusCode: 0}, null);
		}
		if (options.auth.bearer.indexOf("statusNot200") >= 0) {
			return callback(null, {statusCode: 400}, null);
		}
		return callback(null, {statusCode: 200}, "1234");
	}
	if (options.url.indexOf("FAIL-PUBLIC-KEY") >= 0 || options.url.indexOf("FAIL_REQUEST") >= 0) { // Used in public-key-util-test
		return callback(new Error("STUBBED_ERROR"), {statusCode: 0}, null);
	} else if (options.url.indexOf("SUCCESS-PUBLIC-KEY") !== -1) { // Used in public-key-util-test
		return callback(null, {statusCode: 200}, {"n": 1, "e": 2});
	} else if (options.formData && options.formData.code && options.formData.code.indexOf("FAILING_CODE") !== -1) { // Used in webapp-strategy-test
		return callback(new Error("STUBBED_ERROR"), {statusCode: 0}, null);
	} else if (options.formData && options.formData.code && options.formData.code.indexOf("WORKING_CODE") !== -1) { // Used in webapp-strategy-test
		return callback(null, {statusCode: 200}, JSON.stringify({
			"access_token": "access_token_mock",
			"id_token": "id_token_mock",
			"refresh_token": "refresh_token_mock"
		}));
	} else if (options.followRedirect === false) {
		return callback(null, {
			statusCode: 302,
			headers: {
				location: "test-location?code=WORKING_CODE"
			}
		});
	} else if (options.formData && options.formData.code && options.formData.code.indexOf("NULL_ID_TOKEN") !== -1) {
		return callback(null, {statusCode: 200}, JSON.stringify({
			"access_token": "access_token_mock",
			"id_token": "null_scope",
			"refresh_token": "refresh_token_mock"
		}));
	} else if (options.formData.username === "test_username" && options.formData.password === "bad_password") {
		return callback(null, {statusCode: 401}, JSON.stringify({
			error: "invalid_grant",
			"error_description": "wrong credentials"
		}));
	} else if (options.formData.username === "request_error") {
		return callback(new Error("REQUEST_ERROR"), {statusCode: 0}, null);
	} else if (options.formData.username === "parse_error") {
		return callback(null, {statusCode: 401}, JSON.stringify({
			error: "invalid_grant",
			"error_description": "wrong credentials"
		}) + "dddddd");
	} else if (options.formData.username === "test_username" && options.formData.password === "good_password") {
		if (options.formData.scope) {
			return callback(null, {statusCode: 200}, JSON.stringify({
				"access_token": "access_token_mock_test_scope",
				"id_token": "id_token_mock_test_scope",
				"refresh_token": "refrehs_token_test_scope"
			}));
		}
		if (options.formData.appid_access_token) {
			if (options.formData.appid_access_token === previousAccessToken) {
				return callback(null, {statusCode: 200}, JSON.stringify({
					"access_token": "access_token_mock",
					"id_token": "id_token_mock",
					"previousAccessToken": previousAccessToken,
					"refresh_token": "refresh_token_mock"
				}));
			}
			return callback(null, {statusCode: 400}, {});
		}
		return callback(null, {statusCode: 200}, JSON.stringify({
			"access_token": "access_token_mock",
			"id_token": "id_token_mock",
			"refresh_token": "refresh_token_mock"
		}));
	}

	throw "Unhandled case!!!" + JSON.stringify(options);
};