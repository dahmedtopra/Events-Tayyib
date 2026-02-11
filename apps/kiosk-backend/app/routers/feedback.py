from fastapi import APIRouter
from app.schemas.feedback import FeedbackRequest, FeedbackResponse
from app.services.feedback_service import record_feedback

router = APIRouter()

@router.post("/feedback", response_model=FeedbackResponse)
def feedback(payload: FeedbackRequest) -> FeedbackResponse:
  return record_feedback(payload)
