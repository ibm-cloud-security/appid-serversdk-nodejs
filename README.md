# Bluemix AppID
Node.js SDK for the Bluemix AppID service

[![Bluemix powered][img-bluemix-powered]][url-bluemix]
[![Travis][img-travis-master]][url-travis-master]
[![Coveralls][img-coveralls-master]][url-coveralls-master]
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
The Bluemix AppID Service allows developers ....

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
Note that below examples are using additional npm modules. In order to install required npm modules run below commands
```
npm install --save express
npm install --save log4js
npm install --save passport
npm install --save express-session
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

// Both tenantId and serverUrl values can be obtained from Service Credentials
// tab in the AppID Dashboard. You're not required to provide tenantId and
// serverUrl if your node.js application runs on Bluemix and is bound to the
// AppID service instance. In this case AppID configuration will be obtained
// using VCAP_SERVICES environment variable.
passport.use(new APIStrategy({
	tenantId: "{service-tenant-id}",
	serverUrl: "{server-url}"
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

### License
This package contains code licensed under the Apache License, Version 2.0 (the "License"). You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0 and may also view the License in the LICENSE file within this package.

[img-bluemix-powered]: https://img.shields.io/badge/bluemix-powered-blue.svg
[url-bluemix]: http://bluemix.net
[url-npm]: https://www.npmjs.com/package/bluemix-appid
[img-license]: https://img.shields.io/npm/l/bluemix-appid.svg
[img-version]: https://img.shields.io/npm/v/bluemix-appid.svg
[img-npm-downloads-monthly]: https://img.shields.io/npm/dm/bluemix-appid.svg
[img-npm-downloads-total]: https://img.shields.io/npm/dt/bluemix-appid.svg

[img-github-watchers]: https://img.shields.io/github/watchers/ibm-bluemix-mobile-services/appid-serversdk-nodejs.svg?style=social&label=Watch
[url-github-watchers]: https://github.com/ibm-bluemix-mobile-services/appid-serversdk-nodejs/watchers
[img-github-stars]: https://img.shields.io/github/stars/ibm-bluemix-mobile-services/appid-serversdk-nodejs.svg?style=social&label=Star
[url-github-stars]: https://github.com/ibm-bluemix-mobile-services/appid-serversdk-nodejs/stargazers
[img-github-forks]: https://img.shields.io/github/forks/ibm-bluemix-mobile-services/appid-serversdk-nodejs.svg?style=social&label=Fork
[url-github-forks]: https://github.com/ibm-bluemix-mobile-services/appid-serversdk-nodejs/network

[img-travis-master]: https://travis-ci.org/ibm-bluemix-mobile-services/appid-serversdk-nodejs.svg
[url-travis-master]: https://travis-ci.org/ibm-bluemix-mobile-services/appid-serversdk-nodejs
[img-travis-development]: https://travis-ci.org/ibm-bluemix-mobile-services/appid-serversdk-nodejs.svg?branch=development
[url-travis-development]: https://travis-ci.org/ibm-bluemix-mobile-services/appid-serversdk-nodejs?branch=development

[img-coveralls-master]: https://coveralls.io/repos/github/ibm-bluemix-mobile-services/appid-serversdk-nodejs/badge.svg
[url-coveralls-master]: https://coveralls.io/github/ibm-bluemix-mobile-services/appid-serversdk-nodejs
[img-coveralls-development]: https://coveralls.io/repos/github/ibm-bluemix-mobile-services/appid-serversdk-nodejs/badge.svg?branch=development
[url-coveralls-development]: https://coveralls.io/github/ibm-bluemix-mobile-services/appid-serversdk-nodejs?branch=development
