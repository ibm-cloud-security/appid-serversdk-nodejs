const chai = require("chai");
const assert = chai.assert;
const proxyquire = require("proxyquire");
const testServerUrl = "https://mobileclientaccess.ng.bluemix.net/imf-authserver";
const testTenantId = "dummy-tenant-id";


describe('/lib/utils/public-key-util', function(){
	console.log("Loading public-key-util-test.js");

	var PublicKeyUtil;

	before(function(){
		PublicKeyUtil = proxyquire("../lib/utils/public-key-util", {
			"request": require("./mocks/request-mock")
		});
	});

	this.timeout(5000);

	describe('#retrievePublicKey()', function(){
		it('Should fail retrieving public key from the server', function(done){
			PublicKeyUtil.retrievePublicKey(testTenantId, testServerUrl + "FAIL-PUBLIC-KEY").then(function(){
				done(new Error("This is impossible!!!"));
			}).catch(function(err){
				done();
			})
		});
	});

	describe("#getPublicKeyPem()", function(){
		it("Should fail to get previously retrieved public key", function(){
			var publicKey = PublicKeyUtil.getPublicKeyPem();
			assert.isUndefined(publicKey);
		});
	});

	describe('#retrievePublicKey()', function(){
		it('Should successfully retrieve public key from OAuth server', function(done){
			PublicKeyUtil.retrievePublicKey(testTenantId, testServerUrl + "SUCCESS-PUBLIC-KEY").then(function(){
				done();
			}).catch(function(err){
				done(new Error(err));
			})
		});
	});

	describe("#getPublicKeyPem()", function(){
		it("Should get previously retrieved public key", function(){
			var publicKey = PublicKeyUtil.getPublicKeyPem();
			assert.isNotNull(publicKey);
			assert.isString(publicKey);
			assert.include(publicKey, "BEGIN RSA PUBLIC KEY");
		});
	});
});
