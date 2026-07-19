/**
 * Fan Route endpoint — StadiumPulse
 *
 * POST /api/route
 * Combines fanRouting.js (pure decision logic) with mapsClient.js
 * (real Google Maps Directions API call) to return the best destination
 * and walking directions for a fan.
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { chooseDestination } = require('../lib/fanRouting');
const { getWalkingDirections } = require('../lib/mapsClient');
const { TICKET_ZONES } = require('../lib/stadiumLocations');

const routeLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { error: 'Too many requests, please try again later.' }
});

// Errors from Maps API that will NOT succeed on retry — fail fast for these.
const NON_RETRYABLE_MAPS_STATUSES = new Set([
    'REQUEST_DENIED',
    'ZERO_RESULTS',
    'NOT_FOUND',
    'MAX_WAYPOINTS_EXCEEDED',
    'INVALID_REQUEST'
]);

/**
 * Returns true if the error is a transient failure that may succeed on retry
 * (network glitches, Maps 5xx, OVER_QUERY_LIMIT, UNKNOWN_ERROR).
 *
 * @param {Error} error
 * @returns {boolean}
 */
function isRetryable(error) {
    const msg = error?.message || '';
    // Non-retryable Maps API statuses
    for (const status of NON_RETRYABLE_MAPS_STATUSES) {
        if (msg.includes(status)) return false;
    }
    // Maps HTTP-level 4xx are also not retryable
    if (/Maps HTTP error: 4\d\d/.test(msg)) return false;
    return true;
}

router.post('/', routeLimiter, async (req, res) => {
    const { destinationType, mobilityNeed, zoneId } = req.body;

    // ── Validate zoneId ───────────────────────────────────────────
    if (!zoneId) {
        return res.status(400).json({ error: 'zoneId is required.' });
    }
    const zone = TICKET_ZONES[zoneId];
    if (!zone) {
        return res.status(400).json({ error: 'Invalid zoneId provided.' });
    }
    const { lat: originLat, lng: originLng } = zone;

    // ── Choose destination (fanRouting.js handles its own validation) ─────────
    let chosenLocation, routingWarning;
    try {
        const result = chooseDestination({ destinationType, mobilityNeed });
        chosenLocation = result.chosenLocation;
        routingWarning = result.warning;
    } catch (err) {
        // fanRouting throws for invalid destinationType / mobilityNeed
        return res.status(400).json({ error: err.message });
    }

    // ── Call Google Maps Directions API with retry-with-backoff ───────────────
    const MAX_ATTEMPTS = 3;
    const RETRY_DELAYS_MS = [1000, 2000]; // before attempt 2, before attempt 3
    let lastError;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            const route = await getWalkingDirections(
                originLat,
                originLng,
                chosenLocation.lat,
                chosenLocation.lng
            );

            // ── Success ───────────────────────────────────────────────────────
            return res.status(200).json({
                chosenLocation,
                warning: routingWarning,
                route
            });

        } catch (error) {
            lastError = error;
            const errMsg = error?.message || String(error);
            const errStatus = error?.status ?? error?.statusCode ?? error?.code ?? 'N/A';
            let errJson;
            try { errJson = JSON.stringify(error, Object.getOwnPropertyNames(error), 2); }
            catch (_) { errJson = String(error); }

            console.error(`=== Maps Route API Error (attempt ${attempt}/${MAX_ATTEMPTS}) ===`);
            console.error('status/code:', errStatus);
            console.error('message:', errMsg);
            console.error('full error object:', errJson);
            console.error('=================================');

            // Non-retryable errors: don't waste remaining attempts
            if (!isRetryable(error) || attempt === MAX_ATTEMPTS) {
                return res.status(502).json({ error: 'Unable to calculate route, please retry' });
            }

            // Wait before next attempt
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1]));
        }
    }

    // Exhausted all retries
    return res.status(502).json({ error: 'Unable to calculate route, please retry' });
});

module.exports = router;
