# Bluemix App ID
Node.js SDK for the Bluemix App ID service

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

This SDK provides Passport.js strategies for protecting two types of resources - APIs and Web applications. The major difference between these two resource types is the way client is challenged.

If you use the API protection strategy the unauthenticated client will get HTTP 401 response with list of scopes to obtain authorization for as described below.

If you use the Web application protection strategy the unauthenticated client will get HTTP 302 redirect to the login page hosted by App ID service (or, depending on configuration, directly to identity provider login page). WebAppStrategy, as name suggests, best fit for building web applications.

Read the [official documentation](https://console.ng.bluemix.net/docs/services/appid/index.html#gettingstarted) for information about getting started with Bluemix App ID Service.

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
APIStrategy expects request to contain an Authorization header with valid access token and optionally identity token. See App ID docs for additional information. The expected header structure is `Authorization=Bearer {access_token} [{id_token}]`

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
// tab in the App ID Dashboard. You're not required to provide this argument if
// your node.js application runs on Bluemix and is bound to the
// App ID service instance. In this case App ID configuration will be obtained
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
		// Get full appIdAuthorizationContext from request object
		var appIdAuthContext = req.appIdAuthorizationContext;

		appIdAuthContext.accessToken; // Raw access_token
		appIdAuthContext.accessTokenPayload; // Decoded access_token JSON
		appIdAuthContext.identityToken; // Raw identity_token
		appIdAuthContext.identityTokenPayload; // Decoded identity_token JSON

		// Or use user object provided by passport.js
		var username = req.user.name || "Anonymous";
		res.send("Hello from protected resource " + username);
	}
);

var port = process.env.PORT || 1234;

app.listen(port, function(){
	logger.info("Send GET request to http://localhost:" + port + "/api/protected");
});

```

#### Protecting web applications using WebAppStrategy
WebAppStrategy is based on the OAuth2 authorization_code grant flow and should be used for web applications that use browsers. The strategy provides tools to easily implement authentication and authorization flows. When WebAppStrategy provides mechanisms to detect unauthenticated attempts to access protected resources. The WebAppStrategy will automatically redirect user's browser to the authentication page. After successful authentication user will be taken back to the web application's callback URL (redirectUri), which will once again use WebAppStrategy to obtain access and identity tokens from App ID service. After obtaining these tokens the WebAppStrategy will store them in HTTP session under WebAppStrategy.AUTH_CONTEXT key. In a scalable cloud environment it is recommended to persist HTTP sessions in a scalable storage like Redis to ensure they're available across server app instances.

```JavaScript
const express = require('express');
const session = require('express-session')
const log4js = require('log4js');
const passport = require('passport');
const WebAppStrategy = require('bluemix-appid').WebAppStrategy;

const app = express();
const logger = log4js.getLogger("testApp");

app.use(passport.initialize());

// Below URLs will be used for App ID OAuth flows
const LANDING_PAGE_URL = "/web-app-sample.html";
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

// Use static resources from /samples directory
app.use(express.static("samples"));

// Configure express application to use passportjs
app.use(passport.initialize());
app.use(passport.session());

// Below configuration can be obtained from Service Credentials
// tab in the App ID Dashboard. You're not required to manually provide below
// configuration if your node.js application runs on Bluemix and is bound to the
// App ID service instance. In this case App ID configuration will be obtained
// automatically using VCAP_SERVICES environment variable.
//
// The redirectUri value can be supplied in three ways:
// 1. Manually in new WebAppStrategy({redirectUri: "...."})
// 2. As environment variable named `redirectUri`
// 3. If none of the above was supplied the App ID SDK will try to retrieve
//    application_uri of the application running on Bluemix and append a
//    default suffix "/ibm/bluemix/appid/callback"
passport.use(new WebAppStrategy({
	tenantId: "{tenant-id}",
	clientId: "{client-id}",
	secret: "{secret}",
	oauthServerUrl: "{oauth-server-url}",
	redirectUri: "{app-url}" + CALLBACK_URL
}));

// Configure passportjs with user serialization/deserialization. This is required
// for authenticated session persistence across HTTP requests. See passportjs docs
// for additional information http://passportjs.org/docs
passport.serializeUser(function(user, cb) {
	cb(null, user);
});

passport.deserializeUser(function(obj, cb) {
	cb(null, obj);
});

// Explicit login endpoint. Will always redirect browser to login widget due to {forceLogin: true}. If forceLogin is set to false the redirect to login widget will not occur if user is already authenticated
app.get(LOGIN_URL, passport.authenticate(WebAppStrategy.STRATEGY_NAME, {
	successRedirect: LANDING_PAGE_URL,
	forceLogin: true
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

// Start the server!
app.listen(process.env.PORT || 1234);
```

#### Anonymous login
WebAppStrategy allows users to login to your web application anonymously, meaning without requiring any credentials. After successful login the anonymous user access token will be persisted in HTTP session, making it available as long as HTTP session is kept alive. Once HTTP session is destroyed or expired the anonymous user access token will be destroyed as well.  

To allow anonymous login for a particular URL use two configuration properties as shown on a code snippet below:
* `allowAnonymousLogin` - set this value to true if you want to allow your users to login anonymously when accessing this endpoint. If this property is set to true no authentication will be required. The default value of this property is `false`, therefore you must set it explicitly to allow anonymous login.
* `allowCreateNewAnonymousUser` - By default a new anonymous user will be created every time this method is invoked unless there's an existing anonymous access_token stored in the current HTTP session. In some cases you want to explicitly control whether you want to automatically create new anonymous user or not. Set this property to `false` if you want to disable automatic creation of new anonymous users. The default value of this property is `true`.  

```JavaScript
const LOGIN_ANON_URL = "/ibm/bluemix/appid/loginanon";

// Explicit anonymous login endpoint
app.get(LOGIN_ANON_URL, passport.authenticate(WebAppStrategy.STRATEGY_NAME, {
	successRedirect: LANDING_PAGE_URL,
	allowAnonymousLogin: true,
	allowCreateNewAnonymousUser: true
}));
```

As mentioned previously the anonymous access_token and identity_token will be automatically persisted in HTTP session by App ID SDK. You can retrieve them from HTTP session via same mechanisms as regular tokens. Access and identity tokens will be kept in HTTP session and will be used until either them or HTTP session expires.

### User profile attributes

```javascript
const userAttributeManager = require("bluemix-appid").UserAttributeManager;
userAttributeManager.init();
var accessToken = req.session[WebAppStrategy.AUTH_CONTEXT].accessToken;

// get all attributes
userAttributeManager.getAllAttributes(accessToken).then(function (attributes) {
    	
        });

// get single attribute
userAttributeManager.getAttribute(accessToken, name).then(function (attributes) {
    	
        });

// set attribute value
userAttributeManager.setAttribute(accessToken, name, value).then(function (attributes) {
    	
        });

// delete attribute
userAttributeManager.deleteAttribute(accessToken, name).then(function () {
    	
        });

```

<!--### Login using resource owner password flow-->
<!--WebAppStrategy allows users to login to your web application using username/password.-->
<!--After successful login the user access token will be persisted in HTTP session, making it available as long as HTTP session is kept alive. Once HTTP session is destroyed or expired the anonymous user access token will be destroyed as well.-->
<!--To allow login using username/password add to your app a post route that will be called with the username and password parameters. -->
<!--```javascript-->
<!--app.post("/form/submit", bodyParser.urlencoded({extended: false}), passport.authenticate(WebAppStrategy.STRATEGY_NAME, {-->
<!--	<!--successRedirect: LANDING_PAGE_URL,-->
<!--	<!--failureRedirect: ROP_LOGIN_PAGE_URL,-->
<!--	<!--failureFlash : true // allow flash messages-->
<!--}));-->
<!--```-->
<!--* `successRedirect` - set this value to the url you want the user to be redirected after successful authentication, default: the original request url. (in this example:"/form/submit")-->
<!--* `failureRedirect` - set this value to the url you want the user to be redirected in case authentication fails, default: the original request url. (in this example:"/form/submit")-->
<!--* `failureFlash` - set this value to true if you want to receive the error message that returned from cloud directory service, default: false-->

<!--Note:-->
<!--1. If you submitting the request using a html form, use [body-parser](https://www.npmjs.com/package/body-parser) middleware.-->
<!--2. Use [connect-flash](https://www.npmjs.com/package/connect-flash) for getting the returned error message. see the web-app-sample-server.js.-->

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
