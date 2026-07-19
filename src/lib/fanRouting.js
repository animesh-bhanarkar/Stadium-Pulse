/**
 * Fan Routing Decision Engine — StadiumPulse
 *
 * Pure, deterministic module that selects the best destination for a fan
 * based on their destination type and mobility need. No network calls.
 * Mirrors the structure and quality of decisionEngine.js.
 */

const { STADIUM_LOCATIONS } = require('./stadiumLocations');

// ── Lookup tables for validation ─────────────────────────────────────────────

/**
 * All valid destination types a fan can request.
 * "accessible_exit" is an internal type stored on locations but is NOT a
 * valid caller-facing destinationType — fans requesting wheelchair + exit
 * are automatically mapped to accessible_exit locations.
 */
const VALID_DESTINATION_TYPES = new Set(["exit", "parking", "transit", "medical"]);

/** All valid mobility-need values. */
const VALID_MOBILITY_NEEDS = new Set(["none", "wheelchair"]);

/**
 * Numeric rank for crowd levels — lower is better (less crowded).
 * Used to sort candidate locations and pick the least congested one.
 */
const CROWD_LEVEL_RANK = {
    "low":      1,
    "moderate": 2,
    "high":     3,
    "critical": 4
};

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Chooses the best destination location for a fan.
 *
 * Decision rules (applied in order):
 *  1. Validate inputs; throw on invalid values.
 *  2. Collect candidate locations matching the requested type.
 *     - If destinationType is "exit" AND mobilityNeed is "wheelchair",
 *       look for locations of type "accessible_exit" first.
 *     - If that search yields no candidates, fall back to any "exit"
 *       location and set a warning in the response.
 *     - For all other destinationType/mobilityNeed combinations the
 *       accessibility flag does not filter candidates (parking, transit,
 *       and medical locations are all reachable regardless of mobility).
 *  3. Among candidates, pick the one with the lowest currentCrowdLevel.
 *  4. Ties are broken by array order (first in STADIUM_LOCATIONS wins).
 *
 * @param {Object} params
 * @param {string} params.destinationType - "exit" | "parking" | "transit" | "medical"
 * @param {string} params.mobilityNeed    - "none" | "wheelchair"
 * @returns {{ chosenLocation: import('./stadiumLocations').StadiumLocation, warning: string|null }}
 * @throws {Error} If destinationType or mobilityNeed is not a recognised value.
 */
function chooseDestination({ destinationType, mobilityNeed }) {
    // ── Validation ───────────────────────────────────────────────────────────
    if (!VALID_DESTINATION_TYPES.has(destinationType)) {
        throw new Error(`Invalid destinationType: ${destinationType}`);
    }
    if (!VALID_MOBILITY_NEEDS.has(mobilityNeed)) {
        throw new Error(`Invalid mobilityNeed: ${mobilityNeed}`);
    }

    // ── Candidate selection ──────────────────────────────────────────────────
    let candidates = [];
    let warning = null;

    const isWheelchairExit = (destinationType === "exit" && mobilityNeed === "wheelchair");

    if (isWheelchairExit) {
        // Prefer dedicated accessible_exit locations
        candidates = STADIUM_LOCATIONS.filter(loc => loc.type === "accessible_exit");

        if (candidates.length === 0) {
            // Fallback: any standard exit will do, but flag it
            candidates = STADIUM_LOCATIONS.filter(loc => loc.type === "exit");
            warning =
                "No wheelchair-accessible exit locations are currently available. " +
                "Routing to the nearest standard exit instead — please request staff assistance on arrival.";
        }
    } else {
        // Standard filter: match on destinationType only
        candidates = STADIUM_LOCATIONS.filter(loc => loc.type === destinationType);
    }

    // ── Pick lowest-crowd candidate (stable: ties go to first in array) ───────
    const chosenLocation = candidates.reduce((best, current) => {
        return CROWD_LEVEL_RANK[current.currentCrowdLevel] < CROWD_LEVEL_RANK[best.currentCrowdLevel]
            ? current
            : best;
    });

    return { chosenLocation, warning };
}

module.exports = { chooseDestination };
