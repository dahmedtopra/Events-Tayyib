import json
import logging
import os
import time
from typing import Any, Dict, Generator, List

import requests
from datetime import datetime, timezone, timedelta

from app.db.sqlite import insert_analytics
from app.schemas.chat import ChatRequest, ChatResponseMeta, ChatSourceItem
from app.services.ask_service import (
  is_out_of_scope,
  out_of_scope_message,
  suggestion_chips,
)
from app.services.hash_service import hash_query
from app.services.offline_pack_service import match_offline
from app.services.rag_service import retrieve

OFFLINE_THRESHOLD = 0.25
RAG_THRESHOLD = 0.35
MIN_SOURCES = 1
MIN_SOURCE_SCORE = 0.2
MAX_HISTORY_MESSAGES = 10

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


def _verified_only_message(lang: str) -> str:
  if lang == "AR":
    return "لم أجد إجابة موثقة في مستندات الفعالية الرسمية. اختر سؤالا أدق أو راجع مكتب المعلومات."
  if lang == "FR":
    return "Je n'ai pas trouve de reponse verifiee dans les documents officiels de l'evenement. Reformulez votre question ou consultez le bureau d'information."
  return "I couldn't verify this in the official event documents. Please ask a more specific question or check with the information desk."


def _sse_token(text: str) -> str:
  return f"event: token\ndata: {text}\n\n"


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
    f"- Do not include inline source tags like [Source 1] in answer text.\n"
    f"- If you don't know, say so clearly.\n"
    f"- Keep responses under 200 words unless the user asks for detail.\n\n"
    f"FORMATTING:\n"
    f"- Use markdown.\n"
    f"- Put headings, bullets, and paragraphs on separate lines.\n"
    f"- Use sections only when relevant:\n"
    f"  ## Direct Answer\n"
    f"  ## Steps\n"
    f"  ## Common Mistakes\n"
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

  if answer.get("direct"):
    if lang == "AR":
      parts.append("## الإجابة المباشرة")
    elif lang == "FR":
      parts.append("## Reponse directe")
    else:
      parts.append("## Direct Answer")
    parts.append(answer["direct"])

  steps = answer.get("steps", [])
  if steps:
    if lang == "AR":
      parts.append("## الخطوات")
    elif lang == "FR":
      parts.append("## Etapes")
    else:
      parts.append("## Steps")
    parts.append("\n".join(f"- {s}" for s in steps))

  mistakes = answer.get("mistakes", [])
  if mistakes:
    if lang == "AR":
      parts.append("## أخطاء شائعة")
    elif lang == "FR":
      parts.append("## Erreurs courantes a eviter")
    else:
      parts.append("## Common Mistakes")
    parts.append("\n".join(f"- {m}" for m in mistakes))

  return "\n\n".join(parts)


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
      yield from _yield_text_as_tokens("Please ask me a question about the event!")
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
      yield from _yield_text_as_tokens("Please ask me a question about the event!")
      yield _sse_meta(ChatResponseMeta(
        sources=[],
        confidence=0.0,
        refinement_chips=[],
        route_used="fallback",
        latency_ms=0,
      ))
      return

    latest_query = latest_msg.content
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
      sources_raw, _ = retrieve(rag_query, payload.lang, top_k=5)
      source_ids = match.get("source_ids", [])
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

    retrieved_sources, rag_conf = retrieve(rag_query, payload.lang, top_k=8)
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
        clarify_text = "I'd like to help with that. Could you be a bit more specific?"
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
    error_msg = "I'm sorry, I couldn't complete that request. Please try again."
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
