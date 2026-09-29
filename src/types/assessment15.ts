/**
 * Kneeva: 15-Minute Assessment Routine Types & Specifications
 */

export interface StepTimeBudget {
  stepNumber: number;
  id: string;
  name: string;
  shortName: string;
  durationSeconds: number; // e.g. 90 for 1.5 min
  plannedStart: string; // "0:00"
  plannedEnd: string;   // "1:30"
  description: string;
  purpose: string;
}

export const ASSESSMENT_15_STEPS: StepTimeBudget[] = [
  {
    stepNumber: 1,
    id: 'questionnaire',
    name: 'Clinical Intake & Symptom Survey',
    shortName: 'Questionnaire',
    durationSeconds: 90,
    plannedStart: '0:00',
    plannedEnd: '1:30',
    description: 'Patient background, baseline VAS pain score, and joint impairment domain subscores.',
    purpose: 'Establish subjective pain, stiffness, and physical function baselines.',
  },
  {
    stepNumber: 2,
    id: 'calibration',
    name: 'Quiet Standing & Sensor Calibration',
    shortName: 'Calibration',
    durationSeconds: 60,
    plannedStart: '1:30',
    plannedEnd: '2:30',
    description: 'Neutral 0° flex check, resting RF & BF muscle noise baseline, and IMU gravity alignment.',
    purpose: 'Zero reference drift and ensure high signal-to-noise ratio.',
  },
  {
    stepNumber: 3,
    id: 'strength',
    name: 'Isometric Knee Strength Test (Force Proxy)',
    shortName: 'Strength Test',
    durationSeconds: 180,
    plannedStart: '2:30',
    plannedEnd: '5:30',
    description: '3 maximal extension and flexion push trials, measuring peak torque, L vs R asymmetry, and RF/BF drive.',
    purpose: 'Quantify quadriceps weakness and limb force asymmetry.',
  },
  {
    stepNumber: 4,
    id: 'chair_stand',
    name: '30-Second Chair Stand (Sit-to-Stand)',
    shortName: 'Chair Stand',
    durationSeconds: 60,
    plannedStart: '5:30',
    plannedEnd: '6:30',
    description: 'Repeated standing reps, measuring knee ROM peaks, sit/stand velocities, fatigue decay, and piezo crepitus.',
    purpose: 'Assess functional lower-limb power and joint sound emissions under load.',
  },
  {
    stepNumber: 5,
    id: 'tug',
    name: 'Timed Up and Go (TUG)',
    shortName: 'TUG Test',
    durationSeconds: 90,
    plannedStart: '6:30',
    plannedEnd: '8:00',
    description: 'Stand, walk 3m, turn 180°, return, and sit down with phase segmentation and transition EMG drive.',
    purpose: 'Evaluate dynamic balance, turn velocity, and fall risk score.',
  },
  {
    stepNumber: 6,
    id: 'walking',
    name: 'Comfortable & Fast Walking (40m)',
    shortName: 'Gait Analysis',
    durationSeconds: 180,
    plannedStart: '8:00',
    plannedEnd: '11:00',
    description: 'Bilateral knee flexion curves (0-100% cycle), stride time CV, RF/BF co-contraction, and crepitus spectrogram.',
    purpose: 'Identify antalgic gait compensation, guarding, and joint sound bursts.',
  },
  {
    stepNumber: 7,
    id: 'stairs',
    name: 'Stair Ascent & Descent',
    shortName: 'Stair Climb',
    durationSeconds: 120,
    plannedStart: '11:00',
    plannedEnd: '13:00',
    description: 'Step-over-step stair climbing with phase labeling, peak angular velocity, eccentric descent co-contraction, and deep flexion crepitus.',
    purpose: 'High mechanical patellofemoral joint stress analysis.',
  },
  {
    stepNumber: 8,
    id: 'balance',
    name: 'Single-Leg Stance Balance Test',
    shortName: 'Single Stance',
    durationSeconds: 60,
    plannedStart: '13:00',
    plannedEnd: '14:00',
    description: 'Left vs Right unipedal balance stability, center-of-mass sway trajectory (X-Y), sway area, and EMG stabilization micro-bursts.',
    purpose: 'Assess unipedal proprioception and joint stability.',
  },
  {
    stepNumber: 9,
    id: 'recovery',
    name: 'Post-Test Pain & Joint Recovery',
    shortName: 'Recovery',
    durationSeconds: 60,
    plannedStart: '14:00',
    plannedEnd: '15:00',
    description: 'Post-exercise VAS pain, session pain timeline (Start -> Strength -> Movement -> Recovery), and joint stiffness duration.',
    purpose: 'Gauge acute inflammatory reaction and post-exertional pain flare.',
  },
];

// ─────────────────────────────────────────────────────────────
// Data Types for Each Step
// ─────────────────────────────────────────────────────────────

export interface Step1QuestionnaireData {
  painScoreBaseline: number; // 0-10
  symptomPain: number;        // 0-20
  symptomStiffness: number;   // 0-8
  symptomFunction: number;    // 0-68
  symptomTotalNormalized: number; // 0-100%
  dailyInclineHours: number;
  carriedLoadKg: number;
}

export interface Step2CalibrationData {
  leftFlexAngleBaseline: number;  // ~0 deg
  rightFlexAngleBaseline: number; // ~0 deg
  rfRestingNoiseMv: number;       // e.g. 12 mV
  bfRestingNoiseMv: number;       // e.g. 15 mV
  imuGravityVector: { x: number; y: number; z: number }; // ~ (0.05, 0.98, 0.02)
  isCalibrated: boolean;
}

export interface StrengthTrial {
  trialNumber: number;
  peakForceN: number;
  rfEmgPeakMv: number;
  bfEmgPeakMv: number;
  timeToPeakSeconds: number;
  forceTimeSeries: number[];
  rfEmgSeries: number[];
  bfEmgSeries: number[];
}

export interface Step3StrengthData {
  leftTrials: StrengthTrial[];
  rightTrials: StrengthTrial[];
  peakForceLeftN: number;
  peakForceRightN: number;
  asymmetryPct: number; // e.g. 18.5%
  fatigueIndexPct: number; // drop from trial 1 to 3
}

export interface ChairRep {
  repNumber: number;
  durationSeconds: number;
  peakFlexionDeg: number;
  peakAngularVelocityDps: number;
  crepitusSpikes: number;
}

export interface Step4ChairStandData {
  totalReps: number;
  referenceThresholdReps: number; // e.g. 14
  repList: ChairRep[];
  meanRepDuration: number;
  fatigueDecayPct: number;
  crepitusTotalEvents: number;
  timeSeriesFlexion: number[];
  timeSeriesAngularVelocity: number[];
  timeSeriesPiezo: number[];
  timeSeriesRfEmg: number[];
  timeSeriesBfEmg: number[];
}

export interface Step5TugData {
  totalDurationSeconds: number;
  referenceThresholdSeconds: number; // e.g. 10.0s
  fallRiskTier: 'Normal' | 'Moderate' | 'High';
  phaseDurations: {
    stand: number;
    walkOut: number;
    turn: number;
    walkBack: number;
    sit: number;
  };
  peakStandAngularVelocityDps: number;
  peakTurnAngularVelocityDps: number;
  standEffortRfMv: number;
  sitEffortBfMv: number;
  timeSeriesVelocity: number[];
  timeSeriesFlexion: number[];
}

export interface Step6WalkingData {
  comfortableSpeedMs: number;
  fastSpeedMs: number;
  stepCadenceSpm: number;
  strideTimeCvPct: number; // e.g. 6.2%
  meanGaitCycleFlexionLeft: number[];  // 0-100% normalized
  meanGaitCycleFlexionRight: number[]; // 0-100% normalized
  coContractionIndex: number;          // e.g. 0.42
  piezoCrepitusBursts: number;
  rfFiringWindow: [number, number];    // % of gait cycle
  bfFiringWindow: [number, number];
}

export interface Step7StairsData {
  ascentDurationSeconds: number;
  descentDurationSeconds: number;
  ascentPeakFlexionDeg: number;
  descentPeakFlexionDeg: number;
  ascentPeakAngularVelocityDps: number;
  descentPeakAngularVelocityDps: number;
  ascentCci: number;
  descentCci: number;
  crepitusDeepFlexionCount: number;
  timeSeriesFlexion: number[];
  timeSeriesRfEmg: number[];
  timeSeriesBfEmg: number[];
}

export interface Step8BalanceData {
  leftHoldSeconds: number;
  rightHoldSeconds: number;
  normativeHoldSeconds: number; // 30s
  leftSwayAreaCm2: number;
  rightSwayAreaCm2: number;
  leftSwayPathXy: [number, number][];
  rightSwayPathXy: [number, number][];
  stabilizationEffortRfMv: number;
  stabilizationEffortBfMv: number;
}

export interface Step9RecoveryData {
  painTimeline: {
    start: number;
    postStrength: number;
    endMovement: number;
    recovery: number;
  };
  stiffnessDurationMinutes: number;
  recoveryIndex: 'Fast' | 'Moderate' | 'Delayed';
}

export interface StepExecutionLog {
  stepNumber: number;
  id: string;
  name: string;
  plannedDurationSeconds: number;
  actualDurationSeconds: number;
  status: 'completed' | 'skipped' | 'running' | 'pending';
  completedAtIso: string;
}

// ─────────────────────────────────────────────────────────────
// Final Combined 15-Minute Report Payload
// ─────────────────────────────────────────────────────────────

export interface Final15MinuteReport {
  sessionId: string;
  patientId: string;
  conductedAtIso: string;
  totalPlannedDurationSeconds: number; // 900s
  totalActualDurationSeconds: number;
  logs: StepExecutionLog[];

  // Step-Specific Data
  step1: Step1QuestionnaireData;
  step2: Step2CalibrationData;
  step3: Step3StrengthData;
  step4: Step4ChairStandData;
  step5: Step5TugData;
  step6: Step6WalkingData;
  step7: Step7StairsData;
  step8: Step8BalanceData;
  step9: Step9RecoveryData;

  // Integrated Multimodal Clinical Evaluation
  overallOaRiskTier: 'Low' | 'Moderate' | 'High';
  overallOaRiskScore: number; // 0.0 - 1.0
  confidenceInterval: [number, number];
  primaryContributingFactors: string[];
  clinicalRecommendations: string[];
  inferenceSource?: 'CATBOOST_CLOUD_LIVE' | 'LOCAL_OFFLINE_FALLBACK';
  modelName?: string;

  // Bilateral Comparisons
  bilateralComparison: {
    romMaxFlexionDeg: { left: number; right: number };
    peakStrengthN: { left: number; right: number };
    crepitusTotalEvents: { left: number; right: number };
    emgActivationRfY: { left: number; right: number };
  };

  // Co-Contraction Indices across activities
  taskCoContraction: {
    chairStand: number;
    flatWalk: number;
    stairAscent: number;
    stairDescent: number;
  };

  // Trends vs baseline
  baselineTrends: {
    romDeltaDeg: number;
    strengthDeltaPct: number;
    tugDeltaSeconds: number;
    painDeltaPoints: number;
  };
}
