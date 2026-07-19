/**
 * Stadium Locations — StadiumPulse
 *
 * Static dataset of named fan-facing locations around MetLife Stadium,
 * East Rutherford, NJ (lat 40.8135, lng -74.0745) — a confirmed FIFA
 * World Cup 2026 host venue.
 *
 * `currentCrowdLevel` is manually set per location to simulate real
 * event-day conditions (varying crowd distribution across locations).
 * Offsets are realistic: 200–600 m from the stadium footprint.
 */

/** @typedef {"low" | "moderate" | "high" | "critical"} CrowdLevel */
/** @typedef {"exit" | "parking" | "transit" | "medical" | "accessible_exit"} LocationType */

/**
 * @typedef {Object} StadiumLocation
 * @property {string}       id                  - Unique slug identifier.
 * @property {string}       name                - Human-readable location name.
 * @property {LocationType} type                - Functional category.
 * @property {number}       lat                 - Latitude (WGS84).
 * @property {number}       lng                 - Longitude (WGS84).
 * @property {boolean}      wheelchairAccessible - True if the location is accessible via wheelchair/mobility aids.
 * @property {CrowdLevel}   currentCrowdLevel   - Live simulated crowd level at this location.
 */

/** @type {StadiumLocation[]} */
const STADIUM_LOCATIONS = [
    // ── Exits (standard gates) ──────────────────────────────────────────────
    {
        id: "gate_a",
        name: "Gate A — North Exit",
        type: "exit",
        lat: 40.8162,
        lng: -74.0745,
        wheelchairAccessible: false,
        currentCrowdLevel: "high"
    },
    {
        id: "gate_b",
        name: "Gate B — East Exit",
        type: "exit",
        lat: 40.8135,
        lng: -74.0701,
        wheelchairAccessible: false,
        currentCrowdLevel: "critical"
    },
    {
        id: "gate_c",
        name: "Gate C — South Exit",
        type: "exit",
        lat: 40.8108,
        lng: -74.0745,
        wheelchairAccessible: false,
        currentCrowdLevel: "moderate"
    },

    // ── Accessible exit ─────────────────────────────────────────────────────
    {
        id: "gate_acc_west",
        name: "Accessible Gate — West Exit",
        type: "accessible_exit",
        lat: 40.8135,
        lng: -74.0789,
        wheelchairAccessible: true,
        currentCrowdLevel: "low"
    },

    // ── Parking lots ────────────────────────────────────────────────────────
    {
        id: "lot_north",
        name: "North Parking Lot (Lot A)",
        type: "parking",
        lat: 40.8192,
        lng: -74.0755,
        wheelchairAccessible: true,
        currentCrowdLevel: "high"
    },
    {
        id: "lot_south",
        name: "South Parking Lot (Lot B)",
        type: "parking",
        lat: 40.8082,
        lng: -74.0738,
        wheelchairAccessible: true,
        currentCrowdLevel: "moderate"
    },

    // ── Transit ─────────────────────────────────────────────────────────────
    {
        id: "transit_meadowlands",
        name: "Meadowlands Station — NJ Transit Bus Hub",
        type: "transit",
        lat: 40.8148,
        lng: -74.0812,
        wheelchairAccessible: true,
        currentCrowdLevel: "low"
    },

    // ── Medical ─────────────────────────────────────────────────────────────
    {
        id: "medical_tent_east",
        name: "Medical Tent — East Plaza",
        type: "medical",
        lat: 40.8130,
        lng: -74.0718,
        wheelchairAccessible: true,
        currentCrowdLevel: "low"
    }
];

/**
 * Hardcoded origin coordinates for the zones (inside/near MetLife Stadium).
 * Single source of truth for both frontend definitions and backend validation.
 */
const TICKET_ZONES = {
    'zone_a': { id: 'zone_a', name: 'Zone A — North Stands', lat: 40.8145, lng: -74.0745 },
    'zone_b': { id: 'zone_b', name: 'Zone B — South Stands', lat: 40.8125, lng: -74.0745 },
    'zone_c': { id: 'zone_c', name: 'Zone C — East Stands',  lat: 40.8135, lng: -74.0725 },
    'zone_d': { id: 'zone_d', name: 'Zone D — West Stands',  lat: 40.8135, lng: -74.0765 }
};

module.exports = { STADIUM_LOCATIONS, TICKET_ZONES };
