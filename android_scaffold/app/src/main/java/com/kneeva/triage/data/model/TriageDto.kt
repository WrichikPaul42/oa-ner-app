package com.kneeva.triage.data.model

import com.google.gson.annotations.SerializedName

/**
 * Kneeva Triage API Contract (POST /triage/)
 * Data classes matching backend FastAPI Pydantic models.
 */

data class TriageRequest(
    @SerializedName("patient_id")
    val patientId: String,

    @SerializedName("tier_a")
    val tierA: TierAPatientData,

    @SerializedName("tier_b")
    val tierB: TierBBiomechanicalSensors = TierBBiomechanicalSensors()
)

data class TierAPatientData(
    @SerializedName("age")
    val age: Int,

    @SerializedName("sex")
    val sex: String, // "male", "female", "other"

    @SerializedName("height_cm")
    val heightCm: Float,

    @SerializedName("weight_kg")
    val weightKg: Float,

    @SerializedName("daily_load_kg")
    val dailyLoadKg: Float = 0.0f,

    @SerializedName("daily_incline_hours")
    val dailyInclineHours: Float = 0.0f,

    @SerializedName("squatting_difficulty")
    val squattingDifficulty: Int = 0, // 0 to 4

    @SerializedName("previous_injury")
    val previousInjury: Int = 0, // 0 or 1

    @SerializedName("activity_level")
    val activityLevel: Int = 2 // 1 to 4
)

/**
 * Tier B: Biomechanical sensor features.
 * FAULT-TOLERANT: ALL fields allow null to support partial/single-leg screening.
 */
data class TierBBiomechanicalSensors(
    // 1. IMU Gait Dynamics
    @SerializedName("flat_gait_cadence")
    val flatGaitCadence: Float? = null,

    @SerializedName("flat_gait_stride_time_cv")
    val flatGaitStrideTimeCv: Float? = null,

    @SerializedName("climbing_cadence")
    val climbingCadence: Float? = null,

    @SerializedName("climbing_stride_time_cv")
    val climbingStrideTimeCv: Float? = null,

    @SerializedName("gait_step_time_asymmetry")
    val gaitStepTimeAsymmetry: Float? = null,

    @SerializedName("gait_swing_time_asymmetry")
    val gaitSwingTimeAsymmetry: Float? = null,

    @SerializedName("gait_speed_ms")
    val gaitSpeedMs: Float? = null,

    // 2. Digital Dynamometer (Isometric Strength)
    @SerializedName("strength_ext_peak_n")
    val strengthExtPeakN: Float? = null,

    @SerializedName("strength_flex_peak_n")
    val strengthFlexPeakN: Float? = null,

    @SerializedName("strength_ext_bw_ratio")
    val strengthExtBwRatio: Float? = null,

    @SerializedName("strength_hq_ratio")
    val strengthHqRatio: Float? = null,

    // 3. Digital Goniometer (Range of Motion)
    @SerializedName("rom_active_flexion_deg")
    val romActiveFlexionDeg: Float? = null,

    @SerializedName("rom_active_extension_deficit_deg")
    val romActiveExtensionDeficitDeg: Float? = null,

    @SerializedName("rom_passive_flexion_deg")
    val romPassiveFlexionDeg: Float? = null,

    // 4. Acoustic Microphone (Crepitus)
    @SerializedName("crepitus_event_count")
    val crepitusEventCount: Float? = null,

    @SerializedName("crepitus_total_energy")
    val crepitusTotalEnergy: Float? = null,

    @SerializedName("crepitus_mean_energy")
    val crepitusMeanEnergy: Float? = null,

    @SerializedName("crepitus_presence")
    val crepitusPresence: Float? = null,

    // 5. Single-Leg Testing Metadata
    @SerializedName("affected_side")
    val affectedSide: String? = null // "left", "right", "bilateral"
)

data class TierCContextFeatures(
    @SerializedName("standard_bmi")
    val standardBmi: Float,

    @SerializedName("effective_bmi")
    val effectiveBmi: Float,

    @SerializedName("load_to_bodyweight_ratio")
    val loadToBodyweightRatio: Float,

    @SerializedName("who_asian_bmi_category")
    val whoAsianBmiCategory: String,

    @SerializedName("mechanical_overload_flag")
    val mechanicalOverloadFlag: Boolean
)

data class TriageResponse(
    @SerializedName("patient_id")
    val patientId: String,

    @SerializedName("risk_score")
    val riskScore: Float,

    @SerializedName("risk_category")
    val riskCategory: String, // "Low", "Moderate", "High", "Severe"

    @SerializedName("urgency")
    val urgency: String, // "Routine", "Elevated", "Urgent", "Immediate"

    @SerializedName("confidence_interval")
    val confidenceInterval: List<Float>,

    @SerializedName("tier_c")
    val tierC: TierCContextFeatures,

    @SerializedName("feature_importance")
    val featureImportance: Map<String, Float>,

    @SerializedName("primary_drivers")
    val primaryDrivers: List<String>,

    @SerializedName("clinical_explanation")
    val clinicalExplanation: String,

    @SerializedName("recommendations")
    val recommendations: List<String>,

    @SerializedName("missing_modality_count")
    val missingModalityCount: Int,

    @SerializedName("model_version")
    val modelVersion: String,

    @SerializedName("timestamp")
    val timestamp: String
)
