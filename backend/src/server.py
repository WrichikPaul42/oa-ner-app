"""
Kneeva Triage System — Production-Grade FastAPI Backend Server.

Implements the POST /triage/ endpoint fusing:
- Tier A: Demographic & Clinical Survey
- Tier B: Biomechanical Sensors (Fault-Tolerant, All fields Optional/Nullable)
- Tier C: Contextual / Indian Occupational Features (BMI & Effective BMI)
- CatBoost Multimodal Fusion Model
- SHAP Explainability Engine
"""

import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional, Literal

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Ensure src modules are resolvable
SRC_ROOT = Path(__file__).resolve().parent.parent
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from src.features.tier_c import calculate_indian_context_features, IndianContextFeatures
from src.models.fusion import fusion_model
from src.models.explainability import shap_explainer
from src.fhir.fhir_mapper import create_fhir_diagnostic_report
from src.security.abdm_gateway import verify_and_link_abha, AbhaVerificationRequest, AbhaVerificationResponse

import os
import logging

logger = logging.getLogger("kneeva.server")

# --- Graceful Observability: Sentry Setup ---
SENTRY_DSN = os.getenv("SENTRY_DSN")
if SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        sentry_sdk.init(
            dsn=SENTRY_DSN,
            environment=os.getenv("ENVIRONMENT", "production"),
            traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.2")),
            integrations=[FastApiIntegration()],
        )
        logger.info("Sentry monitoring initialized successfully.")
    except ImportError:
        logger.warning("sentry-sdk not installed. Skipping Sentry initialization.")
    except Exception as exc:
        logger.warning(f"Failed to initialize Sentry: {exc}")
else:
    logger.info("SENTRY_DSN not set in environment. Skipping Sentry initialization.")

# --- FastAPI App Initialization ---
app = FastAPI(
    title="Kneeva OA-NER Triage API",
    description=(
        "Point-of-care multimodal screening and risk stratification API for Knee Osteoarthritis. "
        "Engineered for frontline health workers (ASHA/ANM) with on-device edge fusion, "
        "Indian occupational context adjustments, and SHAP explainability."
    ),
    version="1.2.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configuration for mobile (Expo / React Native) and web clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Graceful Observability: Prometheus Metrics ---
try:
    from prometheus_fastapi_instrumentator import Instrumentator
    Instrumentator(
        should_group_status_codes=True,
        should_ignore_untemplated=True,
        excluded_handlers=["/health", "/healthz", "/metrics", "/docs", "/openapi.json"]
    ).instrument(app).expose(app, endpoint="/metrics")
    logger.info("Prometheus metrics instrumentation active at /metrics.")
except ImportError:
    logger.info("prometheus-fastapi-instrumentator not installed. Skipping Prometheus metrics.")
except Exception as exc:
    logger.warning(f"Prometheus instrumentation skipped: {exc}")


# --- Pydantic Data Models ---

class TierAPatientData(BaseModel):
    """Tier A: Patient demographics, occupational load, and clinical survey data."""
    age: int = Field(..., ge=18, le=120, description="Patient age in years", examples=[58])
    sex: Literal["male", "female", "other"] = Field(..., description="Biological sex", examples=["female"])
    height_cm: float = Field(..., gt=50.0, lt=250.0, description="Height in centimeters", examples=[156.0])
    weight_kg: float = Field(..., gt=20.0, lt=300.0, description="Weight in kilograms", examples=[64.0])
    daily_load_kg: float = Field(
        default=0.0,
        ge=0.0,
        description="Average daily carried weight in kg (water vessels, firewood, headloads)",
        examples=[15.0]
    )
    daily_incline_hours: float = Field(
        default=0.0,
        ge=0.0,
        description="Daily hours spent walking on hilly terrain or stairs",
        examples=[2.5]
    )
    squatting_difficulty: int = Field(
        default=0,
        ge=0,
        le=4,
        description="Difficulty in deep squatting/sitting cross-legged (0=None, 4=Severe)",
        examples=[3]
    )
    previous_injury: int = Field(
        default=0,
        ge=0,
        le=1,
        description="History of knee trauma, ligament tear, or meniscus damage (0=No, 1=Yes)",
        examples=[0]
    )
    activity_level: int = Field(
        default=2,
        ge=1,
        le=4,
        description="General physical activity (1=Sedentary, 4=Heavy Manual Labor)",
        examples=[3]
    )


class TierBBiomechanicalSensors(BaseModel):
    """
    Tier B: Biomechanical sensor features.
    CRITICAL REQUIREMENT: ALL fields allow None (null) to guarantee fault tolerance
    and support single-leg or partial sensor availability (e.g., IMU only, or no goniometer).
    """
    # 1. IMU Gait Dynamics (Phone or Wearable Node)
    flat_gait_cadence: Optional[float] = Field(None, description="Cadence during flat walk test (steps/min)", examples=[88.5])
    flat_gait_stride_time_cv: Optional[float] = Field(None, description="Stride time coefficient of variation", examples=[0.092])
    climbing_cadence: Optional[float] = Field(None, description="Cadence during stair/incline walk (steps/min)", examples=[76.0])
    climbing_stride_time_cv: Optional[float] = Field(None, description="Stride time CV during stair climbing", examples=[0.14])
    gait_step_time_asymmetry: Optional[float] = Field(None, description="Step time asymmetry between legs (0-1)", examples=[0.16])
    gait_swing_time_asymmetry: Optional[float] = Field(None, description="Swing time asymmetry between legs (0-1)", examples=[0.10])
    gait_speed_ms: Optional[float] = Field(None, description="Estimated gait speed in m/s", examples=[0.88])

    # 2. Digital Dynamometer (Isometric Strength)
    strength_ext_peak_n: Optional[float] = Field(None, description="Peak knee extensor force (Newtons)", examples=[185.0])
    strength_flex_peak_n: Optional[float] = Field(None, description="Peak knee flexor force (Newtons)", examples=[115.0])
    strength_ext_bw_ratio: Optional[float] = Field(None, description="Extension force to bodyweight ratio (N/kg)", examples=[2.89])
    strength_hq_ratio: Optional[float] = Field(None, description="Hamstring-to-Quadriceps ratio (flexion/extension)", examples=[0.62])

    # 3. Digital Goniometer (Range of Motion)
    rom_active_flexion_deg: Optional[float] = Field(None, description="Active knee flexion in degrees", examples=[114.0])
    rom_active_extension_deficit_deg: Optional[float] = Field(None, description="Active extension deficit in degrees", examples=[6.0])
    rom_passive_flexion_deg: Optional[float] = Field(None, description="Passive knee flexion in degrees", examples=[120.0])

    # 4. Acoustic Microphone / Stethoscope (Vibroarthrography)
    crepitus_event_count: Optional[float] = Field(None, description="Number of detected crepitus acoustic events", examples=[12.0])
    crepitus_total_energy: Optional[float] = Field(None, description="Cumulative crepitus acoustic energy", examples=[2400.0])
    crepitus_mean_energy: Optional[float] = Field(None, description="Mean acoustic energy per event", examples=[200.0])
    crepitus_presence: Optional[float] = Field(None, description="Binary flag indicating crepitus presence (0 or 1)", examples=[1.0])

    # 5. Single-Leg Testing Metadata
    affected_side: Optional[Literal["left", "right", "bilateral"]] = Field(
        None,
        description="Indicates which knee was screened if single-leg protocol was performed",
        examples=["bilateral"]
    )


class TriageRequest(BaseModel):
    """Complete incoming payload for Kneeva Triage Screening."""
    patient_id: str = Field(..., description="Unique patient identifier", examples=["pat_kn_2026_091"])
    abha_id: Optional[str] = Field(None, description="Ayushman Bharat Health Account (ABHA ID)", examples=["sonam_ner@abdm"])
    tier_a: TierAPatientData = Field(..., description="Patient demographics & questionnaire")
    tier_b: TierBBiomechanicalSensors = Field(
        default_factory=TierBBiomechanicalSensors,
        description="Fault-tolerant biomechanical features (all fields nullable)"
    )


class TriageResponse(BaseModel):
    """Comprehensive triage assessment response with SHAP explainability & FHIR Bundle."""
    patient_id: str
    abha_id: Optional[str] = None
    risk_score: float = Field(..., description="Composite OA Risk Score on scale of 0 to 100")
    risk_category: str = Field(..., description="Stratified risk tier: Low, Moderate, High, Severe")
    urgency: str = Field(..., description="Triage urgency: Routine, Elevated, Urgent, Immediate")
    confidence_interval: List[float] = Field(..., description="95% prediction interval [lower, upper]")
    tier_c: IndianContextFeatures = Field(..., description="Calculated Indian contextual BMI and mechanical load")
    feature_importance: Dict[str, float] = Field(..., description="Top SHAP feature attribution scores")
    primary_drivers: List[str] = Field(..., description="Human-interpretable clinical risk factors")
    clinical_explanation: str = Field(..., description="Clinical narrative for frontline workers")
    recommendations: List[str] = Field(..., description="Actionable clinical care and referral pathway")
    missing_modality_count: int = Field(..., description="Count of omitted Tier B sensor modalities")
    model_version: str = Field(..., description="Inference engine model version")
    timestamp: str = Field(..., description="ISO 8601 UTC evaluation timestamp")
    fhir_bundle: Optional[Dict[str, Any]] = Field(None, description="Standardized HL7 FHIR R4 DiagnosticReport Bundle")


# --- API Routes ---

@app.get("/", tags=["Health Check"])
def root():
    return {
        "service": "Kneeva OA-NER Triage API",
        "status": "online",
        "docs_url": "/docs",
        "version": "1.2.0"
    }


@app.get("/health", tags=["Health Check"])
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.post(
    "/triage/",
    response_model=TriageResponse,
    status_code=status.HTTP_200_OK,
    tags=["Triage Inference"],
    summary="Screen and stratify Knee Osteoarthritis risk using Multimodal Fusion"
)
@app.post(
    "/triage",
    response_model=TriageResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=False
)
def evaluate_triage(payload: TriageRequest) -> TriageResponse:
    """
    Evaluates patient Knee Osteoarthritis risk:
    1. Extracts Tier A clinical and survey inputs.
    2. Computes Tier C Indian Context Features (Standard BMI vs Effective Terrain/Load-Adjusted BMI).
    3. Handles Tier B sensor features fault-tolerantly (supporting partial / single-leg inputs).
    4. Executes CatBoost multimodal fusion model.
    5. Computes TreeSHAP explainability attributions.
    """
    try:
        tier_a_dict = payload.tier_a.model_dump()
        tier_b_dict = payload.tier_b.model_dump()

        # Count missing/null modalities in Tier B
        total_tier_b_fields = len(tier_b_dict)
        missing_count = sum(1 for val in tier_b_dict.values() if val is None)

        # 1. Feature Engineering: Tier C Contextual & Indian Load Features
        tier_c_dict = calculate_indian_context_features(
            weight=payload.tier_a.weight_kg,
            height=payload.tier_a.height_cm,
            daily_load=payload.tier_a.daily_load_kg
        )
        tier_c_features = IndianContextFeatures(**tier_c_dict)

        # 2. Model Inference: CatBoost Multimodal Fusion
        risk_score, risk_category, confidence_interval, urgency = fusion_model.predict(
            tier_a=tier_a_dict,
            tier_b=tier_b_dict,
            tier_c=tier_c_dict
        )

        # 3. Model Explainability: SHAP Feature Attributions
        explanation_data = shap_explainer.explain(
            tier_a=tier_a_dict,
            tier_b=tier_b_dict,
            tier_c=tier_c_dict,
            risk_score=risk_score,
            risk_category=risk_category
        )

        # 4. FHIR R4 DiagnosticReport & Observation Mapping (ABDM Grid Interoperability)
        fhir_bundle = create_fhir_diagnostic_report(
            patient_id=payload.patient_id,
            abha_id=payload.abha_id,
            risk_score=risk_score,
            risk_category=risk_category,
            urgency=urgency,
            tier_b=tier_b_dict,
            tier_c=tier_c_dict,
            clinical_explanation=explanation_data["clinical_explanation"],
            primary_drivers=explanation_data["primary_drivers"],
            recommendations=explanation_data["recommendations"]
        )

        # 5. Construct response
        return TriageResponse(
            patient_id=payload.patient_id,
            abha_id=payload.abha_id,
            risk_score=risk_score,
            risk_category=risk_category,
            urgency=urgency,
            confidence_interval=confidence_interval,
            tier_c=tier_c_features,
            feature_importance=explanation_data["feature_importance"],
            primary_drivers=explanation_data["primary_drivers"],
            clinical_explanation=explanation_data["clinical_explanation"],
            recommendations=explanation_data["recommendations"],
            missing_modality_count=missing_count,
            model_version=fusion_model.model_version,
            timestamp=datetime.now(timezone.utc).isoformat(),
            fhir_bundle=fhir_bundle
        )

    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Validation error in feature computation: {str(ve)}"
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference execution failure: {str(exc)}"
        )


@app.post(
    "/abdm/verify-abha",
    response_model=AbhaVerificationResponse,
    tags=["ABDM & ABHA Integration"],
    summary="Verify and link patient ABHA Address / Number via ABDM Sandbox"
)
def verify_abha_endpoint(payload: AbhaVerificationRequest):
    """
    Authenticates and retrieves patient demographic context from the ABDM Sandbox
    to bind the triage session directly to the national health record registry.
    """
    return verify_and_link_abha(payload)



if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.server:app", host="0.0.0.0", port=8000, reload=True)
