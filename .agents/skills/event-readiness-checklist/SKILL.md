---
name: event-readiness-checklist
description: Pre-event operational checks for the kiosk stack. Use when preparing demos or live event deployment to verify env, data assets, backend/frontend health, and critical runtime readiness before go-live.
---

# Event Readiness Checklist

Run this skill before any event/demo session.

## Workflow

1. Run `python .agents/skills/event-readiness-checklist/scripts/run_checklist.py`.
2. If local services are up, run with HTTP checks:
   `python .agents/skills/event-readiness-checklist/scripts/run_checklist.py --check-http`.
3. Resolve all `FAIL` items.
4. Capture the output in your deployment notes.

## Validation areas

- Required env variables available from `.env` files.
- Core data assets present (offline pack and Chroma index).
- Frontend/backend ports and health endpoints (optional HTTP mode).
- Version endpoint availability.

## References

- See `references/checklist.md` for checklist intent and thresholds.

