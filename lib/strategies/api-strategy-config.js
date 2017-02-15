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
const logger = log4js.getLogger("appid-api-strategy-config");

const VCAP_SERVICES = "VCAP_SERVICES";
const VCAP_SERVICES_CREDENTIALS = "credentials";
const VCAP_SERVICES_SERVICE_NAME = "AdvancedMobileAccess";
const VCAP_APPLICATION = "VCAP_APPLICATION";
const TENANT_ID = "tenantId";
const SERVER_URL = "serverUrl";

module.exports = function (options) {
	logger.debug("Initializing");
	options = options || {};
	const vcapServices = JSON.parse(process.env[VCAP_SERVICES] || "{}");
	var vcapServiceCredentials = {};
	var serviceConfig = {};

	// Find AppID service config
	for (var propName in vcapServices) {
		// Does service name starts with VCAP_SERVICES_SERVICE_NAME
		if (propName.indexOf(VCAP_SERVICES_SERVICE_NAME) === 0) {
			vcapServiceCredentials = vcapServices[propName][0][VCAP_SERVICES_CREDENTIALS];
			break;
		}
	}

	serviceConfig[TENANT_ID] = options[TENANT_ID] || vcapServiceCredentials[TENANT_ID];
	serviceConfig[SERVER_URL] = options[SERVER_URL] || vcapServiceCredentials[SERVER_URL];

	if (!serviceConfig[TENANT_ID] || !serviceConfig[SERVER_URL]) {
		logger.error("Failed to initialize api-strategy. All requests to protected endpoints will be rejected");
		logger.error("Ensure your node.js app is either bound to an AppID service instance or pass required parameters in the strategy constructor ");
	}

	logger.info(TENANT_ID, serviceConfig[TENANT_ID]);
	logger.info(SERVER_URL, serviceConfig[SERVER_URL]);

	function getConfig() {
		return serviceConfig;
	}

	function getTenantId(){
		return serviceConfig[TENANT_ID];
	}

	function getServerUrl(){
		return serviceConfig[SERVER_URL];
	}

	return {
		getConfig: getConfig,
		getTenantId: getTenantId,
		getServerUrl: getServerUrl
	}
};
