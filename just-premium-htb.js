/**
 * @author:    Partner
 * @license:   UNLICENSED
 *
 * @copyright: Copyright (c) 2017 by Index Exchange. All rights reserved.
 *
 * The information contained within this document is confidential, copyrighted
 * and or a trade secret. No part of this document may be reproduced or
 * distributed in any form or by any means, in whole or in part, without the
 * prior written permission of Index Exchange.
 */

'use strict';

////////////////////////////////////////////////////////////////////////////////
// Dependencies ////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

var BidTransformer = require('bid-transformer.js');
var Browser = require('browser.js');
var Classify = require('classify.js');
var Constants = require('constants.js');
var Partner = require('partner.js');
var Size = require('size.js');
var SpaceCamp = require('space-camp.js');
var System = require('system.js');
var Utilities = require('utilities.js');
var EventsService;
var RenderService;

//? if (DEBUG) {
var ConfigValidators = require('config-validators.js');
var PartnerSpecificValidator = require('just-premium-htb-validator.js');
var Scribe = require('scribe.js');
var Whoopsie = require('whoopsie.js');
//? }

////////////////////////////////////////////////////////////////////////////////
// Main ////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

/**
 * Partner module template
 *
 * @class
 */
function JustPremiumHtb(configs) {
    /* =====================================
     * Data
     * ---------------------------------- */

    /* Private
     * ---------------------------------- */

    /**
     * Reference to the partner base class.
     *
     * @private {object}
     */
    var __baseClass;

    /**
     * Profile for this partner.
     *
     * @private {object}
     */
    var __profile;

    /**
     * Instances of BidTransformer for transforming bids.
     *
     * @private {object}
     */
    var __bidTransformers;

    //? if (TEST) {
    /**
     * Necessary for tests, fake window object
     * @type {{document: {createElement: fakeWindow.document.createElement, getElementsByTagName: fakeWindow.document.getElementsByTagName, cookie: string}}}
     */
    var fakeWindow = {
        document: {
            createElement: function () {
                return {}
            },
            getElementsByTagName: function () {
                return [
                    {
                        insertBefore: function () {
                        }
                    }
                ]
            },
            cookie: ''
        }
    };
    //? }

    /* =====================================
     * Functions
     * ---------------------------------- */

    function __getTopWindow() {
        //? if (TEST) {
        return fakeWindow;
        //? }
        return window.top;
    }

    function __findBid(params, bids) {
        for (var zoneId in bids) {
            if (bids.hasOwnProperty(zoneId)) {
                if (parseInt(params.zoneId) === parseInt(zoneId)) {
                    var len = bids[zoneId].length;
                    while(len--) {
                        if(__passCond(params, bids[zoneId][len])) {
                            return bids[zoneId].splice(len, 1).pop();
                        }
                    }
                }
            }
        }

        return false;
    }

    function __passCond(params, bid) {
        var format = bid.format;

        if (params.allow && params.allow.length) {
            return params.allow.indexOf(format) > -1;
        }

        if (params.exclude && params.exclude.length) {
            return params.exclude.indexOf(format) < 0;
        }

        return true;
    }

    function __arrayUnique(array) {
        const a = array.concat();
        for (var i = 0; i < a.length; ++i) {
            for (var j = i + 1; j < a.length; ++j) {
                if (a[i] === a[j]) {
                    a.splice(j--, 1);
                }
            }
        }

        return a;
    }

    function __preparePubCond(bids) {
        const cond = {};
        const count = {};

        bids.forEach(function (bid) {
            var zone = bid.zoneId;

            if (cond[zone] === 1) {
                return;
            }

            const allow = bid.allow || [];
            const exclude = bid.exclude || [];

            if (allow.length === 0 && exclude.length === 0) {
                return cond[zone] = 1;
            }

            cond[zone] = cond[zone] || [[], {}];
            cond[zone][0] = __arrayUnique(cond[zone][0].concat(allow));
            exclude.forEach(function (e) {
                if (!cond[zone][1][e]) {
                    cond[zone][1][e] = 1;
                } else cond[zone][1][e]++;
            });
            count[zone] = count[zone] || 0;
            if (exclude.length) count[zone]++;
        });

        Object.keys(count).forEach(function (zone) {
            if (cond[zone] === 1) {
                return;
            }

            const exclude = [];
            Object.keys(cond[zone][1]).forEach(function (format) {
                if (cond[zone][1][format] === count[zone])
                    exclude.push(format);
            });
            cond[zone][1] = exclude;
        });

        Object.keys(cond).forEach(function (zone) {
            if (cond[zone] !== 1 && cond[zone][1].length) {
                cond[zone][0].forEach(function (r) {
                    var idx = cond[zone][1].indexOf(r);
                    if (idx > -1) {
                        cond[zone][1].splice(idx, 1);
                    }
                })
                ;
                cond[zone][0].length = 0;
            }

            if (cond[zone] !== 1 && !cond[zone][0].length && !cond[zone][1].length) cond[zone] = 1;
        });

        return cond;
    }

    function __requestResource(tagSrc) {
        var window = __getTopWindow();
        var jptScript = window.document.createElement('script');
        jptScript.type = 'text/javascript';
        jptScript.async = true;
        jptScript.src = tagSrc;

        var elToAppend = window.document.getElementsByTagName('head');
        elToAppend = elToAppend.length ? elToAppend : window.document.getElementsByTagName('body');
        if (elToAppend.length) {
            elToAppend = elToAppend[0];
            elToAppend.insertBefore(jptScript, elToAppend.firstChild);
        }
    }

    function __readCookie(name) {
        const nameEQ = name + '=';
        const ca = __getTopWindow().document.cookie.split(';');
        for (var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) == ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    }

    /* Utilities
     * ---------------------------------- */

    /**
     * Generates the request URL and query data to the endpoint for the xSlots
     * in the given returnParcels.
     *
     * @param  {object[]} returnParcels
     *
     * @return {object}
     */
    function __generateRequestObj(returnParcels) {
        // Load external manager, required to show Justpremium ad
        __requestResource(Browser.getProtocol() + '//cdn-cf.justpremium.com/js/' + (__readCookie('jpxhbjs') || '') + 'jpx.js');

        var callbackId = System.generateUniqueId();
        var queryObj = {};
        var zones = [];

        var baseUrl = Browser.getProtocol() + '//pre.ads.justpremium.com/v/2.0/t/ixhr';
        var cond = __preparePubCond(returnParcels.map(function (parcel) {
            return parcel.xSlotRef;
        }));

        /* ---------------- Craft bid request using the above returnParcels --------- */
        queryObj.hostname = Browser.getHostname();
        queryObj.protocol = Browser.getProtocol().replace(':', '');
        queryObj.sw = Browser.getScreenWidth();
        queryObj.sh = Browser.getScreenHeight();
        queryObj.ww = Browser.getViewportWidth();
        queryObj.wh = Browser.getViewportHeight();
        queryObj.i = (+new Date());
        returnParcels.forEach(function (parcel) {
            if (zones.indexOf(parseInt(parcel.xSlotRef.zoneId)) < 0) {
                zones.push(parseInt(parcel.xSlotRef.zoneId));
            }
        });
        queryObj.zones = zones;
        queryObj.c = encodeURIComponent(JSON.stringify(cond));

        /* -------------------------------------------------------------------------- */

        return {
            url: baseUrl,
            data: queryObj,
            callbackId: callbackId
        };
    }

    function adResponseCallback(adResponse) {
        /* get callbackId from adResponse here */
        var callbackId = 0;
        __baseClass._adResponseStore[callbackId] = adResponse;
    }

    /* -------------------------------------------------------------------------- */

    /* Helpers
     * ---------------------------------- */

    /**
     * @param  {Object} doc The document of the iframe where the ad will go.
     * @param  {string} adm The ad code that came with the original demand.
     */
    function __render(doc, adm) {
        System.documentWrite(doc, adm);
    }

    /**
     * Parses and extracts demand from adResponse according to the adapter and then attaches it
     * to the corresponding bid's returnParcel in the correct format using targeting keys.
     *
     * @param {string} sessionId The sessionId, used for stats and other events.
     *
     * @param {any} adResponse This is the bid response as returned from the bid request, that was either
     * passed to a JSONP callback or simply sent back via AJAX.
     *
     * @param {object[]} returnParcels The array of original parcels, SAME array that was passed to
     * generateRequestObj to signal which slots need demand. In this funciton, the demand needs to be
     * attached to each one of the objects for which the demand was originally requested for.
     */
    function __parseResponse(sessionId, adResponse, returnParcels) {

        var unusedReturnParcels = returnParcels.slice();

        /* ---------- Process adResponse and extract the bids into the bids array ------------*/

        var bids = Utilities.deepCopy(adResponse);

        /* --------------------------------------------------------------------------------- */

        for (var j = 0; j < returnParcels.length; j++) {
            var curReturnParcel = returnParcels[j];

            /* ----------- Fill this out to find a matching bid for the current parcel ------------- */
            var curBid;
            curBid = __findBid(curReturnParcel.xSlotRef, bids);

            /* ------------------------------------------------------------------------------------*/

            /* HeaderStats information */
            var headerStatsInfo = {};
            headerStatsInfo[curReturnParcel.htSlot.getId()] = [curReturnParcel.xSlotName];

            /* No matching bid found so its a pass */
            if (!curBid) {
                if (__profile.enabledAnalytics.requestTime) {
                    __baseClass._emitStatsEvent(sessionId, 'hs_slot_pass', headerStatsInfo);
                }
                curReturnParcel.pass = true;
                continue;
            }

            /* ---------- Fill the bid variables with data from the bid response here. ------------*/
            /* Using the above variable, curBid, extract various information about the bid and assign it to
             * these local variables */

            var bidPrice = curBid.price;
            /* the bid price for the given slot */
            var bidSize = [curBid.width, curBid.height];
            /* the size of the given slot */
            var bidCreative = curBid.adm;
            /* the creative/adm for the given slot that will be rendered if is the winner. */
            var bidDealId = curBid.dealid;
            /* the dealId if applicable for this slot. */
            /* ---------------------------------------------------------------------------------------*/

            if (__profile.enabledAnalytics.requestTime) {
                __baseClass._emitStatsEvent(sessionId, 'hs_slot_bid', headerStatsInfo);
            }

            curReturnParcel.size = bidSize;
            curReturnParcel.targetingType = 'slot';
            curReturnParcel.targeting = {};

            //? if (FEATURES.GPT_LINE_ITEMS) {
            var targetingCpm = __bidTransformers.targeting.apply(bidPrice);
            var sizeKey = Size.arrayToString(curReturnParcel.size);

            if (bidDealId) {
                curReturnParcel.targeting[__baseClass._configs.targetingKeys.pmid] = [sizeKey + '_' + bidDealId];
                curReturnParcel.targeting[__baseClass._configs.targetingKeys.pm] = [sizeKey + '_' + targetingCpm];
            } else {
                curReturnParcel.targeting[__baseClass._configs.targetingKeys.om] = [sizeKey + '_' + targetingCpm];
            }
            curReturnParcel.targeting[__baseClass._configs.targetingKeys.id] = [curReturnParcel.requestId];

            if (__baseClass._configs.lineItemType === Constants.LineItemTypes.ID_AND_SIZE) {
                RenderService.registerAdByIdAndSize(
                    sessionId,
                    __profile.partnerId,
                    __render, [bidCreative],
                    '',
                    __profile.features.demandExpiry.enabled ? (__profile.features.demandExpiry.value + System.now()) : 0,
                    curReturnParcel.requestId, bidSize
                );
            } else if (__baseClass._configs.lineItemType === Constants.LineItemTypes.ID_AND_PRICE) {
                RenderService.registerAdByIdAndPrice(
                    sessionId,
                    __profile.partnerId,
                    __render, [bidCreative],
                    '',
                    __profile.features.demandExpiry.enabled ? (__profile.features.demandExpiry.value + System.now()) : 0,
                    curReturnParcel.requestId,
                    targetingCpm
                );
            }
            //? }

            //? if (FEATURES.RETURN_CREATIVE) {
            curReturnParcel.adm = bidCreative;
            //? }

            //? if (FEATURES.RETURN_PRICE) {
            curReturnParcel.price = Number(__bidTransformers.price.apply(bidPrice));
            //? }


            //? if (FEATURES.INTERNAL_RENDER) {
            var pubKitAdId = RenderService.registerAd(
                sessionId,
                __profile.partnerId,
                __render, [bidCreative],
                '',
                __profile.features.demandExpiry.enabled ? (__profile.features.demandExpiry.value + System.now()) : 0
            );
            curReturnParcel.targeting.pubKitAdId = pubKitAdId;
            //? }
        }
    }

    /* =====================================
     * Constructors
     * ---------------------------------- */

    (function __constructor() {
        EventsService = SpaceCamp.services.EventsService;
        RenderService = SpaceCamp.services.RenderService;

        /* ---------- Please fill out this partner profile according to your module ------------*/
        __profile = {
            partnerId: 'JustPremiumHtb', // PartnerName
            namespace: 'JustPremiumHtb', // Should be same as partnerName
            statsId: 'JUSTP', // Unique partner identifier
            version: '2.0.0',
            targetingType: 'slot',
            enabledAnalytics: {
                requestTime: true
            },
            features: {
                demandExpiry: {
                    enabled: false,
                    value: 0
                },
                rateLimiting: {
                    enabled: false,
                    value: 0
                }
            },
            targetingKeys: { // Targeting keys for demand, should follow format ix_{statsId}_id
                id: 'ix_justp_id',
                om: 'ix_justp_cpm',
                pm: 'ix_justp_cpm',
                pmid: 'ix_justp_dealid'
            },
            lineItemType: Constants.LineItemTypes.ID_AND_SIZE,
            callbackType: Partner.CallbackTypes.NONE, // Callback type, please refer to the readme for details
            architecture: Partner.Architectures.FSRA, // Request architecture, please refer to the readme for details
            requestType: Partner.RequestTypes.AJAX // Request type, jsonp, ajax, or any.
        };
        /* ---------------------------------------------------------------------------------------*/

        //? if (DEBUG) {
        var results = ConfigValidators.partnerBaseConfig(configs) || PartnerSpecificValidator(configs);

        if (results) {
            throw Whoopsie('INVALID_CONFIG', results);
        }
        //? }

        /*
         * Adjust the below bidTransformerConfigs variable to match the units the adapter
         * sends bids in and to match line item setup. This configuration variable will
         * be used to transform the bids going into DFP.
         */

        /* - Please fill out this bid trasnformer according to your module's bid response format - */
        // Is that ok, if we send our price in dollars?
        var bidTransformerConfigs = {
            //? if (FEATURES.GPT_LINE_ITEMS) {
            targeting: {
                inputCentsMultiplier: 100, // Input is in dollars
                outputCentsDivisor: 100, // Output as dollars
                outputPrecision: 2, // With 0 decimal places
                roundingType: 'FLOOR', // jshint ignore:line
                floor: 0,
                buckets: [{
                    max: 2000, // Up to 20 dollar (above 5 cents)
                    step: 5 // use 5 cent increments
                }, {
                    max: 5000, // Up to 50 dollars (above 20 dollars)
                    step: 100 // use 1 dollar increments
                }]
            },
            //? }
            //? if (FEATURES.RETURN_PRICE) {
            price: {
                inputCentsMultiplier: 100, // Input is in dollars
                outputCentsDivisor: 100, // Output as dollars
                outputPrecision: 2, // With 2 decimal places
                roundingType: 'NONE',
            },
            //? }
        };

        /* --------------------------------------------------------------------------------------- */

        if (configs.bidTransformer) {
            //? if (FEATURES.GPT_LINE_ITEMS) {
            bidTransformerConfigs.targeting = configs.bidTransformer;
            //? }
            //? if (FEATURES.RETURN_PRICE) {
            bidTransformerConfigs.price.inputCentsMultiplier = configs.bidTransformer.inputCentsMultiplier;
            //? }
        }

        __bidTransformers = {};

        //? if (FEATURES.GPT_LINE_ITEMS) {
        __bidTransformers.targeting = BidTransformer(bidTransformerConfigs.targeting);
        //? }
        //? if (FEATURES.RETURN_PRICE) {
        __bidTransformers.price = BidTransformer(bidTransformerConfigs.price);
        //? }

        __baseClass = Partner(__profile, configs, null, {
            parseResponse: __parseResponse,
            generateRequestObj: __generateRequestObj,
            adResponseCallback: adResponseCallback
        });
    })();

    /* =====================================
     * Public Interface
     * ---------------------------------- */

    var derivedClass = {
        /* Class Information
         * ---------------------------------- */

        //? if (DEBUG) {
        __type__: 'JustPremiumHtb',
        //? }

        //? if (TEST) {
        __baseClass: __baseClass,
        //? }

        /* Data
         * ---------------------------------- */

        //? if (TEST) {
        profile: __profile,
        //? }

        /* Functions
         * ---------------------------------- */

        //? if (TEST) {
        preparePubCond: __preparePubCond,
        render: __render,
        parseResponse: __parseResponse,
        generateRequestObj: __generateRequestObj,
        adResponseCallback: adResponseCallback
        //? }
    };

    return Classify.derive(__baseClass, derivedClass);
}

////////////////////////////////////////////////////////////////////////////////
// Exports /////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

module.exports = JustPremiumHtb;