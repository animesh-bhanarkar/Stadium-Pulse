# PROJECT_STATE.md — StadiumPulse

## What this is
An AI-powered command center for FIFA World Cup 2026 stadium operations. Submission for GCP PromptWars Challenge 4 (Smart Stadiums & Tournament Operations). Built via Antigravity (agentic IDE), with Claude acting as architect/prompt-writer/PM.

## Key decisions locked in
- **Name:** StadiumPulse
- **Positioning:** A live, signal-driven AI system that turns real-time stadium crowd/incident data into prioritized action plans for staff — and instant, multilingual, accessibility-aware guidance for fans — from the same underlying intelligence.
- **Two personas:** (1) Staff/volunteer — dashboard/feed view, triage + action plans. (2) Fan — lightweight status widget, zone-based live guidance.
- **Decision engine dimensions:**
  - Staff: incident type × zone crowd level × urgency → recommended action + resource dispatch
  - Fan: ticket zone × mobility need × language → reroute + directions
- **AI usage (2 distinct Gemini endpoints):** (a) conversational triage/chat assistant for staff, (b) structured JSON action-plan generator
- **Real Google API depth:** Google Maps Directions API / Distance Matrix API for actual fan rerouting (not deep-link only — this fixes the capped Google Services score from Challenge 2)
- **Repo constraints:** public GitHub repo, <10MB, single branch, max 3 submission attempts
- **Deployment target:** Google Cloud Run (same pattern as Challenge 2, known to work)
- **Tooling:** Antigravity 2.0, default model Gemini 3.1 Pro for architecture/build, switch to Gemini 3 Flash for trivial fixes
- **Repo name:** TBD — pick on first setup prompt
- **Scoring history to beat:** Challenge 1: 57.15 (Testing 0, Security 35, Access 30, Google Svcs 0). Challenge 2: 82.74 (Testing 0, Google Svcs capped at 50). Goal for Challenge 4: fix Testing (build in from day 1) and Google Services depth (real API call, not deep-link).

## Status log
- [done] Vertical/idea locked: StadiumPulse (signal-driven ops + fan dual view)
- [done] GitHub repo created: https://github.com/animesh-bhanarkar/Stadium-Pulse.git (public, single branch confirmed)
- [done] Gemini API key obtained (reused from existing key, will load via .env)
- [done] Google Maps API key obtained (Directions + Distance Matrix enabled, restricted to those APIs)
- [done] Antigravity project folder opened
- [done] Project scaffold generated and pushed (commit: "Initial project scaffold")
  - NOTE: repo cloned into a nested subfolder — actual project root is `stadiumpulse/Stadium-Pulse/`, not the top-level folder. All future prompts must cd into Stadium-Pulse first.
  - Local project path: C:\Users\anime\OneDrive\Desktop\GCP\promptwars-4\Stadium-Pulse
  - Stack confirmed working: Express server, /health route, index.html (dashboard) + fan.html (fan widget) both verified in browser on port 8080
- [done] Core decision engine (staff triage logic) built + tested — src/lib/decisionEngine.js, 11/11 tests passing via node:test, committed "Add decision engine with unit tests"
- [done] Gemini chat endpoint built — src/routes/chat.js, POST /api/chat, rate-limited (20/60s/IP), generic error messages, committed "Add Gemini classification and chat endpoints"
- [done] Gemini structured plan endpoint built — src/routes/incidents.js, POST /api/incidents/report, classifies free text into decisionEngine input, rate-limited
  - Model used: gemini-2.0-flash (worked on first try, no fallback needed)
  - VERIFIED SO FAR: only the failure path (502 error handling) tested, using a dummy API key
  - NOT YET VERIFIED: happy path with a real API key — must confirm Gemini's JSON response actually parses correctly and matches the expected shape before writing mocked tests in Step 4
  - BLOCKER HIT: real key returned 429 on both endpoints (quota/rate limit). Root cause suspected: this Gemini key is shared across 3 active projects (Testing, quota pooled per Google Cloud project, not per key).
  - DECISION: create a new, dedicated Google Cloud project ("stadiumpulse-hackathon") + a fresh Gemini API key under it, isolated from the other 2 projects' quota — critical to avoid 429s during demo/judging.
  - AWAITING FROM USER: (1) what aistudio.google.com/rate-limit dashboard shows for current key, (2) raw server console.error output from the 429 (to confirm it's genuinely quota, not a masked bug), (3) confirmation the new dedicated key is set up and swapped into .env
- [pending] Fan-facing widget + real Maps API rerouting built + tested
- [pending] Gemini chat endpoint built + tested
- [pending] Gemini structured plan endpoint built + tested
- [pending] Fan-facing widget + real Maps API rerouting built + tested
- [pending] Security hardening pass (rate limiting, input validation, env vars, generic errors)
- [pending] Accessibility pass (ARIA, keyboard nav, contrast, plain language)
- [pending] Test suite written (npm test working)
- [pending] README written (Security + Accessibility + Testing + Google Services sections named explicitly)
- [pending] Attempt 1 submitted
- [pending] Score analyzed, weak points patched
- [pending] Attempt 2 submitted
- [pending] Final polish / Attempt 3 (only if needed)

## Next step
Endpoints are built and failure-path tested (502 handling confirmed with dummy key). BLOCKING before Step 4: user needs to add the real Gemini API key to .env locally and re-run both manual tests, to confirm the happy path — real JSON classification response parses correctly and feeds decisionEngine.triageIncident() as expected. Once that's confirmed (or any parsing issue is patched), proceed to Step 4: mocked automated tests for the two AI routes + fan-facing widget with real Maps API integration.

## Recovery template (paste this in a new session if context is lost)
"Continuing StadiumPulse project (GCP PromptWars Challenge 4). Acting as before — architect/PM using vibe-coding workflow, I relay your prompts to Antigravity. Here is the current PROJECT_STATE.md: [paste full file]. Next step: [paste from Next step section above]."