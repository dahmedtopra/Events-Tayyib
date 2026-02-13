import json
import logging
import os
import time
from typing import Any, Dict, List

from datetime import datetime, timezone, timedelta

import requests

_MAKKAH_TZ = timezone(timedelta(hours=3))


def _now_makkah() -> str:
  """Current date/time in Makkah (UTC+3), e.g. 'Saturday 15 February 2026, 14:30'."""
  now = datetime.now(_MAKKAH_TZ)
  return now.strftime("%A %d %B %Y, %H:%M")

from app.db.sqlite import insert_analytics
from app.schemas.ask import AnswerBlock, AskRequest, AskResponse, SourceItem
from app.services.hash_service import hash_query
from app.services.offline_pack_service import (
  CHIP_CONF_THRESHOLD,
  get_confident_suggestions,
  match_offline,
)
from app.services.rag_service import retrieve

OFFLINE_THRESHOLD = 0.25
RAG_THRESHOLD = 0.35
MIN_SOURCES = 1
MIN_SOURCE_SCORE = 0.2
CHIP_CONFIDENCE_THRESHOLD = CHIP_CONF_THRESHOLD

_last_openai_error = {"code": "", "message": ""}


def _event_mode() -> bool:
  return os.getenv("EVENT_MODE", "false").lower() in ("1", "true", "yes")


def _log_info(message: str, *args: Any) -> None:
  if not _event_mode():
    logging.info(message, *args)


def _set_openai_error(code: str, message: str) -> None:
  global _last_openai_error
  _last_openai_error = {"code": code[:50], "message": message[:200]}


def get_last_openai_error() -> Dict[str, str]:
  return _last_openai_error


def safe_response(lang: str = "EN") -> AskResponse:
  if lang == "AR":
    msg = "لم أتمكن من إتمام هذا الطلب. يرجى المحاولة مرة أخرى أو إعادة الصياغة."
  elif lang == "FR":
    msg = "Je n'ai pas pu traiter cette demande. Veuillez réessayer ou reformuler."
  else:
    msg = "I couldn't complete that request. Please try again or rephrase."
  return AskResponse(
    answer=AnswerBlock(direct="", steps=[], mistakes=[]),
    sources=[],
    confidence=0.0,
    refinement_chips=[],
    route_used="fallback",
    latency_ms=0,
    clarifying_question=msg,
    error_code="ask_error",
    error_message="The request could not be completed.",
    debug_notes="fallback: exception",
  )


def clarifier(query: str, lang: str) -> str:
  q = (query or "").lower()
  if lang == "AR":
    if "جلسة" in query or "session" in q:
      return "هل تقصد جلسة معينة، أم جدول الجلسات، أم تفاصيل التسجيل؟"
    if "متحدث" in query or "speaker" in q:
      return "هل تقصد سيرة المتحدث، أم وقت الجلسة، أم موضوع الجلسة؟"
    return "هل تقصد جدول الفعالية، أم تفاصيل الجلسات، أم معلومات المتحدثين، أم التسجيل؟"
  if lang == "FR":
    if "session" in q:
      return "Parlez-vous d'une session spécifique, du programme des sessions, ou des détails d'inscription ?"
    if "speaker" in q or "intervenant" in q:
      return "Parlez-vous du profil de l'intervenant, de son horaire, ou du sujet de sa session ?"
    return "Parlez-vous du programme, des détails de session, des intervenants, ou de l'inscription ?"
  if "session" in q:
    return "Do you mean a specific session, the session schedule, or registration details?"
  if "speaker" in q:
    return "Do you mean speaker profile, session timing, or talk topic?"
  return "Do you mean the event schedule, session details, speaker information, or registration?"


def clarifier_options(query: str, lang: str) -> List[str]:
  q = (query or "").lower()
  if lang == "AR":
    if "جلسة" in query or "session" in q:
      return ["جدول الجلسات", "تفاصيل الجلسة", "وقت الجلسة"]
    if "متحدث" in query or "speaker" in q:
      return ["السيرة المهنية", "وقت الجلسة", "موضوع الجلسة"]
    return ["جدول الفعالية", "معلومات الجلسات", "مساعدة التسجيل"]
  if lang == "FR":
    if "session" in q:
      return ["Programme des sessions", "Détails de la session", "Horaire de la session"]
    if "speaker" in q or "intervenant" in q:
      return ["Profil de l'intervenant", "Horaire de session", "Sujet de session"]
    return ["Programme de l'événement", "Infos sessions", "Aide à l'inscription"]
  if "session" in q:
    return ["Session schedule", "Session details", "Session timing"]
  if "speaker" in q:
    return ["Speaker profile", "Session timing", "Talk topic"]
  return ["Event schedule", "Session information", "Registration help"]


def is_out_of_scope(query: str) -> bool:
  q = (query or "").lower()
  keywords = [
    "medical",
    "vaccine",
    "health",
    "legal",
    "law",
    "lawsuit",
    "court",
    "employment",
    "refund",
    "payment",
    "credit card",
    "hotel booking",
    "flight",
  ]
  return any(k in q for k in keywords)


def out_of_scope_message(lang: str) -> str:
  if lang == "AR":
    return "هذا الكشك مخصص لجداول الفعاليات والجلسات وإرشادات الحضور الرسمية فقط."
  if lang == "FR":
    return "Ce kiosque couvre uniquement les programmes, les sessions et les informations officielles pour les participants."
  return "This kiosk covers event schedules, sessions, and official attendee guidance only."


def insufficient_grounding_message(lang: str) -> str:
  if lang == "AR":
    return "لم أجد إجابة موثقة في مستندات الفعالية الرسمية. اختر سؤالا أدق أو راجع مكتب المعلومات."
  if lang == "FR":
    return "Je n'ai pas trouvé de réponse vérifiée dans les documents officiels de l'événement. Reformulez votre question ou consultez le bureau d'information."
  return "I couldn't verify this in the official event documents. Please ask a more specific question or check with the information desk."


def suggestion_chips(query: str, lang: str, retrieved_sources: List[Dict[str, Any]] | None = None) -> List[str]:
  if not retrieved_sources:
    return []
  chips = get_confident_suggestions(
    query,
    lang,
    retrieved_sources,
    limit=3,
    min_confidence=CHIP_CONFIDENCE_THRESHOLD,
  )
  return chips


def build_prompt(query: str, lang: str, sources: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
  lang_name = {"EN": "English", "AR": "Arabic", "FR": "French"}.get(lang, "English")
  snippets = "\n\n".join(
    f"Title: {s.get('title', '')}\nURL: {s.get('url_or_path', '')}\nSnippet: {s.get('snippet', '')}"
    for s in sources
  )
  system_text = (
    f"You are an event kiosk assistant. Current date/time in Makkah: {_now_makkah()}.\n"
    f"Respond in {lang_name}.\n"
    "Use only the provided snippets. "
    "Stay factual and helpful. "
    "Do not include inline source tags like [Source 1] in the answer text. "
    "Return concise blocks suitable for a kiosk."
  )
  user_text = (
    f"Language: {lang}\n"
    f"Question: {query}\n"
    f"Snippets:\n{snippets}\n\n"
    "Return JSON only."
  )
  return [
    {"role": "system", "content": [{"type": "input_text", "text": system_text}]},
    {"role": "user", "content": [{"type": "input_text", "text": user_text}]},
  ]


def call_responses_api(
  messages: List[Dict[str, Any]],
  schema: Dict[str, Any] | None = None,
  schema_name: str = "kiosk_answer",
) -> Dict[str, Any]:
  api_key = os.getenv("OPENAI_API_KEY")
  if not api_key:
    raise RuntimeError("OPENAI_API_KEY missing")

  model = os.getenv("OPENAI_MODEL", "gpt-4o")
  url = "https://api.openai.com/v1/responses"
  headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json",
  }

  if schema is None:
    schema = {
      "type": "object",
      "additionalProperties": False,
      "properties": {
        "answer": {
          "type": "object",
          "additionalProperties": False,
          "properties": {
            "direct": {"type": "string"},
            "steps": {"type": "array", "items": {"type": "string"}},
            "mistakes": {"type": "array", "items": {"type": "string"}},
          },
          "required": ["direct", "steps", "mistakes"],
        },
        "refinement_chips": {"type": "array", "items": {"type": "string"}},
      },
      "required": ["answer", "refinement_chips"],
    }

  payload = {
    "model": model,
    "input": messages,
    "text": {
      "format": {
        "type": "json_schema",
        "name": schema_name,
        "schema": schema,
        "strict": True,
      }
    },
  }

  last_err: Exception | None = None
  for attempt in range(2):
    try:
      _log_info("openai_start")
      resp = requests.post(url, headers=headers, data=json.dumps(payload), timeout=(5, 12))
      if resp.status_code == 429 or resp.status_code >= 500:
        raise RuntimeError(f"openai_http_{resp.status_code}")
      resp.raise_for_status()
      _log_info("openai_success")
      return resp.json()
    except Exception as e:
      last_err = e
      _set_openai_error(type(e).__name__, str(e))
      if not _event_mode():
        logging.warning("openai_error %s", type(e).__name__)
      if attempt == 0:
        time.sleep(0.6)
        continue
  raise last_err or RuntimeError("OpenAI call failed")


def extract_output_text(data: Dict[str, Any]) -> str:
  if isinstance(data.get("output_text"), str):
    return data["output_text"]
  output = data.get("output", [])
  parts: List[str] = []
  for item in output:
    for c in item.get("content", []):
      if c.get("type") in ("output_text", "text"):
        parts.append(c.get("text", ""))
  return "\n".join(parts)


def to_sources(items: List[Dict[str, Any]]) -> List[SourceItem]:
  return [
    SourceItem(
      title=s.get("title", ""),
      url=s.get("url_or_path", ""),
      snippet=s.get("snippet", ""),
      relevance=s.get("relevance", "Low"),
      page=s.get("page"),
      page_label=s.get("page_label"),
      page_start=s.get("page_start"),
      page_end=s.get("page_end"),
    )
    for s in items
  ]


def _parse_answer(output_text: str) -> tuple[str, List[str], List[str], List[str]]:
  parsed = json.loads(output_text)
  answer = parsed.get("answer", {}) if isinstance(parsed, dict) else {}
  chips = parsed.get("refinement_chips", []) if isinstance(parsed, dict) else []
  direct = answer.get("direct", "") if isinstance(answer, dict) else ""
  steps_val = answer.get("steps", []) if isinstance(answer, dict) else []
  mistakes_val = answer.get("mistakes", []) if isinstance(answer, dict) else []
  if not direct and steps_val:
    direct = steps_val[0]
  return direct, steps_val, mistakes_val, chips if isinstance(chips, list) else []


def answer_query(payload: AskRequest) -> AskResponse:
  start = time.time()
  response = safe_response()
  original_query = payload.query or ""

  try:
    clarify_choice = payload.clarifier_choice or ""
    effective_query = (
      f"{original_query}\nClarifier choice: {clarify_choice}"
      if payload.clarified and clarify_choice
      else original_query
    )

    if is_out_of_scope(original_query) and not payload.clarified:
      response = AskResponse(
        answer=AnswerBlock(direct="", steps=[], mistakes=[]),
        sources=[],
        confidence=0.0,
        refinement_chips=suggestion_chips(original_query, payload.lang),
        route_used="fallback",
        latency_ms=0,
        clarifying_question=out_of_scope_message(payload.lang),
        debug_notes="fallback: out_of_scope",
      )
      _log_info("branch=fallback out_of_scope=true")
    else:
      match, offline_conf = match_offline(effective_query, payload.lang)
      if match and offline_conf >= OFFLINE_THRESHOLD:
        retrieved_for_offline, _ = retrieve(effective_query, payload.lang, top_k=5)
        source_ids = match.get("source_ids", [])
        filtered = [
          s for s in retrieved_for_offline
          if s.get("source_id") in source_ids and s.get("score", 0) >= MIN_SOURCE_SCORE
        ]
        if len(filtered) >= MIN_SOURCES:
          answer = match.get("answer", {})
          response = AskResponse(
            answer=AnswerBlock(
              direct=answer.get("direct", ""),
              steps=answer.get("steps", []),
              mistakes=answer.get("mistakes", []),
            ),
            sources=to_sources(filtered),
            confidence=offline_conf,
            refinement_chips=[],
            route_used="offline",
            latency_ms=0,
          )
          _log_info("branch=offline sources=%d", len(filtered))

      if response.route_used != "offline":
        retrieved_sources, rag_conf = retrieve(effective_query, payload.lang, top_k=8)
        strong_sources = [s for s in retrieved_sources if s.get("score", 0) >= MIN_SOURCE_SCORE]
        weak_rag = len(strong_sources) < MIN_SOURCES or rag_conf < RAG_THRESHOLD
        chips = suggestion_chips(original_query, payload.lang, retrieved_sources=retrieved_sources)

        if weak_rag:
          if payload.clarified:
            response = AskResponse(
              answer=AnswerBlock(direct="", steps=[], mistakes=[]),
              sources=[],
              confidence=rag_conf,
              refinement_chips=chips,
              route_used="fallback",
              latency_ms=0,
              clarifying_question=insufficient_grounding_message(payload.lang),
              error_code="insufficient_grounding",
              error_message="No verified answer in official documents.",
              debug_notes="fallback: insufficient_grounding",
            )
            _log_info("branch=fallback insufficient_grounding")
          else:
            response = AskResponse(
              answer=AnswerBlock(direct="", steps=[], mistakes=[]),
              sources=[],
              confidence=rag_conf,
              refinement_chips=chips,
              route_used="fallback",
              latency_ms=0,
              clarifying_question=clarifier(original_query, payload.lang),
              debug_notes="fallback: rag_low_clarify",
            )
            _log_info("branch=fallback rag_low_clarify")
        else:
          try:
            data = call_responses_api(build_prompt(effective_query, payload.lang, strong_sources))
            direct, steps_val, mistakes_val, _ = _parse_answer(extract_output_text(data))
            if not direct and not steps_val and not mistakes_val:
              response = AskResponse(
                answer=AnswerBlock(direct="", steps=[], mistakes=[]),
                sources=[],
                confidence=rag_conf,
                refinement_chips=chips,
                route_used="fallback",
                latency_ms=0,
                clarifying_question=clarifier(original_query, payload.lang),
                debug_notes="fallback: empty_answer",
              )
            else:
              response = AskResponse(
                answer=AnswerBlock(direct=direct, steps=steps_val, mistakes=mistakes_val),
                sources=to_sources(strong_sources),
                confidence=rag_conf,
                refinement_chips=chips,
                route_used="rag",
                latency_ms=0,
              )
              _log_info("branch=rag sources=%d", len(strong_sources))
          except Exception as e:
            msg = str(e).lower()
            if "openai_api_key" in msg or "missing" in msg:
              debug = "fallback: openai_missing_key"
            elif "timeout" in msg:
              debug = "fallback: openai_timeout"
            else:
              debug = "fallback: openai_error"
            response = AskResponse(
              answer=AnswerBlock(direct="", steps=[], mistakes=[]),
              sources=[],
              confidence=rag_conf,
              refinement_chips=chips,
              route_used="fallback",
              latency_ms=0,
              clarifying_question=clarifier(original_query, payload.lang),
              error_code="openai_unavailable",
              error_message="LLM step unavailable; using clarifier",
              debug_notes=debug,
            )
  except Exception:
    logging.exception("/api/ask failed")
    response = safe_response(payload.lang)
  finally:
    latency_ms = int((time.time() - start) * 1000)
    response.latency_ms = latency_ms
    try:
      insert_analytics(
        session_id=payload.session_id,
        mode="ask",
        lang=payload.lang,
        rating_1_5=None,
        time_on_screen_ms=None,
        route_used=response.route_used,
        confidence=response.confidence,
        sources_count=len(response.sources) if response.sources else 0,
        error_code=response.error_code,
        latency_ms=latency_ms,
        hashed_query=hash_query(original_query),
      )
    except Exception:
      pass

  return response
