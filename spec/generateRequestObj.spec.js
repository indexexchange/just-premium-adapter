/**
 * @author:    Index Exchange
 * @license:   UNLICENSED
 *
 * @copyright: Copyright (C) 2017 by Index Exchange. All rights reserved.
 *
 * The information contained within this document is confidential, copyrighted
 *  and or a trade secret. No part of this document may be reproduced or
 * distributed in any form or by any means, in whole or in part, without the
 * prior written permission of Index Exchange.
 */
// jshint ignore: start

'use strict';

/* =====================================
 * Utilities
 * ---------------------------------- */

/**
 * Returns an array of parcels based on all of the xSlot/htSlot combinations defined
 * in the partnerConfig (simulates a session in which all of them were requested).
 *
 * @param {object} profile
 * @param {object} partnerConfig
 * @returns []
 */
function generateReturnParcels(profile, partnerConfig) {
    var returnParcels = [];

    for (var htSlotName in partnerConfig.mapping) {
        if (partnerConfig.mapping.hasOwnProperty(htSlotName)) {
            var xSlotsArray = partnerConfig.mapping[htSlotName];
            for (var i = 0; i < xSlotsArray.length; i++) {
                var xSlotName = xSlotsArray[i];
                returnParcels.push({
                    partnerId: profile.partnerId,
                    htSlot: {
                        getId: function () {
                            return htSlotName
                        }
                    },
                    ref: "",
                    xSlotRef: partnerConfig.xSlots[xSlotName],
                    requestId: '_' + Date.now()
                });
            }
        }
    }

    return returnParcels;
}

/* =====================================
 * Testing
 * ---------------------------------- */

describe('generateRequestObj', function () {

    /* Setup and Library Stub
     * ------------------------------------------------------------- */
    var inspector = require('schema-inspector');
    var proxyquire = require('proxyquire').noCallThru();
    var libraryStubData = require('./support/libraryStubData.js');
    var partnerModule = proxyquire('../just-premium-htb.js', libraryStubData);
    var partnerConfig = require('./support/mockPartnerConfig.json');
    var expect = require('chai').expect;
    /* -------------------------------------------------------------------- */

    /* Instantiate your partner module */
    var partnerModule = partnerModule(partnerConfig);
    var partnerProfile = partnerModule.profile;

    /* Generate dummy return parcels based on MRA partner profile */
    var returnParcels;
    var requestObject;

    /* Generate a request object using generated mock return parcels. */
    returnParcels = generateReturnParcels(partnerProfile, partnerConfig);

    /* -------- IF SRA, generate a single request for each parcel -------- */
    if (partnerProfile.architecture) {
        requestObject = partnerModule.generateRequestObj(returnParcels);

        /* Simple type checking, should always pass */
        it('SRA - should return a correctly formatted object', function () {
            var result = inspector.validate({
                type: 'object',
                strict: true,
                properties: {
                    url: {
                        type: 'string',
                        minLength: 1
                    },
                    data: {
                        type: 'object'
                    },
                    callbackId: {
                        type: 'string',
                        minLength: 1
                    }
                }
            }, requestObject);

            expect(result.valid).to.be.true;
        });

        /* Test that the generateRequestObj function creates the correct object by building a URL
         * from the results. This is the bid request url the wrapper will send out to get demand
         * for your module.
         *
         * The url should contain all the necessary parameters for all of the request parcels
         * passed into the function.
         */

        /* ---------- ADD MORE TEST CASES TO TEST AGAINST REAL VALUES ------------*/
        it('should correctly build a url', function () {
            /* Write unit tests to verify that your bid request url contains the correct
             * request params, url, etc.
             */
            var result = inspector.validate({
                type: 'object',
                properties: {
                    hostname: {
                        type: 'string',
                        minLength: 1
                    },
                    protocol: {
                        type: 'string',
                        minLength: 4
                    },
                    sw: {
                        type: 'integer',
                        minLength: 2
                    },
                    sh: {
                        type: 'integer',
                        minLength: 2
                    },
                    ww: {
                        type: 'integer',
                        minLength: 2
                    },
                    wh: {
                        type: 'integer',
                        minLength: 2
                    },
                    c: {
                        type: 'string',
                        minLength: 2
                    },
                    zones: {
                        type: 'array',
                        splitWith: ',',
                        items: {type: 'number', min: 10}
                    },
                    i: {
                        type: 'integer',
                        minLength: 13
                    }
                }
            }, requestObject.data);

            expect(result.valid).to.be.true;
        });

        it('should correctly prepare pub conditions', function () {

            var conditions = partnerModule.preparePubCond(returnParcels.map(function (parcel) {
                return parcel.xSlotRef;
            }));

            var result = inspector.validate({
                "type": 'object',
                "properties": {
                    '*': {
                        "properties": {
                            "type": 'integer',
                            "eq": 1
                        }
                    }
                }
            }, conditions);

            expect(result.valid).to.be.true;

            var conditions2 = partnerModule.preparePubCond([
                {
                    zoneId: 1163,
                    allow: ['lb']
                },
                {
                    zoneId: 1163,
                    allow: ['wp']
                }
            ]);

            var result2 = inspector.validate({
                "type": 'object',
                "properties": {
                    "1163": {
                        "type": "array",
                        "minLength": 2,
                        "maxLength": 2,
                        "items": {
                            "type": "array"
                        }
                    }
                }
            }, conditions2);

            expect(result2.valid).to.be.true;
            expect(conditions2['1163'][0][0]).to.be.equal('lb');
            expect(conditions2['1163'][0][1]).to.be.equal('wp');

            var conditions3 = partnerModule.preparePubCond([
                {
                    zoneId: 1163,
                    exclude: ['lb']
                }
            ]);

            expect(conditions3['1163'][0].length).to.be.equal(0);
            expect(conditions3['1163'][1][0]).to.be.equal('lb');
        });
        /* -----------------------------------------------------------------------*/

        /* ---------- IF MRA, generate a single request for each parcel ---------- */
    } else {
        for (var i = 0; i < returnParcels.length; i++) {
            requestObject = partnerModule.generateRequestObj([returnParcels[i]]);

            /* Simple type checking, should always pass */
            it('MRA - should return a correctly formatted object', function () {
                var result = inspector.validate({
                    type: 'object',
                    strict: true,
                    properties: {
                        url: {
                            type: 'string',
                            minLength: 1
                        },
                        data: {
                            type: 'object'
                        },
                        callbackId: {
                            type: 'string',
                            minLength: 1
                        }
                    }
                }, requestObject);

                expect(result.valid).to.be.true;
            });

            /* Test that the generateRequestObj function creates the correct object by building a URL
             * from the results. This is the bid request url that wrapper will send out to get demand
             * for your module.
             *
             * The url should contain all the necessary parameters for all of the request parcels
             * passed into the function.
             */

            /* ---------- ADD MORE TEST CASES TO TEST AGAINST REAL VALUES ------------*/
            it('should correctly build a url', function () {
                /* Write unit tests to verify that your bid request url contains the correct
                 * request params, url, etc.
                 */
                expect(requestObject).to.exist;
            });
            /* -----------------------------------------------------------------------*/
        }
    }

});