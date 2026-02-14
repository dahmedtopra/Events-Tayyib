import json
import logging
import os
import time
from typing import Any, Dict, Generator, List

import requests
from datetime import datetime, timezone, timedelta

from app.db.sqlite import consume_session_user_message_slot, insert_analytics
from app.schemas.chat import ChatRequest, ChatResponseMeta, ChatSourceItem
from app.services.ask_service import (
  is_out_of_scope,
  out_of_scope_message,
  suggestion_chips,
)
from app.services.hash_service import hash_query
from app.services.offline_pack_service import match_offline
from app.services.rag_service import (
  confidence_from_sources,
  filter_sources_for_query,
  is_landmarks_query,
  is_landmarks_source_id,
  retrieve,
)

OFFLINE_THRESHOLD = 0.25
RAG_THRESHOLD = 0.35
MIN_SOURCES = 1
MIN_SOURCE_SCORE = 0.2
MAX_HISTORY_MESSAGES = 10
DEFAULT_MAX_MESSAGES_PER_SESSION = 15

_QUESTION_WORDS = {
  "how", "what", "where", "when", "why", "who", "which",
  "can", "does", "do", "is", "are", "should", "will", "tell",
}


def _is_vague_query(query: str) -> bool:
  q = query.strip()
  words = q.split()
  if len(words) >= 4:
    return False
  if "?" in q:
    return False
  first = words[0].lower().rstrip("?") if words else ""
  if first in _QUESTION_WORDS:
    return False
  return True


def _effective_query(messages, latest_query: str) -> str:
  user_messages = [m for m in messages if m.role == "user"]
  if len(user_messages) >= 2:
    original = user_messages[-2].content
    if original.lower().strip() != latest_query.lower().strip():
      return f"{original} ({latest_query})"
  return latest_query


def _offline_intent_conflict(query: str, source_ids: List[str]) -> bool:
  if not source_ids:
    return False
  landmarks_match = any(is_landmarks_source_id(str(sid)) for sid in source_ids)
  return landmarks_match != is_landmarks_query(query)


def _verified_only_message(lang: str) -> str:
  if lang == "AR":
    return "\u0644\u0645 \u0623\u062c\u062f \u0625\u062c\u0627\u0628\u0629 \u0645\u0648\u062b\u0642\u0629 \u0641\u064a \u0645\u0633\u062a\u0646\u062f\u0627\u062a \u0627\u0644\u0641\u0639\u0627\u0644\u064a\u0629 \u0627\u0644\u0631\u0633\u0645\u064a\u0629. \u0627\u062e\u062a\u0631 \u0633\u0624\u0627\u0644\u0627 \u0623\u062f\u0642 \u0623\u0648 \u0631\u0627\u062c\u0639 \u0645\u0643\u062a\u0628 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062a."
  if lang == "FR":
    return "Je n'ai pas trouv\u00e9 de r\u00e9ponse v\u00e9rifi\u00e9e dans les documents officiels de l'\u00e9v\u00e9nement. Reformulez votre question ou consultez le bureau d'information."
  return "I couldn't verify this in the official event documents. Please ask a more specific question or check with the information desk."


def _max_messages_per_session() -> int:
  raw = os.getenv("MAX_MESSAGES_PER_SESSION", str(DEFAULT_MAX_MESSAGES_PER_SESSION)).strip()
  try:
    val = int(raw)
    return val if val > 0 else DEFAULT_MAX_MESSAGES_PER_SESSION
  except Exception:
    return DEFAULT_MAX_MESSAGES_PER_SESSION


def _session_limit_message(limit: int, lang: str) -> str:
  if lang == "AR":
    return f"\u0648\u0635\u0644\u062a \u0647\u0630\u0647 \u0627\u0644\u062c\u0644\u0633\u0629 \u0625\u0644\u0649 \u0627\u0644\u062d\u062f \u0627\u0644\u0623\u0642\u0635\u0649 ({limit} \u0631\u0633\u0627\u0644\u0629). \u0627\u0636\u063a\u0637 \u0639\u0644\u0649 \u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u062c\u0644\u0633\u0629 \u0644\u0628\u062f\u0621 \u062c\u0644\u0633\u0629 \u062c\u062f\u064a\u062f\u0629."
  if lang == "FR":
    return f"Cette session a atteint la limite ({limit} messages). Appuyez sur Fin de session pour en d\u00e9marrer une nouvelle."
  return f"This session reached the limit ({limit} messages). Tap End Session to start a new session."


def _empty_query_message(lang: str) -> str:
  if lang == "AR":
    return "\u0627\u0633\u0623\u0644\u0646\u064a \u0633\u0624\u0627\u0644\u0627 \u0639\u0646 \u0627\u0644\u0641\u0639\u0627\u0644\u064a\u0629!"
  if lang == "FR":
    return "Posez-moi une question sur l'\u00e9v\u00e9nement !"
  return "Please ask me a question about the event!"


def _vague_query_message(lang: str) -> str:
  if lang == "AR":
    return "\u0623\u0648\u062f \u0645\u0633\u0627\u0639\u062f\u062a\u0643. \u0647\u0644 \u064a\u0645\u0643\u0646\u0643 \u062a\u062d\u062f\u064a\u062f \u0633\u0624\u0627\u0644\u0643 \u0628\u0634\u0643\u0644 \u0623\u062f\u0642\u061f"
  if lang == "FR":
    return "Je souhaite vous aider. Pourriez-vous pr\u00e9ciser votre question ?"
  return "I'd like to help with that. Could you be a bit more specific?"


def _error_message(lang: str) -> str:
  if lang == "AR":
    return "\u0639\u0630\u0631\u0627\u060c \u0644\u0645 \u0623\u062a\u0645\u0643\u0646 \u0645\u0646 \u0625\u062a\u0645\u0627\u0645 \u0647\u0630\u0627 \u0627\u0644\u0637\u0644\u0628. \u064a\u0631\u062c\u0649 \u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0629 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649."
  if lang == "FR":
    return "D\u00e9sol\u00e9, je n'ai pas pu traiter cette demande. Veuillez r\u00e9essayer."
  return "I'm sorry, I couldn't complete that request. Please try again."


def _sse_token(text: str) -> str:
  # JSON-encode token payload so newlines/special chars are transmitted losslessly.
  return f"event: token\ndata: {json.dumps(text, ensure_ascii=False)}\n\n"


def _sse_meta(meta: ChatResponseMeta) -> str:
  return f"event: meta\ndata: {meta.model_dump_json()}\n\n"


def _to_chat_sources(items: List[Dict[str, Any]]) -> List[ChatSourceItem]:
  return [
    ChatSourceItem(
      title=s.get("title", ""),
      url=s.get("url_or_path", s.get("url", "")),
      snippet=s.get("snippet", ""),
      relevance=s.get("relevance", "Low"),
      page=s.get("page"),
      page_label=s.get("page_label"),
      page_start=s.get("page_start"),
      page_end=s.get("page_end"),
    )
    for s in items
  ]


def _now_makkah() -> str:
  now = datetime.now(timezone(timedelta(hours=3)))
  return now.strftime("%A %d %B %Y, %H:%M")


def _build_system_prompt(lang: str, sources: List[Dict[str, Any]] | None = None) -> str:
  lang_name = {"EN": "English", "AR": "Arabic", "FR": "French"}.get(lang, "English")
  base = (
    f"You are Guide, a friendly and knowledgeable event assistant on a public kiosk. "
    f"Current date/time in Makkah: {_now_makkah()}.\n"
    f"You help attendees with event schedules, sessions, speakers, and registration information.\n\n"
    f"Rules:\n"
    f"- Respond in {lang_name}.\n"
    f"- Be conversational but concise. This is a kiosk and people are standing.\n"
    f"- Stay factual. Do not give medical or legal advice.\n"
    f"- Use only the provided sources for factual claims.\n"
    f"- For schedule/session/masterclass/exhibition questions, synthesize across all relevant sources before concluding.\n"
    f"- Do not claim an item is only on one day unless the sources explicitly state exclusivity.\n"
    f"- Do not include inline source tags like [Source 1] in answer text.\n"
    f"- If you don't know, say so clearly.\n"
    f"- Keep responses under 200 words unless the user asks for detail.\n\n"
    f"FORMATTING:\n"
    f"- Use markdown with short paragraphs.\n"
    f"- Start with the direct answer immediately.\n"
    f"- If helpful, add a short '## Details' section with up to 4 bullets.\n"
    f"- Do not output sections like '## Steps' or '## Common Mistakes' unless explicitly requested by the user.\n"
  )
  if sources:
    snippets = "\n\n".join(
      f"[Source {i+1}] Title: {s.get('title', '')}\nURL: {s.get('url_or_path', '')}\nSnippet: {s.get('snippet', '')}"
      for i, s in enumerate(sources)
    )
    base += f"\nAvailable sources:\n{snippets}\n"
  return base


def _build_openai_input(system_prompt: str, history: List[Dict[str, str]]) -> List[Dict[str, Any]]:
  messages: List[Dict[str, Any]] = [
    {"role": "system", "content": [{"type": "input_text", "text": system_prompt}]}
  ]
  for msg in history:
    if msg["role"] == "assistant":
      messages.append({
        "role": "assistant",
        "content": [{"type": "output_text", "text": msg["content"]}],
      })
    else:
      messages.append({
        "role": "user",
        "content": [{"type": "input_text", "text": msg["content"]}],
      })
  return messages


def _offline_to_prose(match: Dict[str, Any], lang: str) -> str:
  answer = match.get("answer", {})
  parts: List[str] = []
  direct = str(answer.get("direct", "")).strip()
  steps = [str(s).strip() for s in answer.get("steps", []) if str(s).strip()]

  if not direct and steps:
    direct = steps[0]
    steps = steps[1:]

  if direct:
    parts.append(direct)

  if steps:
    if lang == "AR":
      parts.append("## \u062a\u0641\u0627\u0635\u064a\u0644")
    elif lang == "FR":
      parts.append("## D\u00e9tails")
    else:
      parts.append("## Details")
    parts.append("\n".join(f"- {s}" for s in steps[:4]))

  return "\n\n".join(parts).strip()


def _yield_text_as_tokens(text: str, chunk_size: int = 8) -> Generator[str, None, None]:
  for i in range(0, len(text), chunk_size):
    yield _sse_token(text[i:i + chunk_size])


def _stream_openai(messages: List[Dict[str, Any]]) -> Generator[str, None, str]:
  api_key = os.getenv("OPENAI_API_KEY")
  if not api_key:
    raise RuntimeError("OPENAI_API_KEY missing")

  model = os.getenv("OPENAI_MODEL", "gpt-4o")
  url = "https://api.openai.com/v1/responses"
  headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json",
  }
  payload = {
    "model": model,
    "input": messages,
    "stream": True,
  }

  full_text = ""
  last_err = None
  for attempt in range(2):
    try:
      resp = requests.post(
        url, headers=headers, data=json.dumps(payload),
        timeout=(5, 30), stream=True,
      )
      if resp.status_code in (429,) or resp.status_code >= 500:
        raise RuntimeError(f"openai_http_{resp.status_code}")
      resp.raise_for_status()

      for line in resp.iter_lines(decode_unicode=True):
        if not line or not line.startswith("data:"):
          continue
        data_str = line[len("data:"):].strip()
        if data_str == "[DONE]":
          break
        try:
          event = json.loads(data_str)
        except json.JSONDecodeError:
          continue
        if event.get("type") == "response.output_text.delta":
          delta = event.get("delta", "")
          if delta:
            full_text += delta
            yield _sse_token(delta)

      return full_text
    except Exception as e:
      last_err = e
      logging.warning("openai_stream_error attempt=%d %s", attempt, type(e).__name__)
      if attempt == 0:
        time.sleep(0.6)
        continue

  raise last_err or RuntimeError("OpenAI streaming failed")


def stream_chat_response(payload: ChatRequest) -> Generator[str, None, None]:
  start = time.time()
  route_used = "fallback"
  confidence = 0.0
  sources_list: List[Dict[str, Any]] = []
  refinement_chips: List[str] = []
  clarifying_question = None
  error_code = None
  latest_query = ""

  try:
    if not payload.messages:
      yield from _yield_text_as_tokens(_empty_query_message(payload.lang))
      yield _sse_meta(ChatResponseMeta(
        sources=[],
        confidence=0.0,
        refinement_chips=[],
        route_used="fallback",
        latency_ms=0,
      ))
      return

    latest_msg = None
    for msg in reversed(payload.messages):
      if msg.role == "user":
        latest_msg = msg
        break
    if not latest_msg:
      yield from _yield_text_as_tokens(_empty_query_message(payload.lang))
      yield _sse_meta(ChatResponseMeta(
        sources=[],
        confidence=0.0,
        refinement_chips=[],
        route_used="fallback",
        latency_ms=0,
      ))
      return

    latest_query = latest_msg.content
    max_messages = _max_messages_per_session()
    allowed, _ = consume_session_user_message_slot(payload.session_id, max_messages)
    if not allowed:
      limit_text = _session_limit_message(max_messages, payload.lang)
      yield from _yield_text_as_tokens(limit_text)
      latency_ms = int((time.time() - start) * 1000)
      yield _sse_meta(ChatResponseMeta(
        sources=[],
        confidence=0.0,
        refinement_chips=[],
        route_used="fallback",
        latency_ms=latency_ms,
        clarifying_question=limit_text,
        error_code="session_limit_reached",
      ))
      _log_analytics(
        payload,
        "fallback",
        0.0,
        0,
        "session_limit_reached",
        latency_ms,
        latest_query,
      )
      return

    rag_query = _effective_query(payload.messages, latest_query)

    if is_out_of_scope(latest_query):
      oos_msg = out_of_scope_message(payload.lang)
      yield from _yield_text_as_tokens(oos_msg)
      chips = suggestion_chips(latest_query, payload.lang)
      latency_ms = int((time.time() - start) * 1000)
      yield _sse_meta(ChatResponseMeta(
        sources=[],
        confidence=0.0,
        refinement_chips=chips,
        route_used="fallback",
        latency_ms=latency_ms,
      ))
      _log_analytics(payload, "fallback", 0.0, 0, None, latency_ms, latest_query)
      return

    match, offline_conf = match_offline(rag_query, payload.lang)
    if match and offline_conf >= OFFLINE_THRESHOLD:
      source_ids = [str(sid) for sid in match.get("source_ids", []) if sid]
      if _offline_intent_conflict(rag_query, source_ids):
        source_ids = []
      sources_raw, _ = retrieve(rag_query, payload.lang, top_k=5)
      sources_raw = filter_sources_for_query(rag_query, sources_raw)
      filtered = [s for s in sources_raw if s.get("source_id") in source_ids and s.get("score", 0) >= MIN_SOURCE_SCORE]
      if len(filtered) >= MIN_SOURCES:
        prose = _offline_to_prose(match, payload.lang)
        yield from _yield_text_as_tokens(prose)
        latency_ms = int((time.time() - start) * 1000)
        yield _sse_meta(ChatResponseMeta(
          sources=_to_chat_sources(filtered),
          confidence=offline_conf,
          refinement_chips=[],
          route_used="offline",
          latency_ms=latency_ms,
        ))
        _log_analytics(payload, "offline", offline_conf, len(filtered), None, latency_ms, latest_query)
        return

    retrieved_sources, _ = retrieve(rag_query, payload.lang, top_k=12)
    retrieved_sources = filter_sources_for_query(rag_query, retrieved_sources)
    rag_conf = confidence_from_sources(retrieved_sources)
    strong_sources = [s for s in retrieved_sources if s.get("score", 0) >= MIN_SOURCE_SCORE]
    confidence = rag_conf

    history = [{"role": m.role, "content": m.content} for m in payload.messages[-MAX_HISTORY_MESSAGES:]]
    chips = suggestion_chips(latest_query, payload.lang, retrieved_sources=retrieved_sources)

    if len(strong_sources) >= MIN_SOURCES and rag_conf >= RAG_THRESHOLD:
      system_prompt = _build_system_prompt(payload.lang, strong_sources)
      openai_input = _build_openai_input(system_prompt, history)
      yield from _stream_openai(openai_input)
      route_used = "rag"
      sources_list = strong_sources
      refinement_chips = chips
    else:
      is_first_message = len(payload.messages) <= 1
      if is_first_message and _is_vague_query(latest_query):
        clarify_text = _vague_query_message(payload.lang)
        yield from _yield_text_as_tokens(clarify_text)
        route_used = "fallback"
        clarifying_question = clarify_text
        refinement_chips = chips
      else:
        verified_text = _verified_only_message(payload.lang)
        yield from _yield_text_as_tokens(verified_text)
        route_used = "fallback"
        clarifying_question = verified_text
        refinement_chips = chips
        error_code = "insufficient_grounding"

    latency_ms = int((time.time() - start) * 1000)
    yield _sse_meta(ChatResponseMeta(
      sources=_to_chat_sources(sources_list),
      confidence=confidence,
      refinement_chips=refinement_chips,
      route_used=route_used,
      latency_ms=latency_ms,
      clarifying_question=clarifying_question,
      error_code=error_code,
    ))
    _log_analytics(payload, route_used, confidence, len(sources_list), error_code, latency_ms, latest_query)

  except Exception:
    logging.exception("chat stream error")
    error_msg = _error_message(payload.lang)
    yield from _yield_text_as_tokens(error_msg)
    latency_ms = int((time.time() - start) * 1000)
    yield _sse_meta(ChatResponseMeta(
      sources=[],
      confidence=0.0,
      refinement_chips=[],
      route_used="fallback",
      latency_ms=latency_ms,
      error_code="chat_error",
    ))
    _log_analytics(payload, "fallback", 0.0, 0, "chat_error", latency_ms, latest_query)


def _log_analytics(
  payload: ChatRequest,
  route_used: str,
  confidence: float,
  sources_count: int,
  error_code: str | None,
  latency_ms: int,
  query: str,
) -> None:
  try:
    insert_analytics(
      session_id=payload.session_id,
      mode="chat",
      lang=payload.lang,
      rating_1_5=None,
      time_on_screen_ms=None,
      route_used=route_used,
      confidence=confidence,
      sources_count=sources_count,
      error_code=error_code,
      latency_ms=latency_ms,
      hashed_query=hash_query(query),
    )
  except Exception:
    pass
