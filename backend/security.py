import hashlib
import sqlite3
from typing import Optional

DEFAULT_PIN = "1234"


def hash_pin(pin: str, salt: str = "oa_ner_salt_2026") -> str:
    """Hashes a PIN string using SHA-256 with a salt."""
    salted_pin = f"{salt}:{pin}"
    return hashlib.sha256(salted_pin.encode("utf-8")).hexdigest()


def init_worker_table(conn: sqlite3.Connection):
    """Initializes the Worker table and inserts a default admin worker if empty."""
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS Worker (
            worker_id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            pin_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)
    conn.commit()

    # Seed default worker if table is empty
    cursor.execute("SELECT COUNT(*) FROM Worker")
    count = cursor.fetchone()[0]
    if count == 0:
        default_hash = hash_pin(DEFAULT_PIN)
        cursor.execute(
            "INSERT INTO Worker (worker_id, username, pin_hash, created_at) VALUES (?, ?, ?, datetime('now'))",
            ("wkr-001", "health_worker_1", default_hash)
        )
        conn.commit()


def authenticate_worker(conn: sqlite3.Connection, pin: str) -> bool:
    """Validates the input PIN against hashes stored in the Worker table."""
    incoming_hash = hash_pin(pin)
    cursor = conn.cursor()
    cursor.execute("SELECT worker_id FROM Worker WHERE pin_hash = ?", (incoming_hash,))
    row = cursor.fetchone()
    return row is not None
