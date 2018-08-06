const express = require('express');
const session = require('express-session');
const passport = require('passport');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const log4js = require('log4js');
const logger = log4js.getLogger('custom-identity-sample-app');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const AppID = require('../lib/appid-sdk');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(helmet());
app.use(cookieParser());
app.use(express.static(__dirname));
app.set('view engine', 'ejs');
app.use(session({
	secret: '123456',
	resave: true,
	saveUninitialized: true
}));

const LANDING_PAGE_URL = '/';
const LOGIN_URL = '/login';
const PROTECTED_URL = '/protected';
const APPID_AUTH_CONTEXT = 'AppID_Auth_context';

const tokenManager = new AppID.TokenManager({
	tenantId: 'd4fe200a-70b0-4d3b-9396-e7ab614b4c7b',
	clientId: 'e1af2a92-8f65-4780-bf55-63b08270191c',
	secret: 'ZGUxY2UzNmMtNjdjZS00OTA2LTllZTQtOTZlNmVmNGYyZTgx',
	oauthServerUrl: 'https://appid-oauth.stage1.eu-gb.bluemix.net/oauth/v3/d4fe200a-70b0-4d3b-9396-e7ab614b4c7b',
});

app.get(LANDING_PAGE_URL, (req, res) => {
	res.send('Hello, there');
});

app.get(LOGIN_URL, (req, res) => {
	res.render('custom_identity_login', { message: null });
});

app.post(LOGIN_URL, (req, res) => {
	if (req.body.username === req.body.password) {

		const sampleToken = {
			header: {
				alg: 'RS256',
				kid: 'sample-rsa-private-key'
			},
			payload: {
				iss: 'sample-appid-custom-identity',
				sub: 'sample-unique-user-id',
				aud: tokenManager.serviceConfig.getOAuthServerUrl().split('/')[2],
				exp: 9999999999,
				name: req.body.username,
				scope: 'customScope'
			}
		};

		const generateSignedJWT = (privateKey) => {
			const { header, payload } = sampleToken;
			return jwt.sign(payload, privateKey, { header });
		};

		const privateKey = fs.readFileSync('./resources/private.pem');
		jwsTokenString = generateSignedJWT(privateKey);

		tokenManager.getCustomIdentityTokens(jwsTokenString).then((authContext) => {
			req.session[APPID_AUTH_CONTEXT] = {...authContext};
			req.session[APPID_AUTH_CONTEXT].identityTokenPayload = jwt.decode(authContext.identityToken);
			req.session[APPID_AUTH_CONTEXT].accessTokenPayload = jwt.decode(authContext.accessToken);
			res.redirect(PROTECTED_URL);
		}).catch((error) => {
			res.render('custom_identity_login', { message: error });
		});

	} else {
		res.render('custom_identity_login', { message: 'Login Failed' });
	}
});

app.get(PROTECTED_URL, (req, res) => {
	const appIdAuthContext = req.session[APPID_AUTH_CONTEXT];
	const username = appIdAuthContext.identityTokenPayload.name;
	res.send(`Hello ${username}, This is a protected resource`);
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
	logger.info(`Listening on http://localhost:${port}`);
});
