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

const chai = require("chai");
const assert = chai.assert;
const expect = chai.expect;
chai.use(require("chai-as-promised"));
const proxyquire = require("proxyquire");
const constants = require("./mocks/constants");

describe("/lib/utils/token-util", function(){
    console.log("Loading token-util-test.js");
    var TokenUtil;
    var ServiceConfig;
    var serviceConfig;
    
    before(function(){
        TokenUtil = proxyquire("../lib/utils/token-util", {
            "./public-key-util": require("./mocks/public-key-util-mock")
        });
        ServiceConfig = require("../lib/strategies/api-strategy-config");
        serviceConfig = new ServiceConfig({
            oauthServerUrl: constants.SERVER_URL,
            tenantId: constants.TENANTID,
            clientId: constants.CLIENTID
        });
    });

    describe("#decodeAndValidate()", function(){
        
        it("Should fail since service configuration is not defined", function(){
            return expect(TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN)).to.be.rejectedWith("Invalid service configuration");
        });
        
        it("Should fail since token is expired", function(){
            return expect(TokenUtil.decodeAndValidate(constants.EXPIRED_ACCESS_TOKEN,serviceConfig)).to.be.rejectedWith("jwt expired");
        });

        it("Should succeed since APPID_ALLOW_EXPIRED_TOKENS=true", function(){
            process.env[constants.APPID_ALLOW_EXPIRED_TOKENS] = true;
            TokenUtil.decodeAndValidate(constants.EXPIRED_ACCESS_TOKEN,serviceConfig).then(function (decodedToken) {
                assert.isObject(decodedToken);
            });
        });
        
        it("Should fail since token is malformed", function(){
            process.env[constants.APPID_ALLOW_EXPIRED_TOKENS] = true;
            return expect(TokenUtil.decodeAndValidate(constants.MALFORMED_ACCESS_TOKEN,serviceConfig)).to.be.rejectedWith("JWT error, can not decode token");
        });
        
        it("Should fail since header is empty in token", function(){
            process.env[constants.APPID_ALLOW_EXPIRED_TOKENS] = true;
            return expect(TokenUtil.decodeAndValidate(constants.MALFORMED_ACCESS_TOKEN_WITHOUTHEADER,serviceConfig)).to.be.rejectedWith("JWT error, can not decode token");
        });
        
        it("Should fail since issuer identifier is different", function(){
            return expect(TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN,new ServiceConfig({
                oauthServerUrl: "http://clientaccess.stage1.ng.bluemix.net/",
                tenantId: constants.TENANTID,
                clientId: constants.CLIENTID
            }))).to.be.rejectedWith("JWT error, invalid issuer identifier");
        });
        
        it("Should fail since tenantId is different", function(){
            serviceConfig.tenantId = "abcdef";
            return expect(TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN,new ServiceConfig({
                oauthServerUrl: constants.SERVER_URL,
                tenantId: "4dba9430-54e6-4cf2-a516",
                clientId: constants.CLIENTID
            }))).to.be.rejectedWith("JWT error, invalid tenantId");
        });
        
        it("Should fail since clientId is different ", function(){
            return expect(TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN, new ServiceConfig({
                oauthServerUrl: constants.SERVER_URL,
                tenantId: constants.TENANTID,
                clientId: "26cb012eb327c612d949cbb"
            }))).to.be.rejectedWith("JWT error, invalid audience");
        });
        
        it("Should succeed since token is valid", function(){
            TokenUtil.decodeAndValidate(constants.ACCESS_TOKEN,serviceConfig).then(function (decodedToken) {
                assert.isObject(decodedToken);
            });
        });
    });

    describe("#decode()", function(){
        it("Should return a valid decoded token", function(){
            var decodedToken = TokenUtil.decode(constants.ACCESS_TOKEN);
            assert.isObject(decodedToken);
            assert.property(decodedToken, "iss");
            assert.property(decodedToken, "tenant");
            assert.property(decodedToken, "aud");
            assert.property(decodedToken, "iat");
        });
    });


});
