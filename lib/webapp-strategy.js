const log4js = require("log4js");
const tokenUtils = require("./utils/tokenUtils");
const ServiceConfig = require("./utils/serviceConfigUtils");
const request = require("request");

const APPID_CONTEXT_PATH = "/bluemix/appid/oauth";
const APPID_CONTEXT_PATH_LOGIN = APPID_CONTEXT_PATH + "/login";
const APPID_CONTEXT_PATH_LOGOUT = APPID_CONTEXT_PATH + "/logout";
const APPID_CONTEXT_PATH_CALLBACK = APPID_CONTEXT_PATH + "/callback";
const APPID_SUCCESS_REDIRECT = "APPID_SUCCESS_REDIRECT";
const APPID_FAILURE_REDIRECT = "APPID_FAILURE_REDIRECT";

const STRATEGY_NAME = "appid-webapp-strategy";

const logger = log4js.getLogger(STRATEGY_NAME);

function WebAppStrategy(expressApp, passport, options) {
	logger.debug("Initializing");
	options = options || {};

	if (!expressApp) {
		logger.warn("expressjs app not supplied in .init(expressApp, passport) parameters. Cannot add OAuth endpoints for web apps.");
	} else {
		expressApp.get(APPID_CONTEXT_PATH_LOGIN, onLogin);
		expressApp.get(APPID_CONTEXT_PATH_LOGOUT, onLogout);
		expressApp.get(APPID_CONTEXT_PATH_CALLBACK, onCallback);
	}

	if (!passport){
		logger.warn("passport is not supplied in .init(expressApp, passport) parameters. Cannot add user serialize/deserialize methods.");
	}

	this.name = WebAppStrategy.STRATEGY_NAME;
	this.scope = options.scope || WebAppStrategy.DEFAULT_SCOPE;

	// init strategy with whatever is required
}

WebAppStrategy.STRATEGY_NAME = STRATEGY_NAME;
WebAppStrategy.DEFAULT_SCOPE = "appid_default";

WebAppStrategy.prototype.authenticate = function(req, options) {
	logger.debug("authenticate");
	options = options || {};
	req.session[APPID_SUCCESS_REDIRECT] = options.successRedirect || req.url;
	req.session[APPID_FAILURE_REDIRECT] = options.failureRedirect || APPID_CONTEXT_PATH_LOGIN;

	var scope = options.scope || WebAppStrategy.DEFAULT_SCOPE;
	this.redirect(APPID_CONTEXT_PATH_LOGIN + "?scope=" + scope);
};

function onLogin(req, res){
	logger.debug("onLogin");
	var clientId = ServiceConfig.getClientId();
	var scope = req.params.scope || WebAppStrategy.DEFAULT_SCOPE;
	var authorizationEndpoint = ServiceConfig.getAuthorizationEndpoint();
	var redirectUri = ServiceConfig.getRedirectUriHost() + APPID_CONTEXT_PATH_CALLBACK;
	var authUrl = authorizationEndpoint +
		"?client_id=" + clientId +
		"&response_type=code" +
		"&redirect_uri=" + redirectUri +
		"&scope=" + scope;

	res.redirect(authUrl);
}

function onCallback(req, res) {
	var code = req.params.code;
	var error = req.params.error;
	var errorRedirect = req.session[APPID_FAILURE_REDIRECT] || APPID_CONTEXT_PATH_LOGIN;

	if (error) {
		logger.error("Authorization error::", error);
		return res.redirect(errorRedirect);
	}

	if (!code) {
		logger.error("Authorization error, grant code is null");
		return res.redirect(errorRedirect);
	}

	var clientId = ServiceConfig.getClientId();
	var secret = ServiceConfig.getSecret();
	var tokenEndpoint = ServiceConfig.getTokenEndpoint();
	var redirectUri = ServiceConfig.getRedirectUriHost() + APPID_CONTEXT_PATH_CALLBACK;

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
		// parse tokens
	});
}

function onLogout(req, res){
	logger.debug("onLogout");
	req.logout();
}

module.exports = WebAppStrategy;