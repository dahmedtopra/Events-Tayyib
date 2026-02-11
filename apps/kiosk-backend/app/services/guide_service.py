import os
import time
from app.schemas.guide import GuideRequest, GuideResponse, ChecklistSection
from app.db.sqlite import insert_analytics


def build_checklist(payload: GuideRequest) -> GuideResponse:
  start = time.time()
  base = os.getenv("PUBLIC_QR_BASE_URL", "http://localhost:5176")
  qr_url = f"{base}/share#d=placeholder"

  response = GuideResponse(
    checklist_sections=[
      ChecklistSection(title="Preparation", items=["Item A", "Item B"]),
      ChecklistSection(title="Event steps", items=["Item C", "Item D"])
    ],
    qr_url=qr_url
  )

  latency_ms = int((time.time() - start) * 1000)
  insert_analytics(
    session_id="unknown",
    mode="guide",
    lang=payload.lang,
    rating_1_5=None,
    time_on_screen_ms=None,
    route_used=None,
    confidence=None,
    sources_count=None,
    error_code=None,
    latency_ms=latency_ms,
    hashed_query=None
  )

  return response
