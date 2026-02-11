from fastapi import APIRouter
from app.schemas.ask import AskRequest, AskResponse
from app.services.ask_service import answer_query, safe_response

router = APIRouter()

@router.post("/ask", response_model=AskResponse)
def ask(payload: AskRequest) -> AskResponse:
  try:
    return answer_query(payload)
  except Exception:
    return safe_response()
