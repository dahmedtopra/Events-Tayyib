from fastapi import APIRouter
from app.schemas.guide import GuideRequest, GuideResponse
from app.services.guide_service import build_checklist

router = APIRouter()

@router.post("/guide", response_model=GuideResponse)
def guide(payload: GuideRequest) -> GuideResponse:
  return build_checklist(payload)
