# IBM Cloud App ID Node.js SDK

[![IBM Cloud powered][img-ibmcloud-powered]][url-ibmcloud]
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

## Table of Contents
* [Summary](#summary)
* [Requirements](#requirements)
* [Installation](#installation)
* [Example Usage](#example-usage)
* [License](#license)

## Summary

This SDK provides Passport.js strategies for protecting two types of resources - APIs and Web applications. The major difference between these two resource types is the way client is challenged.

If you use the API protection strategy the unauthenticated client will get HTTP 401 response with list of scopes to obtain authorization for as described below.

If you use the Web application protection strategy the unauthenticated client will get HTTP 302 redirect to the login page hosted by App ID service (or, depending on configuration, directly to identity provider login page). WebAppStrategy, as the name suggests, best fit for building web applications.

In addition, the SDK provides helper utilities centered around tokens and user profiles. The token manager supports token retrieval for additional flows such as Application Identity and Custom Identity, as well as token specific functions. The user profile manager supports helper functions that retrieve identity provider and custom profile information about the user.

Read the [official documentation](https://console.ng.bluemix.net/docs/services/appid/index.html#gettingstarted) for information about getting started with IBM Cloud App ID Service.

## Requirements
* npm 4.+
* node 6.+

## Installation
```
npm install --save ibmcloud-appid
```

## Example Usage
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
const APIStrategy = require("ibmcloud-appid").APIStrategy;

const app = express();
const logger = log4js.getLogger("testApp");

app.use(passport.initialize());

// The oauthServerUrl value can be obtained from Service Credentials
// tab in the App ID Dashboard. You're not required to provide this argument if
// your node.js application runs on IBM Cloud and is bound to the
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
		appIdAuthContext.refreshToken // Raw refresh_token

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

##### Protecting APIs using the APIStrategy: Access Control
Using access control, you can define the scopes that are required to access a specific endpoint.
```JavaScript
app.get("/api/protected",
	passport.authenticate(APIStrategy.STRATEGY_NAME, {
		audience: "myApp",
		scope: "read write update"
	}),
	function(req, res) {
		res.send("Hello from protected resource");
	}
);
```
The scope parameter defines the required scopes. 
The audience parameter is optional and should be set to the application clientId
to guarantee the scopes are for the requested application. 

#### Protecting web applications using WebAppStrategy
WebAppStrategy is based on the OAuth2 authorization_code grant flow and should be used for web applications that use browsers. The strategy provides tools to easily implement authentication and authorization flows. When WebAppStrategy provides mechanisms to detect unauthenticated attempts to access protected resources. The WebAppStrategy will automatically redirect user's browser to the authentication page. After successful authentication user will be taken back to the web application's callback URL (redirectUri), which will once again use WebAppStrategy to obtain access, identity and refresh tokens from App ID service. After obtaining these tokens the WebAppStrategy will store them in HTTP session under WebAppStrategy.AUTH_CONTEXT key. In a scalable cloud environment it is recommended to persist HTTP sessions in a scalable storage like Redis to ensure they're available across server app instances.

```JavaScript
const express = require('express');
const session = require('express-session')
const log4js = require('log4js');
const passport = require('passport');
const WebAppStrategy = require('ibmcloud-appid').WebAppStrategy;

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
// configuration if your node.js application runs on IBM Cloud and is bound to the
// App ID service instance. In this case App ID configuration will be obtained
// automatically using VCAP_SERVICES environment variable.
//
// The redirectUri value can be supplied in three ways:
// 1. Manually in new WebAppStrategy({redirectUri: "...."})
// 2. As environment variable named `redirectUri`
// 3. If none of the above was supplied the App ID SDK will try to retrieve
//    application_uri of the application running on IBM Cloud and append a
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

##### Protecting web applications using WebAppStrategy: Access Control
Using access control, you can check which scopes exist on the request.
```JavaScript
app.get("/protected", passport.authenticate(WebAppStrategy.STRATEGY_NAME), function(req, res){
    if(WeAppStrategy.hasScope(req, "read write")){
      	res.json(req.user);
    }
    else {
        res.send("insufficient scopes!");
    }
});
```
Use WebAppStrategy's hasScope method to check if a given request has some specific scopes.

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

As mentioned previously the anonymous access_token, identity_token and refresh_token (optional) will be automatically persisted in HTTP session by App ID SDK. You can retrieve them from HTTP session via same mechanisms as regular tokens. Access and identity tokens will be kept in HTTP session and will be used until either them or HTTP session expires.

### Refresh Token
Refresh Token may be used to acquire new access and identity tokens without the need to re-authenticate. Refresh Token is usually configured to have longer expiration than access token. Refresh Token is optional and can be configured in your App ID Dashboard.

After a successful login, in addition to access_token and identity_token, a refresh_token will be persisted in the HTTP session as well.

You may persist the refresh_token in any method you'd like. By doing so, you can avoid your users login after the HTTP session has expired as long as the refresh_token is valid. `web-app-sample-server.js` contains an example of storing a refresh-token in a cookie and how to use it.

In order to use the persisted refresh_token, you need to call `webAppStrategy.refreshTokens(request, refreshToken)`. `refreshTokens()` returns a Promise. After the Promise has resolved, the user will be authenticated and new tokens will be generated and persistent in the HTTP session like in a classic login. If the Promise is rejected, the user won't be authenticated.

### Token Manager

The `tokenManager` object provides token helper functions as well as retrieves tokens generated as a result of the Custom Identity and Application Identity flows. The `tokenManager` object can be initialized in two ways.

In the first case, the application has already configured the SDK with the App ID service configuration using other managers, and so `TokenManager` can simply inherit the configurations:

```javascript
const TokenManager = require('ibmcloud-appid').TokenManager;
```

In the second case, the application can directly configured the SDK with the App ID service configuration using the `TokenManager` object:

```javascript
const config = {
	tenantId: "{tenant-id}",
	clientId: "{client-id}",
	secret: "{secret}",
	oauthServerUrl: "{oauth-server-url}"
};

const TokenManager = require('ibmcloud-appid').TokenManager(config);
```

### Custom Identity
App ID's custom identity flow enables developers to utilize their own authorization protocols, while still leveraging App ID's capabilities. Instead of managing the entirety of the authorization flow, App ID's custom identity flow allows clients to leverage their own authorization protocol to authenticate and authorize their users and then provides a framework for exchanging verified authentication data securely for App ID tokens.

To utilize the custom identity flow, the user must first register a public key in PEM form using the App ID Dashboard. The user must generate a signed JWT using any open source library and then the user can then use `TokenManager.getCustomIdentityTokens(jwsTokenString, scopes)` to exchange the token for access and identity tokens. `getCustomIdentityTokens()` is an asynchronous function that returns the access token and identity token. These tokens can be stored in the HTTP session for future use. `custom-identity-app-sample-server.js` contains an example of using the Token Manager.

Refer to the [documentation on custom identity](https://console.bluemix.net/docs/services/appid/custom.html#custom-identity) for more details on how to implement App ID's custom identity flow in your application.


### Application Identity and Authorization

In case you want to call protected APIs from applications or clients that are non-interactive (i.e., there is no user involved), you can use the App ID application identity and authorization flow to secure your applications.   

App ID application authorization implements the OAuth2.0 Client Credentials grant.

Before you can obtain access tokens using the application authorization flow, you need to obtain a `client ID` and a `secret` by registering your application with your App ID instance. Refer to the [App ID application identity and authorization documentation](https://console.bluemix.net/docs/services/appid/app-to-app.html#registering) on how to register your applications.

Since the application needs to store the `client ID` and the `secret`, this flow must never be used with untrusted clients such as mobile clients and browser based applications.

Also, note that this flow only returns an access token and no identity or refresh tokens are issued.

The code snippet below describes how to obtain the access token for this flow.

```javascript
const config = {
	tenantId: "{tenant-id}",
	clientId: "{client-id}",
	secret: "{secret}",
	oauthServerUrl: "{oauth-server-url}"
};

const TokenManager = require('ibmcloud-appid').TokenManager;

const tokenManager = new TokenManager(config);

async function getAppIdentityToken() {
	try {
			const tokenResponse = await tokenManager.getApplicationIdentityToken();
			console.log('Token response : ' + JSON.stringify(tokenResponse));

			//the token response contains the access_token, expires_in, token_type
	} catch (err) {
			console.log('err obtained : ' + err);
	}
}
```
For more detailed information on using the application identity and authorization flow, refer to the [App ID documentation](https://console.bluemix.net/docs/services/appid/app-to-app.html#app).

### Manage User Profile
Using the App ID UserProfileManager, you are able to create, delete, and retrieve user profile attributes as well as get additional info about a user.

```javascript
const userProfileManager = require("ibmcloud-appid").UserProfileManager;
userProfileManager.init();
var accessToken = req.session[WebAppStrategy.AUTH_CONTEXT].accessToken;

// get all attributes
userProfileManager.getAllAttributes(accessToken).then(function (attributes) {

        });

// get single attribute
userProfileManager.getAttribute(accessToken, name).then(function (attributes) {

        });

// set attribute value
userProfileManager.setAttribute(accessToken, name, value).then(function (attributes) {

        });

// delete attribute
userProfileManager.deleteAttribute(accessToken, name).then(function () {

        });

// retrieve user info
userProfileManager.getUserInfo(accessToken).then(function (userInfo) {

        });

// (recommended approach) retrieve user info and validate against the given identity token
userProfileManager.getUserInfo(accessToken, identityToken).then(function (userInfo) {

        });

```
## Cloud Directory
Make sure to that Cloud Directory identity provider set to **ON** in the App ID dashboard and that you've included a callback endpoint.

### Login using resource owner password flow
WebAppStrategy allows users to login to your web application using username/password.
After successful login, the user access token will be persisted in HTTP session, making it available as long as HTTP session is kept alive. Once HTTP session is destroyed or expired the user access token will be destroyed as well.
To allow login using username/password add to your app a post route that will be called with the username and password parameters.
```javascript
app.post("/form/submit", bodyParser.urlencoded({extended: false}), passport.authenticate(WebAppStrategy.STRATEGY_NAME, {
	successRedirect: LANDING_PAGE_URL,
	failureRedirect: ROP_LOGIN_PAGE_URL,
	failureFlash : true // allow flash messages
}));
```
* `successRedirect` - set this value to the url you want the user to be redirected after successful authentication, default: the original request url. (in this example:"/form/submit")
* `failureRedirect` - set this value to the url you want the user to be redirected in case authentication fails, default: the original request url. (in this example:"/form/submit")
* `failureFlash` - set this value to true if you want to receive the error message that returned from cloud directory service, default: false

Note:
1. If you submitting the request using a html form, use [body-parser](https://www.npmjs.com/package/body-parser) middleware.
2. Use [connect-flash](https://www.npmjs.com/package/connect-flash) for getting the returned error message. see the web-app-sample-server.js.

### Sign up
Pass WebAppStrategy "show" property and set it to WebAppStrategy.SIGN_UP, will launch the App ID sign up form.
```javascript
app.get("/sign_up", passport.authenticate(WebAppStrategy.STRATEGY_NAME, {
	successRedirect: LANDING_PAGE_URL,
	show: WebAppStrategy.SIGN_UP
}));
```
Note:
1. If your Cloud directory setting ***Allow users to sign-in without email verification** is set to **No**, the process will end without retrieving App ID access and id tokens.
2. Be sure to set **Allow users to sign up and reset their password" to **ON**, in the settings for Cloud Directory.


### Forgot Password
Pass WebAppStrategy "show" property and set it to WebAppStrategy.FORGOT_PASSWORD, will launch the App ID forgot password from.
```javascript
app.get("/forgot_password", passport.authenticate(WebAppStrategy.STRATEGY_NAME, {
	successRedirect: LANDING_PAGE_URL,
	show: WebAppStrategy.FORGOT_PASSWORD
}));
```
Note:
1. This process will end without retrieving App ID access and id tokens.
2. Make sure to set "Allow users to sign up and reset their password" and "Forgot password email" to ON, in Cloud Directory settings that are in the App ID dashboard.

### Change Details
Pass WebAppStrategy "show" property and set it to WebAppStrategy.CHANGE_DETAILS, will launch the App ID change details from.
```javascript
app.get("/change_details", passport.authenticate(WebAppStrategy.STRATEGY_NAME, {
	successRedirect: LANDING_PAGE_URL,
	show: WebAppStrategy.CHANGE_DETAILS
}));
```
Note:
1. This call requires that the user is authenticated with Cloud directory identity provider.
2. Make sure to set "Allow users to sign up and reset their password" to ON, in Cloud Directory settings that are in the App ID dashboard.

### Change Password
Pass WebAppStrategy "show" property and set it to WebAppStrategy.CHANGE_PASSWORD, will launch the App ID change password from.
```javascript
app.get("/change_password", passport.authenticate(WebAppStrategy.STRATEGY_NAME, {
	successRedirect: LANDING_PAGE_URL,
	show: WebAppStrategy.CHANGE_PASSWORD
}));
```
Note:
1. This call requires that the user is authenticated with Cloud directory identity provider.
2. Make sure to set "Allow users to sign up and reset their password" to ON, in Cloud Directory settings that are in App ID dashboard.

### Self Service APIs

Use the self service manager when you want to control the UI for the sign-in, sign-up, forgot password, changeDetail and change password flows.
The selfServiceManager can be init with the following options:

* iamApiKey: If supplied, it will be used to get iamToken before every request of the selfServiceManager.
* managementUrl: The App ID management url.

```javascript
// The managementUrl value can be obtained from Service Credentials tab in the App ID Dashboard.
// You're not required to provide the managementUrl and the iamApiKey arguments if
// your node.js application runs on IBM Cloud and is bound to the App ID service instance.
// In this case App ID configuration will be obtained using VCAP_SERVICES environment variable,
// during resource-binding process an auto generated apikey is created for you and it can be found in the VCAP_SERVICES environment variable.
// (if you wish to use diffrent IAM api key you can supply it to the iamApiKey).
// Note: If your Service Credentials does not contain managementUrl you can supply the tenantId, and the oauthServerUrl instead.
const SelfServiceManager = require("ibmcloud-appid").SelfServiceManager;
let selfServiceManager = new SelfServiceManager({
	iamApiKey: "{iam-api-key}",
	managementUrl: "{management-url}"
});
```

The self service manger exposed the following APIs, each API can get 'iamToken' as optional parameter, if passed it will be added to the App ID management request.
You must supply 'iamApikey' to the selfServiceManager otherwise you must supply the 'iamToken' to each of the selfServiceManager APIs.

#### Sign-up
Sign up a new user.
userData is a JSON object with the user SCIM profile (https://tools.ietf.org/html/rfc7643#page-35).
language currently unused, default to 'en'.

```javascript
selfServiceManager.signUp(userData, language, iamToken).then(function (user) {
			logger.debug('user created successfully');
		}).catch(function (err) {
			logger.error(err);
		});
	}
```

#### Forgot Password
Forgot password flow.
email is the user email that request the forgot password request.
language currently unused, default to 'en'.

```javascript
selfServiceManager.forgotPassword(email, language, iamToken).then(function (user) {
			logger.debug('forgot password success');
		}).catch(function (err) {
			logger.error(err);
		});
	}
```

#### Resend Notification
Resend notification.
uuid is the Cloud Directory user uuid.
templateName is the template to be send.
language currently unused, default to 'en'.

```javascript
selfServiceManager.resendNotification(uuid, templateName, language, iamToken).then(function () {
			logger.debug('resend success');
		}).catch(function (err) {
			logger.error(err);
		});
	}
```
#### Get Sign-up confirmation result
Get the stored result for the sign up confirmation.
This should be called to verify the authenticity of the sign up verification.
context is a random string that will be supply by App ID, for authenticity purposes.
return a JSON with a 'success' and 'uuid' properties. if 'success' is false additional 'error' property containing 'code' and 'description' properties will be added.

```javascript
selfServiceManager.getSignUpConfirmationResult(context, iamToken).then(function (result) {
			logger.debug('returned result: ' + JSON.stringify(result));
		}).catch(function (err) {
			logger.error(err);
		});
	}
```
#### Get Forgot password confirmation result
Get the stored result for the forgot password confirmation.
This should be called to verify the authenticity of the forgot password request.
context is a random string that will be supply by App ID, for authenticity purposes.
return a JSON with a 'success' and 'uuid' properties. if 'success' is false additional 'error' property containing 'code' and 'description' properties will be added.

```javascript
selfServiceManager.getForgotPasswordConfirmationResult(ucontext, iamToken).then(function (result) {
            logger.debug('returned result: ' + JSON.stringify(result));
		}).catch(function (err) {
			logger.error(err);
		});
	}
```
#### Set User new password
Change the user passowrd.
uuid is the Cloud Directory user uuid.
newPassword the new password to be set.
language currently unused, default to 'en'.
changedIpAddress (optional) is the ip address that trigger the change password request, if supply the placeholder %{passwordChangeInfo.ipAddress} will be available with that value, for change password email template.

```javascript
selfServiceManager.setUserNewPassword(uuid, newPassword, language, changedIpAddress, iamToken).then(function (user) {
			logger.debug('user password changed');
		}).catch(function (err) {
			logger.error(err);
		});
	}
```
#### Get user details
Gets the stored details of the Cloud directory user.
uuid is the Cloud Directory user uuid.

```javascript
selfServiceManager.getUserDetails(uuid, iamToken).then(function (user) {
			logger.debug('user details:'  + JSON.stringify(user));
		}).catch(function (err) {
			logger.error(err);
		});
	}
```
#### Update user details
update the user details.
uuid is the Cloud Directory user uuid.
userData is a JSON object with the updated user SCIM profile (https://tools.ietf.org/html/rfc7643#page-35).

```javascript
selfServiceManager.updateUserDetails(uuid, userData, iamToken).then(function (user) {
			logger.debug('user created successfully');
		}).catch(function (err) {
			logger.error(err);
		});
	}
```

### Logging
This SDK uses the log4js package for logging. By default the logging level is set to `info`. To create your own logging configuration for your application, add a log4js.json file and set the `process.env.LOG4JS_CONFIG` environment variable to your json file.

To learn more about log4js, visit the documentation here (https://log4js-node.github.io/log4js-node/).

## Got Questions?
Join us on [Slack](https://www.ibm.com/cloud/blog/announcements/get-help-with-ibm-cloud-app-id-related-questions-on-slack) and chat with our dev team.


### Logging
This SDK uses the log4js package for logging. By default the logging level is set to `info`. To create your own logging configuration for your application, add a log4js.json file and set the `process.env.LOG4JS_CONFIG` environment variable to your json file.

To learn more about log4js, visit the documentation here (https://log4js-node.github.io/log4js-node/).


### License
This package contains code licensed under the Apache License, Version 2.0 (the "License"). You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0 and may also view the License in the LICENSE file within this package.

[img-ibmcloud-powered]: https://img.shields.io/badge/ibm%20cloud-powered-blue.svg
[url-ibmcloud]: https://www.ibm.com/cloud/
[url-npm]: https://www.npmjs.com/package/ibmcloud-appid
[img-license]: https://img.shields.io/npm/l/ibmcloud-appid.svg
[img-version]: https://img.shields.io/npm/v/ibmcloud-appid.svg
[img-npm-downloads-monthly]: https://img.shields.io/npm/dm/ibmcloud-appid.svg
[img-npm-downloads-total]: https://img.shields.io/npm/dt/ibmcloud-appid.svg

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
