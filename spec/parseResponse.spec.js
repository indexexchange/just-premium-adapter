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
 * @param {Array} ids
 * @param {object} profile
 * @param {object} partnerConfig
 * @returns []
 */
function generateReturnParcels(ids, profile, partnerConfig) {
    var returnParcels = [];

    for (var htSlotName in partnerConfig.mapping) {
        if (partnerConfig.mapping.hasOwnProperty(htSlotName)) {
            var xSlotsArray = partnerConfig.mapping[htSlotName];
            var htSlot = {
                id: htSlotName,
                getId: function () {
                    return this.id;
                }
            }
            for (var i = 0; i < xSlotsArray.length; i++) {
                var xSlotName = xSlotsArray[i];
                returnParcels.push({
                    partnerId: profile.partnerId,
                    htSlot: htSlot,
                    ref: "",
                    xSlotRef: partnerConfig.xSlots[xSlotName],
                    requestId: ids[i]
                });
            }
        }
    }

    return returnParcels;
}

/* =====================================
 * Testing
 * ---------------------------------- */

describe('parseResponse', function () {

    /* Setup and Library Stub
     * ------------------------------------------------------------- */
    var inspector = require('schema-inspector');
    var proxyquire = require('proxyquire').noCallThru();
    var libraryStubData = require('./support/libraryStubData.js');
    var partnerModule = proxyquire('../just-premium-htb.js', libraryStubData);
    var partnerConfig = require('./support/mockPartnerConfig.json');
    var responseData = require('./support/mockResponseData.json');
    var expect = require('chai').expect;
    var deepCopy = libraryStubData['utilities.js'].deepCopy;
    var Browser = libraryStubData['browser.js'];
    /* -------------------------------------------------------------------- */

    /* Instantiate your partner module */
    var partnerModule = partnerModule(partnerConfig);
    var partnerProfile = partnerModule.profile;
    var ids = ['_aszqf', '_fd23g', '_2431h'];
    /* Generate dummy return parcels based on MRA partner profile */
    var returnParcels;
    var result, expectedValue, mockData, returnParcels;

    describe('should correctly parse bids:', function () {

        beforeEach(function () {
            var jPAM = Browser.topWindow.jPAM = Browser.topWindow.jPAM || {};
            jPAM.ie = jPAM.ie || {bids: []};
            jPAM.ie.bids.length = 0;
        });

        /* Simple type checking on the returned objects, should always pass */
        it('parcel for which winning bid was sent should has the required fields set', function () {

            returnParcels = generateReturnParcels(ids, partnerModule.profile, partnerConfig);

            /* Get mock response data from our responseData file */
            mockData = deepCopy(responseData.bid);
            mockData['1163'][0].rid = ids[1];

            /* IF SRA, parse all parcels at once */
            if (partnerProfile.architecture) partnerModule.parseResponse(1, mockData, returnParcels);

            var result = inspector.validate({
                type: 'object',
                properties: {
                    targetingType: {
                        type: 'string',
                        eq: 'slot'
                    },
                    targeting: {
                        type: 'object',
                        properties: {
                            [partnerModule.profile.targetingKeys.id]: {
                                type: 'array',
                                exactLength: 1,
                                items: {
                                    type: 'string',
                                    minLength: 1
                                }
                            },
                            [partnerModule.profile.targetingKeys.om]: {
                                type: 'array',
                                exactLength: 1,
                                items: {
                                    type: 'string',
                                    minLength: 1
                                }
                            },
                            pubKitAdId: {
                                type: 'string',
                                minLength: 1
                            }
                        }
                    },
                    price: {
                        type: 'number'
                    },
                    size: {
                        type: 'array',
                    },
                    adm: {
                        type: 'string',
                        minLength: 1
                    }
                }
            }, returnParcels[1]);

            expect(result.valid, result.format()).to.be.true;
        });

        /* ---------- ADD MORE TEST CASES TO TEST AGAINST REAL VALUES ------------*/
        it('parcel for which winning bid was sent should has the correct values set', function () {
            returnParcels = generateReturnParcels(ids, partnerModule.profile, partnerConfig);

            /* Get mock response data from our responseData file */
            mockData = deepCopy(responseData.bid);
            mockData['1163'][0].rid = ids[1];

            /* IF SRA, parse all parcels at once */
            if (partnerProfile.architecture) partnerModule.parseResponse(1, mockData, returnParcels);

            var bid = mockData['1163'][0];
            expect(returnParcels[1]).to.exist;
            expect(returnParcels[1].price).to.be.equal(bid.price);
            expect(returnParcels[1].adm).to.be.equal(bid.adm);
            expect(returnParcels[1].size[0]).to.be.equal(bid.width);
            expect(returnParcels[1].size[1]).to.be.equal(bid.height);

        });
        /* -----------------------------------------------------------------------*/
    });

    describe('should correctly parse passes: ', function () {


        it('each parcel should have the required fields set', function () {
            returnParcels = generateReturnParcels(ids, partnerModule.profile, partnerConfig);

            /* Get mock response data from our responseData file */
            mockData = responseData.pass;

            /* IF SRA, parse all parcels at once */
            if (partnerProfile.architecture) partnerModule.parseResponse(1, mockData, returnParcels);

            for (var i = 0; i < returnParcels.length; i++) {

                var result = inspector.validate({
                    type: 'object',
                    properties: {
                        pass: {
                            type: 'boolean',
                            eq: true,

                        }
                    }
                }, returnParcels[i]);

                expect(result.valid, result.format()).to.be.true;
            }
        });

        /* ---------- ADD MORE TEST CASES TO TEST AGAINST REAL VALUES ------------*/
        it('each parcel should have the correct values set', function () {
            returnParcels = generateReturnParcels(ids, partnerModule.profile, partnerConfig);

            /* Get mock response data from our responseData file */
            mockData = responseData.pass;

            /* IF SRA, parse all parcels at once */
            if (partnerProfile.architecture) partnerModule.parseResponse(1, mockData, returnParcels);

            for (var i = 0; i < returnParcels.length; i++) {

                expect(returnParcels[i].pass).to.be.true;
                expect(returnParcels[i]).to.exist;
            }
        });
        /* -----------------------------------------------------------------------*/
    });

    describe('should correctly parse deals: ', function () {

        beforeEach(function () {
            var jPAM = Browser.topWindow.jPAM = Browser.topWindow.jPAM || {};
            jPAM.ie = jPAM.ie || {bids: []};
            jPAM.ie.bids.length = 0;
        });

        /* Simple type checking on the returned objects, should always pass */
        it('parcel for which winning bid was sent should has the required fields set', function () {
            returnParcels = generateReturnParcels(ids, partnerModule.profile, partnerConfig);

            /* Get mock response data from our responseData file */
            mockData = deepCopy(responseData.deals);
            mockData['1163'][0].rid = ids[1];

            /* IF SRA, parse all parcels at once */
            if (partnerProfile.architecture) partnerModule.parseResponse(1, mockData, returnParcels);

            var result = inspector.validate({
                type: 'object',
                properties: {
                    targetingType: {
                        type: 'string',
                        eq: 'slot'
                    },
                    targeting: {
                        type: 'object',
                        properties: {
                            [partnerModule.profile.targetingKeys.id]: {
                                type: 'array',
                                exactLength: 1,
                                items: {
                                    type: 'string',
                                    minLength: 1
                                }
                            },
                            [partnerModule.profile.targetingKeys.pm]: {
                                type: 'array',
                                exactLength: 1,
                                items: {
                                    type: 'string',
                                    minLength: 1
                                }
                            },
                            [partnerModule.profile.targetingKeys.pmid]: {
                                type: 'array',
                                exactLength: 1,
                                items: {
                                    type: 'string',
                                    minLength: 1
                                }
                            },
                            pubKitAdId: {
                                type: 'string',
                                minLength: 1
                            }
                        }
                    },
                    price: {
                        type: 'number'
                    },
                    size: {
                        type: 'array',
                    },
                    adm: {
                        type: 'string',
                        minLength: 1
                    },
                }
            }, returnParcels[1]);

            expect(result.valid, result.format()).to.be.true;
        });

        /* ---------- ADD MORE TEST CASES TO TEST AGAINST REAL VALUES ------------*/
        it('parcel for which winning bid was sent should has the correct values set', function () {
            returnParcels = generateReturnParcels(ids, partnerModule.profile, partnerConfig);

            /* Get mock response data from our responseData file */
            mockData = deepCopy(responseData.deals);
            mockData['1163'][0].rid = ids[1];

            /* IF SRA, parse all parcels at once */
            if (partnerProfile.architecture) partnerModule.parseResponse(1, mockData, returnParcels);

            var bid = mockData['1163'][0];
            expect(returnParcels[1]).to.exist;
            expect(returnParcels[1].price).to.be.equal(bid.price);
            expect(returnParcels[1].adm).to.be.equal(bid.adm);
            expect(returnParcels[1].size[0]).to.be.equal(bid.width);
            expect(returnParcels[1].size[1]).to.be.equal(bid.height);
        });
        /* -----------------------------------------------------------------------*/
    });
});