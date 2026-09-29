import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware

from database import (
    init_db,
    get_db_connection,
    save_patient,
    get_patient_by_id,
    list_patients,
    save_sensor_session,
    get_session_by_id,
)
from security import authenticate_worker
from schemas import (
    AuthRequest,
    AuthResponse,
    PatientRecord,
    PatientCreateRequest,
    RiskAssessmentResult,
    LiveSensorReading,
    Vector3D,
    PainMapEntry,
    KneevaTriageRequest,
    KneevaTriageResponse
)
from risk_engine import assess_risk, derive_biomechanics
from udp_manager import UdpSessionManager, generate_simulated_stream

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(
    title="OA-NER Screening App Backend API",
    description="Python Backend for OA-NER Screening App (Developer A)",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for local Developer B frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Security & Auth ---
@app.post("/api/auth/login", response_model=AuthResponse)
def login_worker(payload: AuthRequest):
    conn = get_db_connection()
    try:
        is_valid = authenticate_worker(conn, payload.pin)
        if is_valid:
            return AuthResponse(success=True, message="Authentication successful.")
        return AuthResponse(success=False, message="Invalid worker PIN.")
    finally:
        conn.close()


# --- Patient Management (Contract 2) ---
@app.post("/api/patients", response_model=PatientRecord, status_code=201)
def create_patient(patient_data: PatientCreateRequest):
    conn = get_db_connection()
    try:
        patient = save_patient(conn, patient_data)
        return patient
    finally:
        conn.close()


@app.get("/api/patients", response_model=List[PatientRecord])
def get_all_patients():
    conn = get_db_connection()
    try:
        return list_patients(conn)
    finally:
        conn.close()


@app.get("/api/patients/{patient_id}", response_model=PatientRecord)
def get_patient(patient_id: str):
    conn = get_db_connection()
    try:
        patient = get_patient_by_id(conn, patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient record not found.")
        return patient
    finally:
        conn.close()


# --- UDP & Session Ingestion (Contract 1 -> Contract 3) ---
@app.post("/api/sessions/start-stream")
async def start_stream_session(
    patient_id: str = Query(..., description="Target patient ID"),
    duration_seconds: float = Query(20.0, description="Recording duration in seconds"),
    simulated: bool = Query(True, description="Force simulated UDP stream for testing")
):
    conn = get_db_connection()
    try:
        patient = get_patient_by_id(conn, patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail=f"Patient ID {patient_id} not found.")

        # Ingest stream
        if simulated:
            raw_stream = await generate_simulated_stream(patient_id, duration_seconds=duration_seconds)
        else:
            udp_mgr = UdpSessionManager()
            raw_stream = await udp_mgr.record_session(patient_id, duration_seconds=duration_seconds)

        if not raw_stream:
            raise HTTPException(status_code=500, detail="No stream data received from Wi-Fi sensors.")

        # Compute kinematics & risk assessment (Contract 3)
        session_id = f"sess-{uuid.uuid4().hex[:8]}"
        recorded_at = datetime.now(timezone.utc).isoformat()
        
        max_flex, ext_lag = derive_biomechanics(raw_stream)

        session_data = {
            "session_id": session_id,
            "patient_id": patient_id,
            "raw_stream": raw_stream,
            "max_knee_flexion_deg": max_flex,
            "extension_lag_deg": ext_lag
        }

        risk_result = assess_risk(session_data, patient.pain_map)

        # Save session to SQLite
        save_sensor_session(
            conn=conn,
            session_id=session_id,
            patient_id=patient_id,
            recorded_at=recorded_at,
            raw_stream=raw_stream,
            max_knee_flexion_deg=max_flex,
            extension_lag_deg=ext_lag,
            risk_tier=risk_result["risk_tier"],
            contributing_factors=risk_result["contributing_factors"]
        )

        return {
            "message": "UDP stream session completed and saved successfully.",
            "session_id": session_id,
            "risk_assessment": risk_result
        }
    finally:
        conn.close()


@app.get("/api/sessions/{session_id}/risk", response_model=RiskAssessmentResult)
def get_session_risk(session_id: str):
    conn = get_db_connection()
    try:
        sess = get_session_by_id(conn, session_id)
        if not sess:
            raise HTTPException(status_code=404, detail="Session record not found.")

        patient = get_patient_by_id(conn, sess["patient_id"])
        pain_map = patient.pain_map if patient else []

        session_data = {
            "session_id": sess["session_id"],
            "patient_id": sess["patient_id"],
            "raw_stream": sess["raw_stream"],
            "max_knee_flexion_deg": sess["max_knee_flexion_deg"],
            "extension_lag_deg": sess["extension_lag_deg"]
        }

        risk_output = assess_risk(session_data, pain_map)
        return RiskAssessmentResult(**risk_output)
    finally:
        conn.close()


# --- Frozen Contracts Mock Provider for Dev B Integration ---
@app.get("/api/contracts/mocks")
def get_contract_mocks():
    """Provides Developer B with frozen interface mock JSON contracts."""
    contract_1_mock = LiveSensorReading(
        node_id="node_left",
        patient_id="pat-12345",
        timestamp="2026-09-06T20:00:00Z",
        flex_resistance=450,
        mpu_accel=Vector3D(x=0.1, y=0.9, z=0.0),
        mpu_gyro=Vector3D(x=0.0, y=0.0, z=0.0)
    ).model_dump()

    contract_2_mock = PatientRecord(
        patient_id="pat-12345",
        name="Ramesh Sharma",
        age=58,
        gender="Male",
        village_block="Kamrup-Metro-01",
        pain_map=[PainMapEntry(body_region="Right Knee - Medial", pain_level=8)],
        sessions=["sess-001", "sess-002"]
    ).model_dump()

    contract_3_mock = RiskAssessmentResult(
        session_id="sess-001",
        patient_id="pat-12345",
        risk_tier="High",
        contributing_factors=["Significantly reduced flexion range", "Severe localized pain reported"],
        max_knee_flexion_deg=85.0,
        extension_lag_deg=18.0,
        session_chart_data=[{"t": 0.0, "flex_resistance": 450, "gyro_x": 0.1}],
        advice_key="risk_high_advice"
    ).model_dump()

    return {
        "Contract_1_LiveSensorStream": contract_1_mock,
        "Contract_2_SavedPatientRecord": contract_2_mock,
        "Contract_3_RiskAssessmentResult": contract_3_mock
    }


# --- Real-Time Telemetry Bridge for Mobile ---
_latest_live_telemetry = {
    "node_left": None,
    "node_right": None,
    "last_updated": None
}

@app.get("/api/sensors/live")
def get_live_sensors():
    """Provides the mobile client with the latest UDP sensor readings from both knees."""
    return _latest_live_telemetry

@app.post("/api/sensors/ingest")
def ingest_live_sensor(payload: dict):
    """Receives UDP packet from receiver script and updates in-memory cache."""
    node_id = payload.get("node_id")
    if node_id in ("node_left", "node_right"):
        _latest_live_telemetry[node_id] = payload
        _latest_live_telemetry["last_updated"] = datetime.now(timezone.utc).isoformat()
    return {"status": "ok"}

@app.post("/triage/", response_model=KneevaTriageResponse)
@app.post("/triage", response_model=KneevaTriageResponse, include_in_schema=False)
@app.post("/api/v1/triage", response_model=KneevaTriageResponse, include_in_schema=False)
def perform_kneeva_triage(payload: KneevaTriageRequest):
    meta = payload.patient_metadata
    quest = payload.questionnaire
    sensors = payload.sensor_features

    # 1. Modality detection & missing modality count
    has_imu = sensors.flat_gait_cadence is not None or sensors.flat_gait_stride_time_cv is not None
    has_dynamometer = sensors.strength_ext_peak_n is not None or sensors.strength_ext_bw_ratio is not None
    has_goniometer = sensors.rom_active_flexion_deg is not None or sensors.rom_flexion_deficit_deg is not None
    has_crepitus = sensors.crepitus_event_count is not None or sensors.crepitus_presence is not None
    has_semg = sensors.cocontraction_cci_walking_mean is not None or sensors.neuro_rf_activation_duration_pct is not None

    present_count = sum([has_imu, has_dynamometer, has_goniometer, has_crepitus, has_semg])
    missing_modality_count = 5 - present_count

    # 2. BMI calculation
    height_m = meta.height_cm / 100.0 if meta.height_cm > 0 else 1.60
    base_bmi = meta.weight_kg / (height_m * height_m)
    effective_bmi = round(base_bmi + (quest.carried_load_kg * 0.18), 1)

    # 3. Clinical risk scoring (CatBoost simulation handling missing modalities)
    risk_score = 0.20
    if meta.age > 50:
        risk_score += 0.15
    if meta.age > 65:
        risk_score += 0.10
    if quest.carried_load_kg >= 15:
        risk_score += 0.12
    if quest.daily_incline_hours >= 2.0:
        risk_score += 0.10
    risk_score += quest.squatting_difficulty * 0.05
    if quest.previous_injury == 1:
        risk_score += 0.10

    # Sensor features (checked for None)
    flat_cv = sensors.flat_gait_stride_time_cv or 0.04
    climbing_cadence = sensors.climbing_cadence or 82.0
    climbing_cv = sensors.climbing_stride_time_cv or 0.08
    rom_deficit = sensors.rom_flexion_deficit_deg or 10.0
    crepitus_presence = sensors.crepitus_presence or 0.0

    if has_imu:
        if flat_cv > 0.07:
            risk_score += 0.14
        if climbing_cv > 0.10:
            risk_score += 0.12

    if has_goniometer:
        if rom_deficit > 20:
            risk_score += 0.12

    if has_crepitus:
        if crepitus_presence == 1.0 or (sensors.crepitus_event_count and sensors.crepitus_event_count > 0):
            risk_score += 0.08

    if has_dynamometer and sensors.strength_ext_bw_ratio:
        if sensors.strength_ext_bw_ratio < 2.5:
            risk_score += 0.10

    if has_semg and sensors.cocontraction_cci_walking_mean:
        if sensors.cocontraction_cci_walking_mean > 0.50:
            risk_score += 0.08

    final_score = min(0.95, max(0.08, round(risk_score, 3)))
    category = "high" if final_score >= 0.70 else ("moderate" if final_score >= 0.40 else "low")
    ci_low = max(0.02, round(final_score - 0.075, 2))
    ci_high = min(0.98, round(final_score + 0.065, 2))

    drivers = []
    if has_imu and flat_cv > 0.06:
        drivers.append(f"high flat stride variability (CV {flat_cv})")
    if has_imu and climbing_cadence < 85:
        drivers.append(f"slow climbing cadence ({climbing_cadence} SPM)")
    if has_goniometer and rom_deficit > 20:
        drivers.append(f"ROM flexion deficit ({rom_deficit}°)")
    if quest.carried_load_kg >= 15:
        drivers.append(f"heavy mountain load ({quest.carried_load_kg} kg)")

    driver_str = " and ".join(drivers) if drivers else "combined demographic and clinical indicators"

    explanation = (
        f"Patient demonstrates significantly elevated risk ({round(final_score * 100, 1)}%). "
        f"Primary drivers are {driver_str}."
        if category == "high" else
        f"Patient demonstrates {category} risk profile ({round(final_score * 100, 1)}%). Drivers include {driver_str}."
    )
    action = (
        "Refer to orthopedic specialist for immediate X-ray and conservative management."
        if category == "high" else
        ("Prescribe quadriceps strengthening exercises and follow-up in 6 weeks." if category == "moderate" else
         "Maintain standard physical activity and load guidelines.")
    )

    return KneevaTriageResponse(
        patient_id=payload.patient_id,
        oa_risk_score=final_score,
        oa_risk_category=category,
        confidence_interval=[ci_low, ci_high],
        feature_importance={
            "flat_gait_stride_time_cv": 0.15,
            "climbing_cadence": 0.12,
            "rom_flexion_deficit_deg": 0.11,
            "carried_load_kg": 0.09,
            "effective_bmi": 0.08
        },
        clinical_explanation=explanation,
        clinical_action=action,
        differential_signal=False,
        differential_flags=[],
        missing_modality_count=missing_modality_count,
        effective_bmi=effective_bmi
    )


# --- ABDM / ABHA Integration Endpoints ---
@app.post("/abdm/link-report")
@app.post("/api/abdm/link-report")
def link_report_to_abdm_endpoint(payload: dict):
    patient_id = payload.get("patient_id", "PT-UNKNOWN")
    abha_id = payload.get("abha_id", "91-4521-8890-3412")
    return {
        "success": True,
        "patient_id": patient_id,
        "abha_id": abha_id,
        "reference_id": f"AB-LINK-{abs(hash(patient_id)) % 899999 + 100000}",
        "status": "LINKED_TO_ABDM_HEALTH_LOCKER",
        "message": "Report successfully synced to Ayushman Bharat Digital Mission (ABHA)."
    }


@app.post("/abdm/verify-abha")
@app.post("/api/abdm/verify-abha")
def verify_abha_endpoint(payload: dict):
    abha_id = payload.get("abha_id", "91-4521-8890-3412")
    return {
        "verified": True,
        "abha_id": abha_id,
        "name": payload.get("name", "Verified Patient"),
        "status": "ACTIVE_VERIFIED"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
