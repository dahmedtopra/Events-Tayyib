import os
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional

def default_sqlite_path() -> str:
  repo_root = Path(__file__).resolve().parents[4]
  return str(repo_root / "data" / "analytics.sqlite")

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  lang TEXT,
  mode TEXT NOT NULL,
  rating_1_5 INTEGER,
  time_on_screen_ms INTEGER,
  route_used TEXT,
  confidence REAL,
  sources_count INTEGER,
  error_code TEXT,
  latency_ms INTEGER,
  hashed_query TEXT,
  ts TEXT NOT NULL
);
"""

SESSION_COUNTER_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS session_message_counts (
  session_id TEXT PRIMARY KEY,
  user_messages_count INTEGER NOT NULL DEFAULT 0,
  updated_ts TEXT NOT NULL
);
"""


def get_sqlite_path() -> str:
  return os.getenv("SQLITE_PATH", default_sqlite_path())


def init_db() -> None:
  path = get_sqlite_path()
  Path(path).parent.mkdir(parents=True, exist_ok=True)
  conn = sqlite3.connect(path)
  try:
    conn.execute(SCHEMA_SQL)
    conn.execute(SESSION_COUNTER_SCHEMA_SQL)
    # best-effort add missing columns
    for col_def in [
      "lang TEXT",
      "confidence REAL",
      "sources_count INTEGER",
      "error_code TEXT"
    ]:
      try:
        conn.execute(f"ALTER TABLE analytics ADD COLUMN {col_def}")
      except Exception:
        pass
    conn.commit()
  finally:
    conn.close()


def consume_session_user_message_slot(session_id: str, max_messages: int) -> tuple[bool, int]:
  """
  Atomically consume one attendee/user message slot for a session.
  Returns (allowed, current_count).
  """
  limit = max_messages if isinstance(max_messages, int) and max_messages > 0 else 15
  now = datetime.utcnow().isoformat() + "Z"
  key = (session_id or "").strip() or "unknown-session"

  conn = sqlite3.connect(get_sqlite_path())
  try:
    conn.execute(SESSION_COUNTER_SCHEMA_SQL)
    conn.execute(
      """
      INSERT OR IGNORE INTO session_message_counts (session_id, user_messages_count, updated_ts)
      VALUES (?, 0, ?)
      """,
      (key, now)
    )
    cur = conn.execute(
      """
      UPDATE session_message_counts
      SET user_messages_count = user_messages_count + 1,
          updated_ts = ?
      WHERE session_id = ?
        AND user_messages_count < ?
      """,
      (now, key, limit)
    )
    row = conn.execute(
      "SELECT user_messages_count FROM session_message_counts WHERE session_id = ?",
      (key,)
    ).fetchone()
    conn.commit()
    count = int(row[0]) if row else 0
    return cur.rowcount == 1, count
  finally:
    conn.close()


def insert_analytics(
  session_id: str,
  mode: str,
  lang: str | None,
  rating_1_5: int | None,
  time_on_screen_ms: int | None,
  route_used: str | None,
  confidence: float | None,
  sources_count: int | None,
  error_code: str | None,
  latency_ms: int | None,
  hashed_query: str | None
) -> None:
  conn = sqlite3.connect(get_sqlite_path())
  try:
    conn.execute(
      """
      INSERT INTO analytics
        (session_id, lang, mode, rating_1_5, time_on_screen_ms, route_used, confidence, sources_count, error_code, latency_ms, hashed_query, ts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      """,
      (
        session_id,
        lang,
        mode,
        rating_1_5,
        time_on_screen_ms,
        route_used,
        confidence,
        sources_count,
        error_code,
        latency_ms,
        hashed_query,
        datetime.utcnow().isoformat() + "Z"
      )
    )
    conn.commit()
  finally:
    conn.close()
