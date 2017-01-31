const log4js = require("log4js");
const request = require("request");
const TokenUtil = require("./../utils/token-util");
const ServiceConfig = require("./webapp-strategy-config");

const APPID_SUCCESS_REDIRECT = "APPID_SUCCESS_REDIRECT";
const APPID_FAILURE_REDIRECT = "APPID_FAILURE_REDIRECT";

const STRATEGY_NAME = "appid-webapp-strategy";

const logger = log4js.getLogger(STRATEGY_NAME);

function WebAppStrategy(options) {
	logger.debug("Initializing");
	options = options || {};
	this.name = WebAppStrategy.STRATEGY_NAME;
	this.serviceConfig = new ServiceConfig(options);
}

WebAppStrategy.STRATEGY_NAME = STRATEGY_NAME;
WebAppStrategy.DEFAULT_SCOPE = "appid_default";

// .success(user, info) - call on auth success. user=object, info=object
// .fail(challenge, status) - call on auth failure. challenge=string, status=int
// .redirect(url, status) - call on redirect required. url=url, status=int
// .pass() - skip strategy processing
// .error(err) - error during strategy processing. err=Error obj

WebAppStrategy.prototype.authenticate = function(req, options) {
	logger.debug("authenticate");
	options = options || {};

	// Handle possible errors returned in callback
	if (req.query && req.query.error){
		logger.warn("Error returned in callback ::", req.query.error);
		return this.fail();
	} else if (req.query && req.query.code){
		return handleCallback(req, options, this);
	} else {
		return handleAuthorize(req, options, this);
	}
};

function handleAuthorize(req, options, strategy){
	logger.debug("handleAuthorize");
	const serviceConfig = strategy.serviceConfig;
	const clientId = serviceConfig.getClientId();
	const scope = req.query.scope || WebAppStrategy.DEFAULT_SCOPE;
	const authorizationEndpoint = serviceConfig.getAuthorizationEndpoint();
	const redirectUri = serviceConfig.getRedirectUri();
	const authUrl = authorizationEndpoint +
		"?client_id=" + clientId +
		"&response_type=code" +
		"&redirect_uri=" + redirectUri +
		"&scope=" + scope;
	logger.debug("Redirecting to", authUrl);
	strategy.redirect(authUrl);
}

function handleCallback(req, options, strategy) {
	const code = req.query.code;
	const serviceConfig = strategy.serviceConfig;

	const clientId = serviceConfig.getClientId();
	const secret = serviceConfig.getSecret();
	const tokenEndpoint = serviceConfig.getTokenEndpoint();
	const redirectUri = serviceConfig.getRedirectUri();

	request({
		method: "POST",
		url: tokenEndpoint,
		auth: {
			username: clientId,
			password: secret
		},
		formData: {
			client_id: clientId,
			grant_type: "authorization_code",
			redirect_uri: redirectUri,
			code: code
		}
	}, function (err, response, body) {
		if (err || response.statusCode != 200){
			logger.error("Failed to obtain tokens ::", err, response.statusCode, body);
			strategy.fail();
		} else {
			logger.debug("Got tokens!");
			body = JSON.parse(body);
			const accessTokenString = body["access_token"];
			const identityTokenString = body["id_token"];

			req.appIdAuthorizationContext = {
				accessToken: accessTokenString,
				accessTokenPayload: TokenUtil.decode(accessTokenString),
			};

			if (identityTokenString) {
				req.appIdAuthorizationContext.identityToken = identityTokenString;
				req.appIdAuthorizationContext.identityTokenPayload = TokenUtil.decode(identityTokenString);
			}
			strategy.success(TokenUtil.decode(identityTokenString) || null);
		}
	});
}

module.exports = WebAppStrategy;