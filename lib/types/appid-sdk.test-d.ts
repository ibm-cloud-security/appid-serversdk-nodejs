// Author : Younes A <https://github.com/younes-io>
import {
	APIStrategy,
	ApplicationIdentityToken,
	SelfServiceManager,
	Strategy,
	TokenManager,
	UserSCIM,
	WebAppStrategy,
} from "./appid-sdk";
import { expectType } from "tsd";

expectType<Strategy>(
	new APIStrategy({
		oauthServerUrl: "{oauth-server-url}",
	})
);

expectType<Strategy>(
	new WebAppStrategy({
		tenantId: "{tenant-id}",
		clientId: "{client-id}",
		secret: "{secret}",
		oauthServerUrl: "{oauth-server-url}",
		redirectUri: "{app-url}" + "CALLBACK_URL",
	})
);

const config = {
	tenantId: "{tenant-id}",
	clientId: "{client-id}",
	secret: "{secret}",
	oauthServerUrl: "{oauth-server-url}",
};

const tokenManager = new TokenManager(config);
expectType<ApplicationIdentityToken | Error>(
	await tokenManager.getApplicationIdentityToken()
);

const selfServiceManager = new SelfServiceManager({
	iamApiKey: "{iam-api-key}",
	managementUrl: "{management-url}",
});

const userData = {
	id: "2819c223-7f76-453a-919d-413861904646",
	externalId: "701984",
	userName: "bjensen@example.com",
};

expectType<UserSCIM>(
	await selfServiceManager.signUp(userData, "en", "iamToken")
);