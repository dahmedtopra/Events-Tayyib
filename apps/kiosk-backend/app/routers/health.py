from fastapi import APIRouter
from app.schemas.health import HealthResponse
from app.services.health_service import health_status

router = APIRouter()

@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
  return health_status()
