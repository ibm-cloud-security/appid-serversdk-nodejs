const sinon = require('sinon');
const proxyquire = require('proxyquire').noPreserveCache();
const chai = require("chai");
const expect = chai.expect;
const {
    jsonToURLencodedForm,
    parseFormData
} = require('../lib/utils/common-util');
const sinonChai = require('sinon-chai');
var sandbox = sinon.createSandbox();
chai.use(sinonChai);

describe('/lib/utils/request-util', function (done) {
    let requestUtil;

    let gotStub = sandbox.stub().resolves({
        body: {
            "name": "Abod",
            "car": null
        }
    });

    before(function () {
        requestUtil = proxyquire("../lib/utils/request-util", {
            got: gotStub,
        });
    });

    afterEach(() => {
        gotStub.resetHistory();
        sandbox.restore();
    })

    context('Insure the headers option are updated to match Got library configuration', () => {

        it('should add a content-type header (application/json) if nothing specified for Non Get methods', (done) => {
            const reqHeaders = {
                url: 'sampleURL',
                method: "POST"
            }

            const expectedHeaders = {
                headers: {
                    "content-type": "application/json"
                }
            }

            const callbackFun = (error, response, body) => {
                expect(gotStub).to.have.been.calledOnce;
                expect(gotStub).to.have.been.deep.calledWithMatch('sampleURL', expectedHeaders);
                done();
            }
            requestUtil(reqHeaders, callbackFun);
        });


        it('should NOT override the content-type header if one was specified for Non Get methods', (done) => {
            const reqHeaders = {
                url: 'sampleURL',
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }

            const expectedHeaders = {
                headers: {
                    "content-type": "application/x-www-form-urlencoded"
                }
            }

            const callbackFun = (error, response, body) => {
                expect(gotStub).to.have.been.calledOnce;
                expect(gotStub).to.have.been.deep.calledWithMatch('sampleURL', expectedHeaders);
                done();
            }
            requestUtil(reqHeaders, callbackFun);
        });

        it('should replace the (qs) option header with (searchParams)', (done) => {
            const reqHeaders = {
                url: 'sampleURL',
                qs: {
                    r: "r"
                },
                method: "GET"
            }

            const expectedHeaders = {
                searchParams: {
                    r: "r"
                },
                method: "GET"
            }

            const callbackFun = (error, response, body) => {
                expect(gotStub).to.have.been.calledOnce;
                expect(gotStub).to.have.been.deep.calledWithMatch('sampleURL', expectedHeaders);
                done();
            }
            requestUtil(reqHeaders, callbackFun);
        });
    });

    context('should replace the (form) option with the corresponding body type based on the content-type header', () => {

        it('should replace the (form) option with JSON.stringify Body', (done) => {
            const reqHeaders = {
                url: 'sampleURL',
                form: {
                    r: "r"
                }
            }

            const expectedHeaders = {
                body: '{"r":"r"}',
                headers: {
                    "content-type": "application/json"
                }
            }

            const callbackFun = (error, response, body) => {
                expect(gotStub).to.have.been.calledOnce;
                expect(gotStub).to.have.been.deep.calledWithMatch('sampleURL', expectedHeaders);
                done();
            }
            requestUtil(reqHeaders, callbackFun);
        });


        it('should replace the (form) option with URLencodedForm Body if content-type is application/x-www-form-urlencoded ', (done) => {
            const sampleForm = {
                r: "r",
                s: "sss"
            };
            const reqHeaders = {
                url: 'sampleURL',
                form: sampleForm,
                headers: {
                    "content-type": "application/x-www-form-urlencoded"
                }
            }

            const expectedHeaders = {
                body: jsonToURLencodedForm(sampleForm),
                headers: {
                    "content-type": "application/x-www-form-urlencoded"
                }
            }

            const callbackFun = (error, response, body) => {
                expect(gotStub).to.have.been.calledOnce;
                expect(gotStub).to.have.been.deep.calledWithMatch('sampleURL', expectedHeaders);
                done();
            }
            requestUtil(reqHeaders, callbackFun);
        });
    });

    context('should replace the (auth) option with the corresponding Authorization header', () => {

        it('should replace the (auth) for Bearer Authorization', (done) => {
            const sampleToken = "sampleToken";
            const reqHeaders = {
                url: 'sampleURL',
                auth: {
                    bearer: sampleToken
                }
            }

            const expectedHeaders = {
                headers: {
                    "Authorization": `Bearer ${sampleToken}`,
                    "content-type": "application/json"
                }
            }

            const callbackFun = (error, response, body) => {
                expect(gotStub).to.have.been.calledOnce;
                expect(gotStub).to.have.been.deep.calledWithMatch('sampleURL', expectedHeaders);
                done();
            }
            requestUtil(reqHeaders, callbackFun);
        });


        it('should replace the (auth) for Basic Authorization', (done) => {
            const authUsername = "sampleAuthUsername";
            const authPassword = "sampleAuthPassword";
            const reqHeaders = {
                url: 'sampleURL',
                auth: {
                    username: authUsername,
                    password: authPassword,
                }
            }

            const expectedHeaders = {
                headers: {
                    "Authorization": "Basic " + Buffer.from(`${authUsername}:${authPassword}`).toString("base64"),
                    "content-type": "application/json"
                }
            }

            const callbackFun = (error, response, body) => {
                expect(gotStub).to.have.been.calledOnce;
                expect(gotStub).to.have.been.deep.calledWithMatch('sampleURL', expectedHeaders);
                done();
            }
            requestUtil(reqHeaders, callbackFun);
        });
    });

    context('should replace the formData and json option with the corresponding body option', () => {
        const sampleForm = {
            firstName: 'Abod',
            lastName: 'Akhras',
        };

        const expectedHeaders = {
            body: JSON.stringify(sampleForm),
            headers: {
                "content-type": "application/json"
            }
        }

        it('should replace the (formData) with stringified JSON object', (done) => {
            const reqHeaders = {
                url: 'sampleURL',
                formData: sampleForm
            }


            const callbackFun = (error, response, body) => {
                const bodyParamPassed = gotStub.args[0][1].body;

                expect(gotStub).to.have.been.calledOnce;

                // Expect the body to be passed as a stream
                expect(bodyParamPassed).to.have.property('_streams');
                expect(parseFormData(bodyParamPassed)).to.deep.equal(sampleForm);
                done();
            }
            requestUtil(reqHeaders, callbackFun);
        });

        it('should replace the (json) with stringified JSON object', (done) => {
            const reqHeaders = {
                url: 'sampleURL',
                json: sampleForm
            }

            const callbackFun = (error, response, body) => {
                expect(gotStub).to.have.been.calledOnce;
                expect(gotStub).to.have.been.deep.calledWithMatch('sampleURL', expectedHeaders);
                done();
            }
            requestUtil(reqHeaders, callbackFun);
        });
    });


    context('Handle error failures', () => {
        const reqHeaders = {
            url: 'sampleURL',
            json: {
                val: 'SomeVal'
            }
        }

        beforeEach(function () {
            sandbox.reset();
        });

        it('should return an error if body has error value', (done) => {
            const someError = "someError";
            gotStub = sandbox.stub().resolves({
                "error": someError
            });
            requestUtil = proxyquire("../lib/utils/request-util", {
                got: gotStub,
            });

            const callbackFun = (error, response, body) => {
                expect(gotStub).to.have.been.calledOnce;
                expect(error).to.equal(someError);
                done();
            }
            requestUtil(reqHeaders, callbackFun);

        });

        it('should return an error if body was not sent back2', (done) => {
            let sampleError = new Error("Some Error");
            sampleError.response = {};
            sampleError.response.statusCode = 500;
            gotStub = sandbox.stub().rejects(sampleError);
            requestUtil = proxyquire("../lib/utils/request-util", {
                got: gotStub,
            });

            const callbackFun = (error, response, body) => {
                expect(gotStub).to.have.been.calledOnce;
                expect(error).to.equal(sampleError);
                expect(response).to.deep.equal({
                    statusCode: sampleError.response.statusCode
                });
                done();
            }
            requestUtil(reqHeaders, callbackFun);
        });
    });

});