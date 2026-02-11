#!/usr/bin/env python3
import argparse
import os
import socket
from pathlib import Path
from urllib.request import urlopen
from urllib.error import URLError


ROOT = Path(__file__).resolve().parents[4]
REQUIRED_ENV = ["OPENAI_API_KEY", "OPENAI_MODEL", "OPENAI_EMBED_MODEL", "ALLOWED_ORIGINS"]
REQUIRED_FILES = [
    ROOT / "data" / "offline_pack" / "offline_pack.json",
    ROOT / "data" / "chroma_index" / "chroma.sqlite3",
]


def load_env_files():
    values = {}
    env_paths = [ROOT / ".env", ROOT / "apps" / "kiosk-backend" / ".env"]
    for env_path in env_paths:
        if not env_path.exists():
            continue
        for line in env_path.read_text(encoding="utf-8").splitlines():
            raw = line.strip()
            if not raw or raw.startswith("#") or "=" not in raw:
                continue
            key, val = raw.split("=", 1)
            values[key.strip()] = val.strip().strip('"').strip("'")
    return values


def check_port(host: str, port: int) -> bool:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(0.5)
    try:
        return s.connect_ex((host, port)) == 0
    finally:
        s.close()


def check_http(url: str) -> bool:
    try:
        with urlopen(url, timeout=2) as resp:  # nosec B310
            return 200 <= resp.status < 400
    except URLError:
        return False


def emit(status: str, label: str, detail: str = ""):
    suffix = f" - {detail}" if detail else ""
    print(f"{status}: {label}{suffix}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Run kiosk event readiness checks.")
    parser.add_argument("--check-http", action="store_true", help="Check local HTTP endpoints")
    args = parser.parse_args()

    failures = 0
    env_values = load_env_files()

    print("Event readiness report")
    print("======================")

    for key in REQUIRED_ENV:
        if env_values.get(key):
            emit("PASS", f"env {key}")
        else:
            emit("FAIL", f"env {key}", "missing or empty")
            failures += 1

    for path in REQUIRED_FILES:
        if path.exists():
            emit("PASS", f"file {path.relative_to(ROOT)}")
        else:
            emit("FAIL", f"file {path.relative_to(ROOT)}", "not found")
            failures += 1

    if check_port("127.0.0.1", 8006):
        emit("PASS", "backend port 8006")
    else:
        emit("WARN", "backend port 8006", "not listening")

    if check_port("127.0.0.1", 5176):
        emit("PASS", "frontend port 5176")
    else:
        emit("WARN", "frontend port 5176", "not listening")

    if args.check_http:
        endpoints = [
            ("backend health", "http://127.0.0.1:8006/api/health"),
            ("backend version", "http://127.0.0.1:8006/api/version"),
            ("frontend root", "http://localhost:5176"),
        ]
        for label, url in endpoints:
            if check_http(url):
                emit("PASS", label, url)
            else:
                emit("FAIL", label, url)
                failures += 1

    print("")
    print(f"Summary: {failures} hard failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())

