/**
 * Decision Engine for StadiumPulse
 * Evaluates incoming incidents and computes priority, recommended action, and resource types.
 */

// Lookup tables for validation and scoring
const INCIDENT_CONFIG = {
    "medical": { baseScore: 75, resourceType: "medical_team", action: "Dispatch medical team to location" },
    "overcrowding": { baseScore: 60, resourceType: "crowd_control_team", action: "Initiate crowd dispersal protocols" },
    "security_threat": { baseScore: 85, resourceType: "security_team", action: "Deploy security personnel immediately" },
    "lost_child": { baseScore: 50, resourceType: "guest_services", action: "Escort child to guest services center" },
    "weather": { baseScore: 55, resourceType: "general_staff", action: "Advise fans of weather updates" },
    "technical_failure": { baseScore: 30, resourceType: "maintenance_team", action: "Dispatch maintenance crew to assess" },
    "fire_hazard": { baseScore: 90, resourceType: "security_team", action: "Evacuate zone and deploy fire response" }
};

const CROWD_LEVEL_MODIFIER = {
    "low": -5,
    "moderate": 0,
    "high": 5,
    "critical": 10
};

const URGENCY_MODIFIER = {
    "routine": 0,
    "urgent": 5,
    "critical": 10
};

/**
 * Triages an incident by evaluating its type, crowd level, and urgency.
 *
 * @param {Object} params - The incident parameters.
 * @param {string} params.incidentType - Type of the incident (e.g., 'medical', 'fire_hazard').
 * @param {string} params.zoneCrowdLevel - Current crowd level in the zone ('low', 'moderate', 'high', 'critical').
 * @param {string} params.urgency - Reported urgency ('routine', 'urgent', 'critical').
 * @returns {Object} An object containing the computed priority score, recommended action, resource type, and input summary.
 * @throws {Error} If any of the inputs are invalid.
 */
function triageIncident({ incidentType, zoneCrowdLevel, urgency }) {
    // Validation
    if (!(incidentType in INCIDENT_CONFIG)) {
        throw new Error(`Invalid incidentType: ${incidentType}`);
    }
    if (!(zoneCrowdLevel in CROWD_LEVEL_MODIFIER)) {
        throw new Error(`Invalid zoneCrowdLevel: ${zoneCrowdLevel}`);
    }
    if (!(urgency in URGENCY_MODIFIER)) {
        throw new Error(`Invalid urgency: ${urgency}`);
    }

    const config = INCIDENT_CONFIG[incidentType];
    
    // Compute raw score
    let priorityScore = config.baseScore 
                        + CROWD_LEVEL_MODIFIER[zoneCrowdLevel] 
                        + URGENCY_MODIFIER[urgency];

    // Clamp score between 1 and 100
    priorityScore = Math.max(1, Math.min(100, priorityScore));

    // Determine recommended action
    let recommendedAction = config.action;
    if (priorityScore > 80) {
        recommendedAction = `URGENT: ${recommendedAction}`;
    }

    return {
        priorityScore,
        recommendedAction,
        resourceType: config.resourceType,
        inputSummary: { incidentType, zoneCrowdLevel, urgency }
    };
}

module.exports = { triageIncident };
