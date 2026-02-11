# Claude Instructions (Frontend)

## Scope
- Only modify files under `apps/kiosk-frontend`.
- If asked to change files outside this scope, refuse and ask for explicit permission.
- Always prefer the smallest change that fixes the issue.

## UI Goals
- Saudi emerald + gold premium theme.
- Avatar-first layout (transparent video overlay; no boxed “Tayyib panel” framing).
- Kiosk flow: ATTRACT → LANGUAGE_PICK (locks) → INTRO_WAVE (video) → SEARCH → ANSWER/CLARIFY → PHOTO_MODE → RESET.
- Touch-first: large tap targets, no tiny links, no hover reliance.
- No full-page scroll; only sources rail scrolls. Use internal scroll areas if needed.

## ReactBits Integration
- Prefer touch-safe, low CPU/GPU components.
- Avoid heavy WebGL backgrounds by default.
- Use shadcn registry via `components.json` registries `@react-bits`.
- All decorative layers must be `pointer-events: none`.

## Diagnostics
- `?debug=1` overlay is allowed in dev only.

## Run Commands
- `npm install` (if needed)
- `npm run dev -- --port 5176`
- `npm run build`

## Environment Files
- `.env.example` includes `VITE_API_BASE_URL`.
- `.env.local` allowed for local overrides; must not be committed.

## Do / Don’t
**Do**
- Keep interactions touch-safe and obvious.
- Preserve kiosk constraints and clarity.
- Keep changes minimal and scoped.

**Don’t**
- Add hover-only interactions.
- Add full-page scrolling.
- Introduce heavy GPU/CPU effects without approval.
