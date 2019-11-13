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


/**
/** serviceConfig
 @typedef {Object} ServiceConfig
 * @property {function():string} getConfig - returns the entire config
 * @property {function():string} getTenantId - returns the tenantId
 * @property {function():string} getSecret - returns the secret;
 * @property {function():string} getOAuthServerUrl - returns the server url
 * @property {function():string} getRedirectUri - returns the redirect uri
 * @property {function():string} getPreferredLocale - returns the preferred locale
 * @property {function():string} getIssuer - returns the issuer
 * @property {function():string} getUserProfile - returns the user profiles endpoint
 * @property {function(string)} setIssuer - sets the value of the issuer
 */

/**
 * loads a config
 * @param {string}configName the name of the config
 * @param {string[]}requiredParams an array for the required params
 * @param {object} options the options for the configuration
 * @return {ServiceConfig} the configration
 */
function loadConfig(configName, requiredParams, options={}) {
	logger = log4js.getLogger(`appid-${configName}-config`);
	logger.debug(`Initializing ${configName} config`);

	const vcapServices = JSON.parse(process.env[constants.VCAP_SERVICES] || "{}");
	let vcapServiceCredentials = {};
	const removeTrailingSlash = (url) => url && url.replace && url.replace(/\/$/, "");


	for (let propName in vcapServices) {
		// Checks if string starts with the service name
		if (propName.indexOf(constants.VCAP_SERVICES_SERVICE_NAME1) === 0 || propName.indexOf(constants.VCAP_SERVICES_SERVICE_NAME2) === 0) {
			vcapServiceCredentials = vcapServices[propName][0][constants.VCAP_SERVICES_CREDENTIALS];
			break;
		}
	}
	const findParam = (param) => options[param] || vcapServiceCredentials[param] || process.env[param];
	const serviceEndpoint = findParam(constants.APPID_SERVICE_ENDPOINT);
	const serviceVersion = findParam(constants.APPID_SERVICE_VERSION);
	const serviceTenantID = findParam(constants.APPID_TENANT_ID);
	let serviceConfig = {};
	if (serviceEndpoint) {
		if (!serviceVersion || !Number.isInteger(Number.parseInt(serviceVersion))) {
			throw new Error("Failed to initialize APIStrategy. Missing version parameter, should be an integer.");
		} else if (!serviceTenantID) {
			throw new Error("Failed to initialize APIStrategy. Missing tenantId parameter");
		} else {
			serviceConfig[constants.OAUTH_SERVER_URL] = `${removeTrailingSlash(serviceEndpoint)}/oauth/v${serviceVersion}/${
				serviceTenantID}`;
			serviceConfig[constants.USER_PROFILE_SERVER_URL] = removeTrailingSlash(serviceEndpoint);
		}

	} else {
		serviceConfig[constants.OAUTH_SERVER_URL] = findParam(constants.OAUTH_SERVER_URL);
		serviceConfig[constants.USER_PROFILE_SERVER_URL] = findParam(constants.USER_PROFILE_SERVER_URL);
		if (findParam('oAuthServerUrl')) {
		  serviceConfig[constants.OAUTH_SERVER_URL] = findParam('oAuthServerUrl');
		}
	}
	serviceConfig[constants.TENANT_ID] = serviceTenantID;
	serviceConfig[constants.CLIENT_ID] = findParam(constants.CLIENT_ID);
	serviceConfig[constants.SECRET] = findParam(constants.SECRET);

	serviceConfig[constants.REDIRECT_URI] = options[constants.REDIRECT_URI] || process.env[constants.REDIRECT_URI];
	serviceConfig[constants.PREFERRED_LOCALE] = options[constants.PREFERRED_LOCALE];
	serviceConfig[constants.APPID_ISSUER] = options[constants.APPID_ISSUER] || process.env[constants.APPID_ISSUER];
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

	if (serviceConfig[constants.PREFERRED_LOCALE]) {
		logger.info(constants.PREFERRED_LOCALE, serviceConfig[constants.PREFERRED_LOCALE]);
	}

	//getters
	const getConfig = () => serviceConfig;
	const getTenantId = () => serviceConfig[constants.TENANT_ID];
	const getClientId = () => serviceConfig[constants.CLIENT_ID];
	const getSecret = () => serviceConfig[constants.SECRET];
	const getOAuthServerUrl = () => removeTrailingSlash(serviceConfig[constants.OAUTH_SERVER_URL]);
	const getRedirectUri = () => serviceConfig[constants.REDIRECT_URI];
	const getPreferredLocale = () => serviceConfig[constants.PREFERRED_LOCALE];
	const getIssuer = () => serviceConfig[constants.APPID_ISSUER];
	const getUserProfile = () => serviceConfig[constants.USER_PROFILE_SERVER_URL];
	//setters
	const setIssuer = (value) => serviceConfig[constants.APPID_ISSUER] = value;


	return {
		getConfig,
		getTenantId,
		getClientId,
		getSecret,
		getOAuthServerUrl,
		getRedirectUri,
		getPreferredLocale,
		getIssuer,
		getUserProfile,
		setIssuer
	};
}

module.exports = {loadConfig};
