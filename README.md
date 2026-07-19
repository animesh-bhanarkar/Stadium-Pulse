# StadiumPulse ⚡

**An AI-powered command center for FIFA World Cup 2026 stadium operations** — built for GCP PromptWars Challenge 4 (Smart Stadiums & Tournament Operations).

StadiumPulse turns real-time crowd and incident signals into prioritized action plans for stadium staff, and instant, accessible, personalized guidance for fans — powered by the same underlying decision intelligence.

**🔗 Live Demo:** https://stadiumpulse-597315970831.us-central1.run.app (Command Center: `/index.html` · Fan Guide: `/fan.html`)

---

## Chosen Vertical

**Smart Stadiums & Tournament Operations**, addressed through two connected personas sharing one intelligence layer:

- **Staff / Volunteers** — a live command center dashboard for triaging incidents (medical, security, overcrowding, fire, lost children, weather, technical failures) and getting instant AI-generated action plans.
- **Fans** — a routing assistant that finds the least-crowded path to an exit, parking lot, transit stop, or medical station, personalized by ticket zone and mobility needs, with real walking directions.

This directly targets six of the eight areas named in the challenge brief: crowd management, operational intelligence, real-time decision support, navigation, accessibility, and multilingual-ready conversational assistance.

## Approach & Logic

The system is built around a **deterministic decision engine**, not a black box — Gemini's role is to *understand* unstructured input (free-text incident reports, natural conversation), while a separate, fully unit-tested, pure JavaScript module makes the actual prioritization/routing decision. This keeps the AI's role auditable and the core logic reliable even if the LLM's phrasing varies.

**Staff-side decision engine** (`src/lib/decisionEngine.js`): `incident type × zone crowd level × urgency → priority score + recommended action + resource dispatch`. Uses a severity lookup table (e.g. fire_hazard=90, technical_failure=30) with additive modifiers for crowd level and urgency, clamped to a 1–100 score, with an `URGENT:` escalation prefix above 80.

**Fan-side decision engine** (`src/lib/fanRouting.js`): `destination type × mobility need × ticket zone → nearest low-crowd accessible destination`. Filters by wheelchair-accessibility when needed (with a transparent fallback + warning if no accessible option exists), then picks the lowest-crowd matching location.

**Two distinct Gemini integrations**, not one AI call doing everything:
1. **Structured classification** (`POST /api/incidents/report`) — turns a free-text incident description into strict JSON (`incidentType`, `zoneCrowdLevel`, `urgency`, `zone`), which then feeds the deterministic decision engine. If Gemini returns an unrecognized category, the engine's own validation catches it and the API returns a clear error rather than silently trusting a hallucination.
2. **Conversational assistant** (`POST /api/chat`) — a stateful, multi-turn Q&A assistant for staff (and a fan-facing variant), for open-ended operational questions the structured flow doesn't cover.

## How the Solution Works

### Architecture
```
Browser (Command Center / Fan Guide)
        │
        ▼
Express server (server.js)
   ├── POST /api/incidents/report → Gemini classify → decisionEngine.triageIncident()
   ├── POST /api/chat             → Gemini conversational assistant
   └── POST /api/route            → fanRouting.chooseDestination() → Google Maps Directions API
        │
        ▼
Google Gemini API (gemini-2.5-flash) + Google Maps Directions API
```

### Two frontend surfaces
- **Command Center** (`public/index.html`) — two-panel dashboard: incident reporter + result card on the left, live incident feed on the right, collapsible AI staff chat drawer at the bottom.
- **Fan Guide** (`public/fan.html`) — zone/destination/accessibility-need selector producing real walking directions, plus a fan-facing conversational assistant with quick-question chips.

### Tech stack
Node.js + Express backend, vanilla HTML/CSS/JS frontend (no framework overhead, keeps the repo small), Google Gemini API (`@google/generative-ai`), Google Maps Directions API (via native `fetch`, no extra SDK dependency), `helmet` for HTTP security headers, `express-rate-limit` for abuse protection, Node's built-in `node:test` runner for all automated tests (no test framework dependency). Retry-with-backoff logic for external API calls is centralized in a single shared utility (`src/lib/retryWithBackoff.js`) rather than duplicated per-route, keeping the codebase DRY.

### Running locally
```bash
git clone https://github.com/animesh-bhanarkar/Stadium-Pulse.git
cd Stadium-Pulse
npm install
cp .env.example .env   # then add your own GEMINI_API_KEY and MAPS_API_KEY
npm start
```
Visit `http://localhost:8081/index.html` (Command Center) or `http://localhost:8081/fan.html` (Fan Guide).

### Deployment
Structurally ready for Google Cloud Run:
```bash
gcloud run deploy stadiumpulse --source . --platform managed --allow-unauthenticated
```
Set `GEMINI_API_KEY` and `MAPS_API_KEY` as environment variables/secrets in the Cloud Run service configuration — never bake them into the image.

## Assumptions Made

- **Reference venue**: MetLife Stadium, East Rutherford, NJ (a confirmed FIFA World Cup 2026 host venue), used for realistic coordinates in the routing demo.
- **Crowd data is simulated, not live-sensor-fed**: `stadiumLocations.js` contains a static dataset with manually-set crowd levels per location, standing in for what would be a real-time feed (e.g. from turnstile counters or camera analytics) in a production deployment. This is a deliberate scope decision for a hackathon timeline — the decision engine itself is written to consume live data with no changes needed, only the data source would need to change.
- **Ticket zones are a fixed set of 4** (Zone A–D) mapped to fixed coordinates server-side, rather than a full seating-chart integration — sufficient to demonstrate the personalization dimension without building a full ticketing system.
- **No user accounts or persistent user data** — every request is stateless, which also minimizes the security/privacy surface area (see Security section).

## Security

- **No secrets in code**: `GEMINI_API_KEY` and `MAPS_API_KEY` are loaded exclusively from environment variables, never hardcoded; `.env` is git-ignored.
- **Server-side trust boundary for location data**: the fan routing endpoint accepts a `zoneId`, never raw coordinates from the client — the server resolves zone → coordinates itself, so a client can't send arbitrary/spoofed location data.
- **Rate limiting** on all AI/Maps endpoints (20 requests/60s per IP) via `express-rate-limit`, mitigating abuse and cost-runaway risk on paid external APIs.
- **Retry-with-backoff, not infinite retry**: transient failures (e.g. HTTP 503) are retried up to 3 times with increasing delay; non-retryable errors (e.g. bad request, access denied) fail fast instead of wasting quota.
- **No information leakage in errors**: every route catches external API failures and returns a generic client-facing message, while logging full diagnostic detail server-side only — raw error objects, stack traces, and API responses never reach the client.
- **Secure HTTP headers** via `helmet` middleware (X-Content-Type-Options, X-Frame-Options, and related headers).
- **Input validation on every endpoint**: type checks, length limits (e.g. 500-character cap on incident descriptions), and enum validation against a fixed allow-list — invalid input is rejected with a 400 before any external API call is made, saving cost and reducing attack surface.
- **CORS is deliberately left permissive** (`Access-Control-Allow-Origin: *`) for this hackathon submission, to ensure frictionless access for judges/evaluators from any origin without needing configuration. In a production deployment, this would be restricted to a specific trusted frontend origin.
- **No PII collected or stored** — the application is fully stateless with no user accounts, no database, and no persisted personal data.

## Accessibility

- **Color is never the sole signal**: every priority/urgency/crowd-level indicator pairs color with an icon and/or text label (e.g. "URGENT" text prefix, not just a red badge).
- **Full keyboard operability**: every interactive element (forms, buttons, chat, selectors, quick-question chips) is reachable and operable via keyboard alone. A dedicated audit found and fixed 3 elements where a CSS `outline: none` was silently defeating the site's focus-visible system for keyboard users — now all interactive elements show a clear 3px visible focus ring.
- **WCAG AA color contrast**: a real contrast-ratio audit (not just a code-comment claim) found and fixed 2 text/background combinations that fell below the 4.5:1 minimum for normal text; both now pass with comfortable headroom (verified via the actual WCAG relative-luminance formula, not estimation).
- **Screen reader support**: dynamic result areas use `aria-live` regions so updates are announced automatically; all form inputs have properly associated labels (including screen-reader-only labels where a visible label would clutter the UI); all icon-only buttons have `aria-label` attributes.
- **Reduced motion respected**: all animations (fade-in, pulse, slide-up) are wrapped in a `prefers-reduced-motion` media query and disabled for users who request it at the OS level.

## Testing

- **50 automated tests**, all using Node's built-in `node:test` runner — zero additional test-framework dependency, keeping the repo lightweight.
- **No live external API calls in the test suite**: Gemini and Google Maps calls are mocked, so tests run instantly, deterministically, and without incurring API cost or requiring network access.
- **Coverage includes**: pure decision-engine logic (input validation, score clamping, edge cases), full route-level tests for all three API endpoints (happy paths, 400 validation failures, 502 external-API failures, retry-count verification, JSON-parse-failure handling, response-shape/field-leakage checks), and fan-routing logic (accessibility fallback behavior, crowd-level tie-breaking).
- **Run it yourself**: `npm test`

## Google Services

Two distinct, genuinely integrated Google services — not deep-links:
- **Google Gemini API** (`gemini-2.5-flash`) — used in two structurally different ways: (1) constrained JSON-mode classification of free-text incident reports, and (2) open-ended multi-turn conversational assistance, both for staff and fans.
- **Google Maps Directions API** — a real, authenticated, billed API call (not a `maps.google.com` deep-link) that returns actual walking distance, duration, and turn-by-turn directions based on live routing data, server-side, with results parsed and returned as structured JSON to the frontend.

## Repository

- Public repo, single branch (`main`), well under the 10MB size limit.
- Clean commit history reflecting incremental, verified development.

---

*Built for GCP PromptWars Challenge 4 — Smart Stadiums & Tournament Operations.*