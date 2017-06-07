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

const pemFromModExp = require("rsa-pem-from-mod-exp");

const DEV_PUBLIC_KEY = {"kty":"RSA","n":"AKSd08Gubj4wkfVNcy1g2aDD2SP4rSAxqqSpq3ByTQw1A4NRlN/2obyaU/NSA0o2kBWLDX3bNO4tyBqdNHzcEhYuMWaafteurPx9/Li6Ng4HxMgk/MucCqPerDN6pf6IGxJxWXUT3R949XJGtPNVwRCey1iheFcUp5M4LGZxHfZfkg/YVHOu5Fsx6f0aL2Q/6QbUEle2ZkwHz9Gh8OLoLcVq/yBk9bHV46DYQwNk3/pQcd8tgmxpRYED6X2O7PdjEm6NU6ZE17meux0J/TKUpyZzCUeMYyoQbuC2KscHO6KbpkTJaUg+OygNIAN/Fwy7hljCXVAs05LgIVdjpHiDBrM=","e":"AQAB"};

module.exports = {
	retrievePublicKey: function(){
		
	},

	getPublicKeyPem: function () {
		return pemFromModExp(DEV_PUBLIC_KEY.n, DEV_PUBLIC_KEY.e);
	}
}