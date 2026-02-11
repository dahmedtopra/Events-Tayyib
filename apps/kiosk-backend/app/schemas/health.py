from pydantic import BaseModel
from typing import List

class HealthResponse(BaseModel):
  ok: bool
  backend_time_utc: str
  notes: List[str]
