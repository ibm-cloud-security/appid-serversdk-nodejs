module.exports = function (options, callback){
	if (options.url.indexOf("FAIL-PUBLIC-KEY") !== -1){ // Used in public-key-util-test
		// console.log("request-mock", "failed /publickey");
		setTimeout(function(){
			callback(new Error("STUBBED_ERROR"), {statusCode: 0}, null);
		}, 200);
	} else if (options.url.indexOf("SUCCESS-PUBLIC-KEY") !== -1){ // Used in public-key-util-test
		// console.log("request-mock", "successful /publickey");
		setTimeout(function(){
			callback(null, { statusCode: 200}, {"n":1, "e":2});
		}, 200);
	} else if (options.formData && options.formData.code.indexOf("FAILING_CODE") !== -1){ // Used in webapp-strategy-test
		// console.log("request-mock", "failed /token");
		setTimeout(function(){
			callback(new Error("STUBBED_ERROR"), {statusCode: 0}, null);
		}, 200);
	} else if (options.formData && options.formData.code.indexOf("WORKING_CODE") !== -1){ // Used in webapp-strategy-test
		// console.log("request-mock", "successful /token");
		setTimeout(function () {
			callback(null, {statusCode: 200}, JSON.stringify({
				"access_token": "access_token_mock",
				"id_token": "id_token_mock"
			}));
		}, 200);
	} else {
		throw "Unhandled case!!!";
	}
};
