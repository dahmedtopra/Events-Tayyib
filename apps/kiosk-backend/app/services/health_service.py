from datetime import datetime
from app.schemas.health import HealthResponse
from app.db.sqlite import get_sqlite_path


def health_status() -> HealthResponse:
  return HealthResponse(
    ok=True,
    backend_time_utc=datetime.utcnow().isoformat() + "Z",
    notes=["stubbed", "db-init-on-startup", f"sqlite_path={get_sqlite_path()}"]
  )
