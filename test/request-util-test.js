const sinon = require('sinon');
const proxyquire = require('proxyquire');
const chai = require("chai");
const expect = chai.expect;
const sinonChai = require('sinon-chai');
chai.use(sinonChai);

describe('/lib/utils/request-util', function (done) {
    const gotStub = sinon.stub().resolves({
        body: {
            "name": "Abod",
            "car": null
        }
    }); // Notice how we do not stub the got module here
    context('Insure the headers option are updated to match Got library configuration', () => {

        it('should replace the qs option header with searchParams', (done) => {
            const reqHeaders = {
                url: 'sampleURL',
                qs: { r: "r" },
                method: "GET"
            }

            const expectedHeaders = {
                url: 'sampleURL',
                searchParams: { r: "r" },
                method: "GET"
            }

            const requestUtil = proxyquire('../lib/utils/request-util', {
                got: gotStub,
            });

            const callbackFun = (error, response, body) => {
                expect(gotStub).to.have.been.calledOnce;
                expect(gotStub).to.have.been.deep.calledWithMatch('sampleURL', expectedHeaders);
                done();
            }
            requestUtil(reqHeaders, callbackFun);
        });
    });
});