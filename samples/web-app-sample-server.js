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

const express = require("express");
const session = require("express-session");
const log4js = require("log4js");
const logger = log4js.getLogger("testApp");
const passport = require("passport");

const WebAppStrategy = require("./../lib/appid-sdk").WebAppStrategy;
const app = express();

// Below URLs will be used for AppID OAuth flows
const LANDING_PAGE_URL = "/web-app-sample.html";
const LOGIN_URL = "/ibm/bluemix/appid/login";
const LOGIN_ANON_URL = "/ibm/bluemix/appid/loginanon";
const CALLBACK_URL = "/ibm/bluemix/appid/callback";
const LOGOUT_URL = "/ibm/bluemix/appid/logout";

// Setup express application to use express-session middleware
// Must be configured with proper session storage for production
// environments. See https://github.com/expressjs/session for
// additional documentation
app.use(session({
	secret: "123456",
	resave: true,
	saveUninitialized: true
}));

// Use static resources from /samples directory
app.use(express.static("samples"));

// Configure Pug template engine
// Configure express application to use passportjs
app.use(passport.initialize());
app.use(passport.session());

var webAppStrategy = new WebAppStrategy({
	tenantId: "50d0beed-add7-48dd-8b0a-c818cb456bb4",
	clientId: "7e464c3e-3a0f-431a-b3a1-a35bdb8e2562",
	secret: "MmRkNzA0MzctZjE0MC00ZmY2LTg4MDMtOTM5OGQwODFjMWE0",
	oauthServerUrl: "https://mobileclientaccess.stage1.mybluemix.net/oauth/v3/50d0beed-add7-48dd-8b0a-c818cb456bb4",
	redirectUri: "http://localhost:1234" + CALLBACK_URL
});

// Configure passportjs to use WebAppStrategy
passport.use(webAppStrategy);

// Configure passportjs with user serialization/deserialization. This is required
// for authenticated session persistence accross HTTP requests. See passportjs docs
// for additional information http://passportjs.org/docs
passport.serializeUser(function(user, cb) {
	cb(null, user);
});

passport.deserializeUser(function(obj, cb) {
	cb(null, obj);
});

// Login endpoint. Will redirect browser to login widget
app.get(LOGIN_URL, passport.authenticate(WebAppStrategy.STRATEGY_NAME, {
	successRedirect: LANDING_PAGE_URL
}));

// Anonymous login endpoint. Will generate
app.get(LOGIN_ANON_URL, passport.authenticate(WebAppStrategy.STRATEGY_NAME, {
	allowAnonymousLogin: true,
	allowCreateNewAnonymousUser: true,
	successRedirect: LANDING_PAGE_URL
}));

// Callback to finish authorization process. Will retrieve access and identity tokens/
// from AppID service and redirect to either (in below order)
// 1. successRedirect as specified in passport.authenticate(name, {successRedirect: "...."}) invocation
// 2. the original URL of the request that triggered authentication, as persisted in HTTP session under WebAppStrategy.ORIGINAL_URL key.
// 3. application root ("/")
app.get(CALLBACK_URL, passport.authenticate(WebAppStrategy.STRATEGY_NAME,{
	successRedirect: LANDING_PAGE_URL
}));

// Clears authentication information from session
app.get(LOGOUT_URL, function(req, res){
	WebAppStrategy.logout(req);
	res.redirect(LANDING_PAGE_URL);
});




app.get("/idtoken", function(req, res, next){
	var user = req.user;
	if (user) {
		res.json(user);
	} else {
		res.status(401).send("unauthorized");
	}
});

// Protected area. Will return a page with user information. Protected by WebAppStrategy
// In case of attempt to open this page without authenticating first will redirect to login page
// Before redirecting to the login page the WebAppStrategy.ensureAuthenticated() method will
// persist original request URL to HTTP session under WebAppStrategy.ORIGINAL_URL key.
app.get("/protected", WebAppStrategy.ensureAuthenticated(LOGIN_URL), function(req, res){
	res.json(req.user);
});


var port = process.env.PORT || 1234;
app.listen(port, function(){
	logger.info("Listening on http://localhost:" + port + "/web-app-sample.html");
});
