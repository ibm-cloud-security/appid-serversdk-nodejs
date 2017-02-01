module.exports = {
	decodeAndValidate: function(accessTokenString){
		if (accessTokenString == "invalid_token"){
			return undefined;
		} else if (accessTokenString == "bad_scope") {
			return {scope: "weirdscope"};
		} else {
			return {scope: "appid_default"};
		}
	}
}