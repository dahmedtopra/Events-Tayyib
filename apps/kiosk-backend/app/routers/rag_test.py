from fastapi import APIRouter
from app.schemas.rag_test import RagTestRequest, RagTestResponse, RagTestResult
from app.services.rag_service import retrieve

router = APIRouter()


@router.post("/rag_test", response_model=RagTestResponse)
def rag_test(payload: RagTestRequest) -> RagTestResponse:
  sources, confidence = retrieve(payload.query, payload.lang, top_k=payload.top_k)
  results = [
    RagTestResult(
      title=s.get("title", ""),
      url_or_path=s.get("url_or_path", ""),
      snippet=s.get("snippet", ""),
      score=s.get("score", 0.0),
      page=s.get("page"),
      page_label=s.get("page_label"),
      page_start=s.get("page_start"),
      page_end=s.get("page_end")
    )
    for s in sources
  ]
  return RagTestResponse(results=results, confidence=confidence)
