# PROJECT_STATE.md — StadiumPulse

## ⚠️ CRITICAL — FILE LOCATION
This file MUST live at: C:\Users\anime\OneDrive\Desktop\GCP\promptwars-4\Stadium-Pulse\PROJECT_STATE.md (the actual git repo root, NOT the parent folder). It should be committed to the repo so every Antigravity session reads it automatically. A previous session lost context because this file wasn't in the right place — don't let that happen again.

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
  - RESOLVED: rate-limit dashboard showed plenty of headroom — NOT a quota issue. Root cause was model name: gemini-2.0-flash retired/inactive. Active models on account: Gemini 3.5 Flash, Gemini 2.5 Flash, Gemini 3.1 Flash Lite. Also hit Antigravity's own separate coding-agent quota (unrelated to app's Gemini API quota) — resolved by switching Antigravity's dev-agent model to Claude Sonnet.
  - Model switched to gemini-3.5-flash → hit persistent 503 (model overloaded) → switched to gemini-2.5-flash → SUCCESS.
  - HAPPY PATH CONFIRMED (real responses verified): POST /api/incidents/report with "smoke smell near gate 4" correctly classified as fire_hazard/high/urgent/gate 4, triaged to priorityScore 100, "URGENT: Evacuate zone and deploy fire response", security_team. POST /api/chat returned a clear, practical reply.
  - LESSON LEARNED: always verify raw terminal output fresh (kill stray node processes, fresh terminal windows) — stale scrollback caused a false-alarm repeat of an already-fixed error.
  - Antigravity's coding-agent model going forward: Claude Sonnet (primary), Claude Opus (reserve for tricky bugs), GPT model (tertiary fallback) — Gemini options unavailable for ~1 week due to Antigravity agent quota.
  - DONE: stale comment fixed, 503 retry-with-backoff added (3 attempts, 1s/2s delays, only retries on 503, logs each attempt), verified working, committed (7e31d40) "Fix stale model comment, add 503 retry-with-backoff", pushed to main. STEP 3 FULLY COMPLETE.
- [pending] Fan-facing widget + real Maps API rerouting built + tested
- [pending] Security hardening pass (rate limiting, input validation, env vars, generic errors)
- [pending] Accessibility pass (ARIA, keyboard nav, contrast, plain language)
- [pending] Mocked automated tests for AI routes (Step 4a)
- [pending] README written (Security + Accessibility + Testing + Google Services sections named explicitly)
- [pending] Attempt 1 submitted
- [pending] Score analyzed, weak points patched
- [pending] Attempt 2 submitted
- [pending] Final polish / Attempt 3 (only if needed)

## Next step
Step 3 fully complete (both Gemini endpoints working, retry logic in place, 11/11 decisionEngine tests passing).

CURRENT IN-PROGRESS STEP: Full frontend UI build (Command Center dashboard at index.html + Fan Guide at fan.html, shared design system in styles.css) — approved with two additions: (1) accessibility built in from the start (icon/text alongside all color-coding, ARIA labels, keyboard focus states, prefers-reduced-motion, WCAG AA contrast), (2) explicit instruction that Step 4a (mocked AI-route tests) comes right after this frontend build, NOT skipped in favor of jumping to Maps integration.

ORDER GOING FORWARD: (1) finish frontend build + verify, (2) Step 4a mocked tests for incidents.js/chat.js, (3) fan-facing Maps API integration (Directions/Distance Matrix), (4) security hardening pass, (5) final accessibility audit, (6) README with named Security/Accessibility/Testing/Google Services sections, (7) Attempt 1 submission.

LESSON LEARNED: always re-read this file fresh from disk at the start of a session rather than trusting cached context or a summary — file sync issues have happened twice already.

## Recovery template (paste this in a new session if context is lost)
"Continuing StadiumPulse project (GCP PromptWars Challenge 4). Acting as before — architect/PM using vibe-coding workflow, I relay your prompts to Antigravity. Here is the current PROJECT_STATE.md: [paste full file]. Next step: [paste from Next step section above]."