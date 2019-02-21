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

const log4js = require("log4js");
const request = require("request");

let logger;
const constants = require("./constants");

let isUpdateRequestPending = false;

/**
/** serviceConfig
 @typedef {Object} ServiceConfig
 * @property {function():string} getConfig - returns the entire config
 * @property {function():string} getTenantId - returns the tenantId
 * @property {function():string} getSecret - returns the secret;
 * @property {function():string} getOAuthServerUrl - returns the server url
 * @property {function():string} getRedirectUri - returns the redirect uri
 * @property {function():string} getPreferredLocale - returns the preferred locale
 * @property {function():string} getIssuer - returns the issuer
 * @property {function():string} getUserProfile - returns the user profiles endpoint
 */

/**
 * loads a config
 * @param {string}configName the name of the config
 * @param {string[]}requiredParams an array for the required params
 * @param {object} options the options for the configuration
 * @return {Promise<any>} the configuration
 */

const loadConfig = (configName, requiredParams, options={}) => {
        logger = log4js.getLogger(`appid-${configName}-config`);
        logger.debug(`Initializing ${configName} config`);

        const vcapServices = JSON.parse(process.env[constants.VCAP_SERVICES] || "{}");
        let vcapServiceCredentials = {};
        const removeTrailingSlash = (url) => url && url.replace && url.replace(/\/$/, "");

        for (let propName in vcapServices) {
            // Checks if string starts with the service name
            if (propName.indexOf(constants.VCAP_SERVICES_SERVICE_NAME1) === 0 || propName.indexOf(constants.VCAP_SERVICES_SERVICE_NAME2) === 0) {
                vcapServiceCredentials = vcapServices[propName][0][constants.VCAP_SERVICES_CREDENTIALS];
                break;
            }
        }

        const findParam = (param) => options[param] || vcapServiceCredentials[param] || process.env[param];
        const discoveryEndpoint = findParam(constants.APPID_DISCOVERY_ENDPOINT);
        const serviceEndpoint = findParam(constants.APPID_SERVICE_ENDPOINT);
        const serviceVersion = findParam(constants.APPID_SERVICE_VERSION);
        const serviceTenantID = findParam(constants.APPID_TENANT_ID);
        let serviceConfig = {};

        serviceConfig[constants.TENANT_ID] = serviceTenantID;
        serviceConfig[constants.CLIENT_ID] = findParam(constants.CLIENT_ID);
        serviceConfig[constants.SECRET] = findParam(constants.SECRET);

        serviceConfig[constants.REDIRECT_URI] = options[constants.REDIRECT_URI] || process.env[constants.REDIRECT_URI];
        serviceConfig[constants.PREFERRED_LOCALE] = options[constants.PREFERRED_LOCALE];
        serviceConfig[constants.APPID_ISSUER] = options[constants.APPID_ISSUER] || process.env[constants.APPID_ISSUER];

        if (serviceConfig[constants.PREFERRED_LOCALE]) {
            logger.info(constants.PREFERRED_LOCALE, serviceConfig[constants.PREFERRED_LOCALE]);
        }

        if (!serviceConfig[constants.REDIRECT_URI]) {
            let vcapApplication = process.env[constants.VCAP_APPLICATION];
            if (vcapApplication) {
                vcapApplication = JSON.parse(vcapApplication);
                serviceConfig[constants.REDIRECT_URI] = "https://" + vcapApplication["application_uris"][0] + "/ibm/bluemix/appid/callback";
            }
        }

        const configMethods = {
            getConfig: () => serviceConfig,
            getTenantId: () => serviceConfig[constants.TENANT_ID],
            getClientId: () => serviceConfig[constants.CLIENT_ID],
            getSecret: () => serviceConfig[constants.SECRET],
            getRedirectUri: () => serviceConfig[constants.REDIRECT_URI],
            getPreferredLocale: () => serviceConfig[constants.PREFERRED_LOCALE]
        };

        if (discoveryEndpoint) {
            getInformation(discoveryEndpoint, serviceConfig)
                .then(() => {
                    //requiredParams.map(paramChecker(serviceConfig, configName, reject));
                }).catch(error => {
                    // Error(error);
                });
        } else {
            if (serviceEndpoint) {
                if (!serviceVersion || !Number.isInteger(Number.parseInt(serviceVersion))) {
                    throw new Error("Failed to initialize APIStrategy. Missing version parameter, should be an integer.");
                } else if (!serviceTenantID) {
                    throw new Error("Failed to initialize APIStrategy. Missing tenantId parameter");
                } else {
                    serviceConfig[constants.OAUTH_SERVER_URL] =
                        `${removeTrailingSlash(serviceEndpoint)}/oauth/v${serviceVersion}/${serviceTenantID}`;
                    serviceConfig[constants.USER_PROFILE_SERVER_URL] = removeTrailingSlash(serviceEndpoint);
                }
            } else {
                serviceConfig[constants.OAUTH_SERVER_URL] = findParam(constants.OAUTH_SERVER_URL);
                serviceConfig[constants.USER_PROFILE_SERVER_URL] = findParam(constants.USER_PROFILE_SERVER_URL);
            }

            console.log(configName);
            console.log(requiredParams);
            console.log(options);

            //requiredParams.map(paramChecker(serviceConfig, configName));


        }
    return {
        ...configMethods,
        getOAuthServerUrl: () => Promise.resolve(removeTrailingSlash(serviceConfig[constants.OAUTH_SERVER_URL])),
        getIssuer: getDiscoveryIfUndefined(constants.APPID_ISSUER, serviceConfig),
        getUserProfile: getDiscoveryIfUndefined(constants.USER_PROFILE_SERVER_URL, serviceConfig)
    }

};

const paramChecker = (serviceConfig, configName, reject) => {
    return param => {
        if (!serviceConfig[param]) {
            reject(new Error(`Failed to initialize ${configName}. Missing ${param} parameter.`));
        } else if (param === constants.SECRET) {
            logger.info(param, '[CANNOT LOG SECRET]');
        } else {
            logger.info(param, serviceConfig[param]);
        }
    };
};

function getInformation(discoveryEndpoint, serviceConfig) {
    var deferred = Q.defer();
    eventEmitter.once("getDiscoveryUpdated", error => {error ? deferred.reject(error) : deferred.resolve()});

    if (!isUpdateRequestPending) {
        isUpdateRequestPending = true;
        getDiscovery(discoveryEndpoint).then(response => {
            isUpdateRequestPending = false;

            const oauthServerUrl = response[constants.APPID_DISCOVERY_AUTHORIZATION]
                .slice(0, response.authorization_endpoint.indexOf("/authorization"));
            serviceConfig[constants.OAUTH_SERVER_URL] = oauthServerUrl;
            serviceConfig[constants.USER_PROFILE_SERVER_URL] = response[constants.APPID_DISCOVERY_PROFILES];
            serviceConfig[constants.APPID_ISSUER] = response[constants.APPID_ISSUER];

            eventEmitter.emit("getDiscoveryUpdated");
        }).catch(function (e) {
            var error = "getDiscoveryUpdated error: " + e;
            logger.error(error);
            isUpdateRequestPending = false;
            eventEmitter.emit("getDiscoveryUpdated", error);
        });
    }

    return deferred.promise;
}

const getDiscovery = discoveryEndpoint => {
    return new Promise((resolve, reject) => {
        request({headers: {'Accept': 'application/json'}, url: discoveryEndpoint}, function (error, response, body) {
            if (error) {
                reject(new Error(`GET discovery request failed. Error: ${error.message}`));
            } else if (response.statusCode === 200) {
                resolve(JSON.parse(body));
            } else {
                reject(new Error(`GET discovery request was failed. Status Code: ${response.statusCode}`));
            }
        });
    });
};

const getDiscoveryIfUndefined = (constant, serviceConfig, discoveryEndpoint) => {
    return () => {
        return new Promise((resolve, reject) => {
            if (serviceConfig[constant]) {
                resolve(serviceConfig[constant]);
            }
            let url = discoveryEndpoint;
            if (!url) {
                url = `${serviceConfig[constants.OAUTH_SERVER_URL]}/.well-known/openid-configuration`;
            }

            getInformation(url)
                .then(() => {
                    resolve(serviceConfig[constant]);
                }).catch(error => {
                    reject(error);
                });
        });
    }
};

module.exports = {loadConfig};
