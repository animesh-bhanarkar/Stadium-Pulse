/**
 * Mocked integration tests for POST /api/incidents/report
 *
 * Strategy: Before requiring the incidents router, we inject a mock
 * geminiModel into Node's require cache so no real Gemini API calls are made.
 * We then mount the router on a minimal Express app and make real HTTP
 * requests against it using the built-in fetch (Node 18+).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

// ─── Helper: start a throwaway server, run fn(baseUrl), then close ──────────
async function withServer(app, fn) {
    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}`;
    try {
        await fn(base);
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
}

// ─── Helper: build an Express app with a mocked Gemini response ──────────────
function buildApp(mockGenerateContent) {
    // Inject mock into require cache BEFORE loading the router
    require.cache[require.resolve('../src/lib/geminiClient')] = {
        id: require.resolve('../src/lib/geminiClient'),
        filename: require.resolve('../src/lib/geminiClient'),
        loaded: true,
        exports: {
            geminiModel: { generateContent: mockGenerateContent }
        }
    };

    // Clear the incidents router cache so it re-requires geminiClient fresh
    delete require.cache[require.resolve('../src/routes/incidents')];

    const express = require('express');
    const app = express();
    app.use(express.json());
    app.use('/api/incidents', require('../src/routes/incidents'));
    return app;
}

// ─── Cleanup helper: reset module cache after each test ─────────────────────
function cleanupCache() {
    delete require.cache[require.resolve('../src/lib/geminiClient')];
    delete require.cache[require.resolve('../src/routes/incidents')];
}

// ════════════════════════════════════════════════════════════════════════════
// TEST: 400 — missing description
// ════════════════════════════════════════════════════════════════════════════
test('POST /api/incidents/report → 400 when description is missing', async () => {
    const app = buildApp(async () => { throw new Error('Should not be called'); });
    await withServer(app, async (base) => {
        const res = await fetch(`${base}/api/incidents/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        assert.equal(res.status, 400);
        const body = await res.json();
        assert.ok(body.error, 'Error field should be present');
    });
    cleanupCache();
});

// ════════════════════════════════════════════════════════════════════════════
// TEST: 400 — description exceeds 500 chars
// ════════════════════════════════════════════════════════════════════════════
test('POST /api/incidents/report → 400 when description exceeds 500 characters', async () => {
    const app = buildApp(async () => { throw new Error('Should not be called'); });
    await withServer(app, async (base) => {
        const res = await fetch(`${base}/api/incidents/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: 'x'.repeat(501) })
        });
        assert.equal(res.status, 400);
        const body = await res.json();
        assert.ok(body.error);
    });
    cleanupCache();
});

// ════════════════════════════════════════════════════════════════════════════
// TEST: 400 — description is not a string
// ════════════════════════════════════════════════════════════════════════════
test('POST /api/incidents/report → 400 when description is not a string', async () => {
    const app = buildApp(async () => { throw new Error('Should not be called'); });
    await withServer(app, async (base) => {
        const res = await fetch(`${base}/api/incidents/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: 12345 })
        });
        assert.equal(res.status, 400);
        const body = await res.json();
        assert.ok(body.error);
    });
    cleanupCache();
});

// ════════════════════════════════════════════════════════════════════════════
// TEST: 200 happy path — Gemini returns valid JSON, decisionEngine triages it
// ════════════════════════════════════════════════════════════════════════════
test('POST /api/incidents/report → 200 with correct structure on valid AI response', async () => {
    const mockAiJson = {
        incidentType: 'medical',
        zoneCrowdLevel: 'high',
        urgency: 'urgent',
        zone: 'Sector B, Row 12'
    };

    const app = buildApp(async () => ({
        response: { text: () => JSON.stringify(mockAiJson) }
    }));

    await withServer(app, async (base) => {
        const res = await fetch(`${base}/api/incidents/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: 'Person collapsed near row 12 sector B' })
        });
        assert.equal(res.status, 200);
        const body = await res.json();

        // Validate top-level shape
        assert.ok(body.classification, 'Should have classification key');
        assert.ok(body.triage, 'Should have triage key');

        // Validate classification fields
        assert.equal(body.classification.incidentType, 'medical');
        assert.equal(body.classification.zoneCrowdLevel, 'high');
        assert.equal(body.classification.urgency, 'urgent');
        assert.equal(body.classification.zone, 'Sector B, Row 12');

        // Validate triage fields
        assert.ok(typeof body.triage.priorityScore === 'number', 'priorityScore should be a number');
        assert.ok(body.triage.priorityScore >= 1 && body.triage.priorityScore <= 100, 'Score should be 1–100');
        assert.ok(typeof body.triage.recommendedAction === 'string', 'recommendedAction should be a string');
        assert.equal(body.triage.resourceType, 'medical_team');
    });
    cleanupCache();
});

// ════════════════════════════════════════════════════════════════════════════
// TEST: 200 — zone defaults to 'unspecified' when AI omits it
// ════════════════════════════════════════════════════════════════════════════
test('POST /api/incidents/report → zone defaults to "unspecified" when AI omits zone field', async () => {
    const mockAiJson = {
        incidentType: 'weather',
        zoneCrowdLevel: 'moderate',
        urgency: 'routine'
        // No 'zone' key
    };

    const app = buildApp(async () => ({
        response: { text: () => JSON.stringify(mockAiJson) }
    }));

    await withServer(app, async (base) => {
        const res = await fetch(`${base}/api/incidents/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: 'Heavy rain, fans asking for shelter' })
        });
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.classification.zone, 'unspecified');
    });
    cleanupCache();
});

// ════════════════════════════════════════════════════════════════════════════
// TEST: 200 — high priority fire_hazard scores 100 and gets URGENT prefix
// ════════════════════════════════════════════════════════════════════════════
test('POST /api/incidents/report → fire_hazard + critical crowd + critical urgency → score 100 and URGENT prefix', async () => {
    const mockAiJson = {
        incidentType: 'fire_hazard',
        zoneCrowdLevel: 'critical',
        urgency: 'critical',
        zone: 'Gate 4'
    };

    const app = buildApp(async () => ({
        response: { text: () => JSON.stringify(mockAiJson) }
    }));

    await withServer(app, async (base) => {
        const res = await fetch(`${base}/api/incidents/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: 'Smoke and flames visible near Gate 4' })
        });
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.triage.priorityScore, 100);
        assert.ok(body.triage.recommendedAction.startsWith('URGENT:'), 'Action should start with URGENT:');
    });
    cleanupCache();
});

// ════════════════════════════════════════════════════════════════════════════
// TEST: 502 — AI returns a non-503 error (does not retry, fails immediately)
// ════════════════════════════════════════════════════════════════════════════
test('POST /api/incidents/report → 502 when Gemini throws a non-503 error', async () => {
    const err = new Error('Unauthorized');
    err.status = 401;

    const app = buildApp(async () => { throw err; });

    await withServer(app, async (base) => {
        const res = await fetch(`${base}/api/incidents/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: 'Test incident' })
        });
        assert.equal(res.status, 502);
        const body = await res.json();
        assert.ok(body.error);
    });
    cleanupCache();
});

// ════════════════════════════════════════════════════════════════════════════
// TEST: 502 — AI returns JSON with an unrecognised incidentType
// ════════════════════════════════════════════════════════════════════════════
test('POST /api/incidents/report → 502 when AI returns unrecognised incidentType', async () => {
    const mockAiJson = {
        incidentType: 'alien_invasion',   // invalid — not in decisionEngine
        zoneCrowdLevel: 'high',
        urgency: 'critical',
        zone: 'unspecified'
    };

    const app = buildApp(async () => ({
        response: { text: () => JSON.stringify(mockAiJson) }
    }));

    await withServer(app, async (base) => {
        const res = await fetch(`${base}/api/incidents/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: 'Something very unusual happening' })
        });
        assert.equal(res.status, 502);
        const body = await res.json();
        assert.ok(body.error);
    });
    cleanupCache();
});

// ════════════════════════════════════════════════════════════════════════════
// TEST: 502 — AI returns non-JSON (parse failure)
// ════════════════════════════════════════════════════════════════════════════
test('POST /api/incidents/report → 502 when AI returns non-JSON text', async () => {
    const app = buildApp(async () => ({
        response: { text: () => 'Sure! Here is the classification: ...' }  // not JSON
    }));

    await withServer(app, async (base) => {
        const res = await fetch(`${base}/api/incidents/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description: 'Test incident' })
        });
        assert.equal(res.status, 502);
        const body = await res.json();
        assert.ok(body.error);
    });
    cleanupCache();
});
