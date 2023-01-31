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
"use strict";
const log4js = require("log4js");
const request = require('../utils/request-util');
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
const API_KEY = "apikey";
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
const PRODUCTION_IAM_TOKEN_URL = "https://iam.cloud.ibm.com/identity/token";
const GENERAL_ERROR = "general_error";

const initError = "Failed to initialize self-service-manager.";
const initErrorMsg = "Ensure your node.js app is either bound to an App ID service " +
	"instance or pass required parameter to the constructor";

/**
 * The constructor function, options can include: iamApiKey, tenantId, oauthServerUrl and managementUrl.
 * if iamApiKey, tenantId or oauthServerUrl not specify it will be taken from the App ID service binding json.
 * if iamToken is not passed to the SelfServiceManager APIs, the iamApiKey will be use to get iam tokens before every request.
 * if managementUrl not specify it will be taken from  the App ID service binding json if exist or construct using the oauthServerUrl.
 * @param {object} options - options for the constructor
 * @return {undefined}
 */
function SelfServiceManager(options = {}) {
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
	this.iamApiKey = options.iamApiKey || vcapServiceCredentials[API_KEY];
	if (this.iamApiKey) {
		logger.info("using user IAM API key [NOT SHOWING]");
	}
	this.managementUrl = options[MGMT_URL] || vcapServiceCredentials[MGMT_URL];
	let tenantId = options[TENANT_ID] || vcapServiceCredentials[TENANT_ID];
	this.tenantId = tenantId;

	if (!this.managementUrl) {
		if (!tenantId) {
			logger.error(initError);
			logger.error(initErrorMsg);
			throw new Error(initError);
		}
		let oauthServerUrl = options[OAUTH_SERVER_URL] || options['oAuthServerUrl'] || vcapServiceCredentials[OAUTH_SERVER_URL];
		if (!oauthServerUrl || oauthServerUrl.indexOf(OAUTH_V3) === -1) {
			logger.error(initError);
			logger.error(initErrorMsg);
			throw new Error(initError);
		}
		logger.info(OAUTH_SERVER_URL, oauthServerUrl);

		let serverUrl = oauthServerUrl.split(OAUTH_V3)[0];
		let serverDomain = serverUrl.split(APPID_AUTH);
		if (serverDomain[1]) {
			this.managementUrl = serverDomain[0] + APPID_MGMT + serverDomain[1];
		} else {
			logger.error(initError);
			logger.error(initErrorMsg);
			throw new Error(initError);
		}
		this.managementUrl += MGMT_V4 + tenantId;
	}

	this.iamTokenUrl = options[IAM_TOKEN_URL] || PRODUCTION_IAM_TOKEN_URL;
	logger.info(IAM_TOKEN_URL, this.iamTokenUrl);
	logger.info(MGMT_URL, this.managementUrl);
}

/**
 * Start the sign up process, creates a Cloud Directory user.
 * @param {Object} userData can be object or json and must include at least one email address and 'password' attribute (as defined in the specification).
 * @param {string} [language='en'] the user language code.
 * @param {string=} iamToken, optional, if passed request to the server will use this token.
 * @return {Object} The created user SCIM.
 */
SelfServiceManager.prototype.signUp = function (userData, language = 'en', iamToken) {
	const deferred = Q.defer();
	let url = this.managementUrl + MGMT_SIGN_UP_PATH;
	_getIAMToken(iamToken, this.iamApiKey, this.iamTokenUrl).then(function (token) {
		_handleRequest(token, POST, url, userData, {
			language
		}, SIGN_UP, deferred);
	}).catch(deferred.reject);
	return deferred.promise;
};

/**
 * Starts the forgot password process.
 * @param {string} email, the email address of the Cloud Directory user to send the password reset to.
 * @param {string=} iamToken, optional, if passed request to the server will use this token.
 * @param {string} [language='en'] the user language code.
 * @return {Object} The user SCIM profile.
 */
SelfServiceManager.prototype.forgotPassword = function (email, language = 'en', iamToken) {
	const deferred = Q.defer();
	let url = this.managementUrl + MGMT_FORGOT_PASSWORD_PATH;
	_getIAMToken(iamToken, this.iamApiKey, this.iamTokenUrl).then(function (token) {
		_handleRequest(token, POST, url, {
			email: email
		}, {
			language: language
		}, FORGOT_PASSWORD, deferred);
	}).catch(deferred.reject);
	return deferred.promise;
};

/**
 * @param {string} uuid, the Cloud Directory unique Id.
 * @param {string} templateName, the notification type
 * @param {string} [language='en'] the user language code.
 * @param {string=} iamToken, optional, if passed request to the server will use this token.
 * @return resolve if notification sent successfully, else reject with the error.
 */
SelfServiceManager.prototype.resendNotification = function (uuid, templateName, language = 'en', iamToken) {
	const deferred = Q.defer();
	let url = this.managementUrl + MGMT_RESEND_PATH + templateName;
	_getIAMToken(iamToken, this.iamApiKey, this.iamTokenUrl).then(function (token) {
		_handleRequest(token, POST, url, {
			uuid: uuid
		}, {
			language: language
		}, RESEND_NOTIFICATION, deferred);
	}).catch(deferred.reject);
	return deferred.promise;
};

/**
 * gets the stored result for the sign up confirmation.
 * @param {string} context, the context to use to get the stored result for sign up confirmation.
 * @param {string=} iamToken, optional, if passed request to the server will use this token.
 * @return resolve with the json result, if context is valid, else reject with the error.
 */
SelfServiceManager.prototype.getSignUpConfirmationResult = function (context, iamToken) {
	const deferred = Q.defer();
	let url = this.managementUrl + MGMT_SIGN_UP_RESULT_PATH;
	_getIAMToken(iamToken, this.iamApiKey, this.iamTokenUrl).then(function (token) {
		_handleRequest(token, POST, url, {
			context: context
		}, {}, SIGN_UP_RESULT, deferred);
	}).catch(deferred.reject);
	return deferred.promise;
};

/**
 * gets the stored result for the forgot password confirmation.
 * @param {string} context, the context to use to get the stored result for forgot password confirmation.
 * @param {string=} iamToken, optional, if passed request to the server will use this token.
 * @return resolve with the json result, if context is valid, else reject with the error.
 */
SelfServiceManager.prototype.getForgotPasswordConfirmationResult = function (context, iamToken) {
	const deferred = Q.defer();
	let url = this.managementUrl + MGMT_FORGOT_PASSWORD_RESULT_PATH;
	_getIAMToken(iamToken, this.iamApiKey, this.iamTokenUrl).then(function (token) {
		_handleRequest(token, POST, url, {
			context: context
		}, {}, FORGOT_PASSWORD_RESULT, deferred);
	}).catch(deferred.reject);
	return deferred.promise;
};

/**
 * gets the stored result for the reset password
 * @param {string} uuid, the context to use to get the forgot password stored result.
 * @param {string} newPassword, the new password to set.
 * @param {string} [language='en'] the user language code.
 * @param {string} [changedIpAddress=null] the ip address that performed the password change request.
 * @param {string=} iamToken, optional, if passed request to the server will use this token.
 * @return {Object} The user SCIM profile.
 */

SelfServiceManager.prototype.setUserNewPassword = function (uuid, newPassword, language = 'en', changedIpAddress = null, iamToken) {
	const deferred = Q.defer();
	let url = this.managementUrl + MGMT_CHANGE_PASSWORD_PATH;
	_getIAMToken(iamToken, this.iamApiKey, this.iamTokenUrl).then(function (token) {
		let replacePasswordBody = {
			uuid: uuid,
			newPassword: newPassword
		};
		if (changedIpAddress) {
			replacePasswordBody.changedIpAddress = changedIpAddress;
		}
		_handleRequest(token, POST, url, replacePasswordBody, {
			language: language
		}, CHANGE_USER_PASSWORD, deferred);
	}).catch(deferred.reject);
	return deferred.promise;
};

/**
 * @param {string} uuid, the Cloud Directory unique Id.
 * @param {string=} iamToken, optional, if passed request to the server will use this token.
 * @return {Object} The user SCIM profile.
 */
SelfServiceManager.prototype.getUserDetails = function (uuid, iamToken) {
	const deferred = Q.defer();
	let url = this.managementUrl + MGMT_USERS_PATH + uuid;
	_getIAMToken(iamToken, this.iamApiKey, this.iamTokenUrl).then(function (token) {
		_handleRequest(token, GET, url, {}, {}, GET_USER_DETAILS, deferred);
	}).catch(deferred.reject);
	return deferred.promise;
};

/**
 * @param {string} uuid, the Cloud Directory unique Id.
 * @param {Object} userData, the updated data.
 * @param {string=} iamToken, optional, if passed request to the server will use this token.
 * @return {Object} The user SCIM profile.
 */
SelfServiceManager.prototype.updateUserDetails = function (uuid, userData, iamToken) {
	const deferred = Q.defer();
	let url = this.managementUrl + MGMT_USERS_PATH + uuid;
	_getIAMToken(iamToken, this.iamApiKey, this.iamTokenUrl).then(function (token) {
		_handleRequest(token, PUT, url, userData, {}, UPDATE_USER_DETAILS, deferred);
	}).catch(deferred.reject);
	return deferred.promise;
};

let _handleRequest = function (iamToken, method, url, body, queryObject, action, deferred) {
	let reqOptions = {
		url: url,
		method: method,
		qs: queryObject,
		json: true,
		headers: {
			"Authorization": "Bearer " + iamToken
		}
	};
	if (method !== GET) {
		reqOptions.json = body;
	}
	request(reqOptions, function (err, response, responseBody) {
		if (!err && response.statusCode >= 200 && response.statusCode < 300) {
			logger.debug("request " + action + " success");
			logger.debug("response body: " + JSON.stringify(responseBody));
			deferred.resolve(responseBody);
		} else {
			let error = new Error();
			if (err) {
				logger.error(err);
				error.code = GENERAL_ERROR;
				error.message = "Failed to " + action;
			} else {
				logger.debug("request " + action + " failure");
				error.statusCode = response && response.statusCode;
				if (responseBody && responseBody.scimType) {
					error.code = responseBody.scimType;
				}
				error.message = responseBody && (responseBody.detail || responseBody.message || responseBody.error) || ((!_.isString(responseBody)) ? JSON.stringify(responseBody) : responseBody);
			}
			deferred.reject(error);
		}
	});
};

let _getIAMToken = function (iamToken, iamApiKey, iamTokenUrl) {
	if (iamToken && _.isString(iamToken)) {
		return Promise.resolve(iamToken);
	}
	if (!iamApiKey) {
		return Promise.reject("You must pass 'iamToken' to self-service-manager APIs or specify 'iamApiKey' in selfServiceManager init options.");
	}
	var reqOptions = {
		url: iamTokenUrl,
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			"Accept": "application/json"
		},
		form: {
			"grant_type": "urn:ibm:params:oauth:grant-type:apikey",
			"apikey": iamApiKey
		}
	};
	return new Promise(function (resolve, reject) {
		request(reqOptions, function (error, response, body) {
			if (error) {
				logger.error("Obtained IAM token failure: " + error.message);
				reject(error.message);
			} else {
				if (response.statusCode === 200) {
					var IAMAccessToken = body["access_token"];
					logger.debug("Obtained IAM token: " + IAMAccessToken);
					resolve(IAMAccessToken);
				} else {
					logger.error("Obtained IAM token failure");
					logger.error("Got status code: " + response.statusCode);
					logger.error(body);
					reject(body);
				}
			}
		});
	});
};

module.exports = SelfServiceManager;