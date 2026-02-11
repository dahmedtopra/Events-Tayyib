from pydantic import BaseModel, Field
from typing import List, Literal, Optional

class AskRequest(BaseModel):
  lang: str = Field(..., description="EN/AR/FR")
  query: str
  session_id: str
  clarified: bool | None = False
  clarifier_choice: str | None = None

class AnswerBlock(BaseModel):
  direct: str
  steps: List[str]
  mistakes: List[str]

class SourceItem(BaseModel):
  title: str
  url: str
  snippet: str
  relevance: str
  page: int | None = None
  page_label: str | None = None
  page_start: int | None = None
  page_end: int | None = None

class AskResponse(BaseModel):
  answer: AnswerBlock
  sources: List[SourceItem]
  confidence: float
  refinement_chips: List[str]
  route_used: Literal["offline", "rag", "fallback"]
  latency_ms: int
  clarifying_question: Optional[str] = None
  error_code: Optional[str] = None
  error_message: Optional[str] = None
  debug_notes: Optional[str] = None
  general_mode: Optional[bool] = None
