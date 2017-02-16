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
const UserAttributeManager = require("./../lib/appid-sdk").UserAttributeManager;

const app = express();
const logger = log4js.getLogger("testApp");

// UserAttributeManager.init({
// 	serverUrl: "https://user-profiles-bluemix.com/v1/api"
// });
// UserAttributeManager.getAttribute("a","b","c");

app.use(passport.initialize());

passport.use(new APIStrategy({
	tenantId: "50d0beed-add7-48dd-8b0a-c818cb456bb4",
	// oauthServerUrl: "https://mobileclientaccess.stage1.mybluemix.net/oauth/v3/50d0beed-add7-48dd-8b0a-c818cb456bb4"
	oauthServerUrl: "https://imf-authserver.stage1.mybluemix.net/imf-authserver/authorization/v1/apps/50d0beed-add7-48dd-8b0a-c818cb456bb4"
}));

app.get("/api/protected",
	passport.authenticate(APIStrategy.STRATEGY_NAME, {
		session: false
	}),
	function(req, res) {
		var appIdAuthContext = req.appIdAuthorizationContext;
		var username = "Anonymous";
		if (appIdAuthContext.identityTokenPayload){
			username = appIdAuthContext.identityTokenPayload.name;
		}
		logger.debug(req.appIdAuthorizationContext);
		res.send("Hello from protected resource " + username);
	}
);

var port = process.env.PORT || 1234;

app.listen(port, function(){
	logger.info("Send GET request to http://localhost:" + port + "/api/protected");
});

