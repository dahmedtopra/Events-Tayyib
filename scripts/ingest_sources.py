import argparse
import io
import json
import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple


def repo_root() -> Path:
  return Path(__file__).resolve().parents[1]


def load_sources() -> List[Dict]:
  path = repo_root() / "data" / "rag_corpus" / "sources.yml"
  if not path.exists():
    print(f"sources.yml not found at {path}")
    return []
  try:
    import yaml
  except Exception:
    print("PyYAML is required for ingestion. Install with: pip install pyyaml")
    raise
  data = yaml.safe_load(path.read_text(encoding="utf-8"))
  return data.get("sources", []) if isinstance(data, dict) else []


def strip_html(html: str) -> str:
  text = re.sub(r"<script.*?>.*?</script>", " ", html, flags=re.S | re.I)
  text = re.sub(r"<style.*?>.*?</style>", " ", text, flags=re.S | re.I)
  text = re.sub(r"<[^>]+>", " ", text)
  text = re.sub(r"\s+", " ", text).strip()
  return text


def normalize_text(text: str) -> str:
  text = text.replace("\u00a0", " ")
  text = re.sub(r"\s+", " ", text).strip()
  return text



def sanitize_metadata(d: dict) -> dict:
  out = {}
  for k, v in d.items():
    if v is None:
      continue
    if isinstance(v, Path):
      v = str(v)
    if isinstance(v, (bool, int, float, str)):
      out[k] = v
    elif isinstance(v, (list, dict)):
      # drop complex types unless explicitly needed
      continue
    else:
      out[k] = str(v)
  return out

def chunk_text_chars(text: str, chunk_chars: int = 2000, overlap_chars: int = 200) -> List[str]:
  if not text:
    return []
  text = normalize_text(text)
  if not text:
    return []
  chunks = []
  start = 0
  length = len(text)
  while start < length:
    end = min(start + chunk_chars, length)
    chunk = text[start:end]
    if chunk.strip():
      chunks.append(chunk)
    if end >= length:
      break
    start = max(0, end - overlap_chars)
  return chunks


def get_cache_dir(path_arg: Optional[str]) -> Path:
  if path_arg:
    base = Path(path_arg)
  else:
    base = repo_root() / "data" / "rag_corpus" / "cache"
  base.mkdir(parents=True, exist_ok=True)
  return base


def fetch_url_to_cache(url: str, dest: Path, refresh: bool) -> Path:
  if dest.exists() and not refresh:
    return dest
  try:
    import requests
  except Exception:
    print("requests is required for ingestion. Install with: pip install requests")
    raise

  def _get() -> bytes:
    resp = requests.get(url, timeout=(10, 60))
    resp.raise_for_status()
    return resp.content

  try:
    data = _get()
  except Exception:
    data = _get()

  dest.write_bytes(data)
  return dest


def read_html_path(path: Path) -> str:
  return strip_html(path.read_text(encoding="utf-8", errors="ignore"))


def read_html_bytes(data: bytes) -> str:
  try:
    text = data.decode("utf-8", errors="ignore")
  except Exception:
    text = data.decode(errors="ignore")
  return strip_html(text)


def get_pdf_reader(path: Path):
  try:
    from pypdf import PdfReader
  except Exception:
    print("pypdf is required for PDF parsing. Install with: pip install pypdf")
    raise
  return PdfReader(str(path))


def embed_texts(texts: List[str]) -> List[List[float]]:
  api_key = os.getenv("OPENAI_API_KEY")
  if not api_key:
    raise RuntimeError("OPENAI_API_KEY is required for embeddings.")
  model = os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-large")

  try:
    import requests
  except Exception:
    print("requests is required for ingestion. Install with: pip install requests")
    raise

  url = "https://api.openai.com/v1/embeddings"
  headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
  }
  payload = {
    "model": model,
    "input": texts
  }
  resp = requests.post(url, headers=headers, data=json.dumps(payload), timeout=60)
  resp.raise_for_status()
  data = resp.json()
  return [item["embedding"] for item in data["data"]]


def get_chroma_path() -> str:
  default_path = repo_root() / "data" / "chroma_index"
  return os.getenv("CHROMA_PATH", str(default_path))


def ingest_chunks(collection, src_id: str, title: str, url_or_path: str, lang: str, approved_by: str, approved_date: str, chunks: List[str], batch_size: int, page: Optional[int] = None, page_label: Optional[str] = None, page_start: Optional[int] = None, page_end: Optional[int] = None) -> int:
  total = 0
  for i in range(0, len(chunks), batch_size):
    batch = chunks[i:i+batch_size]
    embeddings = embed_texts(batch)
    ids = [f"{src_id}-{i+j}" for j in range(len(batch))]
    metadatas = [
      sanitize_metadata({
        "source_id": src_id,
        "source_title": title,
        "source_url": url_or_path,
        "lang": lang,
        "approved_by": approved_by,
        "approved_date": approved_date,
        "page": page,
        "page_label": page_label,
        "page_start": page_start,
        "page_end": page_end
      })
      for _ in batch
    ]
    collection.add(ids=ids, documents=batch, embeddings=embeddings, metadatas=metadatas)
    total += len(batch)
  return total


def main() -> int:
  parser = argparse.ArgumentParser()
  parser.add_argument("--reset", action="store_true", help="Reset the collection")
  parser.add_argument("--reset-cache", action="store_true", help="Clear cached downloads")
  parser.add_argument("--refresh", action="store_true", help="Re-download sources even if cached")
  parser.add_argument("--max-sources", type=int, default=None)
  parser.add_argument("--max-pages", type=int, default=None)
  parser.add_argument("--chunk-chars", type=int, default=2000)
  parser.add_argument("--overlap-chars", type=int, default=200)
  parser.add_argument("--batch-size", type=int, default=32)
  parser.add_argument("--cache-dir", type=str, default=None)
  args = parser.parse_args()

  sources = load_sources()
  if not sources:
    print("No sources found.")
    return 1

  try:
    import chromadb
  except Exception:
    print("chromadb is required for ingestion. Install with: pip install chromadb")
    return 1

  cache_dir = get_cache_dir(args.cache_dir)
  if args.reset_cache and cache_dir.exists():
    for p in cache_dir.glob("*"):
      try:
        p.unlink()
      except Exception:
        pass

  chroma_path = get_chroma_path()
  Path(chroma_path).mkdir(parents=True, exist_ok=True)
  client = chromadb.PersistentClient(path=chroma_path)
  collection = client.get_or_create_collection(name="event_sources")
  if args.reset:
    try:
      collection.delete(where={})
    except Exception:
      pass

  total_chunks = 0
  max_sources = args.max_sources if args.max_sources and args.max_sources > 0 else None

  for idx, src in enumerate(sources):
    if max_sources and idx >= max_sources:
      break

    src_id = src.get("id")
    title = src.get("title", "")
    url_or_path = src.get("url_or_path", "")
    lang = src.get("lang", "")
    src_type = src.get("type", "")
    source_url = src.get("source_url", url_or_path)
    approved_by = src.get("approved_by", "")
    approved_date = src.get("approved_date", "")

    if not url_or_path:
      continue

    print(f"Ingesting {src_id} ({src_type})...")

    try:
      if url_or_path.startswith("http://") or url_or_path.startswith("https://"):
        ext = ".pdf" if src_type == "pdf" else ".html"
        cached = cache_dir / f"{src_id}{ext}"
        cached = fetch_url_to_cache(url_or_path, cached, args.refresh)
        path = cached
      else:
        path = Path(url_or_path)
        if not path.is_absolute():
          path = repo_root() / path
    except Exception as e:
      print(f"Failed to fetch {src_id}: {e}")
      continue

    if src_type == "pdf":
      try:
        reader = get_pdf_reader(path)
      except Exception as e:
        print(f"Failed to open PDF {src_id}: {e}")
        continue

      pages = reader.pages
      max_pages = args.max_pages if args.max_pages and args.max_pages > 0 else None
      for page_idx, page in enumerate(pages):
        if max_pages and page_idx >= max_pages:
          break
        try:
          text = page.extract_text() or ""
        except Exception:
          text = ""
        chunks = chunk_text_chars(text, chunk_chars=args.chunk_chars, overlap_chars=args.overlap_chars)
        if not chunks:
          continue
        total_chunks += ingest_chunks(
          collection,
          src_id=f"{src_id}-p{page_idx+1}",
          title=title,
          url_or_path=source_url,
          lang=lang,
          approved_by=approved_by,
          approved_date=approved_date,
          chunks=chunks,
          batch_size=args.batch_size,
          page=page_idx+1
        )
    else:
      try:
        if path.exists():
          if src_type == "txt":
            text = path.read_text(encoding="utf-8", errors="ignore")
          else:
            text = read_html_path(path)
        else:
          text = ""
      except Exception as e:
        print(f"Failed to read HTML {src_id}: {e}")
        continue
      chunks = chunk_text_chars(text, chunk_chars=args.chunk_chars, overlap_chars=args.overlap_chars)
      if not chunks:
        continue
      total_chunks += ingest_chunks(
        collection,
        src_id=src_id,
        title=title,
        url_or_path=source_url,
        lang=lang,
        approved_by=approved_by,
        approved_date=approved_date,
        chunks=chunks,
        batch_size=args.batch_size
      )

  print(f"Done. Total chunks: {total_chunks}. Chroma path: {chroma_path}")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
