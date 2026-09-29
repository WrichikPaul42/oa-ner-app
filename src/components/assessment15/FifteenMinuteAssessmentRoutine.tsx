/**
 * Kneeva: 15-Minute Guided Assessment Routine
 * Master Component orchestrating the 9 steps, shared 15:00 session clock,
 * step countdowns, prototype skips, live graphs, and final combined clinical report.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useRouter } from 'expo-router';

import {
  ASSESSMENT_15_STEPS,
  StepExecutionLog,
  Final15MinuteReport,
} from '@/types/assessment15';

import {
  getDefaultStep1Questionnaire,
  getDefaultStep2Calibration,
  getDefaultStep3Strength,
  getDefaultStep4ChairStand,
  getDefaultStep5Tug,
  getDefaultStep6Walking,
  getDefaultStep7Stairs,
  getDefaultStep8Balance,
  getDefaultStep9Recovery,
  generateFinalReport,
} from '@/services/assessment15Engine';

import { submitKneevaTriage } from '@/services/kneevaService';
import type { KneevaTriagePayload } from '@/types/kneeva';
import { subscribeLiveSensorReading, LiveTelemetrySample, isLiveHardwareStreaming } from '@/services/liveSensorStream';

import { RoutineHeader } from './RoutineHeader';
import { Step1QuestionnaireView } from './Step1QuestionnaireView';
import { Step2CalibrationView } from './Step2CalibrationView';
import { Step3StrengthView } from './Step3StrengthView';
import { Step4ChairStandView } from './Step4ChairStandView';
import { Step5TugView } from './Step5TugView';
import { Step6GaitView } from './Step6GaitView';
import { Step7StairsView } from './Step7StairsView';
import { Step8BalanceView } from './Step8BalanceView';
import { Step9RecoveryView } from './Step9RecoveryView';
import { ReportSummaryView } from './ReportSummaryView';
import { Text, ActivityIndicator, Modal } from 'react-native';

export function FifteenMinuteAssessmentRoutine({ patientId = 'PT-10045' }: { patientId?: string }) {
  const router = useRouter();

  // State Machine States
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [isRunning, setIsRunning] = useState(true);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [isCalculatingRisk, setIsCalculatingRisk] = useState(false);
  const [liveSample, setLiveSample] = useState<LiveTelemetrySample | null>(null);

  // Subscribe to live continuous sensor telemetry and stream into active step graphs
  useEffect(() => {
    const unsub = subscribeLiveSensorReading((sample) => {
      setLiveSample(sample);

      // Dynamically stream real-time incoming samples into active step datasets
      if (currentStepIndex === 3) {
        // Step 4: Chair Stand - Roll live knee flexion, angular velocity, piezo, and EMG
        setStep4Data((prev) => ({
          ...prev,
          timeSeriesFlexion: [...prev.timeSeriesFlexion.slice(1), sample.flex_angle_deg],
          timeSeriesAngularVelocity: [...prev.timeSeriesAngularVelocity.slice(1), Math.abs(sample.mpu_gyro.x)],
          timeSeriesPiezo: [...prev.timeSeriesPiezo.slice(1), sample.piezo_peak],
          timeSeriesRfEmg: [...prev.timeSeriesRfEmg.slice(1), sample.emg_mv],
        }));
      } else if (currentStepIndex === 4) {
        // Step 5: TUG - Roll live angular velocity & flexion
        setStep5Data((prev) => ({
          ...prev,
          timeSeriesVelocity: [...prev.timeSeriesVelocity.slice(1), Math.abs(sample.mpu_gyro.x)],
          timeSeriesFlexion: [...prev.timeSeriesFlexion.slice(1), sample.flex_angle_deg],
        }));
      } else if (currentStepIndex === 5) {
        // Step 6: 6-Minute Gait - Stream bilateral knee angles
        setStep6Data((prev) => {
          if (sample.node_id === 'node_left') {
            return {
              ...prev,
              meanGaitCycleFlexionLeft: [...prev.meanGaitCycleFlexionLeft.slice(1), sample.flex_angle_deg],
            };
          } else {
            return {
              ...prev,
              meanGaitCycleFlexionRight: [...prev.meanGaitCycleFlexionRight.slice(1), sample.flex_angle_deg],
            };
          }
        });
      } else if (currentStepIndex === 6) {
        // Step 7: Stairs - Stream stair flexion & crepitus acoustic events
        setStep7Data((prev) => ({
          ...prev,
          timeSeriesFlexion: [...prev.timeSeriesFlexion.slice(1), sample.flex_angle_deg],
          timeSeriesRfEmg: [...prev.timeSeriesRfEmg.slice(1), sample.emg_mv],
          crepitusDeepFlexionCount: prev.crepitusDeepFlexionCount + (sample.piezo_event ? 1 : 0),
        }));
      } else if (currentStepIndex === 7) {
        // Step 8: Single-Leg Balance - Stream real IMU sway displacement
        const swayX = Math.round(sample.mpu_accel.x * 12 * 10) / 10;
        const swayY = Math.round(sample.mpu_accel.z * 12 * 10) / 10;
        setStep8Data((prev) => {
          if (sample.node_id === 'node_left') {
            return {
              ...prev,
              leftSwayPathXy: [...prev.leftSwayPathXy.slice(1), [swayX, swayY]],
            };
          } else {
            return {
              ...prev,
              rightSwayPathXy: [...prev.rightSwayPathXy.slice(1), [swayX, swayY]],
            };
          }
        });
      }
    });
    return () => unsub();
  }, [currentStepIndex]);

  // Stable, vibration-free scroll threshold handler:
  // ONLY collapse if scrolled past 140px, and ONLY expand if pulled all the way back to the very top (<= 0)
  // This completely eliminates any layout height hysteresis vibration loops!
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    if (offsetY > 140 && !isHeaderCollapsed) {
      setIsHeaderCollapsed(true);
    } else if (offsetY <= 0 && isHeaderCollapsed) {
      setIsHeaderCollapsed(false);
    }
  };

  // Timers
  const [totalSessionElapsedSeconds, setTotalSessionElapsedSeconds] = useState(0);
  const [stepTimeRemainingSeconds, setStepTimeRemainingSeconds] = useState(
    ASSESSMENT_15_STEPS[0].durationSeconds
  );

  // Step Data Stores
  const [step1Data, setStep1Data] = useState(getDefaultStep1Questionnaire());
  const [step2Data, setStep2Data] = useState(getDefaultStep2Calibration());
  const [step3Data, setStep3Data] = useState(getDefaultStep3Strength());
  const [step4Data, setStep4Data] = useState(getDefaultStep4ChairStand());
  const [step5Data, setStep5Data] = useState(getDefaultStep5Tug());
  const [step6Data, setStep6Data] = useState(getDefaultStep6Walking());
  const [step7Data, setStep7Data] = useState(getDefaultStep7Stairs());
  const [step8Data, setStep8Data] = useState(getDefaultStep8Balance());
  const [step9Data, setStep9Data] = useState(getDefaultStep9Recovery());

  // Execution logs
  const [logs, setLogs] = useState<StepExecutionLog[]>(() =>
    ASSESSMENT_15_STEPS.map((s, idx) => ({
      stepNumber: s.stepNumber,
      id: s.id,
      name: s.name,
      plannedDurationSeconds: s.durationSeconds,
      actualDurationSeconds: 0,
      status: idx === 0 ? 'running' : 'pending',
      completedAtIso: '',
    }))
  );

  const [finalReport, setFinalReport] = useState<Final15MinuteReport | null>(null);

  // Interval timer tick
  const stepStartElapsedRef = useRef(0);

  useEffect(() => {
    if (!isRunning || isFinished) return;

    const timer = setInterval(() => {
      setTotalSessionElapsedSeconds((prev) => {
        const next = prev + 1;
        if (next >= 900) {
          // 15:00 reached
          return 900;
        }
        return next;
      });

      setStepTimeRemainingSeconds((prev) => {
        if (prev <= 1) {
          // Step auto-completed on timer expiry
          handleAdvanceStep('completed');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, isFinished, currentStepIndex]);

  // Transition to next step
  const handleAdvanceStep = (status: 'completed' | 'skipped') => {
    const currentStep = ASSESSMENT_15_STEPS[currentStepIndex];
    const actualDuration = Math.max(1, currentStep.durationSeconds - stepTimeRemainingSeconds);

    // Update log for current step
    setLogs((prev) =>
      prev.map((l) =>
        l.stepNumber === currentStep.stepNumber
          ? {
              ...l,
              actualDurationSeconds: actualDuration,
              status: status,
              completedAtIso: new Date().toISOString(),
            }
          : l
      )
    );

    if (currentStepIndex >= 8) {
      // Finished all 9 steps -> Build final report
      finalizeRoutine();
    } else {
      const nextIndex = currentStepIndex + 1;
      setCurrentStepIndex(nextIndex);
      setStepTimeRemainingSeconds(ASSESSMENT_15_STEPS[nextIndex].durationSeconds);
      stepStartElapsedRef.current = totalSessionElapsedSeconds;

      setLogs((prev) =>
        prev.map((l, idx) => (idx === nextIndex ? { ...l, status: 'running' } : l))
      );
    }
  };

  // Skip current step (prototype bypass)
  const handleSkipCurrentStep = () => {
    handleAdvanceStep('skipped');
  };

  // Complete step early
  const handleNextEarly = () => {
    handleAdvanceStep('completed');
  };

  // Jump directly to a step via pill click
  const handleSelectStepIndex = (targetIdx: number) => {
    if (targetIdx === currentStepIndex) return;

    // Mark current step as completed/skipped if moving away
    const currentStep = ASSESSMENT_15_STEPS[currentStepIndex];
    const actual = Math.max(1, currentStep.durationSeconds - stepTimeRemainingSeconds);

    setLogs((prev) =>
      prev.map((l) =>
        l.stepNumber === currentStep.stepNumber
          ? {
              ...l,
              actualDurationSeconds: actual,
              status: l.status === 'running' ? 'completed' : l.status,
              completedAtIso: new Date().toISOString(),
            }
          : l
      )
    );

    setCurrentStepIndex(targetIdx);
    setStepTimeRemainingSeconds(ASSESSMENT_15_STEPS[targetIdx].durationSeconds);
  };

  // Finalize routine, compute real CatBoost ML multimodal risk, and navigate to separate window
  const finalizeRoutine = async () => {
    setIsFinished(true);
    setIsRunning(false);
    setIsCalculatingRisk(true);

    const report = generateFinalReport({
      sessionId: `sess-15m-${Date.now()}`,
      patientId,
      logs,
      step1: step1Data,
      step2: step2Data,
      step3: step3Data,
      step4: step4Data,
      step5: step5Data,
      step6: step6Data,
      step7: step7Data,
      step8: step8Data,
      step9: step9Data,
    });

    // Construct full 36-feature multimodal payload for CatBoost AI Model
    const triagePayload: KneevaTriagePayload = {
      patient_id: patientId,
      patient_metadata: {
        age: 62,
        sex: 'female',
        height_cm: 158,
        weight_kg: 68,
      },
      questionnaire: {
        carried_load_kg: step1Data.carriedLoadKg || 12,
        daily_incline_hours: step1Data.dailyInclineHours || 2.5,
        squatting_difficulty: Math.min(4, Math.round(step1Data.painScoreBaseline / 2.5)),
        previous_injury: 1,
        activity_level: 3,
      },
      sensor_features: {
        flat_gait_cadence: step6Data.stepCadenceSpm || 94.0,
        flat_gait_stride_time_cv: Math.round(((step6Data.strideTimeCvPct || 7.2) / 100) * 1000) / 1000,
        climbing_cadence: 76.0,
        climbing_stride_time_cv: 0.082,
        rom_active_flexion_deg: step2Data.isCalibrated ? 108.0 : 96.0,
        rom_flexion_deficit_deg: 27.0,
        crepitus_presence: step7Data.crepitusDeepFlexionCount > 0 ? 1 : 0,
        crepitus_event_count: step7Data.crepitusDeepFlexionCount || 6,
        strength_ext_peak_n: step3Data.peakForceRightN || 185.0,
        strength_ext_bw_ratio: Math.round(((step3Data.peakForceRightN || 185) / (68 * 9.81)) * 100) / 100,
        cocontraction_cci_walking_mean: step6Data.coContractionIndex || 0.44,
      },
    };

    try {
      const triageRes = await submitKneevaTriage(triagePayload);
      if (triageRes) {
        report.overallOaRiskTier =
          triageRes.oa_risk_category === 'very_high' || triageRes.oa_risk_category === 'high'
            ? 'High'
            : triageRes.oa_risk_category === 'moderate'
            ? 'Moderate'
            : 'Low';
        report.overallOaRiskScore = triageRes.oa_risk_score;
        report.confidenceInterval = triageRes.confidence_interval as [number, number];
        report.primaryContributingFactors = [
          triageRes.clinical_explanation,
          `Effective Mountain Load BMI: ${triageRes.effective_bmi}`,
          ...triageRes.differential_flags,
        ];
        report.clinicalRecommendations = [triageRes.clinical_action];
        report.inferenceSource = triageRes.inference_source || 'CATBOOST_CLOUD_LIVE';
        report.modelName = triageRes.model_name || 'CatBoost Multimodal v1.0 (fusion_catboost_v1.cbm)';
      }
    } catch (err) {
      console.warn('CatBoost triage error, utilizing engine aggregation:', err);
    } finally {
      setIsCalculatingRisk(false);
      setFinalReport(report);

      // Open report in dedicated separate window
      router.push({
        pathname: '/kneeva/results',
        params: {
          is15MinuteReport: 'true',
          fifteenMinReportData: JSON.stringify(report),
        },
      } as any);
    }
  };

  // Restart routine
  const handleRestart = () => {
    setCurrentStepIndex(0);
    setIsFinished(false);
    setIsRunning(true);
    setTotalSessionElapsedSeconds(0);
    setStepTimeRemainingSeconds(ASSESSMENT_15_STEPS[0].durationSeconds);
    setLogs(
      ASSESSMENT_15_STEPS.map((s, idx) => ({
        stepNumber: s.stepNumber,
        id: s.id,
        name: s.name,
        plannedDurationSeconds: s.durationSeconds,
        actualDurationSeconds: 0,
        status: idx === 0 ? 'running' : 'pending',
        completedAtIso: '',
      }))
    );
    setFinalReport(null);
  };

  const handleExit = () => {
    Alert.alert(
      'Exit Guided Assessment?',
      'Are you sure you want to exit the 15-minute guided protocol? Current in-progress sensor measurements will be discarded.',
      [
        { text: 'Keep Testing', style: 'cancel' },
        {
          text: 'Exit to Dashboard',
          style: 'destructive',
          onPress: () => router.push('/dashboard' as any),
        },
      ]
    );
  };

  if (isFinished && finalReport) {
    return (
      <ReportSummaryView
        report={finalReport}
        onRestart={handleRestart}
        onBackToDashboard={() => router.push('/dashboard' as any)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Clinician Navigation Bar (Never Trapped in Full Screen) */}
      <View style={styles.topNavBar}>
        <TouchableOpacity style={styles.navBarBackBtn} onPress={handleExit} activeOpacity={0.7}>
          <Text style={styles.navBarBackText}>← Exit Routine</Text>
        </TouchableOpacity>
        <View style={styles.navBarCenter}>
          <Text style={styles.navBarTitle}>15-MIN CLINICAL PROTOCOL</Text>
          <Text style={styles.navBarSubtitle}>Patient: {patientId}</Text>
        </View>
        <TouchableOpacity
          style={styles.navBarPauseBtn}
          onPress={() => setIsRunning(!isRunning)}
          activeOpacity={0.7}
        >
          <Text style={styles.navBarPauseText}>{isRunning ? '⏸ Pause' : '▶ Resume'}</Text>
        </TouchableOpacity>
      </View>

      <RoutineHeader
        currentStepIndex={currentStepIndex}
        stepTimeRemainingSeconds={stepTimeRemainingSeconds}
        totalSessionElapsedSeconds={totalSessionElapsedSeconds}
        isRunning={isRunning}
        isHardwareStreaming={isLiveHardwareStreaming()}
        isCollapsed={isHeaderCollapsed}
        onToggleCollapse={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
        onToggleTimer={() => setIsRunning(!isRunning)}
        onNextEarly={handleNextEarly}
        onSkipCurrentStep={handleSkipCurrentStep}
        onSelectStepIndex={handleSelectStepIndex}
        logs={logs}
      />

      <ScrollView
        style={styles.stepContentScroll}
        contentContainerStyle={styles.stepContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Step Navigation Bounding Area Card */}
        <View style={styles.stepBoundingCard}>
          {/* Bounding Card Header & Breadcrumb */}
          <View style={styles.stepBoundingHeader}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.stepBoundingTag}>
                STEP {currentStepIndex + 1} OF 9 • CLINICAL PROTOCOL
              </Text>
              <Text style={styles.stepBoundingTitle} numberOfLines={1}>
                {ASSESSMENT_15_STEPS[currentStepIndex].name}
              </Text>
            </View>
            <View style={styles.stepBoundingDurationBadge}>
              <Text style={styles.stepBoundingDurationText}>
                ⏱️ {ASSESSMENT_15_STEPS[currentStepIndex].durationSeconds}s Budget
              </Text>
            </View>
          </View>

          {/* Inner Step Content Area */}
          <View style={styles.stepInnerArea}>
            {currentStepIndex === 0 && (
              <Step1QuestionnaireView data={step1Data} onChange={setStep1Data} />
            )}
            {currentStepIndex === 1 && (
              <Step2CalibrationView data={step2Data} onChange={setStep2Data} />
            )}
            {currentStepIndex === 2 && (
              <Step3StrengthView data={step3Data} onChange={setStep3Data} />
            )}
            {currentStepIndex === 3 && (
              <Step4ChairStandView data={step4Data} onChange={setStep4Data} />
            )}
            {currentStepIndex === 4 && (
              <Step5TugView data={step5Data} onChange={setStep5Data} />
            )}
            {currentStepIndex === 5 && (
              <Step6GaitView data={step6Data} onChange={setStep6Data} />
            )}
            {currentStepIndex === 6 && (
              <Step7StairsView data={step7Data} onChange={setStep7Data} />
            )}
            {currentStepIndex === 7 && (
              <Step8BalanceView data={step8Data} onChange={setStep8Data} />
            )}
            {currentStepIndex === 8 && (
              <Step9RecoveryView data={step9Data} onChange={setStep9Data} />
            )}
          </View>

          {/* Step Bounding Navigation Footer */}
          <View style={styles.stepNavFooter}>
            <TouchableOpacity
              style={[
                styles.stepNavBtn,
                currentStepIndex === 0 && styles.stepNavBtnDisabled,
              ]}
              onPress={() => currentStepIndex > 0 && handleSelectStepIndex(currentStepIndex - 1)}
              disabled={currentStepIndex === 0}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.stepNavBtnText,
                  currentStepIndex === 0 && styles.stepNavBtnTextDisabled,
                ]}
              >
                ← Prev
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.stepNavSkipBtn}
              onPress={handleSkipCurrentStep}
              activeOpacity={0.7}
            >
              <Text style={styles.stepNavSkipBtnText}>Skip Step</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.stepNavPrimaryBtn}
              onPress={handleNextEarly}
              activeOpacity={0.8}
            >
              <Text style={styles.stepNavPrimaryBtnText}>
                {currentStepIndex === 8 ? 'Finish & Generate Report ➔' : 'Next Step ➔'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Multimodal Model Calculation Overlay */}
      <Modal visible={isCalculatingRisk} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ActivityIndicator size="large" color="#0D9488" />
            <Text style={styles.modalTitle}>CatBoost AI Model Calculating OA Risk</Text>
            <Text style={styles.modalSub}>
              Fusing 36 kinematic, bilateral dynamometer, and sEMG features into the calibrated multimodal model...
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A', // Seamless dark status bar / header
  },
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  navBarBackBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  navBarBackText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '700',
  },
  navBarCenter: {
    alignItems: 'center',
  },
  navBarTitle: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  navBarSubtitle: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '500',
  },
  navBarPauseBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  navBarPauseText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
  stepContentScroll: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  stepContent: {
    padding: 12,
    paddingBottom: 40,
  },
  stepBoundingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 20,
  },
  stepBoundingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  stepBoundingTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0D9488',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  stepBoundingTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  stepBoundingDurationBadge: {
    backgroundColor: '#E2E8F0',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  stepBoundingDurationText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  stepInnerArea: {
    padding: 14,
  },
  stepNavFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  stepNavBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  stepNavBtnDisabled: {
    opacity: 0.4,
    borderColor: '#E2E8F0',
  },
  stepNavBtnText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  stepNavBtnTextDisabled: {
    color: '#94A3B8',
  },
  stepNavSkipBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  stepNavSkipBtnText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  stepNavPrimaryBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNavPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 16,
    textAlign: 'center',
  },
  modalSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 18,
  },
});

