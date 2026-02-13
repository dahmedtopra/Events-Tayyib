import json
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Tuple

def get_chroma_path() -> str:
  env_val = os.getenv("CHROMA_PATH")
  if env_val:
    return env_val
  here = Path(__file__).resolve().parent
  candidates = [
    here.parents[3] / "data" / "chroma_index",  # local: repo root
    here.parents[1] / "data" / "chroma_index",  # container: /app/
    Path.cwd() / "data" / "chroma_index",
  ]
  for p in candidates:
    try:
      if p.exists():
        return str(p)
    except Exception:
      continue
  return str(candidates[0])


_cache = {}
_cache_ttl = 60
_client = None
_collection = None



telemetry_disabled = os.getenv("CHROMA_TELEMETRY", "false").lower() in ("false", "0", "no")

def _use_cloud() -> bool:
  return bool(os.getenv("CHROMA_API_KEY") and os.getenv("CHROMA_TENANT") and os.getenv("CHROMA_DATABASE"))


def get_collection():
  global _client, _collection
  if _collection is not None:
    return _collection
  try:
    import chromadb
  except Exception:
    return None
  try:
    if _use_cloud():
      _client = chromadb.CloudClient(
        api_key=os.getenv("CHROMA_API_KEY"),
        tenant=os.getenv("CHROMA_TENANT"),
        database=os.getenv("CHROMA_DATABASE"),
      )
    else:
      chroma_path = get_chroma_path()
      if not Path(chroma_path).exists():
        return None
      if telemetry_disabled:
        os.environ.setdefault("ANONYMIZED_TELEMETRY", "false")
        os.environ.setdefault("CHROMA_TELEMETRY", "false")
      _client = chromadb.PersistentClient(path=chroma_path)
    _collection = _client.get_or_create_collection(name="event_sources")
    return _collection
  except Exception:
    return None


def embed_query(text: str) -> List[float]:
  api_key = os.getenv("OPENAI_API_KEY")
  if not api_key:
    raise RuntimeError("OPENAI_API_KEY is required for embeddings.")
  model = os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-large")

  try:
    import requests
  except Exception:
    raise RuntimeError("requests is required for embeddings.")

  url = "https://api.openai.com/v1/embeddings"
  headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
  }
  payload = {
    "model": model,
    "input": [text]
  }
  resp = requests.post(url, headers=headers, data=json.dumps(payload), timeout=30)
  resp.raise_for_status()
  data = resp.json()
  return data["data"][0]["embedding"]


def relevance_label(distance: float) -> str:
  if distance <= 0.2:
    return "High"
  if distance <= 0.4:
    return "Med"
  return "Low"


def retrieve(query: str, lang: str, top_k: int = 5) -> Tuple[List[Dict[str, Any]], float]:
  key = f"{lang}:{query}"
  now = time.time()
  cached = _cache.get(key)
  if cached and now - cached["ts"] < _cache_ttl:
    return cached["sources"], cached["confidence"]

  collection = get_collection()
  if collection is None:
    return [], 0.0

  try:
    embedding = embed_query(query)
  except Exception:
    return [], 0.0

  try:
    results = collection.query(
      query_embeddings=[embedding],
      n_results=top_k,
      where={"lang": lang},
      include=["documents", "metadatas", "distances"]
    )
  except Exception:
    return [], 0.0

  docs = results.get("documents", [[]])[0]
  metas = results.get("metadatas", [[]])[0]
  distances = results.get("distances", [[]])[0]

  if not docs:
    return [], 0.0

  sources = []
  min_dist = None
  for doc, meta, dist in zip(docs, metas, distances):
    if meta and meta.get("lang") and meta.get("lang") != lang:
      continue
    snippet = (doc or "")[:300]
    dist_val = dist if dist is not None else 1.0
    rel = relevance_label(dist_val)
    score = max(0.0, min(1.0, 1.0 - (dist_val ** 2) / 2.0))
    sources.append({
      "source_id": meta.get("source_id", "") if meta else "",
      "title": meta.get("source_title", "") if meta else "",
      "url": meta.get("source_url", "") if meta else "",
      "url_or_path": meta.get("source_url", "") if meta else "",
      "snippet": snippet,
      "relevance": rel,
      "score": score,
      "page": meta.get("page") if meta else None,
      "page_label": meta.get("page_label") if meta else None,
      "page_start": meta.get("page_start") if meta else None,
      "page_end": meta.get("page_end") if meta else None
    })
    if dist is not None:
      min_dist = dist if min_dist is None else min(min_dist, dist)

  if not sources:
    return [], 0.0

  confidence = 0.0
  if min_dist is not None:
    confidence = max(0.0, min(1.0, 1.0 - (min_dist ** 2) / 2.0))

  _cache[key] = {"ts": now, "sources": sources, "confidence": confidence}
  return sources, confidence
