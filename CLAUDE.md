# Claude Instructions (Repo Root)

## Scope & Boundaries
- Apply these rules to the whole repository.
- If a request affects app behavior outside the stated scope, refuse and ask for explicit permission.
- Always prefer the smallest change that fixes the issue.

## Repo Layout
- `apps/kiosk-frontend` — Vite + React + Tailwind
- `apps/kiosk-backend` — FastAPI
- `data/` — SQLite, Chroma index, RAG corpus
- `scripts/ingest_sources.py` — RAG ingestion

## Domain
- This kiosk provides **event guidance**: schedules, sessions, speakers, venue info, registration.
- It does NOT cover legal, medical, hotel booking, or payment issues.

## Non-Negotiables
- Do not change backend response schemas unless explicitly asked.
- Hybrid answering: if sources are weak, return a clarifier with options; after a clarified choice, LLM may answer with a clear "general guidance" disclaimer.
- No runtime downloads; ingestion may download.
- Avoid heavy dependencies unless essential.

## Safety Defaults
- Keep kiosk touch UX stable: no hover-only interactions.
- Avoid CPU/GPU-heavy animations by default.

## Run Commands
- Frontend: `cd apps/kiosk-frontend` ; `npm run dev -- --port 5176`
- Backend: `cd apps/kiosk-backend` ; `uvicorn app.app:app --reload --port 8006`
- Ingest (from repo root):
  - `python scripts/ingest_sources.py --reset`
  - Or using backend venv: `apps/kiosk-backend/.venv/Scripts/python.exe scripts/ingest_sources.py --reset`

## Environment Files
- `.env` at repo root: optional local values; never commit secrets.
- `.env.example`: public template only.
- `.env.local`: allowed locally; must not be committed.

## When to Ask Before Acting
- Styling overhauls or visual redesigns.
- Any endpoint or schema changes.
- Major refactors or file moves.

## Do / Don't
**Do**
- Keep changes minimal and scoped.
- Preserve kiosk constraints (no full-page scroll).
- Keep avatar-first UX intact.

**Don't**
- Log or print secrets.
- Store raw user query text.
- Add runtime downloads or web browsing.
