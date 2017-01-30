const log4js = require('log4js');
const logger = log4js.getLogger("service-config-utils");

const VCAP_SERVICES = "VCAP_SERVICES";
const VCAP_APPLICATION = "VCAP_APPLICATION";
const ADVANCED_MOBILE_ACCESS = "AdvancedMobileAccess";
const CLIENT_ID = "clientId";
const SECRET = "secret";
const AUTHORIZATION_ENDPOINT = "authorizationEndpoint";
const TOKEN_ENDPOINT = "tokenEndpoint";
const TENANT_ID = "tenantId";
const SERVER_URL = "serverUrl";
const REDIRECT_URI_HOST= "redirectUriHost";

var serviceConfig = (function (){

	var _serviceConfig;

	function init(options){
		logger.debug("Initializing");
		const vcapServices = JSON.parse(process.env[VCAP_SERVICES] || "{}");
		var vcapServiceCredentials = {};

		// Find AppID service config
		for (var propName in vcapServices){
			// Does service name starts with AdvancedMobileAccess
			if (propName.indexOf(ADVANCED_MOBILE_ACCESS) == 0){
				vcapServiceCredentials = vcapServices[propName][0]["credentials"];
			}
		}

		var serviceConfig = {};
		serviceConfig[CLIENT_ID] = options[CLIENT_ID] || vcapServiceCredentials[CLIENT_ID];
		serviceConfig[SECRET] = options[SECRET] || vcapServiceCredentials[SECRET];
		serviceConfig[AUTHORIZATION_ENDPOINT] = options[AUTHORIZATION_ENDPOINT] || vcapServiceCredentials[AUTHORIZATION_ENDPOINT];
		serviceConfig[TOKEN_ENDPOINT] = options[TOKEN_ENDPOINT] || vcapServiceCredentials[TOKEN_ENDPOINT];
		serviceConfig[TENANT_ID] = options[TENANT_ID] || vcapServiceCredentials[TENANT_ID];
		serviceConfig[SERVER_URL] = options[SERVER_URL] || vcapServiceCredentials[SERVER_URL];
		serviceConfig[REDIRECT_URI_HOST] = options[REDIRECT_URI_HOST];

		if (!serviceConfig[REDIRECT_URI_HOST]){
			const vcapApplication = process.env[VCAP_APPLICATION];
			if (vcapApplication){
				serviceConfig[REDIRECT_URI_HOST] = vcapApplication["application_uris"][0];
			}
		}

		if (!serviceConfig[CLIENT_ID]
			|| !serviceConfig[SECRET]
			|| !serviceConfig[AUTHORIZATION_ENDPOINT]
			|| !serviceConfig[TOKEN_ENDPOINT]
			|| !serviceConfig[TENANT_ID]
			|| !serviceConfig[SERVER_URL]
			|| !serviceConfig[REDIRECT_URI_HOST]){
			logger.error("Missing one or more of", CLIENT_ID, SECRET, AUTHORIZATION_ENDPOINT, TOKEN_ENDPOINT, TENANT_ID, SERVER_URL, REDIRECT_URI_HOST);
			logger.error("Failed to initialize AppID SDK. All requests to protected endpoints will be rejected");
			logger.error("Ensure your node.js app is either bound to an AppID service instance or pass required parameters in the .init() call. ");
		}

		logger.info(TENANT_ID, serviceConfig[TENANT_ID]);
		logger.info(CLIENT_ID, serviceConfig[CLIENT_ID]);
		logger.info(SERVER_URL, serviceConfig[SERVER_URL]);
		logger.info(AUTHORIZATION_ENDPOINT, serviceConfig[AUTHORIZATION_ENDPOINT]);
		logger.info(TOKEN_ENDPOINT, serviceConfig[TOKEN_ENDPOINT]);
		logger.info(REDIRECT_URI_HOST, serviceConfig[REDIRECT_URI_HOST]);
		_serviceConfig = serviceConfig;
		return getConfig();
	}

	function getConfig() {
		return _serviceConfig;
	}

	function getTenantId(){
		return _serviceConfig[TENANT_ID];
	}

	function getClientId(){
		return _serviceConfig[CLIENT_ID];
	}

	function getSecret(){
		return _serviceConfig[SECRET];
	}

	function getServerUrl(){
		return _serviceConfig[SERVER_URL];
	}

	function getAuthorizationEndpoint(){
		return _serviceConfig[AUTHORIZATION_ENDPOINT];
	}

	function getTokenEndpoint(){
		return _serviceConfig[TOKEN_ENDPOINT];
	}

	function getRedirectUriHost(){
		return _serviceConfig[REDIRECT_URI_HOST];
	}

	return {
		init: init,
		getConfig: getConfig,
		getTenantId: getTenantId,
		getClientId: getClientId,
		getSecret: getSecret,
		getServerUrl: getServerUrl,
		getAuthorizationEndpoint: getAuthorizationEndpoint,
		getTokenEndpoint: getTokenEndpoint,
		getRedirectUriHost: getRedirectUriHost
	}
}());

module.exports = serviceConfig;