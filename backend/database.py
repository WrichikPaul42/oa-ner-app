import sqlite3
import json
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from schemas import PatientRecord, PainMapEntry, PatientCreateRequest
from security import init_worker_table

DB_PATH = "oa_ner_local.db"


def get_db_connection(db_path: Optional[str] = None) -> sqlite3.Connection:
    if db_path is None:
        db_path = DB_PATH
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: Optional[str] = None):
    if db_path is None:
        db_path = DB_PATH
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # 1. Patient Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS Patient (
            patient_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            age INTEGER NOT NULL,
            gender TEXT NOT NULL,
            village_block TEXT NOT NULL,
            pain_map_json TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    # 2. Sensor Session Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS SensorSession (
            session_id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL,
            recorded_at TEXT NOT NULL,
            raw_stream_json TEXT NOT NULL,
            max_knee_flexion_deg REAL DEFAULT 0.0,
            extension_lag_deg REAL DEFAULT 0.0,
            risk_tier TEXT DEFAULT 'Low',
            contributing_factors_json TEXT DEFAULT '[]',
            FOREIGN KEY (patient_id) REFERENCES Patient(patient_id)
        )
    """)

    conn.commit()

    # 3. Worker Auth Table
    init_worker_table(conn)

    conn.close()


def save_patient(conn: sqlite3.Connection, patient_data: PatientCreateRequest) -> PatientRecord:
    """Creates a new patient record and saves it to SQLite."""
    patient_id = f"pat-{uuid.uuid4().hex[:8]}"
    created_at = datetime.now(timezone.utc).isoformat()
    pain_map_json = json.dumps([p.model_dump() for p in patient_data.pain_map])

    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO Patient (patient_id, name, age, gender, village_block, pain_map_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        patient_id,
        patient_data.name,
        patient_data.age,
        patient_data.gender,
        patient_data.village_block,
        pain_map_json,
        created_at
    ))
    conn.commit()

    return get_patient_by_id(conn, patient_id)


def get_patient_by_id(conn: sqlite3.Connection, patient_id: str) -> Optional[PatientRecord]:
    """Retrieves a single patient record adhering to Contract 2."""
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM Patient WHERE patient_id = ?", (patient_id,))
    patient_row = cursor.fetchone()
    if not patient_row:
        return None

    # Fetch associated session IDs
    cursor.execute("SELECT session_id FROM SensorSession WHERE patient_id = ? ORDER BY recorded_at DESC", (patient_id,))
    session_rows = cursor.fetchall()
    session_ids = [row["session_id"] for row in session_rows]

    pain_map_raw = json.loads(patient_row["pain_map_json"]) if patient_row["pain_map_json"] else []
    pain_map = [PainMapEntry(**item) for item in pain_map_raw]

    return PatientRecord(
        patient_id=patient_row["patient_id"],
        name=patient_row["name"],
        age=patient_row["age"],
        gender=patient_row["gender"],
        village_block=patient_row["village_block"],
        pain_map=pain_map,
        sessions=session_ids
    )


def list_patients(conn: sqlite3.Connection) -> List[PatientRecord]:
    """Lists all saved patient records adhering to Contract 2."""
    cursor = conn.cursor()
    cursor.execute("SELECT patient_id FROM Patient ORDER BY created_at DESC")
    rows = cursor.fetchall()
    
    patients = []
    for r in rows:
        p = get_patient_by_id(conn, r["patient_id"])
        if p:
            patients.append(p)
    return patients


def save_sensor_session(
    conn: sqlite3.Connection,
    session_id: str,
    patient_id: str,
    recorded_at: str,
    raw_stream: List[Dict[str, Any]],
    max_knee_flexion_deg: float = 0.0,
    extension_lag_deg: float = 0.0,
    risk_tier: str = "Low",
    contributing_factors: List[str] = None
) -> str:
    """Saves or updates a sensor session record in SQLite."""
    if contributing_factors is None:
        contributing_factors = []

    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO SensorSession (
            session_id, patient_id, recorded_at, raw_stream_json,
            max_knee_flexion_deg, extension_lag_deg, risk_tier, contributing_factors_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
            raw_stream_json = excluded.raw_stream_json,
            max_knee_flexion_deg = excluded.max_knee_flexion_deg,
            extension_lag_deg = excluded.extension_lag_deg,
            risk_tier = excluded.risk_tier,
            contributing_factors_json = excluded.contributing_factors_json
    """, (
        session_id,
        patient_id,
        recorded_at,
        json.dumps(raw_stream),
        max_knee_flexion_deg,
        extension_lag_deg,
        risk_tier,
        json.dumps(contributing_factors)
    ))
    conn.commit()
    return session_id


def get_session_by_id(conn: sqlite3.Connection, session_id: str) -> Optional[Dict[str, Any]]:
    """Fetches a session row by ID."""
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM SensorSession WHERE session_id = ?", (session_id,))
    row = cursor.fetchone()
    if not row:
        return None

    return {
        "session_id": row["session_id"],
        "patient_id": row["patient_id"],
        "recorded_at": row["recorded_at"],
        "raw_stream": json.loads(row["raw_stream_json"]),
        "max_knee_flexion_deg": row["max_knee_flexion_deg"],
        "extension_lag_deg": row["extension_lag_deg"],
        "risk_tier": row["risk_tier"],
        "contributing_factors": json.loads(row["contributing_factors_json"])
    }
