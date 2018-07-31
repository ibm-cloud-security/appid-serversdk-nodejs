const log4js = require("log4js");
const logger = log4js.getLogger("appid-s2s-config");

const VCAP_SERVICES = "VCAP_SERVICES";
const VCAP_SERVICES_CREDENTIALS = "credentials";
const VCAP_SERVICES_SERVICE_NAME1 = "AdvancedMobileAccess";
const VCAP_SERVICES_SERVICE_NAME2 = "AppID";
const VCAP_APPLICATION = "VCAP_APPLICATION";
const TENANT_ID = "tenantId";
const CLIENT_ID = "clientId";
const SECRET = "secret";
const OAUTH_SERVER_URL = "oauthServerUrl";

module.exports = function (options) {
	logger.debug("Initializing token manager config");
	options = options || {};
	const vcapServices = JSON.parse(process.env[VCAP_SERVICES] || "{}");
	let vcapServiceCredentials = {};

	for (let propName in vcapServices) {
		if (propName === VCAP_SERVICES_SERVICE_NAME1 || propName === VCAP_SERVICES_SERVICE_NAME2) {
			vcapServiceCredentials = vcapServices[propName][0][VCAP_SERVICES_CREDENTIALS];
			break;
		}
	}

	let serviceConfig = {};
	serviceConfig[TENANT_ID] = options[TENANT_ID] || vcapServiceCredentials[TENANT_ID];
	serviceConfig[CLIENT_ID] = options[CLIENT_ID] || vcapServiceCredentials[CLIENT_ID];
	serviceConfig[SECRET] = options[SECRET] || vcapServiceCredentials[SECRET];
	serviceConfig[OAUTH_SERVER_URL] = options[OAUTH_SERVER_URL] || vcapServiceCredentials[OAUTH_SERVER_URL];

	if (!serviceConfig[CLIENT_ID] || !serviceConfig[TENANT_ID] || !serviceConfig[SECRET] || !serviceConfig[OAUTH_SERVER_URL]) {
		logger.error("Failed to initialize token manager. All requests to protected endpoints will be rejected");
		logger.error("Ensure your node.js app is either bound to an App ID service instance or pass required parameters in the token manager constructor ");
	}

	logger.info(TENANT_ID, serviceConfig[TENANT_ID]);
	logger.info(CLIENT_ID, serviceConfig[CLIENT_ID]);
	logger.info(SECRET, "[CANNOT LOG SECRET]");
	logger.info(OAUTH_SERVER_URL, serviceConfig[OAUTH_SERVER_URL]);

	const getConfig = () => serviceConfig;
	const getTenantId = () => serviceConfig[TENANT_ID];
	const getClientId = () => serviceConfig[CLIENT_ID];
	const getSecret = () => serviceConfig[SECRET];
	const getOAuthServerUrl = () => serviceConfig[OAUTH_SERVER_URL];

	return {
		getConfig,
		getTenantId,
		getClientId,
		getSecret,
		getOAuthServerUrl
	};
};