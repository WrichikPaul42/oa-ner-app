import os
import sqlite3
import pytest
from fastapi.testclient import TestClient

import database
from database import init_db, get_db_connection, save_patient, get_patient_by_id, list_patients
from security import authenticate_worker, hash_pin
from schemas import PatientCreateRequest, PainMapEntry
from risk_engine import assess_risk, derive_biomechanics
from udp_manager import validate_contract_1, generate_simulated_stream, UdpSessionManager
from main import app

TEST_DB_PATH = "test_oa_ner.db"


@pytest.fixture(autouse=True)
def setup_test_database():
    """Sets up a clean test database before each test."""
    database.DB_PATH = TEST_DB_PATH
    if os.path.exists(TEST_DB_PATH):
        try:
            os.remove(TEST_DB_PATH)
        except OSError:
            pass

    init_db(TEST_DB_PATH)
    yield
    if os.path.exists(TEST_DB_PATH):
        try:
            os.remove(TEST_DB_PATH)
        except OSError:
            pass


def test_pin_authentication():
    conn = get_db_connection(TEST_DB_PATH)
    # Default PIN is 1234
    assert authenticate_worker(conn, "1234") is True
    assert authenticate_worker(conn, "9999") is False
    conn.close()


def test_patient_crud_contract_2():
    conn = get_db_connection(TEST_DB_PATH)
    patient_req = PatientCreateRequest(
        name="Bhaben Kalita",
        age=62,
        gender="Male",
        village_block="Guwahati-Central",
        pain_map=[PainMapEntry(body_region="Left Knee - Lateral", pain_level=7)]
    )

    created = save_patient(conn, patient_req)
    assert created.patient_id.startswith("pat-")
    assert created.name == "Bhaben Kalita"
    assert len(created.pain_map) == 1
    assert created.pain_map[0].pain_level == 7
    assert created.sessions == []

    fetched = get_patient_by_id(conn, created.patient_id)
    assert fetched is not None
    assert fetched.patient_id == created.patient_id
    assert fetched.name == "Bhaben Kalita"

    all_patients = list_patients(conn)
    assert len(all_patients) == 1
    conn.close()


def test_contract_1_validation():
    valid_reading = {
        "node_id": "node_left",
        "patient_id": "pat-001",
        "timestamp": "2026-09-06T20:00:00Z",
        "flex_resistance": 500,
        "mpu_accel": {"x": 0.0, "y": 1.0, "z": 0.0},
        "mpu_gyro": {"x": 0.0, "y": 0.0, "z": 0.0}
    }
    assert validate_contract_1(valid_reading) is True

    invalid_reading = {
        "patient_id": "pat-001",
        "flex_resistance": 500
    }
    assert validate_contract_1(invalid_reading) is False


def test_risk_engine_contract_3():
    # Test session data with low flexion (<90) and high extension lag (>15)
    session_data = {
        "session_id": "sess-test-01",
        "patient_id": "pat-test-01",
        "max_knee_flexion_deg": 80.0,
        "extension_lag_deg": 20.0,
        "raw_stream": [
            {
                "node_id": "node_left",
                "patient_id": "pat-test-01",
                "timestamp": "2026-09-06T20:00:00Z",
                "flex_resistance": 400,
                "mpu_accel": {"x": 0.0, "y": 1.0, "z": 0.0},
                "mpu_gyro": {"x": 0.5, "y": 0.0, "z": 0.0}
            }
        ]
    }

    pain_map = [PainMapEntry(body_region="Right Knee", pain_level=4)]
    res = assess_risk(session_data, pain_map)

    assert res["session_id"] == "sess-test-01"
    assert res["patient_id"] == "pat-test-01"
    assert res["risk_tier"] == "High"
    assert res["max_knee_flexion_deg"] == 80.0
    assert res["extension_lag_deg"] == 20.0
    assert res["advice_key"] == "risk_high_advice"
    assert len(res["session_chart_data"]) == 1
    assert res["session_chart_data"][0]["gyro_x"] == 0.5


def test_risk_engine_severe_pain_escalation():
    # Moderate kinematic data escalated to High by pain level 9
    session_data = {
        "session_id": "sess-test-02",
        "patient_id": "pat-test-02",
        "max_knee_flexion_deg": 105.0,
        "extension_lag_deg": 10.0,
        "raw_stream": []
    }
    pain_map = [PainMapEntry(body_region="Right Knee", pain_level=9)]
    res = assess_risk(session_data, pain_map)

    # Moderate escalated to High due to pain score 9
    assert res["risk_tier"] == "High"
    assert any("Severe localized pain" in f for f in res["contributing_factors"])


def test_fastapi_endpoints():
    client = TestClient(app)

    # 1. Auth Endpoint
    auth_resp = client.post("/api/auth/login", json={"pin": "1234"})
    assert auth_resp.status_code == 200
    assert auth_resp.json()["success"] is True

    bad_auth = client.post("/api/auth/login", json={"pin": "0000"})
    assert bad_auth.status_code == 200
    assert bad_auth.json()["success"] is False

    # 2. Patient Creation (Contract 2)
    pat_resp = client.post("/api/patients", json={
        "name": "Ananya Baruah",
        "age": 45,
        "gender": "Female",
        "village_block": "Dispur-02",
        "pain_map": [{"body_region": "Knee", "pain_level": 6}]
    })
    assert pat_resp.status_code == 201
    pat_data = pat_resp.json()
    assert pat_data["name"] == "Ananya Baruah"
    pat_id = pat_data["patient_id"]

    # 3. Contract Mocks Endpoint
    mocks_resp = client.get("/api/contracts/mocks")
    assert mocks_resp.status_code == 200
    mocks_json = mocks_resp.json()
    assert "Contract_1_LiveSensorStream" in mocks_json
    assert "node_id" in mocks_json["Contract_1_LiveSensorStream"]
    assert "Contract_2_SavedPatientRecord" in mocks_json
    assert "Contract_3_RiskAssessmentResult" in mocks_json

    # 4. Start Stream Session (Simulated Dual-Node UDP)
    stream_resp = client.post(f"/api/sessions/start-stream?patient_id={pat_id}&duration_seconds=1.0&simulated=true")
    assert stream_resp.status_code == 200
    res_json = stream_resp.json()
    assert "session_id" in res_json
    assert res_json["risk_assessment"]["patient_id"] == pat_id


def test_kneeva_triage_contract():
    client = TestClient(app)
    triage_payload = {
        "patient_id": "PT-10045",
        "patient_metadata": {
            "age": 55,
            "sex": "female",
            "height_cm": 158.0,
            "weight_kg": 62.0
        },
        "questionnaire": {
            "carried_load_kg": 15.0,
            "daily_incline_hours": 2.5,
            "squatting_difficulty": 3,
            "previous_injury": 0,
            "activity_level": 3
        },
        "sensor_features": {
            "rom_active_flexion_deg": 115.0,
            "rom_active_extension_deficit_deg": 5.0,
            "rom_passive_flexion_deg": 120.0,
            "rom_flexion_deficit_deg": 25.0,
            "crepitus_event_count": 4.0,
            "crepitus_total_energy": 18.5,
            "crepitus_mean_energy": 4.6,
            "crepitus_presence": 1.0,
            "cocontraction_cci_walking_mean": 0.45,
            "strength_ext_peak_n": 220.0,
            "strength_flex_peak_n": 140.0,
            "strength_ext_bw_ratio": 3.5,
            "strength_hq_ratio": 0.63,
            "gait_step_time_asymmetry": 0.12,
            "gait_swing_time_asymmetry": 0.08,
            "flat_gait_cadence": 98.5,
            "flat_gait_stride_time_cv": 0.04,
            "climbing_cadence": 82.0,
            "climbing_stride_time_cv": 0.11,
            "gait_speed_ms": 0.95,
            "neuro_rf_activation_duration_pct": 42.0,
            "neuro_bf_activation_duration_pct": 38.0,
            "neuro_onset_emg_to_heelstrike_ms": 110.0,
            "strength_ext_bw_ratio_general": 3.5,
            "strength_general_weakness_flag": 1.0,
            "strength_general_z_score": -1.2,
            "injury_previous_knee_injury": 0.0,
            "injury_acl_history": 0.0,
            "injury_meniscal_history": 0.0
        }
    }

    resp = client.post("/api/v1/triage", json=triage_payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["patient_id"] == "PT-10045"
    assert "oa_risk_score" in data
    assert "oa_risk_category" in data
    assert "confidence_interval" in data
    assert len(data["confidence_interval"]) == 2
    assert "feature_importance" in data
    assert "clinical_explanation" in data
    assert "clinical_action" in data
    assert "effective_bmi" in data
    assert data["effective_bmi"] > 0
    assert data["missing_modality_count"] == 0


def test_kneeva_triage_missing_modalities():
    client = TestClient(app)
    # Clinic without sEMG or Dynamometer (only IMU and demographics)
    triage_payload = {
        "patient_id": "PT-FIELD-99",
        "patient_metadata": {
            "age": 60,
            "sex": "male",
            "height_cm": 170.0,
            "weight_kg": 75.0
        },
        "questionnaire": {
            "carried_load_kg": 20.0,
            "daily_incline_hours": 3.0,
            "squatting_difficulty": 4,
            "previous_injury": 1,
            "activity_level": 4
        },
        "sensor_features": {
            "flat_gait_cadence": 88.0,
            "flat_gait_stride_time_cv": 0.09,
            "climbing_cadence": 74.0,
            "climbing_stride_time_cv": 0.14,
            # Dynamometer, Crepitus, sEMG left as None / omitted
        }
    }

    resp = client.post("/api/v1/triage", json=triage_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["patient_id"] == "PT-FIELD-99"
    assert data["missing_modality_count"] == 4  # only IMU present, 4 missing
    assert data["oa_risk_category"] == "high"


if __name__ == "__main__":
    pytest.main(["-v", "test_backend.py"])
