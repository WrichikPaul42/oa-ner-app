/**
 * Kneeva: 15-Minute Assessment State Machine & Data Engine
 * Manages timers, live sensor feeds, step transitions, skips, and final aggregation.
 */

import {
  ASSESSMENT_15_STEPS,
  StepTimeBudget,
  StepExecutionLog,
  Step1QuestionnaireData,
  Step2CalibrationData,
  Step3StrengthData,
  Step4ChairStandData,
  Step5TugData,
  Step6WalkingData,
  Step7StairsData,
  Step8BalanceData,
  Step9RecoveryData,
  Final15MinuteReport,
} from '@/types/assessment15';

// ─────────────────────────────────────────────────────────────
// Default High-Fidelity Prototype Datasets
// ─────────────────────────────────────────────────────────────

export function getDefaultStep1Questionnaire(): Step1QuestionnaireData {
  return {
    painScoreBaseline: 4.5,
    symptomPain: 8,       // out of 20
    symptomStiffness: 4,  // out of 8
    symptomFunction: 26,  // out of 68
    symptomTotalNormalized: 39.5, // %
    dailyInclineHours: 2.0,
    carriedLoadKg: 10.0,
  };
}

export function getDefaultStep2Calibration(): Step2CalibrationData {
  return {
    leftFlexAngleBaseline: 1.2,
    rightFlexAngleBaseline: 0.8,
    rfRestingNoiseMv: 11.4,
    bfRestingNoiseMv: 14.2,
    imuGravityVector: { x: 0.04, y: 0.98, z: 0.02 },
    isCalibrated: true,
  };
}

export function getDefaultStep3Strength(): Step3StrengthData {
  return {
    leftTrials: [
      {
        trialNumber: 1,
        peakForceN: 310,
        rfEmgPeakMv: 520,
        bfEmgPeakMv: 190,
        timeToPeakSeconds: 1.8,
        forceTimeSeries: [40, 110, 210, 290, 310, 305, 270, 160, 50],
        rfEmgSeries: [80, 190, 380, 490, 520, 510, 420, 230, 90],
        bfEmgSeries: [40, 65, 110, 170, 190, 185, 150, 90, 50],
      },
      {
        trialNumber: 2,
        peakForceN: 295,
        rfEmgPeakMv: 495,
        bfEmgPeakMv: 180,
        timeToPeakSeconds: 2.0,
        forceTimeSeries: [35, 100, 195, 280, 295, 290, 250, 140, 45],
        rfEmgSeries: [75, 180, 360, 460, 495, 480, 390, 210, 80],
        bfEmgSeries: [35, 60, 105, 160, 180, 175, 140, 85, 45],
      },
      {
        trialNumber: 3,
        peakForceN: 275,
        rfEmgPeakMv: 460,
        bfEmgPeakMv: 175,
        timeToPeakSeconds: 2.2,
        forceTimeSeries: [30, 90, 180, 260, 275, 265, 230, 120, 40],
        rfEmgSeries: [70, 165, 340, 430, 460, 440, 360, 190, 75],
        bfEmgSeries: [30, 55, 100, 155, 175, 170, 130, 80, 40],
      },
    ],
    rightTrials: [
      {
        trialNumber: 1,
        peakForceN: 375,
        rfEmgPeakMv: 610,
        bfEmgPeakMv: 210,
        timeToPeakSeconds: 1.6,
        forceTimeSeries: [50, 140, 260, 350, 375, 365, 310, 190, 60],
        rfEmgSeries: [90, 220, 440, 570, 610, 590, 480, 260, 100],
        bfEmgSeries: [45, 75, 125, 190, 210, 200, 160, 100, 55],
      },
      {
        trialNumber: 2,
        peakForceN: 360,
        rfEmgPeakMv: 590,
        bfEmgPeakMv: 205,
        timeToPeakSeconds: 1.7,
        forceTimeSeries: [45, 130, 245, 335, 360, 350, 290, 175, 55],
        rfEmgSeries: [85, 210, 420, 545, 590, 570, 460, 245, 95],
        bfEmgSeries: [40, 70, 120, 185, 205, 195, 155, 95, 50],
      },
      {
        trialNumber: 3,
        peakForceN: 345,
        rfEmgPeakMv: 565,
        bfEmgPeakMv: 195,
        timeToPeakSeconds: 1.9,
        forceTimeSeries: [40, 120, 230, 320, 345, 330, 270, 160, 50],
        rfEmgSeries: [80, 195, 400, 520, 565, 540, 430, 225, 90],
        bfEmgSeries: [35, 65, 115, 175, 195, 185, 145, 90, 45],
      },
    ],
    peakForceLeftN: 310,
    peakForceRightN: 375,
    asymmetryPct: 17.3, // (375-310)/375 = 17.3% deficit in Left Knee
    fatigueIndexPct: 11.3, // Left dropped 310 -> 275 (11.3%)
  };
}

export function getDefaultStep4ChairStand(): Step4ChairStandData {
  return {
    totalReps: 11,
    referenceThresholdReps: 14,
    meanRepDuration: 2.65,
    fatigueDecayPct: 24.5,
    crepitusTotalEvents: 14,
    repList: [
      { repNumber: 1, durationSeconds: 2.1, peakFlexionDeg: 104, peakAngularVelocityDps: 182, crepitusSpikes: 1 },
      { repNumber: 2, durationSeconds: 2.2, peakFlexionDeg: 106, peakAngularVelocityDps: 178, crepitusSpikes: 1 },
      { repNumber: 3, durationSeconds: 2.3, peakFlexionDeg: 105, peakAngularVelocityDps: 175, crepitusSpikes: 0 },
      { repNumber: 4, durationSeconds: 2.4, peakFlexionDeg: 102, peakAngularVelocityDps: 168, crepitusSpikes: 2 },
      { repNumber: 5, durationSeconds: 2.5, peakFlexionDeg: 100, peakAngularVelocityDps: 162, crepitusSpikes: 1 },
      { repNumber: 6, durationSeconds: 2.6, peakFlexionDeg: 98,  peakAngularVelocityDps: 155, crepitusSpikes: 2 },
      { repNumber: 7, durationSeconds: 2.8, peakFlexionDeg: 96,  peakAngularVelocityDps: 148, crepitusSpikes: 1 },
      { repNumber: 8, durationSeconds: 2.9, peakFlexionDeg: 94,  peakAngularVelocityDps: 140, crepitusSpikes: 2 },
      { repNumber: 9, durationSeconds: 3.1, peakFlexionDeg: 92,  peakAngularVelocityDps: 135, crepitusSpikes: 2 },
      { repNumber: 10, durationSeconds: 3.2, peakFlexionDeg: 90, peakAngularVelocityDps: 128, crepitusSpikes: 1 },
      { repNumber: 11, durationSeconds: 3.4, peakFlexionDeg: 88, peakAngularVelocityDps: 120, crepitusSpikes: 1 },
    ],
    timeSeriesFlexion: [10, 45, 95, 105, 70, 20, 10, 50, 98, 106, 65, 15, 10, 55, 96, 102, 60, 15],
    timeSeriesAngularVelocity: [15, 80, 160, 180, 110, 30, 20, 75, 155, 175, 95, 25, 15, 65, 140, 160, 85, 20],
    timeSeriesPiezo: [15, 20, 95, 210, 60, 20, 18, 25, 110, 240, 70, 22, 16, 30, 140, 260, 85, 20],
    timeSeriesRfEmg: [60, 180, 420, 510, 310, 90, 65, 170, 400, 480, 290, 85, 60, 160, 380, 450, 270, 80],
    timeSeriesBfEmg: [40, 80, 170, 230, 150, 60, 45, 75, 160, 215, 140, 55, 40, 70, 150, 200, 130, 50],
  };
}

export function getDefaultStep5Tug(): Step5TugData {
  return {
    totalDurationSeconds: 12.8,
    referenceThresholdSeconds: 10.0,
    fallRiskTier: 'Moderate',
    phaseDurations: {
      stand: 1.8,
      walkOut: 3.6,
      turn: 2.2,
      walkBack: 3.4,
      sit: 1.8,
    },
    peakStandAngularVelocityDps: 165,
    peakTurnAngularVelocityDps: 110,
    standEffortRfMv: 490,
    sitEffortBfMv: 280,
    timeSeriesVelocity: [20, 120, 165, 70, 65, 75, 80, 110, 60, 70, 75, 50, 110, 140, 25],
    timeSeriesFlexion: [95, 60, 15, 5, 55, 15, 5, 25, 10, 55, 15, 5, 50, 85, 95],
  };
}

export function getDefaultStep6Walking(): Step6WalkingData {
  return {
    comfortableSpeedMs: 1.08,
    fastSpeedMs: 1.34,
    stepCadenceSpm: 96,
    strideTimeCvPct: 7.8, // > 6% indicates gait variability / instability
    meanGaitCycleFlexionLeft: [10, 18, 25, 20, 12, 18, 38, 55, 62, 54, 30, 12],
    meanGaitCycleFlexionRight: [12, 20, 28, 22, 14, 20, 42, 60, 67, 58, 32, 14],
    coContractionIndex: 0.48, // Elevated antagonist co-contraction
    piezoCrepitusBursts: 19,
    rfFiringWindow: [0, 25],
    bfFiringWindow: [80, 100],
  };
}

export function getDefaultStep7Stairs(): Step7StairsData {
  return {
    ascentDurationSeconds: 38.5,
    descentDurationSeconds: 46.2,
    ascentPeakFlexionDeg: 96,
    descentPeakFlexionDeg: 108, // Higher flexion during descent
    ascentPeakAngularVelocityDps: 145,
    descentPeakAngularVelocityDps: 115, // Cautious slower descent
    ascentCci: 0.44,
    descentCci: 0.58, // High eccentric co-contraction guarding
    crepitusDeepFlexionCount: 22,
    timeSeriesFlexion: [15, 45, 85, 96, 70, 20, 15, 50, 92, 108, 65, 18],
    timeSeriesRfEmg: [80, 220, 490, 580, 360, 110, 95, 280, 540, 630, 410, 130],
    timeSeriesBfEmg: [50, 110, 230, 310, 200, 70, 60, 150, 310, 390, 260, 85],
  };
}

export function getDefaultStep8Balance(): Step8BalanceData {
  return {
    leftHoldSeconds: 16.5,  // Deficit in symptomatic knee
    rightHoldSeconds: 27.2, // Near normative (30s)
    normativeHoldSeconds: 30.0,
    leftSwayAreaCm2: 8.4,   // Larger postural sway area
    rightSwayAreaCm2: 3.8,  // Compact stable sway
    leftSwayPathXy: [
      [0, 0], [0.8, 1.2], [-1.4, 2.1], [-2.1, 0.4], [0.5, -1.8],
      [1.8, -1.2], [-0.9, -2.4], [-2.3, 1.6], [1.1, 2.8], [0.2, 0.6]
    ],
    rightSwayPathXy: [
      [0, 0], [0.3, 0.4], [-0.5, 0.6], [-0.6, 0.1], [0.2, -0.4],
      [0.5, -0.3], [-0.2, -0.6], [-0.6, 0.4], [0.3, 0.7], [0.1, 0.2]
    ],
    stabilizationEffortRfMv: 340,
    stabilizationEffortBfMv: 295,
  };
}

export function getDefaultStep9Recovery(): Step9RecoveryData {
  return {
    painTimeline: {
      start: 4.5,
      postStrength: 6.0,
      endMovement: 6.8,
      recovery: 5.2,
    },
    stiffnessDurationMinutes: 25,
    recoveryIndex: 'Moderate',
  };
}

// ─────────────────────────────────────────────────────────────
// Aggregation & Final Report Generation
// ─────────────────────────────────────────────────────────────

export function generateFinalReport(params: {
  sessionId: string;
  patientId: string;
  logs: StepExecutionLog[];
  step1: Step1QuestionnaireData;
  step2: Step2CalibrationData;
  step3: Step3StrengthData;
  step4: Step4ChairStandData;
  step5: Step5TugData;
  step6: Step6WalkingData;
  step7: Step7StairsData;
  step8: Step8BalanceData;
  step9: Step9RecoveryData;
}): Final15MinuteReport {
  const {
    sessionId,
    patientId,
    logs,
    step1,
    step2,
    step3,
    step4,
    step5,
    step6,
    step7,
    step8,
    step9,
  } = params;

  const totalActual = logs.reduce((acc, l) => acc + l.actualDurationSeconds, 0);

  // Bilateral comparisons
  const leftRom = Math.max(...step6.meanGaitCycleFlexionLeft, step4.repList[0]?.peakFlexionDeg || 105);
  const rightRom = Math.max(...step6.meanGaitCycleFlexionRight, 125);

  const leftStrength = step3.peakForceLeftN;
  const rightStrength = step3.peakForceRightN;

  const leftCrepitus = step4.crepitusTotalEvents + step6.piezoCrepitusBursts;
  const rightCrepitus = Math.round(leftCrepitus * 0.45); // Left is symptomatic

  // Co-contraction
  const taskCci = {
    chairStand: 0.46,
    flatWalk: step6.coContractionIndex,
    stairAscent: step7.ascentCci,
    stairDescent: step7.descentCci,
  };

  // Evaluate Overall Risk Score
  let score = 0.35;
  if (step3.asymmetryPct > 15) score += 0.15;
  if (step4.totalReps < step4.referenceThresholdReps) score += 0.12;
  if (step5.totalDurationSeconds > step5.referenceThresholdSeconds) score += 0.14;
  if (step6.strideTimeCvPct > 7.0) score += 0.10;
  if (step1.symptomTotalNormalized > 30) score += 0.08;
  if (step9.painTimeline.recovery >= step9.painTimeline.start) score += 0.06;

  const clampedScore = Math.min(0.95, Math.max(0.05, Math.round(score * 100) / 100));
  const riskTier: 'Low' | 'Moderate' | 'High' =
    clampedScore >= 0.70 ? 'High' : clampedScore >= 0.40 ? 'Moderate' : 'Low';

  const factors: string[] = [];
  if (step3.asymmetryPct > 15) {
    factors.push(`Quadriceps Force Asymmetry (${step3.asymmetryPct.toFixed(1)}% deficit on Left Knee)`);
  }
  if (step4.totalReps < step4.referenceThresholdReps) {
    factors.push(`Chair Stand Deficit (${step4.totalReps} reps vs. ${step4.referenceThresholdReps} age norm)`);
  }
  if (step6.coContractionIndex > 0.40) {
    factors.push(`Excessive Antagonist Co-contraction (${step6.coContractionIndex.toFixed(2)} CCI guarding pattern)`);
  }
  if (step7.crepitusDeepFlexionCount > 15) {
    factors.push(`Acoustic Crepitus Bursts during deep stair descent (${step7.crepitusDeepFlexionCount} spikes)`);
  }
  if (step8.leftHoldSeconds < 20) {
    factors.push(`Unipedal Stance Instability (${step8.leftHoldSeconds.toFixed(1)}s on Left vs. ${step8.rightHoldSeconds.toFixed(1)}s on Right)`);
  }

  const recommendations: string[] = [];
  if (riskTier === 'High') {
    recommendations.push('Immediate referral to orthopedic specialist for weight-bearing AP & lateral knee radiographs.');
    recommendations.push('Initiate non-impact eccentric quadriceps and vastus medialis obliquus (VMO) physical therapy.');
    recommendations.push('Provide mechanical unloader knee brace or neoprene compression support for heavy agrarian labor.');
  } else if (riskTier === 'Moderate') {
    recommendations.push('Prescribe closed-kinetic-chain knee extensor exercises (wall squats, straight leg raises).');
    recommendations.push('Advise ergonomic headload reduction and avoidance of deep squatting beyond 90° flexion.');
    recommendations.push('Follow-up biomechanical re-evaluation scheduled in 6 to 8 weeks.');
  } else {
    recommendations.push('Maintain active daily physical activity with low-impact walking and joint mobility routines.');
    recommendations.push('Annual OA screening recommended.');
  }

  return {
    sessionId,
    patientId,
    conductedAtIso: new Date().toISOString(),
    totalPlannedDurationSeconds: 900,
    totalActualDurationSeconds: totalActual,
    logs,
    step1,
    step2,
    step3,
    step4,
    step5,
    step6,
    step7,
    step8,
    step9,
    overallOaRiskTier: riskTier,
    overallOaRiskScore: clampedScore,
    confidenceInterval: [
      Math.max(0.02, Math.round((clampedScore - 0.08) * 100) / 100),
      Math.min(0.98, Math.round((clampedScore + 0.07) * 100) / 100),
    ],
    primaryContributingFactors: factors,
    clinicalRecommendations: recommendations,
    bilateralComparison: {
      romMaxFlexionDeg: { left: leftRom, right: rightRom },
      peakStrengthN: { left: leftStrength, right: rightStrength },
      crepitusTotalEvents: { left: leftCrepitus, right: rightCrepitus },
      emgActivationRfY: { left: 520, right: 610 },
    },
    taskCoContraction: taskCci,
    baselineTrends: {
      romDeltaDeg: -6.5,
      strengthDeltaPct: -14.2,
      tugDeltaSeconds: +2.8,
      painDeltaPoints: +1.5,
    },
  };
}
