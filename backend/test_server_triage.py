import pytest
from fastapi.testclient import TestClient
import sys
from pathlib import Path

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from src.server import app
from src.features.tier_c import calculate_indian_context_features

client = TestClient(app)


def test_calculate_indian_context_features():
    # Patient: 60kg, 160cm (1.6m), no load
    res = calculate_indian_context_features(weight=60.0, height=160.0, daily_load=0.0)
    assert res["standard_bmi"] == 23.44
    assert res["effective_bmi"] == 23.44
    assert res["who_asian_bmi_category"] == "Overweight"
    assert res["mechanical_overload_flag"] is False

    # Patient: 60kg, 160cm, carrying 15kg daily load
    # Effective weight = 75kg -> 75 / (1.6^2) = 29.30
    res_load = calculate_indian_context_features(weight=60.0, height=160.0, daily_load=15.0)
    assert res_load["standard_bmi"] == 23.44
    assert res_load["effective_bmi"] == 29.3
    assert res_load["who_asian_bmi_category"] == "Obese"
    assert res_load["mechanical_overload_flag"] is True


def test_triage_endpoint_full_payload():
    payload = {
        "patient_id": "pat_test_001",
        "tier_a": {
            "age": 62,
            "sex": "female",
            "height_cm": 155.0,
            "weight_kg": 65.0,
            "daily_load_kg": 18.0,
            "daily_incline_hours": 3.0,
            "squatting_difficulty": 3,
            "previous_injury": 0,
            "activity_level": 3
        },
        "tier_b": {
            "flat_gait_cadence": 82.0,
            "flat_gait_stride_time_cv": 0.095,
            "climbing_cadence": 70.0,
            "climbing_stride_time_cv": 0.15,
            "gait_step_time_asymmetry": 0.18,
            "gait_swing_time_asymmetry": 0.12,
            "gait_speed_ms": 0.78,
            "strength_ext_peak_n": 160.0,
            "strength_flex_peak_n": 95.0,
            "strength_ext_bw_ratio": 2.46,
            "strength_hq_ratio": 0.59,
            "rom_active_flexion_deg": 108.0,
            "rom_active_extension_deficit_deg": 8.0,
            "rom_passive_flexion_deg": 115.0,
            "crepitus_event_count": 14.0,
            "crepitus_total_energy": 3200.0,
            "crepitus_mean_energy": 228.5,
            "crepitus_presence": 1.0,
            "affected_side": "right"
        }
    }

    response = client.post("/triage/", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["patient_id"] == "pat_test_001"
    assert data["risk_score"] > 60.0
    assert data["risk_category"] in ("High", "Severe")
    assert "effective_bmi" in data["tier_c"]
    assert data["tier_c"]["effective_bmi"] > data["tier_c"]["standard_bmi"]
    assert "effective_bmi" in data["feature_importance"]
    assert len(data["primary_drivers"]) > 0
    assert len(data["recommendations"]) > 0
    assert data["missing_modality_count"] == 0


def test_triage_endpoint_fault_tolerant_empty_tier_b():
    """Verify that all tier_b fields allow None and payload succeeds with no sensors."""
    payload = {
        "patient_id": "pat_test_no_sensors",
        "tier_a": {
            "age": 42,
            "sex": "male",
            "height_cm": 172.0,
            "weight_kg": 70.0,
            "daily_load_kg": 0.0,
            "daily_incline_hours": 0.0,
            "squatting_difficulty": 0,
            "previous_injury": 0,
            "activity_level": 2
        },
        "tier_b": {}  # All fields default to None
    }

    response = client.post("/triage/", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["patient_id"] == "pat_test_no_sensors"
    assert data["risk_score"] < 50.0
    assert data["risk_category"] in ("Low", "Moderate")
    assert data["missing_modality_count"] > 10
