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
const constants = require("./constants");

function loadConfig(configName, requiredParams, options) {
	logger = log4js.getLogger(`appid-${configName}-config`);
	logger.debug(`Initializing ${configName} config`);
	options = options || {};
	const vcapServices = JSON.parse(process.env[constants.VCAP_SERVICES] || "{}");
	let vcapServiceCredentials = {};

	for (let propName in vcapServices) {
		// Checks if string starts with the service name
		if (propName.indexOf(constants.VCAP_SERVICES_SERVICE_NAME1) === 0 || propName.indexOf(constants.VCAP_SERVICES_SERVICE_NAME2) === 0) {
			vcapServiceCredentials = vcapServices[propName][0][constants.VCAP_SERVICES_CREDENTIALS];
			break;
		}
	}

	let serviceConfig = {};
	serviceConfig[constants.TENANT_ID] = options[constants.TENANT_ID] || vcapServiceCredentials[constants.TENANT_ID];
	serviceConfig[constants.CLIENT_ID] = options[constants.CLIENT_ID] || vcapServiceCredentials[constants.CLIENT_ID];
	serviceConfig[constants.SECRET] = options[constants.SECRET] || vcapServiceCredentials[constants.SECRET];
	serviceConfig[constants.OAUTH_SERVER_URL] = options[constants.OAUTH_SERVER_URL] || vcapServiceCredentials[constants.OAUTH_SERVER_URL];
	serviceConfig[constants.REDIRECT_URI] = options[constants.REDIRECT_URI] || process.env[constants.REDIRECT_URI];
	serviceConfig[constants.PREFERRED_LOCALE] = options[constants.PREFERRED_LOCALE];

	if (!serviceConfig[constants.REDIRECT_URI]) {
		let vcapApplication = process.env[constants.VCAP_APPLICATION];
		if (vcapApplication) {
			vcapApplication = JSON.parse(vcapApplication);
			serviceConfig[constants.REDIRECT_URI] = "https://" + vcapApplication["application_uris"][0] + "/ibm/bluemix/appid/callback";
		}
	}

	requiredParams.map((param) => {
			if (!serviceConfig[param]) {
				throw Error(`Failed to initialize ${configName}. Missing ${param} parameter.`);
			} else if (param === constants.SECRET) {
				logger.info(param, '[CANNOT LOG SECRET]');
			} else {
				logger.info(param, serviceConfig[param]);
			}
		});

	if(serviceConfig[constants.PREFERRED_LOCALE]) {
		logger.info(constants.PREFERRED_LOCALE, serviceConfig[constants.PREFERRED_LOCALE]);
	}

	const getConfig = () => serviceConfig;
	const getTenantId = () => serviceConfig[constants.TENANT_ID];
	const getClientId = () => serviceConfig[constants.CLIENT_ID];
	const getSecret = () => serviceConfig[constants.SECRET];
	const getOAuthServerUrl = () => serviceConfig[constants.OAUTH_SERVER_URL];
	const getRedirectUri = () => serviceConfig[constants.REDIRECT_URI];
	const getPreferredLocale = () => serviceConfig[constants.PREFERRED_LOCALE];

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
