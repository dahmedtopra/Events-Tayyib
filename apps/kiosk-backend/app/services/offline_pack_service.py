import json
import os
import re
import unicodedata
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional, Tuple

CHIP_CONF_THRESHOLD = 0.65

MAP_TERMS = {
  "map",
  "venue map",
  "floor plan",
  "hall map",
  "plan du lieu",
  "lieu",
  "venue",
  "خريطة",
  "مخطط",
  "المكان",
}

MAP_SOURCE_ID_KEYWORDS = (
  "floor_plan",
  "venue_map",
  "map",
)

NON_MAP_FALLBACKS: Dict[str, List[str]] = {
  "EN": [
    "What sessions are happening today?",
    "How do I register for a workshop?",
    "Who are today's speakers?",
    "What time does the event start?",
  ],
  "AR": [
    "ما الجلسات المقامة اليوم؟",
    "كيف أسجّل في ورشة عمل؟",
    "من هم المتحدثون اليوم؟",
    "متى تبدأ الفعالية؟",
  ],
  "FR": [
    "Quelles sessions ont lieu aujourd'hui ?",
    "Comment s'inscrire a un atelier ?",
    "Qui sont les intervenants d'aujourd'hui ?",
    "A quelle heure commence l'evenement ?",
  ],
}


def get_repo_root() -> Path:
  return Path(__file__).resolve().parents[4]


def get_offline_pack_path() -> str:
  default_path = get_repo_root() / "data" / "offline_pack" / "offline_pack.json"
  return os.getenv("OFFLINE_PACK_PATH", str(default_path))


def normalize(text: str) -> str:
  text = text.strip().lower()
  text = "".join(
    c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c)
  )
  text = re.sub(r"[^\w\s\u0600-\u06FF]", " ", text, flags=re.UNICODE)
  text = re.sub(r"\s+", " ", text).strip()
  return text


def score(query: str, variant: str) -> float:
  if not query or not variant:
    return 0.0
  if query == variant:
    return 1.0
  if query in variant or variant in query:
    return 0.9
  q_tokens = set(query.split())
  v_tokens = set(variant.split())
  if not q_tokens or not v_tokens:
    return 0.0
  intersection = q_tokens.intersection(v_tokens)
  union = q_tokens.union(v_tokens)
  return len(intersection) / len(union)


@lru_cache(maxsize=1)
def load_offline_pack() -> List[Dict]:
  path = Path(get_offline_pack_path())
  if not path.exists():
    return []
  data = json.loads(path.read_text(encoding="utf-8"))
  if isinstance(data, list):
    return data
  if isinstance(data, dict) and isinstance(data.get("entries"), list):
    return data["entries"]
  return []


def _entry_source_ids(entry: Dict) -> List[str]:
  ids = entry.get("source_ids", [])
  if not isinstance(ids, list):
    return []
  return [str(i) for i in ids if i]


def _entry_tags(entry: Dict) -> List[str]:
  tags = entry.get("tags", [])
  if not isinstance(tags, list):
    return []
  return [normalize(str(t)) for t in tags if str(t).strip()]


def _entry_variants(entry: Dict) -> List[str]:
  variants = entry.get("question_variants", [])
  if not isinstance(variants, list):
    return []
  return [str(v).strip() for v in variants if str(v).strip()]


def _contains_map_term(text: str) -> bool:
  nt = normalize(text)
  return any(term in nt for term in MAP_TERMS)


def _is_map_related_entry(entry: Dict) -> bool:
  for source_id in _entry_source_ids(entry):
    sid = normalize(source_id)
    if any(keyword in sid for keyword in MAP_SOURCE_ID_KEYWORDS):
      return True
  for tag in _entry_tags(entry):
    if any(term in tag for term in MAP_TERMS):
      return True
  for variant in _entry_variants(entry):
    if _contains_map_term(variant):
      return True
  answer = entry.get("answer", {})
  if isinstance(answer, dict) and isinstance(answer.get("direct"), str):
    if _contains_map_term(answer["direct"]):
      return True
  return False


def _pick_best_variant(query: str, variants: List[str]) -> Tuple[str, float]:
  if not variants:
    return "", 0.0
  nq = normalize(query)
  best_text = variants[0]
  best_score = -1.0
  for variant in variants:
    s = score(nq, normalize(variant))
    if s > best_score:
      best_score = s
      best_text = variant
  return best_text, max(best_score, 0.0)


def _append_fallback_chips(current: List[str], lang: str, limit: int) -> List[str]:
  if len(current) >= limit:
    return current[:limit]
  seen = {normalize(x) for x in current}
  for chip in NON_MAP_FALLBACKS.get(lang, NON_MAP_FALLBACKS["EN"]):
    normalized_chip = normalize(chip)
    if normalized_chip in seen:
      continue
    if _contains_map_term(chip):
      continue
    current.append(chip)
    seen.add(normalized_chip)
    if len(current) >= limit:
      break
  return current[:limit]


def match_offline(query: str, lang: str) -> Tuple[Optional[Dict], float]:
  items = [i for i in load_offline_pack() if i.get("lang") == lang]
  if not items:
    return None, 0.0
  nq = normalize(query)
  best = None
  best_score = 0.0
  for item in items:
    variants = item.get("question_variants", [])
    for variant in variants:
      sv = normalize(variant)
      s = score(nq, sv)
      if s > best_score:
        best_score = s
        best = item
  return best, best_score


def get_suggestions(query: str, lang: str, limit: int = 3) -> List[str]:
  items = [i for i in load_offline_pack() if i.get("lang") == lang]
  if not items:
    return _append_fallback_chips([], lang, limit)
  nq = normalize(query)
  candidates: List[Tuple[str, float]] = []
  for item in items:
    if _is_map_related_entry(item):
      continue
    tags = _entry_tags(item)
    tag_hit = any(t and t in nq for t in tags)
    for variant in _entry_variants(item):
      if _contains_map_term(variant):
        continue
      sv = normalize(variant)
      s = score(nq, sv)
      if tag_hit:
        s += 0.15
      candidates.append((variant, s))

  candidates.sort(key=lambda x: x[1], reverse=True)
  seen = set()
  results: List[str] = []
  for text, s in candidates:
    normalized_text = normalize(text)
    if normalized_text in seen:
      continue
    if s <= 0:
      continue
    seen.add(normalized_text)
    results.append(text)
    if len(results) >= limit:
      break

  return _append_fallback_chips(results, lang, limit)


def get_confident_suggestions(
  query: str,
  lang: str,
  retrieved_sources: List[Dict],
  limit: int = 3,
  min_confidence: float = CHIP_CONF_THRESHOLD,
) -> List[str]:
  source_scores: Dict[str, float] = {}
  for source in retrieved_sources or []:
    source_id = str(source.get("source_id", "")).strip()
    if not source_id:
      continue
    try:
      s = float(source.get("score", 0.0) or 0.0)
    except Exception:
      s = 0.0
    source_scores[source_id] = max(source_scores.get(source_id, 0.0), s)

  candidates: List[Tuple[str, float, float]] = []
  for entry in load_offline_pack():
    if entry.get("lang") != lang:
      continue
    if _is_map_related_entry(entry):
      continue

    matched_scores = [source_scores[sid] for sid in _entry_source_ids(entry) if sid in source_scores]
    if not matched_scores:
      continue

    entry_conf = max(matched_scores)
    if entry_conf < min_confidence:
      continue

    text, lexical = _pick_best_variant(query, _entry_variants(entry))
    if not text or _contains_map_term(text):
      continue
    candidates.append((text, entry_conf, lexical))

  candidates.sort(key=lambda x: (x[1], x[2]), reverse=True)
  results: List[str] = []
  seen = set()
  for text, _, _ in candidates:
    normalized_text = normalize(text)
    if normalized_text in seen:
      continue
    seen.add(normalized_text)
    results.append(text)
    if len(results) >= limit:
      break

  return _append_fallback_chips(results, lang, limit)
