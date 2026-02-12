# AGENTS

## Scope
Kiosk backend (Python 3.11 + FastAPI + Uvicorn).

## Data Rules (non-negotiable)
- Never store raw question text; store only hashed_query (SHA-256 + salt).
- Local SQLite for analytics/events only.
- Local Chroma on-disk for RAG.
- No agentic runtime or web browsing tools.
- Hybrid answering allowed: if sources are weak, return clarifier with options; on clarified follow-up, LLM may answer with a "general guidance" disclaimer.

## OpenAI Usage
- Responses API with gpt-4o.
- Embeddings with text-embedding-3-large.

## API Surface (locked)
- POST /api/ask
- POST /api/guide
- POST /api/feedback
- GET /api/health

## Commands
- python -m venv .venv
- .\.venv\Scripts\activate
- pip install -r requirements.txt
- uvicorn app.app:app --reload
