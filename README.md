# Bluemix AppID
Node.js SDK for the Bluemix AppID service

[![Bluemix powered][img-bluemix-powered]][url-bluemix]
[![Travis][img-travis-master]][url-travis-master]
[![Coveralls][img-coveralls-master]][url-coveralls-master]
[![Codacy][img-codacy]][url-codacy]
[![Version][img-version]][url-npm]
[![DownloadsMonthly][img-npm-downloads-monthly]][url-npm]
[![DownloadsTotal][img-npm-downloads-total]][url-npm]
[![License][img-license]][url-npm]

[![GithubWatch][img-github-watchers]][url-github-watchers]
[![GithubStars][img-github-stars]][url-github-stars]
[![GithubForks][img-github-forks]][url-github-forks]

### Table of Contents
* [Summary](#summary)
* [Requirements](#requirements)
* [Installation](#installation)
* [Example Usage](#example-usage)
* [License](#license)

### Summary
The Bluemix AppID Service allows developers .....

This SDK provides Passport.js strategies for protecting two types of resources - APIs and Web applications. The major difference between these two resource types is the way client is challenged.

If you use the API protection strategy the unauthenticated client will get HTTP 401 response with list of scopes to obtain authorization for as described below.

If you use the Web application protection strategy the unauthenticated client will get HTTP 302 redirect to the login page hosted by AppID service (or, depending on configuration, directly to identity provider login page).

Read the [official documentation](TODO: ADD LINK) for information about getting started with Bluemix AppID Service.

### Requirements
* npm 4.+
* node 4.+

### Installation
```
npm install --save bluemix-appid
```

### Example Usage
Below find two examples of using this SDK to protect APIs and Web applications. Both samples are available under `samples` folder in this repository.

Note that below examples are using additional npm modules. In order to install required npm modules run below commands in your node.js application.
```
npm install --save express
npm install --save log4js
npm install --save passport
npm install --save express-session
npm install --save pug
```

#### Protecting APIs using the APIStrategy
APIStrategy expects request to contain an Authorization header with valid access token and optionally identity token. See AppID docs for additional information. The expected header structure is `Authorization=Bearer {access_token} [{id_token}]`

In case of invalid/expired tokens the APIStrategy will return HTTP 401 with `Www-Authenticate=Bearer scope="{scope}" error="{error}"`. The `error` component is optional.

In case of valid tokens the APIStrategy will pass control to the next middleware while injecting the `appIdAuthorizationContext` property into request object. This property will contain original access and identity tokens as well as decoded payload information as plain JSON objects.

```JavaScript
const express = require('express');
const log4js = require('log4js');
const passport = require('passport');
const APIStrategy = require("bluemix-appid").APIStrategy;

const app = express();
const logger = log4js.getLogger("testApp");

app.use(passport.initialize());

// The oauthServerUrl value can be obtained from Service Credentials
// tab in the AppID Dashboard. You're not required to provide this argument
// if your node.js application runs on Bluemix and is bound to the
// AppID service instance. In this case AppID configuration will be obtained
// using VCAP_SERVICES environment variable.
passport.use(new APIStrategy({
	oauthServerUrl: "{oauth-server-url}"
}));

// Declare the API you want to protect
app.get("/api/protected",

	passport.authenticate(APIStrategy.STRATEGY_NAME, {
		session: false
	}),
	function(req, res) {
		// Get appIdAuthorizationContext from request object
		var appIdAuthContext = req.appIdAuthorizationContext;
		var username = "Anonymous";

		// Get identity information
		if (appIdAuthContext.identityTokenPayload){
			username = appIdAuthContext.identityTokenPayload.name;
		}

		// Print authorization context to console
		logger.debug(appIdAuthContext);
		res.send("Hello from protected resource " + username);
	}
);

var port = process.env.PORT || 1234;

app.listen(port, function(){
	logger.info("Send GET request to http://localhost:" + port + "/api/protected");
});

```

#### Protecting web applications using WebAppStrategy
WebAppStrategy is based on authorization_code OAuth2 flow and should be used for web applications that use browsers. The strategy provides tools to easily implement authentication and authorization flows. When WebAppStrategy detects unauthenticated attempt to access a protected resource it will automatically redirect user's browser to the authentication page. After successful authentication user will be taken back to the web application's callback URL (redirectUri), which will once again use WebAppStrategy to obtain access and identity tokens from AppID service. After obtaining these tokens the WebAppStrategy will store them in HTTP session under WebAppStrategy.AUTH_CONTEXT key. It is up to developer to decide whether to persist access and identity tokens in the application database.

```JavaScript
const express = require('express');
const session = require('express-session')
const log4js = require('log4js');
const passport = require('passport');
const pug = require('pug');
const WebAppStrategy = require('bluemix-appid').WebAppStrategy;

const app = express();
const logger = log4js.getLogger("testApp");

app.use(passport.initialize());

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

// Configure Pug template engine, only required if you're using Pug
pug.basedir = "samples";
app.set('view engine', 'pug');
app.set('views', './samples/views');

// Configure express application to use passportjs session middleware
app.use(passport.session());

// Below configuration can be obtained from Service Credentials
// tab in the AppID Dashboard. You're not required to manually provide below
// configuration if your node.js application runs on Bluemix and is bound to the
// AppID service instance. In this case AppID configuration will be obtained
// automatically using VCAP_SERVICES environment variable.
//
// The redirectUri value can be supplied in three ways:
// 1. Manually in new WebAppStrategy({redirectUri: "...."})
// 2. As environment variable named `redirectUri`
// 3. If none of the above was supplied the AppID SDK will try to retrieve
//    application_uri of the application running on Bluemix and append default
//    default suffix `/ibm/bluemix/appid/callback`
passport.use(new WebAppStrategy({
	tenantId: "{tenant-id}",
	clientId: "{client-id}",
	secret: "{secret}",
	oauthServerUrl: "{oauth-server-url}",
	redirectUri: "{server-url}" + CALLBACK_URL
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
// In case of attempt to open this page without authenticating first it will redirect to login page.
// Before redirecting to the login page the WebAppStrategy.ensureAuthenticated() method will
// persist original request URL to HTTP session under WebAppStrategy.ORIGINAL_URL key.
app.get("/userProfile", WebAppStrategy.ensureAuthenticated(LOGIN_URL), function(req, res){
	res.json(req.user);
});

// Login page. Will redirect to the AppID authorization endpoint.
app.get(LOGIN_URL, passport.authenticate(WebAppStrategy.STRATEGY_NAME));

// Callback to finish authorization process. Will retrieve access and identity tokens
// from AppID service and redirect to either (in below order):
// 1. successRedirect as specified in passport.authenticate(name, {successRedirect: "...."}) invocation
// 2. the original URL of the request that triggered authentication, as persisted in HTTP session under WebAppStrategy.ORIGINAL_URL key.
// 3. application root ("/")
app.get(CALLBACK_URL, passport.authenticate(WebAppStrategy.STRATEGY_NAME));

// Clears authenication information from HTTP session
app.get(LOGOUT_URL, function(req, res){
	WebAppStrategy.logout(req);
	res.redirect("/");
});

var port = process.env.PORT || 1234;
app.listen(port, function(){
	logger.info("Listening on http://localhost:" + port);
});
```

### License
This package contains code licensed under the Apache License, Version 2.0 (the "License"). You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0 and may also view the License in the LICENSE file within this package.

[img-bluemix-powered]: https://img.shields.io/badge/bluemix-powered-blue.svg
[url-bluemix]: http://bluemix.net
[url-npm]: https://www.npmjs.com/package/bluemix-appid
[img-license]: https://img.shields.io/npm/l/bluemix-appid.svg
[img-version]: https://img.shields.io/npm/v/bluemix-appid.svg
[img-npm-downloads-monthly]: https://img.shields.io/npm/dm/bluemix-appid.svg
[img-npm-downloads-total]: https://img.shields.io/npm/dt/bluemix-appid.svg

[img-github-watchers]: https://img.shields.io/github/watchers/ibm-cloud-security/appid-serversdk-nodejs.svg?style=social&label=Watch
[url-github-watchers]: https://github.com/ibm-cloud-security/appid-serversdk-nodejs/watchers
[img-github-stars]: https://img.shields.io/github/stars/ibm-cloud-security/appid-serversdk-nodejs.svg?style=social&label=Star
[url-github-stars]: https://github.com/ibm-cloud-security/appid-serversdk-nodejs/stargazers
[img-github-forks]: https://img.shields.io/github/forks/ibm-cloud-security/appid-serversdk-nodejs.svg?style=social&label=Fork
[url-github-forks]: https://github.com/ibm-cloud-security/appid-serversdk-nodejs/network

[img-travis-master]: https://travis-ci.org/ibm-cloud-security/appid-serversdk-nodejs.svg
[url-travis-master]: https://travis-ci.org/ibm-cloud-security/appid-serversdk-nodejs

[img-coveralls-master]: https://coveralls.io/repos/github/ibm-cloud-security/appid-serversdk-nodejs/badge.svg
[url-coveralls-master]: https://coveralls.io/github/ibm-cloud-security/appid-serversdk-nodejs

[img-codacy]: https://api.codacy.com/project/badge/Grade/3156f40a37cb4026a443082fc1afcaa4?branch=master
[url-codacy]: https://www.codacy.com/app/ibm-cloud-security/appid-serversdk-nodejs
