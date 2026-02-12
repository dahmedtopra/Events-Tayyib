# Claude Instructions (Backend)

## Scope
- Only modify files under `apps/kiosk-backend`, plus `scripts/` and `data/` schema notes when required.
- If asked to change files outside this scope, refuse and ask for explicit permission.
- Always prefer the smallest change that fixes the issue.

## Reliability Rules
- `/api/ask` must NEVER return 5xx. Always return valid `AskResponse` JSON with `route_used` in {offline, rag, fallback}.
- Never include raw user query text in logs; only safe diagnostics (e.g., `debug_notes`).
- OpenAI failures must degrade gracefully to fallback clarifier.
- Hybrid answering allowed: if sources are weak, return clarifier with options; after a clarified follow-up, LLM may answer with a "general guidance" disclaimer.

## Ingestion Rules
- Ingestion may download sources; runtime must not.
- Chroma metadata must not contain `None` values (omit or coerce safely).
- Store page numbers for PDFs; support txt sources.

## Dependencies
- `requirements.txt` must include ingestion deps:
  - `chromadb`, `pypdf`, `pyyaml`, `requests`, `tiktoken`
- Keep versions flexible unless breakage occurs.

## Run Commands
- `uvicorn app.app:app --reload --port 8005`
- Ingest (from repo root):
  - `python scripts/ingest_sources.py --reset`
  - Or using backend venv: `apps/kiosk-backend/.venv/Scripts/python.exe scripts/ingest_sources.py --reset`

## Environment Files
- `.env` is allowed locally in `apps/kiosk-backend` (do not commit secrets).
- Required vars: `OPENAI_API_KEY`, `OPENAI_EMBED_MODEL`, `CHROMA_PATH`, `SQLITE_PATH` (optional).

## Do / Don’t
**Do**
- Keep changes minimal and scoped.
- Preserve schema contracts and grounding guarantees.
- Add safe guards instead of throwing exceptions.

**Don’t**
- Log or print secrets.
- Store raw query text.
- Add runtime downloads or browsing.
