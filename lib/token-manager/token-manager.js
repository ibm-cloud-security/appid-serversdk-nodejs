const log4js = require("log4js");
const logger = log4js.getLogger("appid-token-manager");
const request = require("request");

const ServiceConfig = require("./token-manager-config");
const TokenUtil = require("../utils/token-util");
const PublicKeyUtil = require("../utils/public-key-util");

const TOKEN_PATH = '/token';
const CUSTOM_IDENTITY_GRANT_TYPE = 'urn ietf params oauth grant-type jwt-bearer';

function TokenManager(options) {
	logger.debug("Initializing token manager");
	this.serviceConfig = new ServiceConfig(options);
	PublicKeyUtil.setPublicKeysEndpoint(this.serviceConfig.getOAuthServerUrl());
}

TokenManager.prototype.getCustomIdentityTokens = async function (jwsToken, scopes=[]) {
	const clientId = this.serviceConfig.getClientId();
	const secret = this.serviceConfig.getSecret();
	const scope = scopes.join(' ') ;
	const tokenEndpoint = this.serviceConfig.getOAuthServerUrl() + TOKEN_PATH;


	const tokenResponse = await getTokens(tokenEndpoint, clientId, secret, CUSTOM_IDENTITY_GRANT_TYPE, scope, jwsToken);

	if (!tokenResponse) {
		logger.error('Unable to parse token response');
		throw Error('Unable to parse token response');
	}

	const accessToken = tokenResponse['access_token'];
	const identityToken = tokenResponse['id_token'];
	const tokenType = tokenResponse['token_type'];
	const expiresIn = tokenResponse['expires_in'];

	await validateToken('access', accessToken, this.serviceConfig);
	await validateToken('identity', identityToken, this.serviceConfig);

	return {
		accessToken,
		identityToken,
		tokenType,
		expiresIn
	}
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
				logger.error('Failed to obtain tokens: ', error);
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
					logger.error('Failed to obtain token. Error: ', body.error_description);
					reject(new Error('Failed to obtain tokens'));
				} else {
					logger.error(body);
					reject(new Error("Unexpected error"));
				}
			}
		});
	});
}

async function validateToken(tokenType, token, serviceConfig) {
	const validatedToken = await TokenUtil.decodeAndValidate(token, serviceConfig);
	if (!validatedToken) {
		logger.error(`Invalid ${tokenType} token`);
		throw Error(`Invalid ${tokenType} token`);
	}

	if (!TokenUtil.validateIssAndAud(validatedToken, serviceConfig)) {
		throw Error(`${tokenType} token has invalid claims`);
	}
}

module.exports = TokenManager;