---
name: kiosk-ui-qa
description: Kiosk frontend QA checks for layout safety and interaction reliability. Use when validating no-page-scroll behavior, touch target sizing, overflow regressions, RTL safety hints, and accidental click-blocking layers before release.
---

# Kiosk UI QA

Run this skill before merges that touch `apps/kiosk-frontend`.

## Workflow

1. Run `python .agents/skills/kiosk-ui-qa/scripts/run_checks.py`.
2. Fix `ERROR` items first.
3. Treat `WARN` items as review-required items.
4. Re-run until no `ERROR` remains.

## Checks covered

- Global overflow constraints (`html/body/#root`, body overflow).
- Decorative pointer-events guardrails.
- Potential touch targets below `44px`.
- Suspicious full-screen overlays (`absolute/fixed inset-0`) without safety classes.
- Main panel scroll risks in search/chat surfaces.

## References

- Use `references/rules.md` for thresholds and policy details.

