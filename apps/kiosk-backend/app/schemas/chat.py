from pydantic import BaseModel, Field
from typing import List, Literal, Optional


class ChatMessage(BaseModel):
  role: Literal["user", "assistant"]
  content: str


class ChatRequest(BaseModel):
  lang: str = Field(..., description="EN/AR/FR")
  messages: List[ChatMessage]
  session_id: str


class ChatSourceItem(BaseModel):
  title: str
  url: str
  snippet: str
  relevance: str
  page: int | None = None
  page_label: str | None = None
  page_start: int | None = None
  page_end: int | None = None


class ChatResponseMeta(BaseModel):
  sources: List[ChatSourceItem]
  confidence: float
  refinement_chips: List[str]
  route_used: Literal["offline", "rag", "fallback"]
  latency_ms: int
  clarifying_question: Optional[str] = None
  general_mode: Optional[bool] = None
  error_code: Optional[str] = None
