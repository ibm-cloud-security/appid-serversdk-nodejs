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

const Q = require("q");

function decode(tokenString) {
  if (tokenString === "invalid_token") {
	return undefined;
  } else if (tokenString === "bad_scope") {
	return {scope: "bad_scope"};
  } else if (tokenString === "null_scope") {
	return null;
  } else if (tokenString === "access_token_mock_test_scope") {
	return {scope: "test_scope"};
  } else if (tokenString === "id_token_mock_test_scope") {
	return {scope: "test_scope"};
  } else {
	return {scope: "appid_default"};
  }
}

function decodeAndValidate(tokenString) {
  let deferred = Q.defer();
  if (tokenString === "invalid_token") {
	deferred.resolve();
  } else if (tokenString === "bad_scope") {
	deferred.resolve({scope: "bad_scope", aud: ["myClientId"]});
  } else if (tokenString === "null_scope") {
	deferred.resolve(null);
  } else if (tokenString === "access_token_mock_test_scope" || tokenString === "id_token_mock_test_scope") {
	deferred.resolve({scope: "test_scope", aud: ["myClientId"]});
  } else if (tokenString === "access_token_3_scopes" || tokenString === "id_token_3_scopes") {
	deferred.resolve({scope: "appid_default scope1 scope2 scope3", aud: ["myClientId"]});
  } else {
	deferred.resolve({scope: "appid_default" , aud: ["myClientId"]});
  }
  return deferred.promise;
}

let isIssuerAndAudValid = true;
let shouldSwitchIssuerState = false;
const switchIssuerState = () => shouldSwitchIssuerState = true;
const setValidateIssAndAudResponse = (isValid) => isIssuerAndAudValid = isValid;
const checkSwitch = () => {
  if (shouldSwitchIssuerState) {
	isIssuerAndAudValid = !isIssuerAndAudValid;
	shouldSwitchIssuerState = false;
  }
};

function validateIssAndAud(token, serviceConfig) {
  if (isIssuerAndAudValid) {
	checkSwitch();
	return Promise.resolve(true);
  } else {
	checkSwitch();
	return Promise.reject(new Error("no"));
  }
}

function getRandomNumber() {
  return "123456789";
}

module.exports = {
  decodeAndValidate,
  decode,
  validateIssAndAud,
  getRandomNumber,
  setValidateIssAndAudResponse,
  switchIssuerState
};
