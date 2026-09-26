from typing import List, Optional, Literal
from pydantic import BaseModel, Field


# --- Contract 1: Live Sensor Stream (BLE -> Screen 4) ---
class Vector3D(BaseModel):
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0


class LiveSensorReading(BaseModel):
    node_id: str
    patient_id: str
    timestamp: str  # ISO8601 string
    flex_resistance: int
    mpu_accel: Vector3D
    mpu_gyro: Vector3D


# --- Contract 2: Saved Patient Record (DB -> Screens 2, 3, 5) ---
class PainMapEntry(BaseModel):
    body_region: str
    pain_level: int = Field(ge=0, le=10)


class PatientRecord(BaseModel):
    patient_id: str
    name: str
    age: int
    gender: str
    village_block: str
    pain_map: List[PainMapEntry] = []
    sessions: List[str] = []


class PatientCreateRequest(BaseModel):
    name: str
    age: int
    gender: str
    village_block: str
    pain_map: List[PainMapEntry] = []


# --- Contract 3: Risk Assessment Result (Dummy Risk Engine -> Screen 5) ---
class ChartPoint(BaseModel):
    t: float
    flex_resistance: int
    gyro_x: float


class RiskAssessmentResult(BaseModel):
    session_id: str
    patient_id: str
    risk_tier: Literal["Low", "Moderate", "High"]
    contributing_factors: List[str]
    max_knee_flexion_deg: float
    extension_lag_deg: float
    session_chart_data: List[ChartPoint]
    advice_key: str


# Auth schemas
class AuthRequest(BaseModel):
    pin: str


class AuthResponse(BaseModel):
    success: bool
    message: str


# --- Kneeva Mobile Integration Contract (POST /api/v1/triage) ---
class KneevaPatientMetadata(BaseModel):
    age: int
    sex: Literal["male", "female"]
    height_cm: float
    weight_kg: float


class KneevaQuestionnaire(BaseModel):
    carried_load_kg: float
    daily_incline_hours: float
    squatting_difficulty: int
    previous_injury: int
    activity_level: int


class KneevaSensorFeatures(BaseModel):
    # 1. IMU (Phone/Wearable Accelerometer & Gyroscope)
    flat_gait_cadence: Optional[float] = None
    flat_gait_stride_time_cv: Optional[float] = None
    climbing_cadence: Optional[float] = None
    climbing_stride_time_cv: Optional[float] = None
    gait_step_time_asymmetry: Optional[float] = None
    gait_swing_time_asymmetry: Optional[float] = None
    gait_speed_ms: Optional[float] = None

    # 2. Dynamometer (Digital Force Gauge)
    strength_ext_peak_n: Optional[float] = None
    strength_flex_peak_n: Optional[float] = None
    strength_ext_bw_ratio: Optional[float] = None
    strength_hq_ratio: Optional[float] = None
    strength_ext_bw_ratio_general: Optional[float] = None
    strength_general_weakness_flag: Optional[float] = None
    strength_general_z_score: Optional[float] = None

    # 3. Goniometer (Range of Motion)
    rom_active_flexion_deg: Optional[float] = None
    rom_active_extension_deficit_deg: Optional[float] = None
    rom_passive_flexion_deg: Optional[float] = None
    rom_flexion_deficit_deg: Optional[float] = None

    # 4. Acoustic Microphone (Joint Sound / Crepitus)
    crepitus_event_count: Optional[float] = None
    crepitus_total_energy: Optional[float] = None
    crepitus_mean_energy: Optional[float] = None
    crepitus_presence: Optional[float] = None

    # 5. sEMG (Surface Electromyography Patches)
    cocontraction_cci_walking_mean: Optional[float] = None
    neuro_rf_activation_duration_pct: Optional[float] = None
    neuro_bf_activation_duration_pct: Optional[float] = None
    neuro_onset_emg_to_heelstrike_ms: Optional[float] = None

    # Clinical Injury Records
    injury_previous_knee_injury: Optional[float] = None
    injury_acl_history: Optional[float] = None
    injury_meniscal_history: Optional[float] = None


class KneevaTriageRequest(BaseModel):
    patient_id: str
    patient_metadata: KneevaPatientMetadata
    questionnaire: KneevaQuestionnaire
    sensor_features: KneevaSensorFeatures


class KneevaTriageResponse(BaseModel):
    patient_id: str
    oa_risk_score: float
    oa_risk_category: str
    confidence_interval: List[float]
    feature_importance: dict
    clinical_explanation: str
    clinical_action: str
    differential_signal: bool = False
    differential_flags: List[str] = []
    missing_modality_count: int = 0
    effective_bmi: float

