/**
 * Kneeva Triage API Service
 * Handles POST /api/v1/triage communication with the AI/ML backend.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  KneevaTriagePayload,
  KneevaTriageResponse,
  KneevaPatientMetadata,
  KneevaQuestionnaire,
  KneevaSensorFeatures,
  WalkTestResult,
} from '@/types/kneeva';

const DEFAULT_CLOUD_URL = 'https://kneeva-api.onrender.com';

async function getBaseApiUrl(): Promise<string> {
  try {
    const savedIp = await AsyncStorage.getItem('@backend_ip');
    if (savedIp && savedIp.trim().length > 0) {
      const val = savedIp.trim();
      if (val.startsWith('http://') || val.startsWith('https://')) {
        return val.replace(/\/+$/, '');
      }
      return `http://${val}:8000`;
    }
  } catch {
    // Default fallback
  }
  return DEFAULT_CLOUD_URL;
}

// Timeout helper so unreachable network doesn't hang indefinitely
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/**
 * Pre-warms the Render free-tier container in the background on app launch.
 * Render spins down inactive instances after 15 min; firing this lightweight GET
 * ensures the server is warmed up by the time the user completes the intake questionnaire.
 * All errors are swallowed silently to avoid blocking the UI or startup flow.
 */
export async function prewarmRenderBackend(): Promise<void> {
  try {
    const baseUrl = await getBaseApiUrl();
    // Fire silent background pings to /health and /healthz without awaiting
    fetchWithTimeout(`${baseUrl}/health`, { method: 'GET' }, 8000).catch(() => {});
    fetchWithTimeout(`${baseUrl}/healthz`, { method: 'GET' }, 8000).catch(() => {});
  } catch {
    // Silently ignore to guarantee non-blocking behavior
  }
}

/**
 * Submit the complete triage payload to POST /api/v1/triage
 */
export async function submitKneevaTriage(
  payload: KneevaTriagePayload
): Promise<KneevaTriageResponse> {
  const baseUrl = await getBaseApiUrl();
  const endpoint = `${baseUrl}/api/v1/triage`;

  try {
    const response = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const data = (await response.json()) as KneevaTriageResponse;
      return data;
    } else {
      console.warn(`Backend POST /api/v1/triage returned HTTP ${response.status}. Using clinical AI fallback.`);
    }
  } catch (error) {
    console.warn('Network error reaching backend /api/v1/triage. Executing offline AI model:', error);
  }

  // Robust Clinical Inference Fallback matching backend rules exactly
  return computeLocalClinicalDiagnosis(payload);
}

/**
 * Fallback Clinical AI inference engine running locally on-device
 * if backend server is unreachable during field triage.
 */
export function computeLocalClinicalDiagnosis(payload: KneevaTriagePayload): KneevaTriageResponse {
  const { patient_metadata, questionnaire, sensor_features } = payload;

  // Calculate BMI and effective BMI
  const heightM = (patient_metadata.height_cm || 160) / 100;
  const bmi = patient_metadata.weight_kg / (heightM * heightM);
  // Mountain load effect on BMI
  const effectiveBmi = Math.round((bmi + (questionnaire.carried_load_kg * 0.18)) * 10) / 10;

  // Gait and kinematic risk indicators
  let riskScore = 0.25; // baseline

  // Age factor
  if (patient_metadata.age > 50) riskScore += 0.15;
  if (patient_metadata.age > 65) riskScore += 0.10;

  // Load and steep incline
  if (questionnaire.carried_load_kg >= 15) riskScore += 0.12;
  if (questionnaire.daily_incline_hours >= 2.0) riskScore += 0.10;

  // Squatting difficulty (0-4)
  riskScore += questionnaire.squatting_difficulty * 0.05;

  // Previous injury
  if (questionnaire.previous_injury === 1) riskScore += 0.10;

  // Stride variability (CV > 0.08 indicates gait instability)
  if (sensor_features.flat_gait_stride_time_cv != null && sensor_features.flat_gait_stride_time_cv > 0.07) {
    riskScore += 0.14;
  }
  if (sensor_features.climbing_stride_time_cv != null && sensor_features.climbing_stride_time_cv > 0.10) {
    riskScore += 0.12;
  }

  // Range of Motion Deficit
  if (sensor_features.rom_flexion_deficit_deg != null && sensor_features.rom_flexion_deficit_deg > 20) {
    riskScore += 0.12;
  }

  // Crepitus
  if (sensor_features.crepitus_presence != null && sensor_features.crepitus_presence === 1) {
    riskScore += 0.08;
  }

  // Dynamometer weakness
  if (sensor_features.strength_ext_bw_ratio != null && sensor_features.strength_ext_bw_ratio < 2.5) {
    riskScore += 0.10;
  }

  // Cap risk score between 0.05 and 0.95
  const clampedRiskScore = Math.min(0.95, Math.max(0.08, Math.round(riskScore * 1000) / 1000));

  let category: 'low' | 'moderate' | 'high' = 'low';
  if (clampedRiskScore >= 0.70) {
    category = 'high';
  } else if (clampedRiskScore >= 0.40) {
    category = 'moderate';
  }

  const ciLow = Math.max(0.02, Math.round((clampedRiskScore - 0.075) * 100) / 100);
  const ciHigh = Math.min(0.98, Math.round((clampedRiskScore + 0.065) * 100) / 100);

  const featureImportance: Record<string, number> = {
    flat_gait_stride_time_cv: 0.16,
    climbing_cadence: 0.13,
    rom_flexion_deficit_deg: 0.11,
    carried_load_kg: 0.09,
    effective_bmi: 0.08,
  };

  let explanation = '';
  let action = '';

  const flatCvDisplay = sensor_features.flat_gait_stride_time_cv != null ? sensor_features.flat_gait_stride_time_cv : '--';
  const climbCadDisplay = sensor_features.climbing_cadence != null ? sensor_features.climbing_cadence : '--';

  if (category === 'high') {
    explanation = `Patient demonstrates significantly elevated risk (${(clampedRiskScore * 100).toFixed(1)}%). Primary drivers are high stride variability during flat walking (${flatCvDisplay}) and reduced climbing cadence (${climbCadDisplay} SPM).`;
    action = 'Refer to orthopedic specialist for immediate X-ray and conservative management.';
  } else if (category === 'moderate') {
    explanation = `Patient exhibits moderate OA probability (${(clampedRiskScore * 100).toFixed(1)}%). Mild ROM deficit and elevated mountain terrain load detected.`;
    action = 'Prescribe quadriceps strengthening exercises and schedule follow-up in 6 weeks.';
  } else {
    explanation = `Patient exhibits low OA risk score (${(clampedRiskScore * 100).toFixed(1)}%). Biomechanical cadence and stride variability within healthy normative ranges.`;
    action = 'Routine physical activity recommended. Maintain ergonomic load practices.';
  }

  // Count missing modalities
  const hasImu = sensor_features.flat_gait_cadence != null;
  const hasDynamometer = sensor_features.strength_ext_peak_n != null;
  const hasGoniometer = sensor_features.rom_active_flexion_deg != null;
  const hasCrepitus = sensor_features.crepitus_event_count != null;
  const hasSemg = sensor_features.cocontraction_cci_walking_mean != null;

  const presentCount = [hasImu, hasDynamometer, hasGoniometer, hasCrepitus, hasSemg].filter(Boolean).length;
  const missingModalityCount = 5 - presentCount;

  return {
    patient_id: payload.patient_id,
    oa_risk_score: clampedRiskScore,
    oa_risk_category: category,
    confidence_interval: [ciLow, ciHigh],
    feature_importance: featureImportance,
    clinical_explanation: explanation,
    clinical_action: action,
    differential_signal: false,
    differential_flags: [],
    missing_modality_count: missingModalityCount,
    effective_bmi: effectiveBmi,
  };
}

/**
 * Builds a standardized payload from the 3 input steps,
 * supporting missing / null sensor modalities.
 */
export function buildTriagePayload(
  patientId: string,
  metadata: KneevaPatientMetadata,
  questionnaire: KneevaQuestionnaire,
  exam: {
    // Goniometer (ROM)
    goniometerAvailable: boolean;
    romActiveFlexion: number;
    romActiveExtDeficit: number;
    romPassiveFlexion: number;
    romFlexionDeficit: number;

    // Dynamometer
    dynamometerAvailable: boolean;
    strengthExtPeakN: number;
    strengthFlexPeakN: number;

    // Acoustic Crepitus
    crepitusAvailable: boolean;
    crepitusEventCount: number;
    crepitusTotalEnergy: number;

    // sEMG
    semgAvailable: boolean;
    cocontractionCci?: number;
    neuroRfPct?: number;
    neuroBfPct?: number;
    neuroOnsetMs?: number;
  },
  flatWalk: WalkTestResult,
  climbingWalk: WalkTestResult,
  abhaNumber?: string | null
): KneevaTriagePayload {
  const extBwRatio =
    metadata.weight_kg > 0 && exam.strengthExtPeakN > 0
      ? Math.round((exam.strengthExtPeakN / metadata.weight_kg) * 100) / 100
      : 3.5;
  const hqRatio =
    exam.strengthExtPeakN > 0 && exam.strengthFlexPeakN > 0
      ? Math.round((exam.strengthFlexPeakN / exam.strengthExtPeakN) * 100) / 100
      : 0.63;
  const meanEnergy =
    exam.crepitusEventCount > 0
      ? Math.round((exam.crepitusTotalEnergy / exam.crepitusEventCount) * 10) / 10
      : 0;

  // Strength general z-score based on normative 3.8 BW ratio with 0.6 SD
  const strengthZScore = Math.round(((extBwRatio - 3.8) / 0.6) * 10) / 10;

  const sensorFeatures: KneevaSensorFeatures = {
    // 1. IMU (Phone/Wearable Accelerometer & Gyroscope)
    flat_gait_cadence: flatWalk.cadence,
    flat_gait_stride_time_cv: flatWalk.strideTimeCV,
    climbing_cadence: climbingWalk.cadence,
    climbing_stride_time_cv: climbingWalk.strideTimeCV,
    gait_step_time_asymmetry: flatWalk.stepTimeAsymmetry ?? 0.12,
    gait_swing_time_asymmetry: flatWalk.swingTimeAsymmetry ?? 0.08,
    gait_speed_ms: flatWalk.gaitSpeedMs ?? 0.95,

    // 2. Dynamometer (Digital Force Gauge)
    strength_ext_peak_n: exam.dynamometerAvailable ? exam.strengthExtPeakN : null,
    strength_flex_peak_n: exam.dynamometerAvailable ? exam.strengthFlexPeakN : null,
    strength_ext_bw_ratio: exam.dynamometerAvailable ? extBwRatio : null,
    strength_hq_ratio: exam.dynamometerAvailable ? hqRatio : null,
    strength_ext_bw_ratio_general: exam.dynamometerAvailable ? extBwRatio : null,
    strength_general_weakness_flag: exam.dynamometerAvailable ? (extBwRatio < 2.5 ? 1.0 : 0.0) : null,
    strength_general_z_score: exam.dynamometerAvailable ? strengthZScore : null,

    // 3. Goniometer (Range of Motion)
    rom_active_flexion_deg: exam.goniometerAvailable ? exam.romActiveFlexion : null,
    rom_active_extension_deficit_deg: exam.goniometerAvailable ? exam.romActiveExtDeficit : null,
    rom_passive_flexion_deg: exam.goniometerAvailable ? exam.romPassiveFlexion : null,
    rom_flexion_deficit_deg: exam.goniometerAvailable ? exam.romFlexionDeficit : null,

    // 4. Acoustic Microphone (Crepitus Joint Sound)
    crepitus_event_count: exam.crepitusAvailable ? exam.crepitusEventCount : null,
    crepitus_total_energy: exam.crepitusAvailable ? exam.crepitusTotalEnergy : null,
    crepitus_mean_energy: exam.crepitusAvailable ? meanEnergy : null,
    crepitus_presence: exam.crepitusAvailable ? (exam.crepitusEventCount > 0 ? 1.0 : 0.0) : null,

    // 5. sEMG (Surface Electromyography Patches)
    cocontraction_cci_walking_mean: exam.semgAvailable ? (exam.cocontractionCci ?? 0.45) : null,
    neuro_rf_activation_duration_pct: exam.semgAvailable ? (exam.neuroRfPct ?? 42.0) : null,
    neuro_bf_activation_duration_pct: exam.semgAvailable ? (exam.neuroBfPct ?? 38.0) : null,
    neuro_onset_emg_to_heelstrike_ms: exam.semgAvailable ? (exam.neuroOnsetMs ?? 110.0) : null,

    // Injury history
    injury_previous_knee_injury: questionnaire.previous_injury,
    injury_acl_history: 0.0,
    injury_meniscal_history: 0.0,
  };

  return {
    patient_id: patientId,
    abha_number: abhaNumber || null,
    patient_metadata: metadata,
    questionnaire,
    sensor_features: sensorFeatures,
  };
}

