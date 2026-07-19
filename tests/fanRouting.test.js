const test = require('node:test');
const assert = require('node:assert');
const { chooseDestination } = require('../src/lib/fanRouting');
const { STADIUM_LOCATIONS } = require('../src/lib/stadiumLocations');

// ── Test 1: picks the lowest crowd level among multiple candidates ────────────
test('Picks the lowest-crowd exit when multiple exits exist at different crowd levels', () => {
    // From stadiumLocations: Gate A=high, Gate B=critical, Gate C=moderate
    // Expected: Gate C (moderate is lowest standard exit)
    const { chosenLocation, warning } = chooseDestination({
        destinationType: 'exit',
        mobilityNeed: 'none'
    });
    assert.strictEqual(chosenLocation.id, 'gate_c');
    assert.strictEqual(chosenLocation.currentCrowdLevel, 'moderate');
    assert.strictEqual(warning, null);
});

// ── Test 2: picks the lowest-crowd parking lot ────────────────────────────────
test('Picks the lowest-crowd parking lot among multiple lots', () => {
    // lot_north=high, lot_south=moderate → expect lot_south
    const { chosenLocation, warning } = chooseDestination({
        destinationType: 'parking',
        mobilityNeed: 'none'
    });
    assert.strictEqual(chosenLocation.id, 'lot_south');
    assert.strictEqual(chosenLocation.currentCrowdLevel, 'moderate');
    assert.strictEqual(warning, null);
});

// ── Test 3: wheelchair + exit routes to accessible_exit type ─────────────────
test('wheelchair + exit chooses accessible_exit type, not standard exit', () => {
    // Only one accessible_exit: gate_acc_west (low crowd)
    const { chosenLocation, warning } = chooseDestination({
        destinationType: 'exit',
        mobilityNeed: 'wheelchair'
    });
    assert.strictEqual(chosenLocation.type, 'accessible_exit');
    assert.strictEqual(chosenLocation.id, 'gate_acc_west');
    assert.strictEqual(warning, null);
});

// ── Test 4: wheelchair + exit falls back with warning when no accessible option ──
test('wheelchair + exit falls back to standard exit with a warning when no accessible_exit exists', () => {
    // Temporarily shadow STADIUM_LOCATIONS with a dataset that has no accessible_exit entries
    // We test this by calling chooseDestination against a modified module.
    // Since we cannot re-require with different data at runtime without rewiring, we exercise
    // the code path by temporarily patching the exported array in-place.
    const original = STADIUM_LOCATIONS.splice(0); // remove all entries, save them
    // Insert only standard exits (no accessible_exit)
    STADIUM_LOCATIONS.push(
        { id: 'x_gate_a', name: 'Gate A', type: 'exit', lat: 40.81, lng: -74.07, wheelchairAccessible: false, currentCrowdLevel: 'high' },
        { id: 'x_gate_b', name: 'Gate B', type: 'exit', lat: 40.81, lng: -74.07, wheelchairAccessible: false, currentCrowdLevel: 'moderate' }
    );

    try {
        const { chosenLocation, warning } = chooseDestination({
            destinationType: 'exit',
            mobilityNeed: 'wheelchair'
        });
        // Should have fallen back to standard exit
        assert.strictEqual(chosenLocation.type, 'exit');
        // Picked the lowest-crowd standard exit
        assert.strictEqual(chosenLocation.id, 'x_gate_b');
        // Warning must be a non-empty string
        assert.ok(typeof warning === 'string' && warning.length > 0,
            'Expected a non-null warning string on fallback');
    } finally {
        // Restore original data unconditionally
        STADIUM_LOCATIONS.splice(0);
        STADIUM_LOCATIONS.push(...original);
    }
});

// ── Test 5: invalid destinationType throws ───────────────────────────────────
test('Invalid destinationType throws an error', () => {
    assert.throws(
        () => chooseDestination({ destinationType: 'spaceship', mobilityNeed: 'none' }),
        { message: 'Invalid destinationType: spaceship' }
    );
});

// ── Test 6: invalid mobilityNeed throws ──────────────────────────────────────
test('Invalid mobilityNeed throws an error', () => {
    assert.throws(
        () => chooseDestination({ destinationType: 'exit', mobilityNeed: 'crutches' }),
        { message: 'Invalid mobilityNeed: crutches' }
    );
});

// ── Test 7: wheelchair + non-exit does NOT filter by accessibility ────────────
test('wheelchair + parking does not apply accessibility filter — returns lowest-crowd lot', () => {
    // Accessibility filter only applies to exit routing.
    // parking: lot_north=high, lot_south=moderate → expect lot_south (the less crowded one)
    const { chosenLocation, warning } = chooseDestination({
        destinationType: 'parking',
        mobilityNeed: 'wheelchair'
    });
    assert.strictEqual(chosenLocation.id, 'lot_south');
    assert.strictEqual(warning, null);
});

// ── Test 8: tie-breaking — first array entry wins when crowd levels are equal ──
test('Tie-breaking returns the first matching location in the array when crowd levels are equal', () => {
    const original = STADIUM_LOCATIONS.splice(0);
    // Two exits at identical crowd level — first one should win
    STADIUM_LOCATIONS.push(
        { id: 'tie_a', name: 'Tie Gate A', type: 'exit', lat: 40.81, lng: -74.07, wheelchairAccessible: false, currentCrowdLevel: 'moderate' },
        { id: 'tie_b', name: 'Tie Gate B', type: 'exit', lat: 40.81, lng: -74.07, wheelchairAccessible: false, currentCrowdLevel: 'moderate' }
    );

    try {
        const { chosenLocation } = chooseDestination({
            destinationType: 'exit',
            mobilityNeed: 'none'
        });
        assert.strictEqual(chosenLocation.id, 'tie_a', 'First entry in array should win on tie');
    } finally {
        STADIUM_LOCATIONS.splice(0);
        STADIUM_LOCATIONS.push(...original);
    }
});

// ── Test 9: transit + none returns the single transit location ────────────────
test('Transit request returns the transit location with correct structure', () => {
    const { chosenLocation, warning } = chooseDestination({
        destinationType: 'transit',
        mobilityNeed: 'none'
    });
    assert.strictEqual(chosenLocation.type, 'transit');
    assert.strictEqual(chosenLocation.id, 'transit_meadowlands');
    assert.ok(typeof chosenLocation.lat === 'number');
    assert.ok(typeof chosenLocation.lng === 'number');
    assert.strictEqual(warning, null);
});

// ── Test 10: medical request returns medical location ─────────────────────────
test('Medical request returns the medical tent location', () => {
    const { chosenLocation, warning } = chooseDestination({
        destinationType: 'medical',
        mobilityNeed: 'none'
    });
    assert.strictEqual(chosenLocation.type, 'medical');
    assert.strictEqual(chosenLocation.id, 'medical_tent_east');
    assert.strictEqual(warning, null);
});
