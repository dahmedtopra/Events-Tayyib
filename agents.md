# AGENTS

This repository is the "Event AI Guide Kiosk".

## Hard Constraints
- Reliability > completeness (public kiosk).
- Text-only responses.
- No agentic runtime (no tool-calling loops; no web browsing tools in production).
- No raw question text stored (hashed only + analytics).
- No Docker dependency for kiosk runtime.
- No scrolling in main Ask/Guide panels (sources drawer/panel may scroll).
- Arabic UI is RTL; Arabic output is Fusha.
- Hybrid answering: if sources are weak, return a clarifier; after a clarified choice, LLM may answer with a clear "general guidance" disclaimer.

## Locked Stack
- Frontend: React + Vite + TypeScript + TailwindCSS.
- Backend: Python 3.11 + FastAPI + Uvicorn.
- Vector store: local Chroma (on-disk).
- Analytics: local SQLite.
- OpenAI: Responses API (gpt-4o) + Embeddings (text-embedding-3-large).

## Repo Layout (monorepo)
- apps/kiosk-frontend
- apps/kiosk-backend
- packages/shared-schema
- docs
- data (offline_pack, rag_corpus, chroma_index)
- assets (tayyib_loops, branding)

## Commands (local dev)
- Frontend: npm install; npm run dev; npm run build; npm run preview
- Backend: python -m venv .venv; .\.venv\Scripts\activate; pip install -r requirements.txt; uvicorn app.app:app --reload

## Notes
- Language locks on Home and stays locked for session.
- Orientation auto-detects (vertical if height>=width, else horizontal) with future admin override hook.
- Admin panel opens via long-press ICHS logo for 5 seconds.
