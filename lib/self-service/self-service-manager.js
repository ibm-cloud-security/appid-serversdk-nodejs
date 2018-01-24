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
const request = require("request");
const Q = require("q");
const _ = require("underscore");
const logger = log4js.getLogger("self-service-manager");

const VCAP_SERVICES = "VCAP_SERVICES";
const VCAP_SERVICES_CREDENTIALS = "credentials";
const VCAP_SERVICES_SERVICE_NAME1 = "AdvancedMobileAccess";
const VCAP_SERVICES_SERVICE_NAME2 = "AppID";

const SIGN_UP = "sign up";
const FORGOT_PASSWORD = "forgot password";
const RESEND_NOTIFICATION = "resend notification";
const POST = "POST";
const TENANT_ID = "tenantId";
const MGMT_URL = "managementUrl";
const OAUTH_SERVER_URL = "oauthServerUrl";
const IAM_TOKEN_URL = "iamTokenUrl";

const OAUTH_V3 = "/oauth/v3";
const APPID_AUTH = "appid-oauth";
const APPID_MGMT = "appid-management";
const MGMT_V4 = "/management/v4/";

const MGMT_SIGN_UP_PATH = "/cloud_directory/sign_up";
const MGMT_FORGOT_PASSWORD_PATH = "/cloud_directory/forgot_password";
const MGMT_RESEND_NOTIFICATION_PATH = "/cloud_directory/resend_notification";

const PRODUCTION_IAM_TOKEN_URL = "https://iam.ng.bluemix.net/oidc/token";
const STAGE1_IAM_TOKEN_URL = "https://iam.stage1.ng.bluemix.net/oidc/token";

const PASSWORDS_MISMATCH = "passwords_mismatch";
const GENERAL_ERROR = "general_error";

function SelfServiceManager() {
}

/**
 * The init function, options can include: iamApiKey, tenantId, oauthServerUrl and managementUrl.
 * if iamApiKey specify it will be use to get iam tokens.
 * if tenantId or oauthServerUrl not specify it will be taken from the App ID service binding json.
 * if managementUrl not specify it will be taken from  the App ID service binding json if exist or construct using the oauthServerUrl.
 * @param options
 */
SelfServiceManager.prototype.init = function (options) {
	options = options || {};
	
	this.iamApiKey = options.iamApiKey;
	if(this.iamApiKey) {
		logger.info("using user IAM API key [NOT SHOWING]");
	}
	
	const vcapServices = JSON.parse(process.env[VCAP_SERVICES] || "{}");
	var vcapServiceCredentials = {};
	// Find App ID service config
	for (var propName in vcapServices) {
		// Does service name starts with VCAP_SERVICES_SERVICE_NAME
		if (propName.indexOf(VCAP_SERVICES_SERVICE_NAME1) === 0 || propName.indexOf(VCAP_SERVICES_SERVICE_NAME2) === 0) {
			vcapServiceCredentials = vcapServices[propName][0][VCAP_SERVICES_CREDENTIALS];
			break;
		}
	}
	
	this.managementUrl = options[MGMT_URL] || vcapServiceCredentials[MGMT_URL];
	
	if (!this.managementUrl) {
		let tenantId = options[TENANT_ID] || vcapServiceCredentials[TENANT_ID];
		if (!tenantId) {
			logger.error("Failed to initialize self-service-manager.");
			logger.error("Ensure your node.js app is either bound to an App ID service instance or pass required parameter to the constructor ");
		}
		let oauthServerUrl = options[OAUTH_SERVER_URL] || vcapServiceCredentials[OAUTH_SERVER_URL];
		if (!oauthServerUrl) {
			logger.error("Failed to initialize self-service-manager.");
			logger.error("Ensure your node.js app is either bound to an App ID service instance or pass required parameter to the constructor ");
		}
		logger.info(OAUTH_SERVER_URL, oauthServerUrl);
		
		let serverUrl = oauthServerUrl.split(OAUTH_V3)[0];
		let serverDomain = serverUrl.split(APPID_AUTH);
		if (serverDomain[1]) {
			this.managementUrl = serverDomain[0] + APPID_MGMT + serverDomain[1];
		} else {
			logger.error("Failed to initialize self-service-manager.");
			logger.error("Ensure your node.js app is either bound to an App ID service instance or pass required parameter to the constructor ");
		}
		this.managementUrl +=  MGMT_V4 + tenantId;
	}
	
	this.iamTokenUrl = PRODUCTION_IAM_TOKEN_URL;
	if (this.managementUrl.contains('.stage1')) {
		this.iamTokenUrl = STAGE1_IAM_TOKEN_URL;
	}
	logger.info(IAM_TOKEN_URL, this.iamTokenUrl);
	logger.info(MGMT_URL, this.managementUrl);
};

/**
 * Start the sign up process, creates a Cloud Directory user.
 * @param {JSON} userData can be object or json and must include at least one email address and 'password' attribute (as defined in the specification).
 * if userData have 'confirmed_password' property, there will be a check that the passed 'password' and the 'confirmed_password' are the same
 * @param {string} language, the user language code.
 * @param {string=} iamToken, optional, if passed request to the server will use this token.
 * @return {JSON} The created user SCIM.
 */
SelfServiceManager.prototype.signUp = function (userData, language, iamToken) {
	const deferred = Q.defer();
	if (userData.confirmed_password && userData.password !== userData.confirmed_password) {
		logger.debug('passwords mismatch');
		let error = new Error();
		error.code = PASSWORDS_MISMATCH;
		error.message = 'passwords are not the same';
		deferred.reject(error);
	} else {
		delete userData.confirmed_password;
		let url = this.managementUrl + MGMT_SIGN_UP_PATH;
		_getIAMToken(iamToken, this.iamApiKey).then(function (iamToken) {
			handleRequest(iamToken, POST, url, userData, {language}, SIGN_UP, deferred);
		}).catch(function (err) {
			deferred.reject(err);
		});
	}
	return deferred.promise;
};

/**
 * Starts the forgot password process.
 * @param {JSON} email, the email address of the Cloud Directory user to send the password reset to.
 * @param {string=} iamToken, optional, if passed request to the server will use this token.
 * @param {string} language, the user language code.
 * @return {JSON} The user SCIM profile.
 */
SelfServiceManager.prototype.forgotPassword = function (email, language, iamToken) {
	const deferred = Q.defer();
	let url = this.managementUrl + MGMT_FORGOT_PASSWORD_PATH;
	_getIAMToken(iamToken, this.iamApiKey).then(function (iamToken) {
		handleRequest(iamToken, POST, url, {email: email}, {language: language}, FORGOT_PASSWORD, deferred);
	}).catch(function (err) {
		deferred.reject(err);
	});
	
	return deferred.promise;
};

/**
 * @param {string} uuid, the Cloud Directory unique Id.
 * @param {string} templateName, the notification type
 * @param {string} language, the user language code.
 * @param {string=} iamToken, optional, if passed request to the server will use this token.
 * @return 202, if notification sent successfully, else reject with the error.
 */
SelfServiceManager.prototype.resendNotification = function (uuid, templateName, language, iamToken) {
	const deferred = Q.defer();
	let url = this.managementUrl + MGMT_RESEND_NOTIFICATION_PATH;
	_getIAMToken(iamToken, this.iamApiKey).then(function (iamToken) {
		handleRequest(iamToken, POST, url, {uuid: uuid, templateName: templateName} , {language: language}, RESEND_NOTIFICATION, deferred);
	});
	return deferred.promise;
};

function handleRequest(iamToken, method, url, body, querys ,action, deferred) {
	request({
		url: url,
		method: method,
		json: body,
		qs: querys,
		headers: {
			"Authorization": "Bearer " + iamToken
		}
	}, function (err, response, body) {
		if(!err && response.statusCode >= 200 && response.statusCode < 300) {
			logger.debug('request ' + action + ' success');
			logger.debug('response body: ' + body);
			deferred.resolve(body);
		} else {
			let error = new Error();
			if (err) {
				logger.error(err);
				error.code = GENERAL_ERROR;
				error.message = "Failed to " + action;
			} else {
				logger.debug('request ' + action + ' failure');
				error.statusCode = response && response.statusCode;
				error.code = body.scimType;
				error.message = body && (body.detail || body.message || body.error);
			}
			deferred.reject(error);
		}
	});
}

function _getIAMToken(iamToken, iamApiKey) {
	if (iamToken && _.isString(iamToken)) {
		return Promise.resolve(iamToken);
	}
	if (!iamApiKey) {
		return Promise.reject('You must pass "iamToken" to self-service-manager APIs or specify "iamApiKey" in selfServiceManager init options.');
	}
	var reqOptions = {
		url:  this.iamTokenUrl,
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Accept': 'application/json'
		},
		form : {
			'grant_type':'urn:ibm:params:oauth:grant-type:apikey',
			'apikey' : iamApiKey
		}
	};
	return new Promise(function(resolve, reject) {
		request(reqOptions, function (error, response, body) {
			if (error) {
				logger.error(JSON.stringify(error))
			} else {
				if (response.statusCode === 200) {
					var IAMAccessToken = JSON.parse(body)['access_token'];
					logger.debug('Obtained IAM token: ' + IAMAccessToken);
					resolve(IAMAccessToken);
				} else {
					logger.error('Obtained IAM token failure');
					logger.error('Got status code: ' + response.statusCode);
					logger.error(body);
					reject(body);
				}
			}
		});
	});
}

module.exports = new SelfServiceManager();
