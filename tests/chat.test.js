/**
 * Mocked integration tests for POST /api/chat
 *
 * Strategy: Same require-cache injection pattern as incidents.test.js —
 * mock geminiClient before loading the chat router, mount it on a minimal
 * Express app, and test real HTTP via native fetch (Node 18+).
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
    require.cache[require.resolve('../src/lib/geminiClient')] = {
        id: require.resolve('../src/lib/geminiClient'),
        filename: require.resolve('../src/lib/geminiClient'),
        loaded: true,
        exports: {
            geminiModel: { generateContent: mockGenerateContent }
        }
    };

    delete require.cache[require.resolve('../src/routes/chat')];

    const express = require('express');
    const app = express();
    app.use(express.json());
    app.use('/api/chat', require('../src/routes/chat'));
    return app;
}

// ─── Cleanup helper ──────────────────────────────────────────────────────────
function cleanupCache() {
    delete require.cache[require.resolve('../src/lib/geminiClient')];
    delete require.cache[require.resolve('../src/routes/chat')];
}

// ════════════════════════════════════════════════════════════════════════════
// TEST: 400 — missing message field
// ════════════════════════════════════════════════════════════════════════════
test('POST /api/chat → 400 when message is missing', async () => {
    const app = buildApp(async () => { throw new Error('Should not be called'); });
    await withServer(app, async (base) => {
        const res = await fetch(`${base}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        assert.equal(res.status, 400);
        const body = await res.json();
        assert.ok(body.error);
    });
    cleanupCache();
});

// ════════════════════════════════════════════════════════════════════════════
// TEST: 400 — message exceeds 1000 chars
// ════════════════════════════════════════════════════════════════════════════
test('POST /api/chat → 400 when message exceeds 1000 characters', async () => {
    const app = buildApp(async () => { throw new Error('Should not be called'); });
    await withServer(app, async (base) => {
        const res = await fetch(`${base}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'x'.repeat(1001) })
        });
        assert.equal(res.status, 400);
        const body = await res.json();
        assert.ok(body.error);
    });
    cleanupCache();
});

// ════════════════════════════════════════════════════════════════════════════
// TEST: 400 — message is not a string
// ════════════════════════════════════════════════════════════════════════════
test('POST /api/chat → 400 when message is not a string', async () => {
    const app = buildApp(async () => { throw new Error('Should not be called'); });
    await withServer(app, async (base) => {
        const res = await fetch(`${base}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 99 })
        });
        assert.equal(res.status, 400);
        const body = await res.json();
        assert.ok(body.error);
    });
    cleanupCache();
});

// ════════════════════════════════════════════════════════════════════════════
// TEST: 200 — happy path returns a reply string
// ════════════════════════════════════════════════════════════════════════════
test('POST /api/chat → 200 with a reply string on valid request', async () => {
    const mockReply = 'Move fans to the nearest alternate exit in an orderly fashion.';

    const app = buildApp(async () => ({
        response: { text: () => mockReply }
    }));

    await withServer(app, async (base) => {
        const res = await fetch(`${base}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'What should I do if a gate is blocked?' })
        });
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.ok(typeof body.reply === 'string', 'reply should be a string');
        assert.equal(body.reply, mockReply);
    });
    cleanupCache();
});

// ════════════════════════════════════════════════════════════════════════════
// TEST: 200 — history is accepted and passed along (no extra validation errors)
// ════════════════════════════════════════════════════════════════════════════
test('POST /api/chat → 200 when history array is provided alongside message', async () => {
    const history = [
        { role: 'user', parts: [{ text: 'How many exits does the north stand have?' }] },
        { role: 'model', parts: [{ text: 'The north stand has 4 exits.' }] }
    ];

    const app = buildApp(async () => ({
        response: { text: () => 'Follow signs to exits 1 through 4.' }
    }));

    await withServer(app, async (base) => {
        const res = await fetch(`${base}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Which one is nearest to block 102?', history })
        });
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.ok(typeof body.reply === 'string');
    });
    cleanupCache();
});

// ════════════════════════════════════════════════════════════════════════════
// TEST: 200 — empty history array is valid (default behaviour)
// ════════════════════════════════════════════════════════════════════════════
test('POST /api/chat → 200 when history is an empty array', async () => {
    const app = buildApp(async () => ({
        response: { text: () => 'General procedures apply to all zones.' }
    }));

    await withServer(app, async (base) => {
        const res = await fetch(`${base}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'What are the general crowd procedures?', history: [] })
        });
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.ok(typeof body.reply === 'string');
    });
    cleanupCache();
});

// ════════════════════════════════════════════════════════════════════════════
// TEST: 502 — AI throws a non-503 error (no retry, immediate failure)
// ════════════════════════════════════════════════════════════════════════════
test('POST /api/chat → 502 when Gemini throws a non-503 error', async () => {
    const err = new Error('Forbidden');
    err.status = 403;

    const app = buildApp(async () => { throw err; });

    await withServer(app, async (base) => {
        const res = await fetch(`${base}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Is gate 3 accessible?' })
        });
        assert.equal(res.status, 502);
        const body = await res.json();
        assert.ok(body.error);
    });
    cleanupCache();
});

// ════════════════════════════════════════════════════════════════════════════
// TEST: response has exactly the key 'reply' and no extra leaking fields
// ════════════════════════════════════════════════════════════════════════════
test('POST /api/chat → 200 response body contains only the "reply" key', async () => {
    const app = buildApp(async () => ({
        response: { text: () => 'Go to the nearest steward for assistance.' }
    }));

    await withServer(app, async (base) => {
        const res = await fetch(`${base}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'I need help finding my seat.' })
        });
        assert.equal(res.status, 200);
        const body = await res.json();
        const keys = Object.keys(body);
        assert.deepEqual(keys, ['reply'], `Expected only ["reply"] key but got ${JSON.stringify(keys)}`);
    });
    cleanupCache();
});
