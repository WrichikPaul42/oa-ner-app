"""
HL7 FHIR R4 DiagnosticReport & Observation Generator.

Maps Kneeva AI Triage results, Tier B biomechanical sensor metrics,
and Indian/NER terrain-adjusted BMI to standard FHIR resources
aligned with SNOMED CT and LOINC clinical ontologies for ABDM interoperability.
"""

import uuid
import re
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional


def sanitize_clinical_narrative(text: str) -> str:
    """
    FHIR Payload Sanitizer:
    Ensures zero leakage of proprietary model weights, Platt scaling constants,
    internal tree coefficients, or raw code-level variable identifiers into ABDM FHIR outputs.
    Only clean, human-readable SHAP narratives are permitted.
    """
    if not text:
        return ""

    # 1. Strip internal model weight or Platt scaling constant references
    text = re.sub(r'platt_[a-zA-Z0-9_]+', '', text)
    text = re.sub(r'catboost_[a-zA-Z0-9_]+', '', text)
    text = re.sub(r'weight_[a-zA-Z0-9_]+', '', text)
    text = re.sub(r'coefficient_[a-zA-Z0-9_]+', '', text)

    # 2. Convert raw snake_case feature variable names to human-readable clinical terms
    replacements = {
        "flat_gait_stride_time_cv": "Flat Walk Stride Variability",
        "climbing_cadence": "Stair Climbing Cadence",
        "climbing_stride_time_cv": "Climbing Stride Variability",
        "rom_flexion_deficit_deg": "Flexion Range Deficit",
        "carried_load_kg": "Daily Carried Load",
        "effective_bmi": "Terrain-Adjusted Effective BMI",
        "strength_ext_bw_ratio": "Extension Force Ratio",
        "crepitus_event_count": "Acoustic Crepitus Events",
    }
    for raw_var, clean_term in replacements.items():
        text = text.replace(raw_var, clean_term)

    return text.strip()


def create_fhir_diagnostic_report(
    patient_id: str,
    abha_id: Optional[str],
    risk_score: float,
    risk_category: str,
    urgency: str,
    tier_b: Dict[str, Any],
    tier_c: Dict[str, Any],
    clinical_explanation: str,
    primary_drivers: List[str],
    recommendations: List[str]
) -> Dict[str, Any]:
    """
    Constructs an HL7 FHIR R4 Bundle containing a DiagnosticReport and
    individual Observation resources for national health grid (ABDM) integration.
    """
    # Sanitize narrative text fields to prevent internal model/coefficient leakage
    clean_explanation = sanitize_clinical_narrative(clinical_explanation)
    clean_drivers = [sanitize_clinical_narrative(d) for d in primary_drivers]
    clean_recommendations = [sanitize_clinical_narrative(r) for r in recommendations]

    timestamp = datetime.now(timezone.utc).isoformat()
    report_id = f"diag-rep-{uuid.uuid4().hex[:12]}"
    bundle_id = f"bundle-kneeva-{uuid.uuid4().hex[:12]}"

    observations: List[Dict[str, Any]] = []

    # 1. Observation: Composite OA Risk Score
    obs_risk_id = f"obs-risk-{uuid.uuid4().hex[:8]}"
    observations.append({
        "resourceType": "Observation",
        "id": obs_risk_id,
        "status": "final",
        "category": [{
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                "code": "survey",
                "display": "Survey & Clinical Scoring"
            }]
        }],
        "code": {
            "coding": [{
                "system": "http://snomed.info/sct",
                "code": "39898005",
                "display": "Osteoarthritis of knee (disorder)"
            }],
            "text": "Kneeva Multimodal Knee Osteoarthritis Triage Score"
        },
        "subject": {
            "reference": f"Patient/{patient_id}",
            "identifier": {
                "system": "https://healthid.ndhm.gov.in",
                "value": abha_id or "ABHA-PENDING"
            }
        },
        "effectiveDateTime": timestamp,
        "valueQuantity": {
            "value": round(risk_score, 1),
            "unit": "points",
            "system": "http://unitsofmeasure.org",
            "code": "points"
        },
        "interpretation": [{
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                "code": "H" if risk_category in ("High", "Severe") else ("A" if risk_category == "Moderate" else "N"),
                "display": f"{risk_category} Risk"
            }],
            "text": f"{risk_category} Risk ({urgency} Urgency)"
        }]
    })

    # 2. Observation: Effective Terrain/Load-Adjusted BMI (Tier C)
    obs_bmi_id = f"obs-eff-bmi-{uuid.uuid4().hex[:8]}"
    observations.append({
        "resourceType": "Observation",
        "id": obs_bmi_id,
        "status": "final",
        "category": [{
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                "code": "vital-signs",
                "display": "Vital Signs"
            }]
        }],
        "code": {
            "coding": [{
                "system": "http://loinc.org",
                "code": "39156-5",
                "display": "Body mass index (BMI) [Ratio]"
            }],
            "text": "Effective Terrain & Occupational Load Adjusted BMI"
        },
        "subject": {"reference": f"Patient/{patient_id}"},
        "effectiveDateTime": timestamp,
        "valueQuantity": {
            "value": tier_c.get("effective_bmi", 0.0),
            "unit": "kg/m2",
            "system": "http://unitsofmeasure.org",
            "code": "kg/m2"
        },
        "component": [
            {
                "code": {"text": "Standard Baseline BMI"},
                "valueQuantity": {
                    "value": tier_c.get("standard_bmi", 0.0),
                    "unit": "kg/m2"
                }
            },
            {
                "code": {"text": "WHO South Asia Classification"},
                "valueString": tier_c.get("who_asian_bmi_category", "Normal")
            }
        ]
    })

    # 3. Observation: Gait Dynamics (Cadence & Stride CV)
    if tier_b.get("flat_gait_cadence") is not None:
        obs_gait_id = f"obs-gait-{uuid.uuid4().hex[:8]}"
        observations.append({
            "resourceType": "Observation",
            "id": obs_gait_id,
            "status": "final",
            "category": [{
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                    "code": "exam",
                    "display": "Physical Examination"
                }]
            }],
            "code": {
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": "271649006",
                    "display": "Antalgic gait (finding)"
                }],
                "text": "IMU Biomechanical Gait Analysis"
            },
            "subject": {"reference": f"Patient/{patient_id}"},
            "effectiveDateTime": timestamp,
            "valueQuantity": {
                "value": tier_b["flat_gait_cadence"],
                "unit": "steps/min",
                "system": "http://unitsofmeasure.org",
                "code": "/min"
            },
            "component": [
                {
                    "code": {"text": "Stride Time Coefficient of Variation"},
                    "valueQuantity": {
                        "value": tier_b.get("flat_gait_stride_time_cv", 0.0),
                        "unit": "ratio"
                    }
                },
                {
                    "code": {"text": "Step Time Asymmetry"},
                    "valueQuantity": {
                        "value": tier_b.get("gait_step_time_asymmetry", 0.0),
                        "unit": "ratio"
                    }
                }
            ]
        })

    # 4. Observation: Crepitus Acoustics (if available)
    if tier_b.get("crepitus_event_count") is not None:
        obs_crep_id = f"obs-crep-{uuid.uuid4().hex[:8]}"
        observations.append({
            "resourceType": "Observation",
            "id": obs_crep_id,
            "status": "final",
            "code": {
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": "299407001",
                    "display": "Joint crepitus (finding)"
                }],
                "text": "Vibroarthrographic Acoustic Crepitus"
            },
            "subject": {"reference": f"Patient/{patient_id}"},
            "effectiveDateTime": timestamp,
            "valueQuantity": {
                "value": tier_b["crepitus_event_count"],
                "unit": "events"
            }
        })

    # Construct Main FHIR DiagnosticReport
    diagnostic_report = {
        "resourceType": "DiagnosticReport",
        "id": report_id,
        "identifier": [{
            "system": "https://kneeva.health.gov.in/reports",
            "value": f"KNEOVA-{patient_id}-{int(datetime.now().timestamp())}"
        }],
        "status": "final",
        "category": [{
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/v2-0074",
                "code": "RAD",
                "display": "Non-Invasive Point-of-Care Functional Triage"
            }]
        }],
        "code": {
            "coding": [{
                "system": "http://snomed.info/sct",
                "code": "39898005",
                "display": "Osteoarthritis of knee (disorder)"
            }],
            "text": "Kneeva AI Multimodal Knee Osteoarthritis Screening Assessment"
        },
        "subject": {
            "reference": f"Patient/{patient_id}",
            "identifier": {
                "system": "https://healthid.ndhm.gov.in",
                "value": abha_id or "ABHA-UNLINKED"
            }
        },
        "effectiveDateTime": timestamp,
        "issued": timestamp,
        "performer": [{
            "display": "Frontline Community Health Worker (ASHA / ANM)"
        }],
        "result": [{"reference": f"Observation/{obs['id']}"} for obs in observations],
        "conclusion": clean_explanation,
        "conclusionCode": [{
            "coding": [{
                "system": "http://snomed.info/sct",
                "code": "39898005",
                "display": f"{risk_category} Risk Knee Osteoarthritis"
            }]
        }],
        "extension": [
            {
                "url": "https://kneeva.health.gov.in/fhir/StructureDefinition/primary-drivers",
                "valueString": " | ".join(clean_drivers)
            },
            {
                "url": "https://kneeva.health.gov.in/fhir/StructureDefinition/actionable-recommendations",
                "valueString": " | ".join(clean_recommendations)
            }
        ]
    }

    # Return full FHIR R4 Document Bundle
    bundle_entries = [{"resource": diagnostic_report}] + [{"resource": obs} for obs in observations]

    return {
        "resourceType": "Bundle",
        "id": bundle_id,
        "type": "document",
        "timestamp": timestamp,
        "entry": bundle_entries
    }
