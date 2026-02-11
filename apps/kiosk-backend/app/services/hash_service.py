import os
import hashlib

DEFAULT_DEV_SALT = "dev-salt-not-for-production"


def get_hash_salt() -> str:
  salt = os.getenv("QUERY_HASH_SALT")
  if salt and salt.strip():
    return salt
  return DEFAULT_DEV_SALT


def hash_query(query: str) -> str:
  normalized = query.strip().lower()
  salted = (normalized + get_hash_salt()).encode("utf-8")
  return hashlib.sha256(salted).hexdigest()
