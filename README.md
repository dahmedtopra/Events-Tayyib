# Event AI Guide Kiosk

Event-focused kiosk assistant built as a monorepo.

- Frontend: React + Vite + TypeScript + TailwindCSS
- Backend: FastAPI + Python 3.11
- Retrieval: local Chroma + offline pack

## Repository structure

- `apps/kiosk-frontend`
- `apps/kiosk-backend`
- `packages/shared-schema`
- `docs`
- `data`
- `assets`

## Prerequisites

- Node.js 20+
- Python 3.11
- npm

## Local development

### Frontend

```powershell
cd apps/kiosk-frontend
npm install
npm run dev -- --port 5176
```

### Backend

```powershell
cd apps/kiosk-backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.app:app --reload --port 8006
```

### Environment

Create root `.env` from `.env.example` and set:

- `OPENAI_API_KEY`
- `OPENAI_MODEL=gpt-4o`
- `OPENAI_EMBED_MODEL=text-embedding-3-large`
- `ALLOWED_ORIGINS=http://localhost:5176`

## Ingestion

```powershell
python scripts/ingest_sources.py
```

Reset and re-ingest:

```powershell
python scripts/ingest_sources.py --reset
```

Safe smoke test:

```powershell
python scripts/ingest_sources.py --reset --max-sources 1 --max-pages 5
```

## API checks

Ask:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8006/api/ask" -Method Post -ContentType "application/json" `
  -Body '{"lang":"EN","query":"What sessions are today?","session_id":"sess-123"}'
```

RAG test:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8006/api/rag_test" -Method Post -ContentType "application/json" `
  -Body '{"lang":"EN","query":"event schedule","top_k":5}'
```

## Branch model

- `main`: production-ready
- `develop`: integration branch for active work
- `feature/*`: short-lived branches off `develop`
- Release path: PR from `develop` to `main`

Workflow guide: `docs/GITHUB_WORKFLOW.md`

## CI

GitHub Actions validates:

- Frontend install + build
- Backend dependencies + Python compile check

Workflow file: `.github/workflows/ci.yml`

## Contributing

See `CONTRIBUTING.md`.

## License

MIT (see `LICENSE`).
