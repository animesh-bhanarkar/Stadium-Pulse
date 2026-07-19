/**
 * Google Maps Directions API client — StadiumPulse
 *
 * Thin wrapper using Node 18+ built-in fetch(). No axios or extra deps.
 * Reads MAPS_API_KEY from process.env — never hardcoded.
 */

const MAPS_API_KEY = process.env.MAPS_API_KEY;
if (!MAPS_API_KEY) {
    throw new Error('Startup Error: MAPS_API_KEY is missing from environment variables.');
}

/**
 * Strips HTML tags from a Google Directions step instruction string.
 * Google wraps road names in <b> tags, etc.
 *
 * @param {string} html - Raw instruction string potentially containing HTML.
 * @returns {string} Plain-text instruction.
 */
function stripHtml(html) {
    // Replace each tag with a space (so adjacent text fragments don't merge),
    // then collapse any run of whitespace down to a single space, and trim.
    return html
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

/**
 * Fetches walking directions between two coordinates using the Google Maps
 * Directions API.
 *
 * @param {number} originLat      - Origin latitude.
 * @param {number} originLng      - Origin longitude.
 * @param {number} destLat        - Destination latitude.
 * @param {number} destLng        - Destination longitude.
 * @returns {Promise<{ distanceText: string, durationText: string, steps: string[] }>}
 * @throws {Error} If the Maps API returns a non-OK status, or if the network call fails.
 */
async function getWalkingDirections(originLat, originLng, destLat, destLng) {
    const url =
        `https://maps.googleapis.com/maps/api/directions/json` +
        `?origin=${originLat},${originLng}` +
        `&destination=${destLat},${destLng}` +
        `&mode=walking` +
        `&key=${MAPS_API_KEY}`;

    const fetchResponse = await fetch(url);

    if (!fetchResponse.ok) {
        // HTTP-level failure (should be rare — Google usually returns 200 with status field)
        throw new Error(`Maps HTTP error: ${fetchResponse.status} ${fetchResponse.statusText}`);
    }

    const data = await fetchResponse.json();

    if (data.status !== 'OK') {
        // API-level failure: ZERO_RESULTS, REQUEST_DENIED, OVER_QUERY_LIMIT, etc.
        throw new Error(`Maps API status: ${data.status}`);
    }

    const leg = data.routes[0].legs[0];

    const steps = leg.steps.map(step => stripHtml(step.html_instructions));

    return {
        distanceText: leg.distance.text,
        durationText: leg.duration.text,
        steps
    };
}

module.exports = { getWalkingDirections };
