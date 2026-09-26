"""
Tier C: Contextual & Indian Occupational Feature Engineering Module.

Calculates contextual mechanical load indicators tailored for Indian demographic
and occupational realities (e.g., carrying headloads, heavy water pots, agrarian labor).
"""

from typing import Dict, Any
from pydantic import BaseModel, Field


class IndianContextFeatures(BaseModel):
    """Contextual features derived from patient physical dimensions and occupational load."""
    standard_bmi: float = Field(..., description="Standard Body Mass Index (kg/m^2)")
    effective_bmi: float = Field(
        ...,
        description="Effective BMI incorporating daily carried occupational/head load (kg/m^2)"
    )
    load_to_bodyweight_ratio: float = Field(
        ...,
        description="Ratio of carried daily load to baseline body weight"
    )
    who_asian_bmi_category: str = Field(
        ...,
        description="WHO Asia-Pacific BMI classification (Normal: 18.5-22.9, Overweight: 23-24.9, Obese: >=25)"
    )
    mechanical_overload_flag: bool = Field(
        ...,
        description="True if effective biomechanical load exceeds joint safety threshold"
    )


def calculate_indian_context_features(
    weight: float,
    height: float,
    daily_load: float = 0.0
) -> Dict[str, Any]:
    """
    Calculates standard BMI and terrain/occupational effective BMI for Indian context.

    Parameters:
        weight (float): Patient baseline body weight in kg.
        height (float): Patient height in cm (or meters if <= 3.0).
        daily_load (float): Average daily carried load in kg (headloads, firewood, water containers).

    Returns:
        dict: Containing standard_bmi, effective_bmi, load_to_bodyweight_ratio,
              who_asian_bmi_category, and mechanical_overload_flag.
    """
    if weight <= 0:
        raise ValueError("Weight must be greater than zero.")
    if height <= 0:
        raise ValueError("Height must be greater than zero.")

    # Normalize height to meters if supplied in centimeters (e.g. 165 cm -> 1.65 m)
    height_m = height / 100.0 if height > 3.0 else float(height)

    # Standard BMI: weight (kg) / [height (m)]^2
    standard_bmi = round(weight / (height_m ** 2), 2)

    # Effective BMI: (weight + daily_load) / [height (m)]^2
    effective_weight = weight + max(0.0, float(daily_load))
    effective_bmi = round(effective_weight / (height_m ** 2), 2)

    load_ratio = round(daily_load / weight, 3) if weight > 0 else 0.0

    # WHO Asia-Pacific classification cut-offs:
    # < 18.5: Underweight
    # 18.5 - 22.9: Normal
    # 23.0 - 24.9: Overweight
    # >= 25.0: Obese (Lower threshold for South Asian populations due to central adiposity risk)
    if effective_bmi < 18.5:
        bmi_cat = "Underweight"
    elif effective_bmi <= 22.9:
        bmi_cat = "Normal"
    elif effective_bmi <= 24.9:
        bmi_cat = "Overweight"
    else:
        bmi_cat = "Obese"

    # Joint overload flag: effective BMI >= 25.0 or carrying > 20% of body weight daily
    overload_flag = bool(effective_bmi >= 25.0 or load_ratio >= 0.20)

    return {
        "standard_bmi": standard_bmi,
        "effective_bmi": effective_bmi,
        "load_to_bodyweight_ratio": load_ratio,
        "who_asian_bmi_category": bmi_cat,
        "mechanical_overload_flag": overload_flag,
    }
