const log4js = require("log4js");
const request = require("request");
const TokenUtil = require("./../utils/token-util");
const ServiceConfig = require("./webapp-strategy-config");

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
WebAppStrategy.ORIGINAL_URL = "APPID_ORIGINAL_URL";
WebAppStrategy.AUTH_CONTEXT = "APPID_AUTH_CONTEXT";

WebAppStrategy.ensureAuthenticated = function(notAuthenticatedRedirect){
	return function(req, res, next){
		if (req.isAuthenticated()){
			next();
		} else {
			req.session[WebAppStrategy.ORIGINAL_URL] = req.url;
			res.redirect(notAuthenticatedRedirect || "/");
		}
	}
}

WebAppStrategy.logout = function(req){
	delete req.session[WebAppStrategy.ORIGINAL_URL];
	delete req.session[WebAppStrategy.AUTH_CONTEXT];
	req.logout();
}

// .success(user, info) - call on auth success. user=object, info=object
// .fail(challenge, status) - call on auth failure. challenge=string, status=int
// .redirect(url, status) - call on redirect required. url=url, status=int
// .pass() - skip strategy processing
// .error(err) - error during strategy processing. err=Error obj

WebAppStrategy.prototype.authenticate = function(req, options) {
	options = options || {};

	// Check that express-session is enabled
	if (!req.session){
		logger.error("Can't find req.session. Ensure express-session middleware is in use");
		return this.error(new Error("Can't find req.session"));
	}

	if (req.query && req.query.error){
		// Handle possible errors returned in callback
		logger.warn("Error returned in callback ::", req.query.error);
		return this.fail();
	} else if (req.query && req.query.code){
		// Handle grant code in callback
		return handleCallback(req, options, this);
	} else {
		// Handle authorization request
		return handleAuthorize(req, options, this);
	}
};

function handleAuthorize(req, options, strategy){
	options = options || {};
	options.failureRedirect = options.failureRedirect || "/";
	const serviceConfig = strategy.serviceConfig;
	const clientId = serviceConfig.getClientId();
	const scope = options.scope || WebAppStrategy.DEFAULT_SCOPE;
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
	options = options || {};
	options.failureRedirect = options.failureRedirect || "/";
	const code = req.query.code;
	const serviceConfig = strategy.serviceConfig;

	const clientId = serviceConfig.getClientId();
	const secret = serviceConfig.getSecret();
	const tokenEndpoint = serviceConfig.getTokenEndpoint();
	const redirectUri = serviceConfig.getRedirectUri();

	logger.debug("Getting tokens for code", code);
	request({
		method: "POST",
		url: tokenEndpoint,
		auth: {
			username: clientId,
			password: secret
		},
		formData: {
			"client_id": clientId,
			"grant_type": "authorization_code",
			"redirect_uri": redirectUri,
			"code": code
		}
	}, function (err, response, body) {
		if (err || response.statusCode !== 200){
			logger.error("Failed to obtain tokens ::", err.message, response.statusCode, body);
			strategy.fail(new Error("Failed to obtain tokens"));
		} else {
			body = JSON.parse(body);
			const accessTokenString = body["access_token"];
			const identityTokenString = body["id_token"];

			// Parse access_token
			var appIdAuthorizationContext = {
				accessToken: accessTokenString,
				accessTokenPayload: TokenUtil.decode(accessTokenString),
			};

			// Parse id_token
			if (identityTokenString) {
				appIdAuthorizationContext.identityToken = identityTokenString;
				appIdAuthorizationContext.identityTokenPayload = TokenUtil.decode(identityTokenString);
			}

			// Save to session auth context
			req.session[WebAppStrategy.AUTH_CONTEXT] = appIdAuthorizationContext;

			// Find correct successRedirect
			if (options.successRedirect) {
				options.successRedirect = options.successRedirect;
			} else if (req.session && req.session[WebAppStrategy.ORIGINAL_URL]) {
				options.successRedirect = req.session[WebAppStrategy.ORIGINAL_URL];
			} else {
				options.successRedirect = "/";
			}

			// done!
			strategy.success(TokenUtil.decode(identityTokenString) || null);
		}
	});
}

module.exports = WebAppStrategy;
