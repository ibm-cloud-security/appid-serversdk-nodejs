const express = require('express');
const session = require('express-session')
const log4js = require('log4js');
const logger = log4js.getLogger("testApp");
const passport = require('passport');
const pug = require('pug');

const WebAppStrategy = require('./../lib/appid-sdk').WebAppStrategy;

const app = express();
app.use(session({
	secret: '123456',
	resave: true,
	saveUninitialized: true
}));
pug.basedir = "samples";
app.set('view engine', 'pug');
app.set('views', './samples/views');
app.use(passport.initialize());
app.use(passport.session());

passport.use(new WebAppStrategy({
	tenantId: "e9be2ca6-b280-43b9-b3b9-d03809d8390f",
	clientId: "e9be2ca6-b280-43b9-b3b9-d03809d8390f",
	secret: "NjBlNmQ3ZDctMjUyZC00ZGYyLWIzYjItNTVjN2ZkN2JiNmZm",
	authorizationEndpoint: "https://workingfromhome.stage1.mybluemix.net/oauth/v3/e9be2ca6-b280-43b9-b3b9-d03809d8390f/authorization",
	tokenEndpoint: "https://workingfromhome.stage1.mybluemix.net/oauth/v3/e9be2ca6-b280-43b9-b3b9-d03809d8390f/token",
	redirectUri: "http://localhost:1234/oauth/callback"
}));

app.get("/", function(req, res, next) {
	res.render("index.pug", {});
});

app.get("/ibm/bluemix/appid/login", passport.authenticate(WebAppStrategy.STRATEGY_NAME, {
	failureRedirect: "/"
}));

app.get("/ibm/bluemix/appid/callback", passport.authenticate(WebAppStrategy.STRATEGY_NAME, {
	failureRedirect: "/"
}));

app.get("/ibm/bluemix/appid/logout", function(req, res){
	req.logout();
	res.redirect("/");
});

app.listen(1234, function(){
	logger.info("Listening on http://localhost:1234");
});

