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
    const { destinationType, mobilityNeed, originLat, originLng } = req.body;

    // ── Validate origin coordinates ───────────────────────────────────────────
    if (originLat === undefined || originLat === null ||
        originLng === undefined || originLng === null) {
        return res.status(400).json({ error: 'originLat and originLng are required.' });
    }
    if (typeof originLat !== 'number' || typeof originLng !== 'number') {
        return res.status(400).json({ error: 'originLat and originLng must be numbers.' });
    }
    if (originLat < -90 || originLat > 90) {
        return res.status(400).json({ error: 'originLat must be between -90 and 90.' });
    }
    if (originLng < -180 || originLng > 180) {
        return res.status(400).json({ error: 'originLng must be between -180 and 180.' });
    }

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
