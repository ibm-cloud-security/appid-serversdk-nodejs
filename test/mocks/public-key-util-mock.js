const pemFromModExp = require('rsa-pem-from-mod-exp');

const DEV_PUBLIC_KEY = {"kty":"RSA","n":"AKSd08Gubj4wkfVNcy1g2aDD2SP4rSAxqqSpq3ByTQw1A4NRlN/2obyaU/NSA0o2kBWLDX3bNO4tyBqdNHzcEhYuMWaafteurPx9/Li6Ng4HxMgk/MucCqPerDN6pf6IGxJxWXUT3R949XJGtPNVwRCey1iheFcUp5M4LGZxHfZfkg/YVHOu5Fsx6f0aL2Q/6QbUEle2ZkwHz9Gh8OLoLcVq/yBk9bHV46DYQwNk3/pQcd8tgmxpRYED6X2O7PdjEm6NU6ZE17meux0J/TKUpyZzCUeMYyoQbuC2KscHO6KbpkTJaUg+OygNIAN/Fwy7hljCXVAs05LgIVdjpHiDBrM=","e":"AQAB"};

module.exports = {
	retrievePublicKey: function(){
		throw "NOT IMPLEMENTED";
	},

	getPublicKeyPem: function () {
		return pemFromModExp(DEV_PUBLIC_KEY.n, DEV_PUBLIC_KEY.e);
	}
}