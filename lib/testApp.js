const express = require('express');
const session = require('express-session')
const log4js = require('log4js');
const logger = log4js.getLogger("testApp");
const passport = require('passport');

const AppIDSDK = require('./index');
const APIStrategy = AppIDSDK.APIStrategy;
const WebAppStrategy = AppIDSDK.WebAppStrategy;

const app = express();
app.use(session({
	secret: '123456',
	resave: true,
	saveUninitialized: true
}));

AppIDSDK.init({
	tenantId: "e9be2ca6-b280-43b9-b3b9-d03809d8390f",
	clientId: "e9be2ca6-b280-43b9-b3b9-d03809d8390f",
	secret: "NjBlNmQ3ZDctMjUyZC00ZGYyLWIzYjItNTVjN2ZkN2JiNmZm",
	authorizationEndpoint: "https://mobileclientaccess.stage1-dev.ng.bluemix.net/oauth/v3/e9be2ca6-b280-43b9-b3b9-d03809d8390f/authorization",
	tokenEndpoint: "https://mobileclientaccess.stage1-dev.ng.bluemix.net/oauth/v3/e9be2ca6-b280-43b9-b3b9-d03809d8390f/token",
	redirectUriHost: "http://localhost:1234"
});

app.use(express.static("public"));
app.use(passport.initialize());
app.use(passport.session());

// passport.use(new APIStrategy());
passport.use(new WebAppStrategy(app, passport));

// app.get("/api/protected",
// 	passport.authenticate(APIStrategy.STRATEGY_NAME, {
// 		session: false,
// 		scope: "default"
// 	}),
// 	function(req, res) {
// 		res.json(req.appIdAuthorizationContext || {});
// 	}
// );

app.get("/webapp", passport.authenticate(WebAppStrategy.STRATEGY_NAME), function(req, res){
	res.send("web works!");
});

app.listen(1234, function(){
	logger.info("Listening on http://localhost:1234");
});

