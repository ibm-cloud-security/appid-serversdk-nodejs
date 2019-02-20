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
const request = require("request");
const events = require("events");
const Q = require("q");
const eventEmitter = new events.EventEmitter();

const constants = require('../utils/constants');
const TokenUtil = require("../utils/token-util");
const ServiceUtil = require('../utils/service-util');
const PublicKeyUtil = require("../utils/public-key-util");

function TokenManager(options) {
	logger.debug("Initializing token manager");
	ServiceUtil.loadConfig('TokenManager', [
		constants.CLIENT_ID,
		constants.SECRET
	], options)
		.then(result => {
			this.serviceConfig = result;
			this.serviceConfig.getOAuthServerUrl()
				.then(oauthServerUrl => {
					PublicKeyUtil.setPublicKeysEndpoint(oauthServerUrl);
                    eventEmitter.emit("TokenManagerServiceConfigLoaded");
				});
		});
}

TokenManager.prototype.getCustomIdentityTokens = function (jwsToken, scopes = []) {
	const self = this;
	const deferred = Q.defer();

    eventEmitter.once("TokenManagerServiceConfigLoaded", function() {
        const clientId = self.serviceConfig.getClientId();
        const secret = self.serviceConfig.getSecret();
        const scope = scopes.join(' ');

        return self.serviceConfig.getOAuthServerUrl()
            .then(oauthServerUrl => {
                const tokenEndpoint = oauthServerUrl + constants.TOKEN_PATH;

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
                            validateToken('access', accessToken, self.serviceConfig),
                            validateToken('identity', identityToken, self.serviceConfig)
                        ]).then(() => {
                            deferred.resolve({
                                accessToken,
                                identityToken,
                                tokenType,
                                expiresIn
                            });
                        });
                    });
            }).catch(error => {
                deferred.reject(error);
			});
    });
    return deferred.promise;
};

TokenManager.prototype.getApplicationIdentityToken = function () {
    const self = this;
    const deferred = Q.defer();

    eventEmitter.once("TokenManagerServiceConfigLoaded", function() {
		const clientId = self.serviceConfig.getClientId();
		const secret = self.serviceConfig.getSecret();

		self.serviceConfig.getOAuthServerUrl()
			.then(oauthServerUrl => {
				const tokenEndPoint = oauthServerUrl + constants.TOKEN_PATH;

				return getTokens(tokenEndPoint, clientId, secret, constants.APP_TO_APP_GRANT_TYPE)
					.then((tokenResponse) => {
						if (!tokenResponse) {
							logger.error('Unable to parse token response');
							throw Error('Unable to parse token response');
						}

						const accessToken = tokenResponse['access_token'];
						const tokenType = tokenResponse['token_type'];
						const expiresIn = tokenResponse['expires_in'];

						return validateToken('access', accessToken, self.serviceConfig)
							.then(() => {
                                deferred.resolve({
									accessToken,
									tokenType,
									expiresIn
								});
							});
					});
			}).catch(error => {
				deferred.reject(error);
			});
    });
    return deferred.promise;
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
				resolve(JSON.parse(body));
			} else {
				if (response.statusCode === 401 || response.statusCode === 403) {
					logger.error('Unauthorized. Error: ', JSON.parse(body).error_description);
					reject(new Error('Unauthorized'));
				} else if (response.statusCode === 404) {
					logger.error('Not found');
					reject(new Error("Not found"));
				} else if (response.statusCode === 400) {
					logger.error('Failed to obtain tokens. Error: ', JSON.parse(body).error_description);
					reject(new Error('Failed to obtain tokens'));
				} else {
					logger.error(JSON.parse(body));
					reject(new Error("Unexpected error"));
				}
			}
		});
	});
}

function validateToken(tokenType, token, serviceConfig) {
	logger.debug(`Validating ${tokenType} token`);
	return TokenUtil.decodeAndValidate(token).then((validatedToken) => {
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
