# Contributing

## Branch strategy

- `main`: production-ready branch
- `develop`: active integration branch
- `feature/<short-name>`: branch from `develop` for each task

Default flow:

1. Branch from `develop`.
2. Open PR into `develop`.
3. Team validates in development environment.
4. Open PR from `develop` into `main` for release.

## Local setup

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

## Pull request expectations

- Keep PR scope focused and reviewable.
- Include validation notes in the PR body.
- Avoid mixing unrelated refactors with urgent fixes.
- Do not commit generated runtime artifacts (`data/chroma_index`, local sqlite, etc.).

## Commit guidance

Use clear commit messages:

- `feat: add source-confidence chip ranking`
- `fix: prevent map chips in suggestion surfaces`
- `docs: update setup instructions`

## Security

- Never commit `.env` values or API keys.
- Keep `OPENAI_API_KEY` local only.
