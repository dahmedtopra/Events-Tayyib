from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import logging
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

from app.routers.ask import router as ask_router
from app.routers.guide import router as guide_router
from app.routers.feedback import router as feedback_router
from app.routers.health import router as health_router
from app.routers.rag_test import router as rag_test_router
from app.routers.diag import router as diag_router
from app.routers.chat import router as chat_router
from app.db.sqlite import init_db, get_sqlite_path


def create_app() -> FastAPI:
  repo_root = Path(__file__).resolve().parents[3]
  backend_env = Path(__file__).resolve().parents[1] / ".env"
  env_loaded = [str(repo_root / ".env"), str(backend_env)]
  if (repo_root / ".env").exists():
    load_dotenv(repo_root / ".env", override=False)
  if backend_env.exists():
    load_dotenv(backend_env, override=True)
  app = FastAPI()
  logging.basicConfig(level=logging.INFO)
  app.state.env_loaded_paths = env_loaded
  app.state.repo_root = repo_root
  app.state.build_timestamp = os.getenv("BUILD_TIMESTAMP") or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

  allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5176")
  dev_mode = os.getenv("KIOSK_DEV_MODE", "").lower() in ("1", "true", "yes")
  event_mode = os.getenv("EVENT_MODE", "false").lower() in ("1", "true", "yes")
  app.state.dev_mode = dev_mode and not event_mode
  app.state.event_mode = event_mode
  origins = [o.strip() for o in allowed_origins.split(",") if o.strip()]

  app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
  )

  @app.on_event("startup")
  def on_startup() -> None:
    logging.info("SQLite path: %s", get_sqlite_path())
    init_db()

  app.include_router(ask_router, prefix="/api")
  app.include_router(guide_router, prefix="/api")
  app.include_router(feedback_router, prefix="/api")
  app.include_router(health_router, prefix="/api")
  app.include_router(rag_test_router, prefix="/api")
  app.include_router(diag_router, prefix="/api")
  app.include_router(chat_router, prefix="/api")

  return app


app = create_app()


@app.get("/api/version")
def version():
  commit = "unknown"
  try:
    commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=str(Path(__file__).resolve().parents[2])).decode().strip()
  except Exception:
    pass
  return {
    "commit": commit,
    "build_timestamp": app.state.build_timestamp,
    "event_mode": app.state.event_mode
  }
