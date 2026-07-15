const test = require('node:test');
const assert = require('node:assert');
const { triageIncident } = require('../src/lib/decisionEngine');

test('Validates all valid incident types and maps to correct resourceType', () => {
    const cases = [
        { incidentType: 'medical', expectedResource: 'medical_team' },
        { incidentType: 'overcrowding', expectedResource: 'crowd_control_team' },
        { incidentType: 'security_threat', expectedResource: 'security_team' },
        { incidentType: 'lost_child', expectedResource: 'guest_services' },
        { incidentType: 'weather', expectedResource: 'general_staff' },
        { incidentType: 'technical_failure', expectedResource: 'maintenance_team' },
        { incidentType: 'fire_hazard', expectedResource: 'security_team' }
    ];

    for (const c of cases) {
        const result = triageIncident({
            incidentType: c.incidentType,
            zoneCrowdLevel: 'moderate',
            urgency: 'routine'
        });
        assert.strictEqual(result.resourceType, c.expectedResource);
    }
});

test('Priority score clamps correctly at the high end (fire_hazard + critical + critical)', () => {
    const result = triageIncident({
        incidentType: 'fire_hazard', // 90
        zoneCrowdLevel: 'critical',  // +10
        urgency: 'critical'          // +10
    }); // Total 110
    assert.strictEqual(result.priorityScore, 100);
});

test('Priority score clamps correctly at the low end', () => {
    const result = triageIncident({
        incidentType: 'technical_failure', // 30
        zoneCrowdLevel: 'low',             // -5
        urgency: 'routine'                 // +0
    }); // Total 25
    assert.strictEqual(result.priorityScore, 25);
});

test('Invalid incidentType throws an error', () => {
    assert.throws(
        () => triageIncident({ incidentType: 'alien_invasion', zoneCrowdLevel: 'low', urgency: 'routine' }),
        { message: 'Invalid incidentType: alien_invasion' }
    );
});

test('Invalid zoneCrowdLevel throws an error', () => {
    assert.throws(
        () => triageIncident({ incidentType: 'medical', zoneCrowdLevel: 'empty', urgency: 'routine' }),
        { message: 'Invalid zoneCrowdLevel: empty' }
    );
});

test('Invalid urgency throws an error', () => {
    assert.throws(
        () => triageIncident({ incidentType: 'medical', zoneCrowdLevel: 'low', urgency: 'whatever' }),
        { message: 'Invalid urgency: whatever' }
    );
});

test('The "URGENT:" prefix appears when priorityScore > 80', () => {
    const result = triageIncident({
        incidentType: 'medical', // 75
        zoneCrowdLevel: 'critical', // +10
        urgency: 'routine' // +0
    }); // Score 85
    assert.strictEqual(result.priorityScore, 85);
    assert.ok(result.recommendedAction.startsWith('URGENT: '));
});

test('The "URGENT:" prefix does not appear when priorityScore <= 80', () => {
    const result = triageIncident({
        incidentType: 'medical', // 75
        zoneCrowdLevel: 'moderate', // 0
        urgency: 'routine' // +0
    }); // Score 75
    assert.strictEqual(result.priorityScore, 75);
    assert.ok(!result.recommendedAction.startsWith('URGENT: '));
});

test('Returns correct inputSummary in output', () => {
    const result = triageIncident({
        incidentType: 'weather',
        zoneCrowdLevel: 'high',
        urgency: 'urgent'
    });
    assert.deepStrictEqual(result.inputSummary, {
        incidentType: 'weather',
        zoneCrowdLevel: 'high',
        urgency: 'urgent'
    });
});

test('Priority score computes correctly for edge case (exactly 80)', () => {
    // medical(75) + high(5) + routine(0) = 80
    const result = triageIncident({
        incidentType: 'medical', 
        zoneCrowdLevel: 'high',
        urgency: 'routine'
    });
    assert.strictEqual(result.priorityScore, 80);
    // Should NOT have URGENT prefix, since > 80 is required
    assert.ok(!result.recommendedAction.startsWith('URGENT: '));
});

test('Missing fields in input throw errors as undefined is invalid', () => {
    assert.throws(
        () => triageIncident({ zoneCrowdLevel: 'low', urgency: 'routine' }),
        /Invalid incidentType: undefined/
    );
});
