module.exports = function (options, callback){
	if (options.url.indexOf("FAIL-PUBLIC-KEY") != -1){
		setTimeout(function(){
			callback(new Error("STUBBED ERROR"), null, null);
		}, 200);
	} else if (options.url.indexOf("SUCCESS-PUBLIC-KEY") != -1){
		setTimeout(function(){
			callback(null, { statusCode: 200}, {"n":1, "e":2});
		}, 200);
	} else {
	}
};
