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
const log4js = require("log4js");
const passport = require("passport");
const APIStrategy = require("./../lib/appid-sdk").APIStrategy;
const helmet = require("helmet");

const app = express();
const logger = log4js.getLogger("testApp");

app.use(helmet());
app.use(passport.initialize());

passport.use(new APIStrategy({
	oauthServerUrl: "{oauth-server-url}"
}));

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
		var username = req.user ? req.user.name : "Anonymous";
		res.send("Hello from protected resource " + username);
	}
);

var port = process.env.PORT || 1234;

app.listen(port, function(){
	logger.info("Send GET request to http://localhost:" + port + "/api/protected");
});

