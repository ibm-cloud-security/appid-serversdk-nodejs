module.exports = {
	decodeAndValidate: decode,
	decode: decode
}

function decode(accessTokenString) {
	if (accessTokenString == "invalid_token") {
		return undefined;
	} else if (accessTokenString == "bad_scope") {
		return {scope: "bad_scope"};
	} else {
		return {scope: "appid_default"};
	}
}