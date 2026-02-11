from app.schemas.feedback import FeedbackRequest, FeedbackResponse
from app.db.sqlite import insert_analytics


def record_feedback(payload: FeedbackRequest) -> FeedbackResponse:
  insert_analytics(
    session_id=payload.session_id,
    mode="feedback",
    lang=None,
    rating_1_5=payload.rating_1_5,
    time_on_screen_ms=payload.time_on_screen_ms,
    route_used=payload.last_route_used,
    confidence=payload.last_confidence,
    sources_count=None,
    error_code=None,
    latency_ms=None,
    hashed_query=None
  )
  return FeedbackResponse(ok=True)
