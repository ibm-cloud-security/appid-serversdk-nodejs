const express = require("express");
const log4js = require("log4js");
const passport = require("passport");
const APIStrategy = require("./../lib/appid-sdk").APIStrategy;

const app = express();
const logger = log4js.getLogger("testApp");

app.use(passport.initialize());

passport.use(new APIStrategy({
	tenantId: "e9be2ca6-b280-43b9-b3b9-d03809d8390f",
	serverUrl: "https://workingfromhome.stage1.mybluemix.net/imf-authserver"
}));

app.get("/api/protected",
	passport.authenticate(APIStrategy.STRATEGY_NAME, {
		session: false,
		scope: "default" // TODO: Change to appid_default after server side update
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

