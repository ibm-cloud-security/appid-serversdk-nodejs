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
const logger = log4js.getLogger("appid-token-manager");
const request = require('../utils/request-util');

const constants = require('../utils/constants');
const TokenUtil = require("../utils/token-util");
const ServiceUtil = require('../utils/service-util');


function TokenManager(options) {
	logger.debug("Initializing token manager");
	this.serviceConfig = new ServiceUtil.loadConfig('TokenManager', [
		constants.CLIENT_ID,
		constants.SECRET,
		constants.OAUTH_SERVER_URL
	], options);
}

TokenManager.prototype.getCustomIdentityTokens = function (jwsToken, scopes = []) {
	const clientId = this.serviceConfig.getClientId();
	const secret = this.serviceConfig.getSecret();
	const scope = scopes.join(' ');
	const tokenEndpoint = this.serviceConfig.getOAuthServerUrl() + constants.TOKEN_PATH;


	return getTokens(tokenEndpoint, clientId, secret, constants.CUSTOM_IDENTITY_GRANT_TYPE, scope, jwsToken)
		.then((tokenResponse) => {
			if (!tokenResponse) {
				logger.error('Unable to parse token response');
				throw Error('Unable to parse token response');
			}

			const accessToken = tokenResponse['access_token'];
			const identityToken = tokenResponse['id_token'];
			const tokenType = tokenResponse['token_type'];
			const expiresIn = tokenResponse['expires_in'];

			return Promise.all([
				validateToken('access', accessToken, this.serviceConfig),
				validateToken('identity', identityToken, this.serviceConfig)
			]).then(() => ({
				accessToken,
				identityToken,
				tokenType,
				expiresIn
			}));
		});
};

TokenManager.prototype.getApplicationIdentityToken = function () {

	const clientId = this.serviceConfig.getClientId();
	const secret = this.serviceConfig.getSecret();
	const tokenEndPoint = this.serviceConfig.getOAuthServerUrl() + constants.TOKEN_PATH;

	return getTokens(tokenEndPoint, clientId, secret, constants.APP_TO_APP_GRANT_TYPE)
		.then((tokenResponse) => {
			if (!tokenResponse) {
				logger.error('Unable to parse token response');
				throw Error('Unable to parse token response');
			}

			const accessToken = tokenResponse['access_token'];
			const tokenType = tokenResponse['token_type'];
			const expiresIn = tokenResponse['expires_in'];

			return validateToken('access', accessToken, this.serviceConfig)
				.then(() => ({
					accessToken,
					tokenType,
					expiresIn
				}));
		});
};

function getTokens(tokenEndpoint, clientId, secret, grant_type, scope, assertion) {
	return new Promise((resolve, reject) => {
		request({
			method: 'POST',
			url: tokenEndpoint,
			auth: {
				username: clientId,
				password: secret
			},
			form: {
				grant_type,
				scope,
				assertion
			}
		}, (error, response, body) => {
			if (error) {
				logger.error('Failed to obtain tokens. Error: ', error);
				reject(error);
			} else if (response.statusCode === 200) {
				resolve(body);
			} else {
				if (response.statusCode === 401 || response.statusCode === 403) {
					logger.error('Unauthorized. Error: ', body.error_description);
					reject(new Error('Unauthorized'));
				} else if (response.statusCode === 404) {
					logger.error('Not found');
					reject(new Error("Not found"));
				} else if (response.statusCode === 400) {
					logger.error('Failed to obtain tokens. Error: ', body.error_description);
					reject(new Error('Failed to obtain tokens'));
				} else {
					logger.error(body);
					reject(new Error("Unexpected error"));
				}
			}
		});
	});
}

function validateToken(tokenType, token, serviceConfig) {
	logger.debug(`Validating ${tokenType} token`);
	return TokenUtil.decodeAndValidate(token, serviceConfig.getOAuthServerUrl()).then((validatedToken) => {
		if (!validatedToken) {
			logger.error(`Invalid ${tokenType} token`);
			throw Error(`Invalid ${tokenType} token`);
		}

		return TokenUtil.validateIssAndAud(validatedToken, serviceConfig).catch(error => {
			logger.error(error);
			throw Error(`${tokenType} token has invalid claims`);
		});
	});
}

module.exports = TokenManager;