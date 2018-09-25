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

const express = require('express');
const session = require('express-session');
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

const LOGIN_URL = '/login';
const PROTECTED_URL = '/protected';
const APPID_AUTH_CONTEXT = 'AppID_Auth_context';

const tokenManager = new AppID.TokenManager({
	clientId: '{client-id}',
	secret: '{secret}',
	oauthServerUrl: '{oauth-server-url}',
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

		logger.info(`Generated JWS: ${jwsTokenString}`);
		logger.debug('Calling tokenManager.getCustomIdentityTokens()');

		tokenManager.getCustomIdentityTokens(jwsTokenString).then((authContext) => {
			// authContext.accessToken: Access token string
			// authContext.identityToken: Identity token string
			// authContext.tokenType: Type of tokens
			// authContext.expiresIn: Expiry of tokens

			logger.info(`Access token string: ${authContext.accessToken}`);
			logger.info(`Identity token string: ${authContext.identityToken}`);

			req.session[APPID_AUTH_CONTEXT] = authContext;
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
