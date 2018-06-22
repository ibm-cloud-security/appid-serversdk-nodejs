module.exports = function (options) {
	var stateParamter  = { anonymousLogin : false , state : "123456789" };
	var serviceConfig = options;
	function getConfig() {
		return serviceConfig;
	}
	
	function getTenantId() {
		return serviceConfig.tenantId;
	}
	
	function getClientId() {
		return serviceConfig.clientId;
	}
	
	function getSecret() {
		return serviceConfig.secret;
	}
	
	function getOAuthServerUrl() {
		return serviceConfig.oauthServerUrl;
	}
	
	function getRedirectUri() {
		return serviceConfig.redirectUri;
	}
	
	function getPreferredLocale(){
		return serviceConfig.preferredLocale;
	}
	
	function generateStateParameter(anonymousLogin) {
		stateParamter.anonymousLogin = anonymousLogin;
		return stateParamter;
	}
	
	function getStateParameter() {
		return stateParamter;
	}
	
	return { getConfig, getTenantId, getClientId, getSecret, getOAuthServerUrl,
		getRedirectUri, getPreferredLocale, generateStateParameter, getStateParameter
	};
};