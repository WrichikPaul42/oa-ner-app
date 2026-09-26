/**
 * Kneeva Mobile Integration Types & Contracts
 * Based on Kneeva Android App Integration Guide (API Contract POST /api/v1/triage)
 */

export interface KneevaPatientMetadata {
  age: number;
  sex: 'male' | 'female';
  height_cm: number;
  weight_kg: number;
}

export interface KneevaQuestionnaire {
  carried_load_kg: number;
  daily_incline_hours: number;
  squatting_difficulty: number; // 0-4 scale
  previous_injury: number; // 0 or 1
  activity_level: number; // 1-4 scale
}

export interface KneevaSensorFeatures {
  // 1. IMU (Phone/Wearable Accelerometer & Gyroscope)
  flat_gait_cadence?: number | null;
  flat_gait_stride_time_cv?: number | null;
  climbing_cadence?: number | null;
  climbing_stride_time_cv?: number | null;
  gait_step_time_asymmetry?: number | null;
  gait_swing_time_asymmetry?: number | null;
  gait_speed_ms?: number | null;

  // 2. Dynamometer (Digital Force Gauge)
  strength_ext_peak_n?: number | null;
  strength_flex_peak_n?: number | null;
  strength_ext_bw_ratio?: number | null;
  strength_hq_ratio?: number | null;
  strength_ext_bw_ratio_general?: number | null;
  strength_general_weakness_flag?: number | null;
  strength_general_z_score?: number | null;

  // 3. Goniometer (Range of Motion)
  rom_active_flexion_deg?: number | null;
  rom_active_extension_deficit_deg?: number | null;
  rom_passive_flexion_deg?: number | null;
  rom_flexion_deficit_deg?: number | null;

  // 4. Acoustic Microphone (Crepitus Joint Sound)
  crepitus_event_count?: number | null;
  crepitus_total_energy?: number | null;
  crepitus_mean_energy?: number | null;
  crepitus_presence?: number | null;

  // 5. sEMG (Surface Electromyography Patches)
  cocontraction_cci_walking_mean?: number | null;
  neuro_rf_activation_duration_pct?: number | null;
  neuro_bf_activation_duration_pct?: number | null;
  neuro_onset_emg_to_heelstrike_ms?: number | null;

  // Neuromuscular & Injury History
  injury_previous_knee_injury?: number | null;
  injury_acl_history?: number | null;
  injury_meniscal_history?: number | null;
}

export interface KneevaTriagePayload {
  patient_id: string;
  abha_number?: string | null;
  patient_metadata: KneevaPatientMetadata;
  questionnaire: KneevaQuestionnaire;
  sensor_features: KneevaSensorFeatures;
}

export interface KneevaTriageResponse {
  patient_id: string;
  oa_risk_score: number; // e.g. 0.825 (82.5%)
  oa_risk_category: 'low' | 'moderate' | 'high' | string;
  confidence_interval: [number, number];
  feature_importance: Record<string, number>;
  clinical_explanation: string;
  clinical_action: string;
  differential_signal: boolean;
  differential_flags: string[];
  missing_modality_count: number;
  effective_bmi: number;
}

export interface WalkTestResult {
  durationSeconds: number;
  stepCount: number;
  cadence: number; // steps per minute
  strideTimeCV: number; // std(step_times) / mean(step_times)
  stepTimes: number[]; // seconds between consecutive heel-strikes
  peaks: { timestamp: number; value: number }[];
  stepTimeAsymmetry?: number;
  swingTimeAsymmetry?: number;
  gaitSpeedMs?: number;
}
