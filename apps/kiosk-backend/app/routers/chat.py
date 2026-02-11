from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.schemas.chat import ChatRequest
from app.services.chat_service import stream_chat_response

router = APIRouter()


@router.post("/chat")
async def chat(payload: ChatRequest):
  return StreamingResponse(
    stream_chat_response(payload),
    media_type="text/event-stream",
    headers={
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  )
