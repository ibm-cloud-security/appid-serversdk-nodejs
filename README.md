# IBM Cloud App ID Node.js SDK

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

Application security can be incredibly complicated. For most developers, it's one of the hardest part of creating an app. How can you be sure that you are protecting your users information? By integrating IBM® Cloud App ID into your apps, you can secure resources and add authentication; even when you don't have a lot of security experience.

By requiring users to sign in to your app, you can store user data such as app preferences or information from the public social profiles, and then use that data to customize each experience of your app. App ID provides a log in framework for you, but you can also bring your own branded sign in screens when working with cloud directory.

For more information about how you might use App ID, check out our [official docs](https://console.ng.bluemix.net/docs/services/appid/index.html)!

## Table of Contents
* [Summary](#summary)
* [Requirements](#requirements)
* [Installation](#installation)
* [Example Usage: APIs](#example-usage-api)
* [Example Usage: Web apps](#example-usage-web)
* [License](#license)

## Summary

With this SDK you can protect two different types of resources: APIs and Web apps. By using Passport.js strategies the SDK creates a challenge for the client that is specific to the type of resource.

<dl>
	<dt>API strategy</dt>
		<dd> The API strategy is used to protect your APIs and back-end resources. Clients that are authenticated, can gain access to the resource, while those that are not receive an HTTP 401 response. Unauthenticated users also receive a message that can allow them to obtain authorization.</dd>
	<dt>Web app strategy</dt>
		<dd>The web app strategy allows you to challenge a client's authentication prior to giving them access to your application. If a user is unauthenticated, they are redirected to a sign in page that is hosted by App ID.</dd>
</dl>


## Requirements

You must have the following requirements:
* npm 4.+
* node 6.+
* An instance of the App ID service

## Installing the SDK

1. Add the following code to your application.
	```
	npm install --save bluemix-appid
	```
2. To replicate the example in your own code, you'll need to install the following npm modules into your Node.js app.
	```
	npm install --save express
	npm install --save log4js
	npm install --save passport
	npm install --save express-session
	npm install --save pug
	```
	

## Example Usage: Protecting APIs

When using the API strategy, you are going to be using the following header structure:

	```
	Authorization=Bearer {access_token} [{id_token}]
	```

The API strategy expects a request to contain an authorization header with a valid access token. The header might also contain an identity token, but it is not required. If the token is invalid or expired, the API strategy returns an HTTP 401 with an optional `error` component: `Www-Authenticate=Bearer scope="{scope}" error="{error}"`. If the tokens are valid, control is passed to the the next middleware with the `appIdAuthorizationContext` injected into the request object. The property contains the original access and identity tokens as well as decoded payload information as plain JSON objects.

For more information about the different types of tokens, see [key concepts](https://console.bluemix.net/docs/services/appid/authorization.html#key-concepts).


Example code:

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


## Example Usage: Protecting web applications

If your application is web based, you can use the web app strategy. The strategy is based on the OAuth2 authorization_code grant flow. It provides the tools to help you easily implement authentication and authorization into your apps.

The web app strategy provides the mechanisms to detect any attempts to access protected resources. If the strategy detects an unauthenticated attempt, the user is automatically redirected to the authentication page. Once the user is successfully authenticated, they are taken to the web app's callback URL, or `redirectUri`. At this point, the web app strategy is used to obtain access, identity, and refresh tokens from the App ID service. After these tokens are obtained, the web app strategy stores them in an HTTP session in the `WebAppStrategy.AUTH_CONTEXT` key. 

	>Tip: If you are working in a scalable cloud environment, we recommend that you persist HTTP sessions in scalable storage to ensure that they're available across all of your instances.

Example code:

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

### Anonymous login

With the web app strategy, users can access your web app anonymously. This means that they can access your app without providing any credentials. For more information about how to use anonymous log in, see [How the process works](https://console.bluemix.net/docs/services/appid/authorization.html#process)!

To allow anonymous activity for a particular URL, use the following two properties. They are also shown in the code snippet. 

<dl>
	<dt><code>allowAnonymousLogin</code></dt>
		<dd>To allow users to access your endpoint anonymously, set this value to <code>true</code>. The default value, <code>false</code>, requires authentication. You must explicitly set this value to allow anonymous log in.</dd>
	<dt><code>allowCreateNewAnonymousUser</code></dt>
		<dd>By default, a new anonymous user is created every time this value is invoked unless there's an existing anonymous access_token that is stored in the current HTTP session. If you do not want users to be automatically created as anonymous, you must set this value to <code>false</code></dd>
</dl>

Example code:

```JavaScript
const LOGIN_ANON_URL = "/ibm/bluemix/appid/loginanon";

// Explicit anonymous login endpoint
app.get(LOGIN_ANON_URL, passport.authenticate(WebAppStrategy.STRATEGY_NAME, {
	successRedirect: LANDING_PAGE_URL,
	allowAnonymousLogin: true,
	allowCreateNewAnonymousUser: true
}));
```

	>Tip: Just like the previous tokens, anonymous access, identity, and refresh tokens are automatically persisted in each HTTP session and can be retrieved the same way.

## Refresh Token

A refresh token can be used to get new access and identity tokens with out re-authenticating. A refresh token is usually configured with a longer expiration time than an access token. Refresh tokens are optional and can be configured through the App ID dashboard.

In addition to an access token and identity token, a refresh token is persisted in the HTTP session. You can persist the refresh token in any method that you'd like. By persisting the token, users won't need to login again even after the HTTP session is expired provided that the refresh token is still valid. 

You can see an example of a refresh token in a cookie and how to use it, in the `web-app-sample-server.js` file.

To use the persisted refresh token, call `webAppStrategy.refreshTokens(request, refreshToken)`. A promise is returned by `refreshTokens()`. After the promise is resolved, the user is authenticated and new tokens are generated and persisted in the HTTP session. If the promise is rejected, the user will not gain access and will need to authenticate again.


## User profile attributes

You can use the `UserAttributeManager` to store and retrieve user attributes.


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


## Cloud Directory

You can allow App ID to help you maintain a user registry when you use cloud directory as your identity provider. For help configuring your cloud directory settings, [check out our docs](https://console.bluemix.net/docs/services/appid/cloud-directory.html)! 


### Login with the resource owner password flow

With the web app strategy, users can log in to your web app with a username and password. Their access token is persisted in the HTTP session for the length of the session. When the session is destroyed or expired, the access token is also destroyed.

To allow users to log in with a username and password, add a post route with username and password parameters.

```javascript
app.post("/form/submit", bodyParser.urlencoded({extended: false}), passport.authenticate(WebAppStrategy.STRATEGY_NAME, {
	successRedirect: LANDING_PAGE_URL,
	failureRedirect: ROP_LOGIN_PAGE_URL,
	failureFlash : true // allow flash messages
}));
```

<table>
	<tr>
		<th>Parameter</th>
		<th>Explanation</th>
	</tr>
	<tr>
		<td><code>successRedirect</code></td>
		<td>Set this value to the URL that you want users to be redirected to after a successful authentication. The default value is the original request URL. In the example: <code>/form/submit</code>.</td>
	</tr>
	<tr>
		<td><code>failureRedirect</code></td>
		<td>Set this value to the URL that you want users to be redirected to if authentication fails. The default value is the original request URL. In the example: <code>/form/submit</code>.</td>
	</tr>
	<tr>
		<td><code>failureFlash</code></td>
		<td>Set this value to the true to receive the error message that is returned from cloud directory should authentication fail. The default value is <code>false</code>.</td>
	</tr>
</table>

Note:
	1. If you're submitting the request with an html form, use [body-parser](https://www.npmjs.com/package/body-parser) middleware.
	2. You can use [connect-flash](https://www.npmjs.com/package/connect-flash) to get the returned error message. See the `web-app-sample-server.js` for an example.

### Sign up

To launch the sign up form, pass the web app strategy `show` property as `WebAppStrategy.SIGN_UP`.

```javascript
app.get("/sign_up", passport.authenticate(WebAppStrategy.STRATEGY_NAME, {
	successRedirect: LANDING_PAGE_URL,
	show: WebAppStrategy.SIGN_UP
}));
```

Note:
1. **Allow users to sign-in without email verification** must be set to **Yes** in your cloud directory settings. If not, the process will end without retrieving App ID access and id tokens.
2. Be sure to set **Allow users to sign up and reset their password" to **ON**, in the settings for Cloud Directory.


### Forgot Password

To launch the forgot password form, pass the web app strategy `show` property as `WebAppStrategy.FORGOT_PASSWORD`.

```javascript
app.get("/forgot_password", passport.authenticate(WebAppStrategy.STRATEGY_NAME, {
	successRedirect: LANDING_PAGE_URL,
	show: WebAppStrategy.FORGOT_PASSWORD
}));
```

Note:
1. **Allow users to sign-in without email verification** must be set to **Yes** in your cloud directory settings. If not, the process will end without retrieving App ID access and id tokens.
2. Be sure to set **Allow users to sign up and reset their password"** and **Forgot password email** to **ON**, in the settings for cloud directory.


### Change Details

To launch the change details form, pass the web app strategy `show` property as `WebAppStrategy.CHANGE_DETAILS`.

```javascript
app.get("/change_details", passport.authenticate(WebAppStrategy.STRATEGY_NAME, {
	successRedirect: LANDING_PAGE_URL,
	show: WebAppStrategy.CHANGE_DETAILS
}));
```

Note:
1. This call requires that the user is authenticated with cloud directory.
2. Be sure to set **Allow users to sign up and reset their password"** to **ON**, in the settings for cloud directory.

### Change Password

To launch the change password form, pass the web app strategy `show` property as `WebAppStrategy.CHANGE_PASSWORD`.

```javascript
app.get("/change_password", passport.authenticate(WebAppStrategy.STRATEGY_NAME, {
	successRedirect: LANDING_PAGE_URL,
	show: WebAppStrategy.CHANGE_PASSWORD
}));
```

Note:
1. This call requires that the user is authenticated with cloud directory.
2. Be sure to set **Allow users to sign up and reset their password"** to **ON**, in the settings for cloud directory.



## Self Service APIs

To display your own screens for sign-up, sign-in, forgot password, change detail, and change password you can use the APIs. 


You can initialize the `selfServiceManager` with the following options:

* `iamApiKey`: If supplied, the key is used to get an IAM token before each `selfServiceManager` request.
* `managementUrl`: The App ID management url.

```javascript
// The managementUrl value can be obtained from Service Credentials
// tab in the App ID Dashboard. You're not required to provide this argument if
// your node.js application runs on IBM Cloud and is bound to the
// App ID service instance. In this case App ID configuration will be obtained
// using VCAP_SERVICES environment variable.
// Note: If your Service Credentials does not contain managementUrl you can supply the tenantId, and the oauthServerUrl instead.
const SelfServiceManager = require("bluemix-appid").SelfServiceManager;
let selfServiceManager = new SelfServiceManager({
	iamApiKey: "{iam-api-key}",
	managementUrl: "{management-url}"
});
```

The self service manager exposes the API so that it can get an IAM token as an optional parameter. If it's passed, it gets added to the App ID management request. If you choose not to supply the `iamApikey` to the `selfServiceManager`, you'll have to supply the `iamToken` to each of the APIs.

### Sign-up

You can sign up a new user.

`userData` is specified as a JSON object with an [SCIM profile](https://tools.ietf.org/html/rfc7643#page-35). Currently the default language is English (en) and it cannot be changed.

```javascript
selfServiceManager.signUp(userData, language, iamToken).then(function (user) {
			logger.debug('user created successfully');
		}).catch(function (err) {
			logger.error(err);
		});
	}
```

<table>
	<tr>
		<th>Parameter</th>
		<th>Explanation</th>
	</tr>
	<tr>
		<td><code>userData</code></td>
		<td>Specified as a JSON object with an <a href="https://tools.ietf.org/html/rfc7643#page-35" >SCIM profile </a>.</td>
	</tr>
	<tr>
		<td><code>language</code></td>
		<td>Currently the default language is English (en) and it cannot be changed.</td>
	</tr>
	<tr>
		<td><code>iamToken</code></td>
		<td>You only need to provide this token if you did not supply the <code>iamApikey</code> to the <code>selfServiceManager</code>.</td>
	</tr>
</table>

### Forgot Password

You can allow a user to recover their forgotten password.

```javascript
selfServiceManager.forgotPassword(email, language, iamToken).then(function (user) {
			logger.debug('forgot password success');
		}).catch(function (err) {
			logger.error(err);
		});
	}
```

<table>
	<tr>
		<th>Parameter</th>
		<th>Explanation</th>
	</tr>
	<tr>
		<td><code>email</code></td>
		<td>The email of the user that wants to recover their password.</td>
	</tr>
	<tr>
		<td><code>language</code></td>
		<td>Currently the default language is English (en) and it cannot be changed.</td>
	</tr>
	<tr>
		<td><code>iamToken</code></td>
		<td>You only need to provide this token if you did not supply the <code>iamApikey</code> to the <code>selfServiceManager</code>.</td>
	</tr>
</table>

### Resend Notification

You can resend a notification if a user happened to not receive it for some reason.

```javascript
selfServiceManager.resendNotification(uuid, templateName, language, iamToken).then(function () {
			logger.debug('resend success');
		}).catch(function (err) {
			logger.error(err);
		});
	}
```

<table>
	<tr>
		<th>Parameter</th>
		<th>Explanation</th>
	</tr>
	<tr>
		<td><code>uuid</code></td>
		<td>The unique identifier within cloud directory for that specific user.</td>
	</tr>
	<tr>
		<td><code>templateName</code></td>
		<td>The notification template that you want to send.</td>
	</tr>
	<tr>
		<td><code>language</code></td>
		<td>Currently the default language is English (en) and it cannot be changed.</td>
	</tr>
	<tr>
		<td><code>iamToken</code></td>
		<td>You only need to provide this token if you did not supply the <code>iamApikey</code> to the <code>selfServiceManager</code>.</td>
	</tr>
</table>


### Get Sign-up confirmation result

You can verify the authenticity of sign up verification by calling the confirmation result.

```javascript
selfServiceManager.getSignUpConfirmationResult(context, iamToken).then(function (result) {
			logger.debug('returned result: ' + JSON.stringify(result));
		}).catch(function (err) {
			logger.error(err);
		});
	}
```

<table>
	<tr>
		<th>Parameter</th>
		<th>Explanation</th>
	</tr>
	<tr>
		<td><code>context</code></td>
		<td>A random string that is supplied by App ID for authenticity purposes.</td>
	</tr>
	<tr>
		<td><code>iamToken</code></td>
		<td>You only need to provide this token if you did not supply the <code>iamApikey</code> to the <code>selfServiceManager</code>.</td>
	</tr>
</table>

A JSON object is returned whether the result is successful or not. If successful, `success` and `uuid` properties are returned. If not, an `error` property that contains `code` and `description` properties.


### Get Forgot password confirmation result

You can verify the authenticity of a forgot password request by calling the confirmation result.

```javascript
selfServiceManager.getForgotPasswordConfirmationResult(ucontext, iamToken).then(function (result) {
            logger.debug('returned result: ' + JSON.stringify(result));
		}).catch(function (err) {
			logger.error(err);
		});
	}
```
<table>
	<tr>
		<th>Parameter</th>
		<th>Explanation</th>
	</tr>
	<tr>
		<td><code>context</code></td>
		<td>A random string that is supplied by App ID for authenticity purposes.</td>
	</tr>
	<tr>
		<td><code>iamToken</code></td>
		<td>You only need to provide this token if you did not supply the <code>iamApikey</code> to the <code>selfServiceManager</code>.</td>
	</tr>
</table>

A JSON object is returned whether the result is successful or not. If successful, `success` and `uuid` properties are returned. If not, an `error` property that contains `code` and `description` properties.


### Update a user's password

A user's password can be changed should they need to update it for any reason.

```javascript
selfServiceManager.setUserNewPassword(uuid, newPassword, language, changedIpAddress, iamToken).then(function (user) {
			logger.debug('user password changed');
		}).catch(function (err) {
			logger.error(err);
		});
	}
```

<table>
	<tr>
		<th>Parameter</th>
		<th>Explanation</th>
	</tr>
	<tr>
		<td><code>uuid</code></td>
		<td>The unique identifier within cloud directory for that specific user.</td>
	</tr>
	<tr>
		<td><code>newPassword</code></td>
		<td>The new password that the user wants to choose.</td>
	</tr>
	<tr>
		<td><code>language</code></td>
		<td>Currently the default language is English (en) and it cannot be changed.</td>
	</tr>
	<tr>
		<td><code>changedIpAddress</code></td>
		<td>Optional: The IP address that triggered the request to change the password. If supplied, the place holder, <code>%{passwordChangeInfo.ipAddress}</code> is available with that value for the change password email template.</td>
	</tr>
	<tr>
		<td><code>iamToken</code></td>
		<td>You only need to provide this token if you did not supply the <code>iamApikey</code> to the <code>selfServiceManager</code>.</td>
	</tr>
</table>


### Get user details

You can get the stored details for a specific user.

```javascript
selfServiceManager.getUserDetails(uuid, iamToke).then(function (user) {
			logger.debug('user details:'  + JSON.stringify(user));
		}).catch(function (err) {
			logger.error(err);
		});
	}
```

<table>
	<tr>
		<th>Parameter</th>
		<th>Explanation</th>
	</tr>
	<tr>
		<td><code>uuid</code></td>
		<td>The unique identifier within cloud directory for that specific user.</td>
	</tr>
	<tr>
		<td><code>iamToken</code></td>
		<td>You only need to provide this token if you did not supply the <code>iamApikey</code> to the <code>selfServiceManager</code>.</td>
	</tr>
</table>


### Update user details

You can allow users to update their information.

```javascript
selfServiceManager.updateUserDetails(uuid, userData, iamToken).then(function (user) {
			logger.debug('user created successfully');
		}).catch(function (err) {
			logger.error(err);
		});
	}
```
<table>
	<tr>
		<th>Parameter</th>
		<th>Explanation</th>
	</tr>
	<tr>
		<td><code>uuid</code></td>
		<td>The unique identifier within cloud directory for that specific user.</td>
	</tr>
	<tr>
		<td><code>userData</code></td>
		<td>Specified as a JSON object with an <a href="https://tools.ietf.org/html/rfc7643#page-35" >SCIM profile </a>.</td>
	</tr>
	<tr>
		<td><code>iamToken</code></td>
		<td>You only need to provide this token if you did not supply the <code>iamApikey</code> to the <code>selfServiceManager</code>.</td>
	</tr>
</table>


## License
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

