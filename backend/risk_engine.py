from typing import List, Dict, Any
from schemas import RiskAssessmentResult, ChartPoint, PainMapEntry


def upgrade_one_tier(current_tier: str) -> str:
    """Upgrades risk tier by one level (Low -> Moderate -> High)."""
    if current_tier == "Low":
        return "Moderate"
    elif current_tier == "Moderate":
        return "High"
    return "High"


def derive_biomechanics(raw_stream: List[Dict[str, Any]]) -> tuple[float, float]:
    """
    Derives max_knee_flexion_deg and extension_lag_deg from raw sensor stream readings.
    Maps flex_resistance readings (e.g. 0-1023 analog range) to knee flexion degrees.
    """
    if not raw_stream:
        return 100.0, 5.0

    flex_values = [item.get("flex_resistance", 0) for item in raw_stream]
    max_resistance = max(flex_values)
    min_resistance = min(flex_values)

    # Standard calibration curve: 0-1000 resistance maps to 0-135 degrees
    max_knee_flexion = round(min(135.0, (max_resistance / 1000.0) * 135.0), 1)
    
    # Extension lag: deficit from full 0 degree extension
    # Represented by baseline minimum resistance / lag angle
    extension_lag = round(max(0.0, (min_resistance / 1000.0) * 40.0), 1)

    return max_knee_flexion, extension_lag


def assess_risk(
    session_data: Dict[str, Any],
    pain_map: List[PainMapEntry]
) -> Dict[str, Any]:
    """
    Processes session data and patient pain map into Contract 3 Risk Assessment Result.
    """
    raw_stream = session_data.get("raw_stream", [])
    
    # 1. Biomechanics extraction
    if "max_knee_flexion_deg" in session_data and session_data["max_knee_flexion_deg"] > 0:
        max_flex = float(session_data["max_knee_flexion_deg"])
        ext_lag = float(session_data.get("extension_lag_deg", 5.0))
    else:
        max_flex, ext_lag = derive_biomechanics(raw_stream)

    # 2. Risk tier classification based on kinematic thresholds
    factors = []
    if max_flex < 90 and ext_lag > 15:
        risk = "High"
        factors = ["Significantly reduced flexion range (<90 deg)", "Notable extension lag (>15 deg)"]
    elif max_flex < 110 or ext_lag > 8:
        risk = "Moderate"
        factors = ["Mildly reduced flexion range (<110 deg)"]
    else:
        risk = "Low"
        factors = ["Flexion and extension within expected clinical range"]

    # 3. Escalation based on patient self-reported severe pain
    has_severe_pain = False
    for entry in pain_map:
        level = entry.pain_level if isinstance(entry, PainMapEntry) else entry.get("pain_level", 0)
        region = entry.body_region if isinstance(entry, PainMapEntry) else entry.get("body_region", "knee")
        if level >= 8:
            has_severe_pain = True
            factors.append(f"Severe localized pain reported in {region} (Level {level}/10)")

    if has_severe_pain:
        risk = upgrade_one_tier(risk)

    # 4. Session chart data transformation (Contract 3 session_chart_data)
    session_chart_data = []
    t_start = 0.0
    for idx, reading in enumerate(raw_stream):
        t_offset = round(idx * 0.1, 1)  # 10Hz sampling -> 0.1s increments
        flex_r = reading.get("flex_resistance", 0)
        gyro_x = reading.get("mpu_gyro", {}).get("x", 0.0) if isinstance(reading.get("mpu_gyro"), dict) else 0.0
        session_chart_data.append({
            "t": t_offset,
            "flex_resistance": flex_r,
            "gyro_x": gyro_x
        })

    advice_key = f"risk_{risk.lower()}_advice"

    result = {
        "session_id": session_data.get("session_id", "sess-000"),
        "patient_id": session_data.get("patient_id", "pat-000"),
        "risk_tier": risk,
        "contributing_factors": factors,
        "max_knee_flexion_deg": max_flex,
        "extension_lag_deg": ext_lag,
        "session_chart_data": session_chart_data,
        "advice_key": advice_key
    }

    return result
