from pydantic import BaseModel
from typing import List


class RagTestRequest(BaseModel):
  lang: str
  query: str
  top_k: int = 5


class RagTestResult(BaseModel):
  title: str
  url_or_path: str
  snippet: str
  score: float
  page: int | None = None
  page_label: str | None = None
  page_start: int | None = None
  page_end: int | None = None


class RagTestResponse(BaseModel):
  results: List[RagTestResult]
  confidence: float
