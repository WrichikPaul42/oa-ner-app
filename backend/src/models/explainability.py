"""
SHAP (SHapley Additive exPlanations) Model Explainability Mock Implementation.

Computes local feature attributions and generates natural-language clinical explanations
for frontline healthcare workers and primary care physicians.
"""

from typing import Dict, Any, List


class ShapExplainer:
    """
    Mock TreeSHAP explainer for CatBoost multimodal fusion predictions.
    Generates local feature importance values and explainable clinical narratives.
    """

    def explain(
        self,
        tier_a: Dict[str, Any],
        tier_b: Dict[str, Any],
        tier_c: Dict[str, Any],
        risk_score: float,
        risk_category: str
    ) -> Dict[str, Any]:
        """
        Calculates simulated SHAP values and synthesizes clinical interpretation.

        Returns:
            Dict containing:
                - feature_importance: Map of feature names to local SHAP attribution scores
                - primary_drivers: Top clinical contributors pushing risk up
                - clinical_explanation: Concise ASHA-interpretable explanation
                - recommendations: Triage and clinical management actions
        """
        shap_values: Dict[str, float] = {}
        primary_drivers: List[str] = []

        # 1. Tier C: Effective BMI & Occupational load
        effective_bmi = tier_c.get("effective_bmi", 24.0)
        daily_load = tier_a.get("daily_load_kg", 0.0)
        if effective_bmi >= 25.0:
            val = round((effective_bmi - 23.0) * 1.8, 1)
            shap_values["effective_bmi"] = val
            primary_drivers.append(
                f"Elevated joint loading: Effective BMI is {effective_bmi} kg/m² "
                f"(includes {daily_load} kg daily occupational load)."
            )
        else:
            shap_values["effective_bmi"] = -2.5

        # 2. Tier A: Age
        age = tier_a.get("age", 45)
        if age >= 55:
            shap_values["age"] = round((age - 45) * 0.45, 1)
            primary_drivers.append(f"Age-related joint degeneration vulnerability (Age {age}).")
        else:
            shap_values["age"] = -3.0

        # 3. Tier B: Gait Variability (IMU)
        cv = tier_b.get("flat_gait_stride_time_cv")
        if cv is not None:
            if cv > 0.08:
                shap_values["gait_stride_time_cv"] = 12.4
                primary_drivers.append(
                    f"Dynamic gait instability: Elevated stride time CV ({round(cv * 100, 1)}% vs <5% normal)."
                )
            else:
                shap_values["gait_stride_time_cv"] = -6.0

        # 4. Tier B: Quadriceps Strength (Dynamometer)
        strength_bw = tier_b.get("strength_ext_bw_ratio")
        if strength_bw is not None:
            if strength_bw < 2.8:
                shap_values["quad_strength_bw_ratio"] = 14.8
                primary_drivers.append(
                    f"Extensor muscle deficit: Knee extensor force is {strength_bw}x bodyweight (normal >3.5x)."
                )
            else:
                shap_values["quad_strength_bw_ratio"] = -8.5

        # 5. Tier B: Crepitus Acoustics (Stethoscope)
        crepitus_events = tier_b.get("crepitus_event_count")
        if crepitus_events is not None and crepitus_events > 6:
            shap_values["crepitus_event_count"] = 9.2
            primary_drivers.append(
                f"Acoustic crepitus detected: {int(crepitus_events)} friction bursts recorded during movement."
            )

        # 6. Tier B: Range of Motion (Goniometer)
        rom_flex = tier_b.get("rom_active_flexion_deg")
        if rom_flex is not None and rom_flex < 115.0:
            shap_values["rom_active_flexion"] = 8.6
            primary_drivers.append(
                f"Restricted joint flexion: Active flexion limited to {rom_flex}° (normal ~135°)."
            )

        # Synthesize concise clinical narrative
        if not primary_drivers:
            primary_drivers.append("Biomechanical gait and joint parameters are within healthy normative thresholds.")

        if risk_category in ("High", "Severe"):
            clinical_explanation = (
                f"Patient presents with {risk_category} risk of progressive knee osteoarthritis (Risk Score: {risk_score}/100). "
                f"Key drivers include {primary_drivers[0].lower()} "
                f"Urgent clinical examination and radiological confirmation are recommended."
            )
            recommendations = [
                "Refer to primary orthopedic/physiotherapy clinic for bilateral standing knee radiographs.",
                "Prescribe non-weight-bearing quadriceps isometrics and hamstring stretching.",
                "Advise load-offloading strategies for heavy agricultural or domestic carrying."
            ]
        elif risk_category == "Moderate":
            clinical_explanation = (
                f"Patient demonstrates Moderate OA vulnerability (Risk Score: {risk_score}/100). "
                f"Biomechanical markers show early compensatory gait changes and mild quadriceps weakness."
            )
            recommendations = [
                "Initiate community-level low-impact physical exercise program (walking, cycling).",
                "Weight management and ergonomic counseling regarding deep squatting and stair climbing.",
                "Follow-up screening in 3 to 6 months."
            ]
        else:
            clinical_explanation = (
                f"Patient is in Low risk tier (Risk Score: {risk_score}/100). "
                "No severe gait asymmetry, muscle deficit, or acoustic crepitus detected."
            )
            recommendations = [
                "Continue standard physical activity and preventive joint health awareness.",
                "Annual follow-up screening."
            ]

        return {
            "feature_importance": shap_values,
            "primary_drivers": primary_drivers,
            "clinical_explanation": clinical_explanation,
            "recommendations": recommendations,
        }


# Global singleton instance for immediate testing
shap_explainer = ShapExplainer()
