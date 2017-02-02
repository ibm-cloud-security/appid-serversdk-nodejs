const log4js = require('log4js');
const logger = log4js.getLogger("appid-webapp-strategy-config");

const VCAP_SERVICES = "VCAP_SERVICES";
const VCAP_SERVICES_CREDENTIALS = "credentials";
const VCAP_SERVICES_SERVICE_NAME = "AdvancedMobileAccess";
const VCAP_APPLICATION = "VCAP_APPLICATION";
const TENANT_ID = "tenantId";
const CLIENT_ID = "clientId";
const SECRET = "secret";
const AUTHORIZATION_ENDPOINT = "authorizationEndpoint";
const TOKEN_ENDPOINT = "tokenEndpoint";
const REDIRECT_URI = "redirectUri";

module.exports = function (options){
	logger.debug("Initializing");
	options = options ||{};
	const vcapServices = JSON.parse(process.env[VCAP_SERVICES] || "{}");
	var vcapServiceCredentials = {};
	var serviceConfig = {};

	// Find AppID service config
	for (var propName in vcapServices){
		// Does service name starts with AdvancedMobileAccess
		if (propName.indexOf(VCAP_SERVICES_SERVICE_NAME) == 0){
			vcapServiceCredentials = vcapServices[propName][0][VCAP_SERVICES_CREDENTIALS];
			break;
		}
	}

	var serviceConfig = {};
	serviceConfig[TENANT_ID] = options[TENANT_ID] || vcapServiceCredentials[TENANT_ID];
	serviceConfig[CLIENT_ID] = options[CLIENT_ID] || vcapServiceCredentials[CLIENT_ID];
	serviceConfig[SECRET] = options[SECRET] || vcapServiceCredentials[SECRET];
	serviceConfig[AUTHORIZATION_ENDPOINT] = options[AUTHORIZATION_ENDPOINT] || vcapServiceCredentials[AUTHORIZATION_ENDPOINT];
	serviceConfig[TOKEN_ENDPOINT] = options[TOKEN_ENDPOINT] || vcapServiceCredentials[TOKEN_ENDPOINT];
	serviceConfig[REDIRECT_URI] = options[REDIRECT_URI] || process.env[REDIRECT_URI];

	if (!serviceConfig[REDIRECT_URI]){
		var vcapApplication = process.env[VCAP_APPLICATION];
		if (vcapApplication){
			vcapApplication = JSON.parse(vcapApplication);
			serviceConfig[REDIRECT_URI] = "https://" + vcapApplication["application_uris"][0] + "/ibm/bluemix/appid/callback";
		}
	}

	if (!serviceConfig[CLIENT_ID]
		|| !serviceConfig[SECRET]
		|| !serviceConfig[AUTHORIZATION_ENDPOINT]
		|| !serviceConfig[TOKEN_ENDPOINT]
		|| !serviceConfig[TENANT_ID]
		|| !serviceConfig[REDIRECT_URI]){
		logger.error("Failed to initialize webapp-strategy. All requests to protected endpoints will be rejected");
		logger.error("Ensure your node.js app is either bound to an AppID service instance or pass required parameters in the strategy constructor ");
	}

	logger.info(TENANT_ID, serviceConfig[TENANT_ID]);
	logger.info(CLIENT_ID, serviceConfig[CLIENT_ID]);
	logger.info(SECRET, "[NOT SHOWING]");
	logger.info(AUTHORIZATION_ENDPOINT, serviceConfig[AUTHORIZATION_ENDPOINT]);
	logger.info(TOKEN_ENDPOINT, serviceConfig[TOKEN_ENDPOINT]);
	logger.info(REDIRECT_URI, serviceConfig[REDIRECT_URI]);

	function getConfig() {
		return serviceConfig;
	}

	function getTenantId(){
		return serviceConfig[TENANT_ID];
	}

	function getClientId(){
		return serviceConfig[CLIENT_ID];
	}

	function getSecret(){
		return serviceConfig[SECRET];
	}

	function getAuthorizationEndpoint(){
		return serviceConfig[AUTHORIZATION_ENDPOINT];
	}

	function getTokenEndpoint(){
		return serviceConfig[TOKEN_ENDPOINT];
	}

	function getRedirectUri(){
		return serviceConfig[REDIRECT_URI];
	}

	return {
		getConfig: getConfig,
		getTenantId: getTenantId,
		getClientId: getClientId,
		getSecret: getSecret,
		getAuthorizationEndpoint: getAuthorizationEndpoint,
		getTokenEndpoint: getTokenEndpoint,
		getRedirectUri: getRedirectUri
	}
}