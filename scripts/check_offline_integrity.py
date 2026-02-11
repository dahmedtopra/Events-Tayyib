#!/usr/bin/env python3
import json
import sys
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[1]
OFFLINE_PACK = ROOT / "data" / "offline_pack" / "offline_pack.json"
SOURCES = ROOT / "data" / "rag_corpus" / "sources.yml"


def load_offline_entries(path: Path):
  data = json.loads(path.read_text(encoding="utf-8"))
  if isinstance(data, list):
    return data
  if isinstance(data, dict) and isinstance(data.get("entries"), list):
    return data["entries"]
  return []


def main() -> int:
  if not OFFLINE_PACK.exists():
    print(f"ERROR: Missing offline pack at {OFFLINE_PACK}")
    return 2
  if not SOURCES.exists():
    print(f"ERROR: Missing sources file at {SOURCES}")
    return 2

  entries = load_offline_entries(OFFLINE_PACK)
  source_obj = yaml.safe_load(SOURCES.read_text(encoding="utf-8")) or {}
  valid_ids = {s.get("id") for s in source_obj.get("sources", []) if s.get("id")}

  failures = []
  for entry in entries:
    entry_id = entry.get("id", "<unknown>")
    source_ids = entry.get("source_ids")
    if not isinstance(source_ids, list) or not source_ids:
      failures.append(f"{entry_id}: missing source_ids")
      continue
    missing = [sid for sid in source_ids if sid not in valid_ids]
    if missing:
      failures.append(f"{entry_id}: invalid source_ids={missing}")

  if failures:
    print("Offline integrity check failed:")
    for item in failures:
      print(f"- {item}")
    return 1

  print(f"Offline integrity check passed ({len(entries)} entries)")
  return 0


if __name__ == "__main__":
  sys.exit(main())
