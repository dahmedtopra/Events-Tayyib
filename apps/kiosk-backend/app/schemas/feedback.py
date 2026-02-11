from pydantic import BaseModel

class FeedbackRequest(BaseModel):
  session_id: str
  rating_1_5: int
  time_on_screen_ms: int
  last_route_used: str | None = None
  last_confidence: float | None = None

class FeedbackResponse(BaseModel):
  ok: bool
