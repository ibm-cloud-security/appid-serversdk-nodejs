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
const passport = require("passport");
const WebAppStrategy = require("./../lib/appid-sdk").WebAppStrategy;
const helmet = require("helmet");

const app = express();
const logger = log4js.getLogger("testApp");

// Below URLs will be used for App ID OAuth flows
const LANDING_PAGE_URL = "/web-app-sample.html";
const LOGIN_URL = "/ibm/bluemix/appid/login";
const LOGIN_ANON_URL = "/ibm/bluemix/appid/loginanon";
const CALLBACK_URL = "/ibm/bluemix/appid/callback";
const LOGOUT_URL = "/ibm/bluemix/appid/logout";

// Security
app.use("/protected", helmet());
app.use("/protected", helmet().noCache());

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

// Configure express application to use passportjs
app.use(passport.initialize());
app.use(passport.session());

// Configure passportjs to use WebAppStrategy
passport.use(new WebAppStrategy({
	tenantId: "90ff4e45-dd1c-4367-b878-5307f68ee9ce",
	clientId: "a7a75575-8763-4200-8165-58792e88b16e",
	secret: "YmYwZmUwNTgtMTNkYi00ZDZiLTg0OTUtODIwNmM2M2RjNGEy",
	oauthServerUrl: "https://appid-oauth.ng.bluemix.net/oauth/v3/90ff4e45-dd1c-4367-b878-5307f68ee9ce",
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

// Explicit login endpoint. Will always redirect browser to login widget due to {forceLogin: true}.
// If forceLogin is set to false redirect to login widget will not occur of already authenticated users.
app.get(LOGIN_URL, passport.authenticate(WebAppStrategy.STRATEGY_NAME, {
	successRedirect: LANDING_PAGE_URL,
	forceLogin: true
}));

// Explicit anonymous login endpoint. Will always redirect browser for anonymous login due to forceLogin: true
app.get(LOGIN_ANON_URL, passport.authenticate(WebAppStrategy.STRATEGY_NAME, {
	successRedirect: LANDING_PAGE_URL,
	allowAnonymousLogin: true,
	allowCreateNewAnonymousUser: true
}));

// Callback to finish the authorization process. Will retrieve access and identity tokens/
// from App ID service and redirect to either (in below order)
// 1. the original URL of the request that triggered authentication, as persisted in HTTP session under WebAppStrategy.ORIGINAL_URL key.
// 2. successRedirect as specified in passport.authenticate(name, {successRedirect: "...."}) invocation
// 3. application root ("/")
app.get(CALLBACK_URL, passport.authenticate(WebAppStrategy.STRATEGY_NAME));

// Logout endpoint. Clears authentication information from session
app.get(LOGOUT_URL, function(req, res){
	WebAppStrategy.logout(req);
	res.redirect(LANDING_PAGE_URL);
});

// Protected area. If current user is not authenticated - redirect to the login widget will be returned.
// In case user is authenticated - a page with current user information will be returned.
app.get("/protected", passport.authenticate(WebAppStrategy.STRATEGY_NAME), function(req, res){
	res.json(req.user);
});

var port = process.env.PORT || 1234;
app.listen(port, function(){
	logger.info("Listening on http://localhost:" + port + "/web-app-sample.html");
});
