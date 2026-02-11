import os
from fastapi import APIRouter, Request, HTTPException
from app.db.sqlite import get_sqlite_path
from app.services.rag_service import get_chroma_path
from app.services.ask_service import get_last_openai_error

router = APIRouter()


@router.get("/diag")
def diag(request: Request):
  dev_mode = getattr(request.app.state, "dev_mode", False)
  if not dev_mode:
    raise HTTPException(status_code=404, detail="Not found")

  env_paths = getattr(request.app.state, "env_loaded_paths", [])
  return {
    "openai_key_present": bool(os.getenv("OPENAI_API_KEY")),
    "openai_model": os.getenv("OPENAI_MODEL", ""),
    "embed_model": os.getenv("OPENAI_EMBED_MODEL", ""),
    "chroma_path": get_chroma_path(),
    "sqlite_path": get_sqlite_path(),
    "env_loaded_paths": env_paths,
    "last_openai_error": get_last_openai_error()
  }
