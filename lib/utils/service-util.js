/*
 Copyright 2017 IBM Corp.
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

const log4js = require("log4js");
let logger;
const {
	VCAP_SERVICES,
	VCAP_SERVICES_CREDENTIALS,
	VCAP_SERVICES_SERVICE_NAME1,
	VCAP_SERVICES_SERVICE_NAME2,
	VCAP_APPLICATION,
	CLIENT_ID,
	TENANT_ID,
	SECRET,
	OAUTH_SERVER_URL,
	REDIRECT_URI,
	PREFERRED_LOCALE
} = require('./constants');

const checkParams = (configName, requiredParams, config) => requiredParams
	.map((param) => {
		if (!config[param]) {
			throw Error(`Failed to initialize ${configName}. Missing ${param} parameter.`);
		} else if (param === SECRET) {
			logger.info(param, '[CANNOT LOG SECRET]');
		} else {
			logger.info(param, config[param]);
		}
		return config[param];
	})
	.every((x) => x);

function loadConfig(configName, requiredParams, options) {
	logger = log4js.getLogger(`appid-${configName}-config`);
	logger.debug(`Initializing ${configName} config`);
	options = options || {};
	const vcapServices = JSON.parse(process.env[VCAP_SERVICES] || "{}");
	let vcapServiceCredentials = {};

	for (let propName in vcapServices) {
		// Checks if string starts with the service name
		if (propName.indexOf(VCAP_SERVICES_SERVICE_NAME1) === 0|| propName.indexOf(VCAP_SERVICES_SERVICE_NAME2) === 0) {
			vcapServiceCredentials = vcapServices[propName][0][VCAP_SERVICES_CREDENTIALS];
			break;
		}
	}

	let serviceConfig = {};
	serviceConfig[TENANT_ID] = options[TENANT_ID] || vcapServiceCredentials[TENANT_ID];
	serviceConfig[CLIENT_ID] = options[CLIENT_ID] || vcapServiceCredentials[CLIENT_ID];
	serviceConfig[SECRET] = options[SECRET] || vcapServiceCredentials[SECRET];
	serviceConfig[OAUTH_SERVER_URL] = options[OAUTH_SERVER_URL] || vcapServiceCredentials[OAUTH_SERVER_URL];
	serviceConfig[REDIRECT_URI] = options[REDIRECT_URI] || process.env[REDIRECT_URI];
	serviceConfig[PREFERRED_LOCALE] = options[PREFERRED_LOCALE];

	if (!serviceConfig[REDIRECT_URI]) {
		let vcapApplication = process.env[VCAP_APPLICATION];
		if (vcapApplication) {
			vcapApplication = JSON.parse(vcapApplication);
			serviceConfig[REDIRECT_URI] = "https://" + vcapApplication["application_uris"][0] + "/ibm/bluemix/appid/callback";
		}
	}

	if (!checkParams(configName, requiredParams, serviceConfig)) {
		logger.error(`Failed to initialize ${configName}. Check error logs for more details. All requests to protected endpoints will be rejected`);
		logger.error(`Ensure your node.js app is either bound to an App ID service instance or pass required parameters in the ${configName} constructor`);
	}

	if(serviceConfig[PREFERRED_LOCALE]) {
		logger.info(PREFERRED_LOCALE, serviceConfig[PREFERRED_LOCALE]);
	}

	const getConfig = () => serviceConfig;
	const getTenantId = () => serviceConfig[TENANT_ID];
	const getClientId = () => serviceConfig[CLIENT_ID];
	const getSecret = () => serviceConfig[SECRET];
	const getOAuthServerUrl = () => serviceConfig[OAUTH_SERVER_URL];
	const getRedirectUri = () => serviceConfig[REDIRECT_URI];
	const getPreferredLocale = () => serviceConfig[PREFERRED_LOCALE];

	return {
		getConfig,
		getTenantId,
		getClientId,
		getSecret,
		getOAuthServerUrl,
		getRedirectUri,
		getPreferredLocale
	};
}

module.exports = {loadConfig};