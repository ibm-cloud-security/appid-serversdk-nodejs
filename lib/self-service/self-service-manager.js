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
const SIGN_UP_RESULT = "sign up result";
const FORGOT_PASSWORD_RESULT = "forgot password result";
const CHANGE_USER_PASSWORD = "change user password";
const GET_USER_DETAILS = "get user details";
const UPDATE_USER_DETAILS = "update user details";
const POST = "POST";
const PUT = "PUT";
const GET = "GET";
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
const MGMT_RESEND_PATH = "/cloud_directory/resend/";
const MGMT_USERS_PATH = "/cloud_directory/Users/";
const MGMT_SIGN_UP_RESULT_PATH = "/cloud_directory/sign_up/confirmation_result";
const MGMT_FORGOT_PASSWORD_RESULT_PATH = "/cloud_directory/forgot_password/confirmation_result";
const MGMT_CHANGE_PASSWORD_PATH = "/cloud_directory/change_password";
const PRODUCTION_IAM_TOKEN_URL = "https://iam.bluemix.net/oidc/token";
const STAGE1_IAM_TOKEN_URL = "https://iam.stage1.ng.bluemix.net/oidc/token";
const GENERAL_ERROR = "general_error";

function SelfServiceManager() {
}

/**
 * The init function, options can include: iamApiKey, tenantId, oauthServerUrl and managementUrl.
 * if iamApiKey specify it will be use to get iam tokens before every request.
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
	
	let tenantId = options[TENANT_ID] || vcapServiceCredentials[TENANT_ID];
	this.tenantId = tenantId;
	
	if (!this.managementUrl) {
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
	if (this.managementUrl.indexOf('.stage1') > -1 || this.managementUrl.indexOf('localhost:8080') > -1) {
		this.iamTokenUrl = STAGE1_IAM_TOKEN_URL;
	}
	logger.info(IAM_TOKEN_URL, this.iamTokenUrl);
	logger.info(MGMT_URL, this.managementUrl);
};

/**
 * Start the sign up process, creates a Cloud Directory user.
 * @param {JSON} userData can be object or json and must include at least one email address and 'password' attribute (as defined in the specification).
 * @param {string} language, the user language code.
 * @param {string=} iamToken, optional, if passed request to the server will use this token.
 * @return {JSON} The created user SCIM.
 */
SelfServiceManager.prototype.signUp = function (userData, language, iamToken) {
	const deferred = Q.defer();
	let url = this.managementUrl + MGMT_SIGN_UP_PATH;
	_getIAMToken(iamToken, this.iamApiKey, this.iamTokenUrl).then(function (iamToken) {
		handleRequest(iamToken, POST, url, userData, {language}, SIGN_UP, deferred);
	}).catch(deferred.reject);
	
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
	_getIAMToken(iamToken, this.iamApiKey, this.iamTokenUrl).then(function (iamToken) {
		handleRequest(iamToken, POST, url, {email: email}, {language: language}, FORGOT_PASSWORD, deferred);
	}).catch(deferred.reject);
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
	let url = this.managementUrl + MGMT_RESEND_PATH + templateName;
	_getIAMToken(iamToken, this.iamApiKey, this.iamTokenUrl).then(function (iamToken) {
		handleRequest(iamToken, POST, url, {uuid: uuid} , {language: language}, RESEND_NOTIFICATION, deferred);
	}).catch(deferred.reject);
	return deferred.promise;
};

/**
 * gets the stored result for the sign up confirmation.
 * @param {string} context, the context to use to get the stored result for sign up confirmation.
 * @param {string=} iamToken, optional, if passed request to the server will use this token.
 * @return 200 with the json result, if context is valid, else reject with the error.
 */
SelfServiceManager.prototype.getSignUpConfirmationResult = function (context, iamToken) {
	const deferred = Q.defer();
	let url = this.managementUrl + MGMT_SIGN_UP_RESULT_PATH;
	_getIAMToken(iamToken, this.iamApiKey, this.iamTokenUrl).then(function (iamToken) {
		handleRequest(iamToken, POST, url, {context: context} , {}, SIGN_UP_RESULT, deferred);
	}).catch(deferred.reject);
	return deferred.promise;
};

/**
 * gets the stored result for the forgot password confirmation.
 * @param {string} context, the context to use to get the stored result for forgot password confirmation.
 * @param {string=} iamToken, optional, if passed request to the server will use this token.
 * @return 200 with the json result, if context is valid, else reject with the error.
 */
SelfServiceManager.prototype.getForgotPasswordConfirmationResult = function (context, iamToken) {
	const deferred = Q.defer();
	let url = this.managementUrl + MGMT_FORGOT_PASSWORD_RESULT_PATH;
	_getIAMToken(iamToken, this.iamApiKey, this.iamTokenUrl).then(function (iamToken) {
		handleRequest(iamToken, POST, url, {context: context} , {}, FORGOT_PASSWORD_RESULT, deferred);
	}).catch(deferred.reject);
	return deferred.promise;
};

/**
 * gets the stored result for the reset password
 * @param {string} uuid, the context to use to get the forgot password stored result.
 * @param {string} newPassword, the new password to set.
 * @param {string} [changedIpAddress=undefined], the ip address that performed the password change request.
 * @param {string=} iamToken, optional, if passed request to the server will use this token.
 * @return 200 with the json result, if context is valid, else reject with the error.
 */
SelfServiceManager.prototype.setUserNewPassword = function (uuid, newPassword, changedIpAddress=undefined, iamToken) {
	const deferred = Q.defer();
	let url = this.managementUrl + MGMT_CHANGE_PASSWORD_PATH;
	_getIAMToken(iamToken, this.iamApiKey, this.iamTokenUrl).then(function (iamToken) {
		let replacePasswordBody =  {
			uuid: uuid,
			newPassword: newPassword,
		};
		if (changedIpAddress) {
			replacePasswordBody.changedIpAddress = changedIpAddress;
		}
		handleRequest(iamToken, POST, url, replacePasswordBody , {}, CHANGE_USER_PASSWORD, deferred);
	}).catch(deferred.reject);
	return deferred.promise;
};

/**
 * @param {string} uuid, the Cloud Directory unique Id.
 * @param {string=} iamToken, optional, if passed request to the server will use this token.
 * @return {JSON} The user SCIM profile.
 */
SelfServiceManager.prototype.getUserDetails = function (uuid, iamToken) {
	const deferred = Q.defer();
	let url = this.managementUrl + MGMT_USERS_PATH + uuid;
	_getIAMToken(iamToken, this.iamApiKey, this.iamTokenUrl).then(function (iamToken) {
		handleRequest(iamToken, GET, url, {} , {}, GET_USER_DETAILS, deferred);
	}).catch(deferred.reject);
	return deferred.promise;
};

/**
 * @param {string} uuid, the Cloud Directory unique Id.
 * @param {JSON} userData, the updated data.
 * @param {string=} iamToken, optional, if passed request to the server will use this token.
 * @return {JSON} The user SCIM profile.
 */
SelfServiceManager.prototype.updateUserDetails = function (uuid, userData, iamToken) {
	const deferred = Q.defer();
	let url = this.managementUrl + MGMT_USERS_PATH + uuid;
	_getIAMToken(iamToken, this.iamApiKey, this.iamTokenUrl).then(function (iamToken) {
		handleRequest(iamToken, PUT, url, userData, {}, UPDATE_USER_DETAILS, deferred);
	}).catch(deferred.reject);
	return deferred.promise;
};

function handleRequest(iamToken, method, url, body, querys ,action, deferred) {
	let reqOptions = {
		url: url,
		method: method,
		qs: querys,
		json: true,
		headers: {
			"Authorization": "Bearer " + iamToken
		}
	};
	if (method !== GET) {
		reqOptions.json = body;
	}
	request(reqOptions, function (err, response, body) {
		if(!err && response.statusCode >= 200 && response.statusCode < 300) {
			logger.debug('request ' + action + ' success');
			logger.debug('response body: ' + JSON.stringify(body));
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
				if (body && body.scimType) {
					error.code = body.scimType;
				}
				error.message = body && (body.detail || body.message || body.error) || body;
			}
			deferred.reject(error);
		}
	});
}

function _getIAMToken(iamToken, iamApiKey, iamTokenUrl) {
	if (iamToken && _.isString(iamToken)) {
		return Promise.resolve(iamToken);
	}
	if (!iamApiKey) {
		return Promise.reject('You must pass "iamToken" to self-service-manager APIs or specify "iamApiKey" in selfServiceManager init options.');
	}
	var reqOptions = {
		url:  iamTokenUrl,
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
				logger.error('Obtained IAM token failure: ' + error.message);
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
