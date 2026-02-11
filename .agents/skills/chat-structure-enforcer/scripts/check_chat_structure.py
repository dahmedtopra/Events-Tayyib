#!/usr/bin/env python3
import argparse
import json
import re
from pathlib import Path


HEADING_PATTERNS = [
    r"^#{1,3}\s*(Direct Answer|Reponse directe|الاجابة المباشرة)\b",
    r"^#{1,3}\s*(Steps|Etapes|الخطوات)\b",
    r"^#{1,3}\s*(Common Mistakes|Erreurs courantes|اخطاء شائعة)\b",
]


def read_input(path: Path) -> str:
    text = path.read_text(encoding="utf-8").strip()
    # If JSON payload is provided, extract a likely message field.
    if text.startswith("{") or text.startswith("["):
        try:
            data = json.loads(text)
            if isinstance(data, dict):
                for key in ("content", "answer", "direct", "text"):
                    if isinstance(data.get(key), str):
                        return data[key]
            if isinstance(data, list) and data and isinstance(data[0], dict):
                for key in ("content", "answer", "direct", "text"):
                    if isinstance(data[0].get(key), str):
                        return data[0][key]
        except json.JSONDecodeError:
            pass
    return text


def main() -> int:
    parser = argparse.ArgumentParser(description="Check chat response structure.")
    parser.add_argument("--file", required=True, help="Text or JSON file containing a response")
    args = parser.parse_args()

    content = read_input(Path(args.file))
    if not content:
        print("FAIL: Empty content")
        return 1

    failures = []
    for pattern in HEADING_PATTERNS:
        if not re.search(pattern, content, re.IGNORECASE | re.MULTILINE):
            failures.append(f"Missing heading pattern: {pattern}")

    bullet_count = len(re.findall(r"^\s*[-*]\s+.+$", content, re.MULTILINE))
    if bullet_count == 0:
        failures.append("Missing bullet points")

    paragraph_lines = [ln.strip() for ln in content.splitlines() if ln.strip()]
    if len(paragraph_lines) <= 2 and bullet_count == 0:
        failures.append("Looks like a single-paragraph response")

    if failures:
        print("FAIL: structure check failed")
        for f in failures:
            print(f"- {f}")
        return 1

    print("PASS: structure check passed")
    print(f"- bullets: {bullet_count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

