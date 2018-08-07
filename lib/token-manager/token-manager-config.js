const ServiceUtil = require('../utils/service-util');

module.exports = function (options) {
	const { getConfig, getTenantId, getClientId, getSecret, getOAuthServerUrl } = ServiceUtil.loadConfig('TokenManager', options);
	return { getConfig, getTenantId, getClientId, getSecret, getOAuthServerUrl };
};
