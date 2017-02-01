const express = require('express');
const session = require('express-session')
const log4js = require('log4js');
const logger = log4js.getLogger("testApp");
const passport = require('passport');
const pug = require('pug');

const WebAppStrategy = require('./../lib/appid-sdk').WebAppStrategy;
const app = express();

// Below URLs will be used for AppID OAuth flows
const LOGIN_URL = "/ibm/bluemix/appid/login";
const CALLBACK_URL = "/ibm/bluemix/appid/callback";
const LOGOUT_URL = "/ibm/bluemix/appid/logout";

// Setup express application to use express-session middleware
// Must be configured with proper session storage for production
// environments. See https://github.com/expressjs/session for
// additional documentation
app.use(session({
	secret: '123456',
	resave: true,
	saveUninitialized: true
}));

// Configure Pug template engine
pug.basedir = "samples";
app.set('view engine', 'pug');
app.set('views', './samples/views');

// Configure express application to use passportjs
app.use(passport.initialize());
app.use(passport.session());

// Configure passportjs to use WebAppStrategy
passport.use(new WebAppStrategy({
	tenantId: "bb9b7729-3a5e-4e4b-b917-5076e848bcf2",
	clientId: "a8fd7d1c-2c82-4ad0-b4f8-0ded373e69a9",
	secret: "NWY3MzIzYzctMzM0Ny00MWM4LWJkYmUtY2FjNTNjYzM2MWNi",
	authorizationEndpoint: "https://mobileclientaccess.stage1-dev.ng.bluemix.net/oauth/v3/bb9b7729-3a5e-4e4b-b917-5076e848bcf2/authorization",
	tokenEndpoint: "https://mobileclientaccess.stage1-dev.ng.bluemix.net/oauth/v3/bb9b7729-3a5e-4e4b-b917-5076e848bcf2/token",
	redirectUri: "http://localhost:1234" + CALLBACK_URL
}));

// Configure passportjs with user serialization/deserialization. This is required
// for authenticated session persistence accross HTTP requests. See passportjs docs
// for additional information http://passportjs.org/docs
passport.serializeUser(function(user, cb) {
	cb(null, user);
});

passport.deserializeUser(function(obj, cb) {
	cb(null, obj);
});

// Main application landing page. Not protected by WebAppStrategy
app.get("/", function(req, res, next) {
	var user = req.user;
	var data = {};
	if (user){
		data = {
			isAuthenticated: true,
			name: user.name,
			picture: user.picture
		}
	}
	res.render("index.pug", data);
});

// userProfile page. Will return current user information. Protected by WebAppStrategy
// In case of attempt to open this page without authenticating first will redirect to login page
// Before redirecting to the login page the WebAppStrategy.ensureAuthenticated() method will
// persist original request URL to HTTP session under WebAppStrategy.ORIGINAL_URL key.
app.get("/userProfile", WebAppStrategy.ensureAuthenticated(LOGIN_URL), function(req, res){
	res.json(req.user);
});

// Login page
app.get(LOGIN_URL, passport.authenticate(WebAppStrategy.STRATEGY_NAME));

// Callback to finish authorization process. Will retrieve access and identity tokens
// from AppID service and redirect to either (in below order)
// 1. successRedirect as specified in passport.authenticate(name, {successRedirect: "...."}) invocation
// 2. the original URL of the request that triggered authentication, as persisted in HTTP session under WebAppStrategy.ORIGINAL_URL key.
// 3. application root ("/")
app.get(CALLBACK_URL, passport.authenticate(WebAppStrategy.STRATEGY_NAME));

// Clears authetnication information from session
app.get(LOGOUT_URL, function(req, res){
	WebAppStrategy.logout(req);
	res.redirect("/");
});

var port = process.env.PORT || 1234;
app.listen(port, function(){
	logger.info("Listening on http://localhost:" + port);
});

