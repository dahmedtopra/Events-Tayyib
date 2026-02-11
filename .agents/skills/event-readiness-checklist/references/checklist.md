# Event Readiness Checklist

## Must pass before event

- Environment:
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL`
  - `OPENAI_EMBED_MODEL`
  - `ALLOWED_ORIGINS`
- Data:
  - `data/offline_pack/offline_pack.json`
  - `data/chroma_index/chroma.sqlite3`
- Runtime:
  - Backend health endpoint responds.
  - Backend version endpoint responds.
  - Frontend URL is reachable (if running).

## Recommended

- Confirm API base points to expected backend.
- Run one chat/ask smoke query in each language.
- Check fallback rate is acceptable during dry run.

