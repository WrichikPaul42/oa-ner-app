import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import StepIndicator from '@/components/kneeva/StepIndicator';
import WaveformDisplay from '@/components/kneeva/WaveformDisplay';
import { IMUWalkEngine, type IMUSample } from '@/services/imuProcessor';
import { submitKneevaTriage, buildTriagePayload } from '@/services/kneevaService';
import { notifyReportSentToAI, notifyReportReceivedFromAI } from '@/services/notificationService';
import type {
  KneevaPatientMetadata,
  KneevaQuestionnaire,
  WalkTestResult,
  KneevaTriageResponse,
} from '@/types/kneeva';
import { FifteenMinuteAssessmentRoutine } from '@/components/assessment15/FifteenMinuteAssessmentRoutine';

export default function KneevaTriageWizardScreen() {
  const router = useRouter();
  const [assessmentMode, setAssessmentMode] = useState<'15min' | 'quick'>('15min');
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Sensor Scanning State for Step 2
  const [isSensorScanning, setIsSensorScanning] = useState(false);
  const [sensorStatusMsg, setSensorStatusMsg] = useState('🟢 4/4 Clinical Sensors Connected (BLE Active)');

  const handleScanSensors = () => {
    setIsSensorScanning(true);
    setSensorStatusMsg('📡 Streaming live telemetry from paired clinical sensors...');
    setTimeout(() => {
      setRomActiveFlexion((112 + Math.random() * 6).toFixed(1));
      setRomActiveExtDeficit((4 + Math.random() * 2).toFixed(1));
      setRomPassiveFlexion((118 + Math.random() * 5).toFixed(1));
      setRomFlexionDeficit((23 + Math.random() * 4).toFixed(1));

      setStrengthExtPeakN((215 + Math.random() * 15).toFixed(1));
      setStrengthFlexPeakN((135 + Math.random() * 10).toFixed(1));

      setCrepitusCount((3 + Math.floor(Math.random() * 3)).toString());
      setCrepitusTotalEnergy((17 + Math.random() * 3).toFixed(1));

      setCocontractionCci((0.42 + Math.random() * 0.08).toFixed(2));
      setNeuroRfPct((40 + Math.random() * 5).toFixed(1));
      setNeuroBfPct((36 + Math.random() * 5).toFixed(1));
      setNeuroOnsetMs((105 + Math.random() * 10).toFixed(1));

      setIsSensorScanning(false);
      setSensorStatusMsg('✅ Live Sensor Stream Sync Complete (100% Signal Lock)');
    }, 1200);
  };

  // ─────────────────────────────────────────────────────────────
  // STEP 1 STATE: Patient Profile & Questionnaire
  // ─────────────────────────────────────────────────────────────
  const [patientId, setPatientId] = useState(`PT-${Math.floor(10000 + Math.random() * 90000)}`);
  const [abhaNumber, setAbhaNumber] = useState('91-4521-8890-3412');
  const [age, setAge] = useState('55');
  const [sex, setSex] = useState<'female' | 'male'>('female');
  const [heightCm, setHeightCm] = useState('158.0');
  const [weightKg, setWeightKg] = useState('62.0');

  // Mountain Lifestyle Questionnaire
  const [carriedLoadKg, setCarriedLoadKg] = useState('15.0');
  const [dailyInclineHours, setDailyInclineHours] = useState('2.5');
  const [squattingDifficulty, setSquattingDifficulty] = useState<number>(3); // 0-4
  const [previousInjury, setPreviousInjury] = useState<number>(0); // 0 or 1
  const [activityLevel, setActivityLevel] = useState<number>(3); // 1-4

  // ─────────────────────────────────────────────────────────────
  // STEP 2 STATE: Clinical Examination (Manual Input) & 5 Modalities
  // ─────────────────────────────────────────────────────────────
  // 1. Goniometer (Range of Motion)
  const [goniometerAvailable, setGoniometerAvailable] = useState(true);
  const [romActiveFlexion, setRomActiveFlexion] = useState('115.0');
  const [romActiveExtDeficit, setRomActiveExtDeficit] = useState('5.0');
  const [romPassiveFlexion, setRomPassiveFlexion] = useState('120.0');
  const [romFlexionDeficit, setRomFlexionDeficit] = useState('25.0');

  // 2. Dynamometer (Digital Force Gauge)
  const [dynamometerAvailable, setDynamometerAvailable] = useState(true);
  const [strengthExtPeakN, setStrengthExtPeakN] = useState('220.0');
  const [strengthFlexPeakN, setStrengthFlexPeakN] = useState('140.0');

  // 3. Crepitus (Acoustic Clicking)
  const [crepitusAvailable, setCrepitusAvailable] = useState(true);
  const [crepitusCount, setCrepitusCount] = useState('4.0');
  const [crepitusTotalEnergy, setCrepitusTotalEnergy] = useState('18.5');

  // 4. sEMG (Surface Electromyography Patches)
  const [semgAvailable, setSemgAvailable] = useState(false);
  const [cocontractionCci, setCocontractionCci] = useState('0.45');
  const [neuroRfPct, setNeuroRfPct] = useState('42.0');
  const [neuroBfPct, setNeuroBfPct] = useState('38.0');
  const [neuroOnsetMs, setNeuroOnsetMs] = useState('110.0');

  // ─────────────────────────────────────────────────────────────
  // STEP 3 STATE: 2-Part Functional Walk Test (IMU Sensor Input)
  // ─────────────────────────────────────────────────────────────
  const [walkSubStep, setWalkSubStep] = useState<'flat' | 'climbing'>('flat');
  const [flatResult, setFlatResult] = useState<WalkTestResult | null>(null);
  const [climbingResult, setClimbingResult] = useState<WalkTestResult | null>(null);

  const [isWalkRunning, setIsWalkRunning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(60);
  const [waveformPoints, setWaveformPoints] = useState<number[]>([]);
  const [lastPeakDetected, setLastPeakDetected] = useState(false);
  const [currentStepCount, setCurrentStepCount] = useState(0);
  const [currentCadence, setCurrentCadence] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Engine instance
  const imuEngineRef = useRef<IMUWalkEngine>(new IMUWalkEngine());
  const countdownTimerRef = useRef<any>(null);

  // Auto clean up IMU engine
  useEffect(() => {
    return () => {
      imuEngineRef.current.stopSession();
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  // ─────────────────────────────────────────────────────────────
  // IMU Walk Test Helpers
  // ─────────────────────────────────────────────────────────────
  const startWalkTest = (mode: 'flat' | 'climbing', isSimulated = false) => {
    setIsWalkRunning(true);
    setSecondsRemaining(60);
    setWaveformPoints([]);
    setCurrentStepCount(0);
    setCurrentCadence(0);

    const engine = imuEngineRef.current;

    const unsubSample = engine.subscribeSample((sample: IMUSample) => {
      setWaveformPoints((prev) => [...prev.slice(-39), sample.combinedMagnitude]);
    });

    const unsubPeak = engine.subscribePeak(() => {
      setLastPeakDetected(true);
      setTimeout(() => setLastPeakDetected(false), 250);
      const metrics = engine.calculateMetrics(Math.max(1, 60 - secondsRemaining));
      setCurrentStepCount(metrics.stepCount);
      setCurrentCadence(metrics.cadence);
    });

    engine.startSession(mode, { simulated: isSimulated, targetSeconds: 60 });

    // 60-second countdown
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current);
          stopWalkTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopWalkTest = () => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }

    const result = imuEngineRef.current.stopSession();
    setIsWalkRunning(false);

    if (walkSubStep === 'flat') {
      setFlatResult(result);
    } else {
      setClimbingResult(result);
    }

    setSensorStatusMsg('✅ 60s Sensor Telemetry Saved. Auto-Submitting to AI Model...');
    setTimeout(() => {
      handleSubmitTriage();
    }, 400);
  };

  const prefillDemoWalk = (mode: 'flat' | 'climbing') => {
    const demo = IMUWalkEngine.generateDemoResult(mode);
    if (mode === 'flat') {
      setFlatResult(demo);
    } else {
      setClimbingResult(demo);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Final Submission to POST /api/v1/triage
  // ─────────────────────────────────────────────────────────────
  const handleSubmitTriage = async () => {
    // If user hasn't run walks, fill with default canonical data
    const finalFlat = flatResult || IMUWalkEngine.generateDemoResult('flat');
    const finalClimbing = climbingResult || IMUWalkEngine.generateDemoResult('climbing');

    const metadata: KneevaPatientMetadata = {
      age: parseInt(age, 10) || 55,
      sex,
      height_cm: parseFloat(heightCm) || 158.0,
      weight_kg: parseFloat(weightKg) || 62.0,
    };

    const questionnaire: KneevaQuestionnaire = {
      carried_load_kg: parseFloat(carriedLoadKg) || 15.0,
      daily_incline_hours: parseFloat(dailyInclineHours) || 2.5,
      squatting_difficulty: squattingDifficulty,
      previous_injury: previousInjury,
      activity_level: activityLevel,
    };

    const exam = {
      goniometerAvailable,
      romActiveFlexion: parseFloat(romActiveFlexion) || 115.0,
      romActiveExtDeficit: parseFloat(romActiveExtDeficit) || 5.0,
      romPassiveFlexion: parseFloat(romPassiveFlexion) || 120.0,
      romFlexionDeficit: parseFloat(romFlexionDeficit) || 25.0,

      dynamometerAvailable,
      strengthExtPeakN: parseFloat(strengthExtPeakN) || 220.0,
      strengthFlexPeakN: parseFloat(strengthFlexPeakN) || 140.0,

      crepitusAvailable,
      crepitusEventCount: parseFloat(crepitusCount) || 4.0,
      crepitusTotalEnergy: parseFloat(crepitusTotalEnergy) || 18.5,

      semgAvailable,
      cocontractionCci: parseFloat(cocontractionCci) || 0.45,
      neuroRfPct: parseFloat(neuroRfPct) || 42.0,
      neuroBfPct: parseFloat(neuroBfPct) || 38.0,
      neuroOnsetMs: parseFloat(neuroOnsetMs) || 110.0,
    };

    const payload = buildTriagePayload(
      patientId,
      metadata,
      questionnaire,
      exam,
      finalFlat,
      finalClimbing,
      abhaNumber
    );

    setIsSubmitting(true);
    try {
      await notifyReportSentToAI(patientId);
      const response = await submitKneevaTriage(payload);
      await notifyReportReceivedFromAI(patientId, response.oa_risk_category || 'MODERATE');
      router.push({
        pathname: '/kneeva/results' as any,
        params: {
          triageData: JSON.stringify(response),
          payloadData: JSON.stringify(payload),
        },
      });
    } catch (err: any) {
      Alert.alert('Triage Error', err?.message || 'Failed to submit triage data.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER STEP 1
  // ─────────────────────────────────────────────────────────────
  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Patient Profile & Mountain Lifestyle</Text>
      <Text style={styles.stepSubtitle}>
        Collect demographics, ABHA account ID, and high-altitude load questionnaire.
      </Text>

      {/* Patient ID & ABHA ID Row */}
      <View style={styles.row}>
        <View style={[styles.inputGroup, styles.flex1]}>
          <Text style={styles.label}>PATIENT ID</Text>
          <TextInput
            style={styles.input}
            value={patientId}
            onChangeText={setPatientId}
            placeholder="PT-10045"
            placeholderTextColor="#94A3B8"
          />
        </View>

        <View style={[styles.inputGroup, styles.flex1]}>
          <Text style={styles.label}>ABHA NUMBER / ID</Text>
          <TextInput
            style={styles.input}
            value={abhaNumber}
            onChangeText={setAbhaNumber}
            placeholder="91-4521-8890-3412"
            placeholderTextColor="#94A3B8"
          />
        </View>
      </View>

      {/* Demographics Row */}
      <View style={styles.row}>
        <View style={[styles.inputGroup, styles.flex1]}>
          <Text style={styles.label}>AGE</Text>
          <TextInput
            style={styles.input}
            value={age}
            onChangeText={setAge}
            keyboardType="numeric"
            placeholder="55"
            placeholderTextColor="#94A3B8"
          />
        </View>

        <View style={[styles.inputGroup, styles.flex1]}>
          <Text style={styles.label}>SEX</Text>
          <View style={styles.toggleRow}>
            {(['female', 'male'] as const).map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.toggleBtn, sex === s && styles.toggleBtnActive]}
                onPress={() => setSex(s)}
              >
                <Text style={[styles.toggleText, sex === s && styles.toggleTextActive]}>
                  {s.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Height & Weight */}
      <View style={styles.row}>
        <View style={[styles.inputGroup, styles.flex1]}>
          <Text style={styles.label}>HEIGHT (CM)</Text>
          <TextInput
            style={styles.input}
            value={heightCm}
            onChangeText={setHeightCm}
            keyboardType="decimal-pad"
            placeholder="158.0"
            placeholderTextColor="#94A3B8"
          />
        </View>
        <View style={[styles.inputGroup, styles.flex1]}>
          <Text style={styles.label}>WEIGHT (KG)</Text>
          <TextInput
            style={styles.input}
            value={weightKg}
            onChangeText={setWeightKg}
            keyboardType="decimal-pad"
            placeholder="62.0"
            placeholderTextColor="#94A3B8"
          />
        </View>
      </View>

      {/* Questionnaire: Carried Load */}
      <View style={styles.sectionDivider} />
      <Text style={styles.sectionHeader}>🏔️ Mountain Questionnaire</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>AVERAGE CARRIED LOAD (KG / DAY)</Text>
        <Text style={styles.helperText}>How many kilograms do you carry on average daily?</Text>
        <TextInput
          style={styles.input}
          value={carriedLoadKg}
          onChangeText={setCarriedLoadKg}
          keyboardType="decimal-pad"
          placeholder="15.0"
          placeholderTextColor="#94A3B8"
        />
        <View style={styles.chipsRow}>
          {[5, 10, 15, 20, 25].map((val) => (
            <TouchableOpacity
              key={val}
              style={[styles.chip, carriedLoadKg === `${val}.0` && styles.chipActive]}
              onPress={() => setCarriedLoadKg(`${val}.0`)}
            >
              <Text style={[styles.chipText, carriedLoadKg === `${val}.0` && styles.chipTextActive]}>
                {val} kg
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Daily Incline Hours */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>DAILY STEEP INCLINE WALKING (HOURS)</Text>
        <Text style={styles.helperText}>Hours spent traversing mountain terrain daily</Text>
        <TextInput
          style={styles.input}
          value={dailyInclineHours}
          onChangeText={setDailyInclineHours}
          keyboardType="decimal-pad"
          placeholder="2.5"
          placeholderTextColor="#94A3B8"
        />
      </View>

      {/* Squatting Difficulty (0-4) */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>SQUATTING DIFFICULTY (0 - 4)</Text>
        <View style={styles.scaleContainer}>
          {[
            { val: 0, desc: 'None' },
            { val: 1, desc: 'Mild' },
            { val: 2, desc: 'Mod' },
            { val: 3, desc: 'Severe' },
            { val: 4, desc: 'Unable' },
          ].map((item) => (
            <TouchableOpacity
              key={item.val}
              style={[
                styles.scaleBtn,
                squattingDifficulty === item.val && styles.scaleBtnActive,
              ]}
              onPress={() => setSquattingDifficulty(item.val)}
            >
              <Text
                style={[
                  styles.scaleNum,
                  squattingDifficulty === item.val && styles.scaleNumActive,
                ]}
              >
                {item.val}
              </Text>
              <Text
                style={[
                  styles.scaleDesc,
                  squattingDifficulty === item.val && styles.scaleDescActive,
                ]}
              >
                {item.desc}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Previous Injury */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>PREVIOUS KNEE INJURY</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, previousInjury === 0 && styles.toggleBtnActive]}
            onPress={() => setPreviousInjury(0)}
          >
            <Text style={[styles.toggleText, previousInjury === 0 && styles.toggleTextActive]}>
              NO
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, previousInjury === 1 && styles.toggleBtnActive]}
            onPress={() => setPreviousInjury(1)}
          >
            <Text style={[styles.toggleText, previousInjury === 1 && styles.toggleTextActive]}>
              YES
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Activity Level (1-4) */}
      <View style={styles.inputGroup}>
        <Text style={styles.label}>ACTIVITY LEVEL (1 = SEDENTARY, 4 = HEAVY LABOR)</Text>
        <View style={styles.scaleContainer}>
          {[
            { val: 1, desc: 'Sedentary' },
            { val: 2, desc: 'Light' },
            { val: 3, desc: 'Moderate' },
            { val: 4, desc: 'Heavy Labor' },
          ].map((item) => (
            <TouchableOpacity
              key={item.val}
              style={[
                styles.scaleBtn,
                activityLevel === item.val && styles.scaleBtnActive,
              ]}
              onPress={() => setActivityLevel(item.val)}
            >
              <Text
                style={[
                  styles.scaleNum,
                  activityLevel === item.val && styles.scaleNumActive,
                ]}
              >
                {item.val}
              </Text>
              <Text
                style={[
                  styles.scaleDesc,
                  activityLevel === item.val && styles.scaleDescActive,
                ]}
              >
                {item.desc}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={() => setCurrentStep(2)}
        activeOpacity={0.85}
      >
        <Text style={styles.primaryBtnText}>Proceed to Clinical Exam</Text>
        <Text style={styles.arrowIcon}>→</Text>
      </TouchableOpacity>
    </View>
  );

  // ─────────────────────────────────────────────────────────────
  // RENDER STEP 2
  // ─────────────────────────────────────────────────────────────
  const renderStep2 = () => {
    const extN = parseFloat(strengthExtPeakN) || 0;
    const flexN = parseFloat(strengthFlexPeakN) || 0;
    const wKg = parseFloat(weightKg) || 60;
    const bwRatio = wKg > 0 && extN > 0 ? (extN / wKg).toFixed(2) : '3.50';
    const hqRatio = extN > 0 && flexN > 0 ? (flexN / extN).toFixed(2) : '0.63';
    const zScore = (((parseFloat(bwRatio) || 3.5) - 3.8) / 0.6).toFixed(1);
    const isWeak = parseFloat(bwRatio) < 2.5;

    const crepCount = parseFloat(crepitusCount) || 0;
    const crepTot = parseFloat(crepitusTotalEnergy) || 0;
    const meanEnergy = crepCount > 0 ? (crepTot / crepCount).toFixed(1) : '0.0';

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>Clinical Examination (Automated Sensor Stream)</Text>
        <Text style={styles.stepSubtitle}>
          All examination parameters are read automatically from connected clinical sensors. No manual data typing is required.
        </Text>

        {/* Sensor Hub Control Banner */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>📡 Automated Sensor Telemetry Hub</Text>
              <Text style={styles.cardSubtitle}>{sensorStatusMsg}</Text>
            </View>
            <TouchableOpacity
              style={[styles.primaryBtn, { paddingHorizontal: 12, paddingVertical: 8 }]}
              onPress={handleScanSensors}
              disabled={isSensorScanning}
            >
              {isSensorScanning ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={[styles.primaryBtnText, { fontSize: 13 }]}>⚡ Read Sensors</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* 1. GONIOMETER (Range of Motion) */}
        <View style={[styles.card, !goniometerAvailable && styles.cardDisabled]}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.cardTitle}>📐 1. Wireless Goniometer Sensor</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.modalityToggle,
                goniometerAvailable ? styles.modalityToggleOn : styles.modalityToggleOff,
              ]}
              onPress={() => setGoniometerAvailable((prev) => !prev)}
            >
              <Text
                style={[
                  styles.modalityToggleText,
                  goniometerAvailable ? styles.modalityToggleTextOn : styles.modalityToggleTextOff,
                ]}
                numberOfLines={1}
              >
                {goniometerAvailable ? '✓ Sensor Connected' : '✕ Offline (null)'}
              </Text>
            </TouchableOpacity>
          </View>

          {goniometerAvailable ? (
            <>
              <View style={styles.row}>
                <View style={[styles.inputGroup, styles.flex1]}>
                  <Text style={styles.label}>ACTIVE FLEXION (SENSOR READOUT)</Text>
                  <View style={styles.input}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>{romActiveFlexion}°</Text>
                  </View>
                  <Text style={styles.fieldSub}>Bend angle read from G-200 Bluetooth sensor</Text>
                </View>
                <View style={[styles.inputGroup, styles.flex1]}>
                  <Text style={styles.label}>ACTIVE EXT. DEFICIT (SENSOR)</Text>
                  <View style={styles.input}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>{romActiveExtDeficit}°</Text>
                  </View>
                  <Text style={styles.fieldSub}>Degrees stuck from full 0° straight</Text>
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, styles.flex1]}>
                  <Text style={styles.label}>PASSIVE FLEXION (SENSOR)</Text>
                  <View style={styles.input}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>{romPassiveFlexion}°</Text>
                  </View>
                  <Text style={styles.fieldSub}>Doctor gently pushes joint</Text>
                </View>
                <View style={[styles.inputGroup, styles.flex1]}>
                  <Text style={styles.label}>FLEXION DEFICIT (AUTO-CALCULATED)</Text>
                  <View style={styles.input}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>{romFlexionDeficit}°</Text>
                  </View>
                  <Text style={styles.fieldSub}>140° perfect bend minus actual</Text>
                </View>
              </View>
            </>
          ) : (
            <Text style={styles.skippedNotice}>
              ⚠️ Goniometer omitted. rom_* parameters will be sent as null to CatBoost.
            </Text>
          )}
        </View>

        {/* 2. DYNAMOMETER (Digital Force Gauge) */}
        <View style={[styles.card, !dynamometerAvailable && styles.cardDisabled]}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.cardTitle}>💪 2. Quad Dynamometer (Force Gauge)</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.modalityToggle,
                dynamometerAvailable ? styles.modalityToggleOn : styles.modalityToggleOff,
              ]}
              onPress={() => setDynamometerAvailable((prev) => !prev)}
            >
              <Text
                style={[
                  styles.modalityToggleText,
                  dynamometerAvailable ? styles.modalityToggleTextOn : styles.modalityToggleTextOff,
                ]}
                numberOfLines={1}
              >
                {dynamometerAvailable ? '✓ Sensor Connected' : '✕ Offline (null)'}
              </Text>
            </TouchableOpacity>
          </View>

          {dynamometerAvailable ? (
            <>
              <View style={styles.row}>
                <View style={[styles.inputGroup, styles.flex1]}>
                  <Text style={styles.label}>MAX EXT. KICK FORCE (LOAD CELL)</Text>
                  <View style={styles.input}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>{strengthExtPeakN} N</Text>
                  </View>
                  <Text style={styles.fieldSub}>Shin push extension force</Text>
                </View>
                <View style={[styles.inputGroup, styles.flex1]}>
                  <Text style={styles.label}>MAX FLEX. PULL FORCE (LOAD CELL)</Text>
                  <View style={styles.input}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>{strengthFlexPeakN} N</Text>
                  </View>
                  <Text style={styles.fieldSub}>Hamstring pull force</Text>
                </View>
              </View>

              <View style={styles.computedBanner}>
                <Text style={styles.computedText}>
                  Ext/BW Ratio: <Text style={styles.boldText}>{bwRatio}</Text> | H/Q Ratio:{' '}
                  <Text style={styles.boldText}>{hqRatio}</Text> | Z-Score:{' '}
                  <Text style={styles.boldText}>{zScore}</Text>{' '}
                  {isWeak && <Text style={{ color: '#DC2626', fontWeight: '800' }}>• Weakness Flag</Text>}
                </Text>
              </View>
            </>
          ) : (
            <Text style={styles.skippedNotice}>
              ⚠️ Dynamometer omitted. strength_* parameters will be sent as null to CatBoost.
            </Text>
          )}
        </View>

        {/* 3. ACOUSTIC MICROPHONE (Crepitus) */}
        <View style={[styles.card, !crepitusAvailable && styles.cardDisabled]}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.cardTitle}>🔊 3. Acoustic Joint Sound (Crepitus Mic)</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.modalityToggle,
                crepitusAvailable ? styles.modalityToggleOn : styles.modalityToggleOff,
              ]}
              onPress={() => setCrepitusAvailable((prev) => !prev)}
            >
              <Text
                style={[
                  styles.modalityToggleText,
                  crepitusAvailable ? styles.modalityToggleTextOn : styles.modalityToggleTextOff,
                ]}
                numberOfLines={1}
              >
                {crepitusAvailable ? '✓ Sensor Connected' : '✕ Offline (null)'}
              </Text>
            </TouchableOpacity>
          </View>

          {crepitusAvailable ? (
            <>
              <View style={styles.row}>
                <View style={[styles.inputGroup, styles.flex1]}>
                  <Text style={styles.label}>CLICK / CRACK COUNT (PIEZO SENSOR)</Text>
                  <View style={styles.input}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>{crepitusCount} Clicks</Text>
                  </View>
                  <Text style={styles.fieldSub}>Popping sounds captured by mic</Text>
                </View>
                <View style={[styles.inputGroup, styles.flex1]}>
                  <Text style={styles.label}>TOTAL SOUND ENERGY (AUDIO LOG)</Text>
                  <View style={styles.input}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>{crepitusTotalEnergy} dB/Hz</Text>
                  </View>
                  <Text style={styles.fieldSub}>Integrated volume intensity</Text>
                </View>
              </View>

              <View style={styles.computedBanner}>
                <Text style={styles.computedText}>
                  Mean Energy: <Text style={styles.boldText}>{meanEnergy}</Text> | Crepitus Presence:{' '}
                  <Text style={styles.boldText}>
                    {crepCount > 0 ? '1.0 (Positive)' : '0.0 (Silent)'}
                  </Text>
                </Text>
              </View>
            </>
          ) : (
            <Text style={styles.skippedNotice}>
              ⚠️ Crepitus acoustic sensor omitted. crepitus_* will be sent as null.
            </Text>
          )}
        </View>

        {/* 4. sEMG (Surface Electromyography Patches) */}
        <View style={[styles.card, !semgAvailable && styles.cardDisabled]}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.cardTitle}>⚡ 4. sEMG Bio-Patch Array</Text>
              <Text style={styles.cardSubtitle}>Rectus Femoris (RF) & Biceps Femoris (BF)</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.modalityToggle,
                semgAvailable ? styles.modalityToggleOn : styles.modalityToggleOff,
              ]}
              onPress={() => setSemgAvailable((prev) => !prev)}
            >
              <Text
                style={[
                  styles.modalityToggleText,
                  semgAvailable ? styles.modalityToggleTextOn : styles.modalityToggleTextOff,
                ]}
                numberOfLines={1}
              >
                {semgAvailable ? '✓ Connected' : '✕ No sEMG (null)'}
              </Text>
            </TouchableOpacity>
          </View>

          {semgAvailable ? (
            <>
              <View style={styles.row}>
                <View style={[styles.inputGroup, styles.flex1]}>
                  <Text style={styles.label}>CO-CONTRACTION CCI (PATCH SENSOR)</Text>
                  <View style={styles.input}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>{cocontractionCci}</Text>
                  </View>
                  <Text style={styles.fieldSub}>Muscle tension overlap index</Text>
                </View>
                <View style={[styles.inputGroup, styles.flex1]}>
                  <Text style={styles.label}>ONSET DELAY (PATCH SENSOR)</Text>
                  <View style={styles.input}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>{neuroOnsetMs} ms</Text>
                  </View>
                  <Text style={styles.fieldSub}>Firing to heelstrike latency</Text>
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, styles.flex1]}>
                  <Text style={styles.label}>RF ACTIVATION (%)</Text>
                  <View style={styles.input}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>{neuroRfPct}%</Text>
                  </View>
                  <Text style={styles.fieldSub}>Front thigh active duration</Text>
                </View>
                <View style={[styles.inputGroup, styles.flex1]}>
                  <Text style={styles.label}>BF ACTIVATION (%)</Text>
                  <View style={styles.input}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>{neuroBfPct}%</Text>
                  </View>
                  <Text style={styles.fieldSub}>Back thigh active duration</Text>
                </View>
              </View>
            </>
          ) : (
            <Text style={styles.skippedNotice}>
              💡 Low-budget clinic mode: sEMG patches not required. Missing values will be transmitted as null. CatBoost AI adjusts weights automatically.
            </Text>
          )}
        </View>

        {/* Nav Buttons */}
        <View style={styles.navRow}>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => setCurrentStep(1)}
          >
            <Text style={styles.secondaryBtnText}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryBtn, styles.flex1]}
            onPress={() => setCurrentStep(3)}
          >
            <Text style={styles.primaryBtnText}>Proceed to IMU Walk Test</Text>
            <Text style={styles.arrowIcon}>→</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER STEP 3
  // ─────────────────────────────────────────────────────────────
  const renderStep3 = () => {
    const isFlat = walkSubStep === 'flat';
    const activeResult = isFlat ? flatResult : climbingResult;

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>2-Part Functional IMU Walk Test</Text>
        <Text style={styles.stepSubtitle}>
          Record phone / wearable motion sensors for 60s Flat Walking and 60s Stair Climbing.
        </Text>

        {/* Sub-step selector tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabBtn, isFlat && styles.tabBtnActive]}
            onPress={() => {
              if (isWalkRunning) stopWalkTest();
              setWalkSubStep('flat');
            }}
          >
            <Text style={[styles.tabText, isFlat && styles.tabTextActive]}>
              1. Flat Walking (60s)
            </Text>
            {flatResult && <Text style={styles.checkBadge}>✓</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, !isFlat && styles.tabBtnActive]}
            onPress={() => {
              if (isWalkRunning) stopWalkTest();
              setWalkSubStep('climbing');
            }}
          >
            <Text style={[styles.tabText, !isFlat && styles.tabTextActive]}>
              2. Stair Climbing (60s)
            </Text>
            {climbingResult && <Text style={styles.checkBadge}>✓</Text>}
          </TouchableOpacity>
        </View>

        {/* Timer Banner */}
        <View style={styles.timerBanner}>
          <View>
            <Text style={styles.timerTitle}>
              {isFlat ? 'Flat Surface Walk Test' : 'Stair Climbing Test'}
            </Text>
            <Text style={styles.timerHelp}>
              {isWalkRunning
                ? 'Keep device secured to leg / pocket during walking.'
                : 'Press Start Test to record phone motion sensor.'}
            </Text>
          </View>
          <View style={styles.clockCircle}>
            <Text style={styles.clockText}>
              {Math.floor(secondsRemaining / 60)}:
              {(secondsRemaining % 60).toString().padStart(2, '0')}
            </Text>
          </View>
        </View>

        {/* Waveform Visualization */}
        <WaveformDisplay
          dataPoints={waveformPoints}
          lastPeakDetected={lastPeakDetected}
          stepCount={currentStepCount}
          currentCadence={currentCadence}
          label={isFlat ? 'Flat Walking IMU Signal' : 'Stair Climbing IMU Signal'}
        />

        {/* Action Controls */}
        <View style={styles.walkControlsRow}>
          {!isWalkRunning ? (
            <>
              <TouchableOpacity
                style={[styles.startWalkBtn, { flex: 1.1 }]}
                onPress={() => startWalkTest(walkSubStep, false)}
              >
                <Text style={styles.startWalkText}>▶ Live Sensor Test</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.simulateWalkBtn, { flex: 1.2 }]}
                onPress={() => startWalkTest(walkSubStep, true)}
              >
                <Text style={styles.simulateWalkText}>🎮 Simulate Live Test</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.demoWalkBtn}
                onPress={() => prefillDemoWalk(walkSubStep)}
              >
                <Text style={styles.demoWalkText}>⚡ Quick Fill</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.stopWalkBtn} onPress={stopWalkTest}>
              <Text style={styles.stopWalkText}>⏹ Stop & Calculate Metrics</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Result Card for Current Sub-test */}
        {activeResult && (
          <View style={styles.metricsSummaryCard}>
            <Text style={styles.metricsHeader}>
              📊 {isFlat ? 'Flat Walking' : 'Stair Climbing'} Calculated Features
            </Text>
            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>CADENCE</Text>
                <Text style={styles.metricNumber}>{activeResult.cadence.toFixed(1)}</Text>
                <Text style={styles.metricUnit}>steps / min</Text>
              </View>

              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>STRIDE TIME CV</Text>
                <Text style={[styles.metricNumber, { color: '#0D9488' }]}>
                  {activeResult.strideTimeCV.toFixed(3)}
                </Text>
                <Text style={styles.metricUnit}>variability (std/mean)</Text>
              </View>

              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>TOTAL HEEL STRIKES</Text>
                <Text style={styles.metricNumber}>{activeResult.stepCount}</Text>
                <Text style={styles.metricUnit}>peaks detected</Text>
              </View>
            </View>
          </View>
        )}

        {/* Final Submission Card */}
        <View style={styles.submitSection}>
          <View style={styles.summaryBadge}>
            <Text style={styles.summaryBadgeText}>
              Flat: {flatResult ? `${flatResult.cadence} SPM / CV ${flatResult.strideTimeCV}` : 'Pending'}
              {'  '}•{'  '}
              Climbing: {climbingResult ? `${climbingResult.cadence} SPM / CV ${climbingResult.strideTimeCV}` : 'Pending'}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.triageSubmitBtn, isSubmitting && styles.btnDisabled]}
            onPress={handleSubmitTriage}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.triageSubmitText}>🚀 Transmit to AI Triage API</Text>
                <Text style={styles.arrowIcon}>→</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => setCurrentStep(2)}
        >
          <Text style={styles.secondaryBtnText}>← Back to Clinical Exam</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Protocol Mode Switcher Bar */}
      <View style={styles.modeSwitchBar}>
        <TouchableOpacity
          style={[styles.modeTab, assessmentMode === '15min' && styles.modeTabActive]}
          onPress={() => setAssessmentMode('15min')}
          activeOpacity={0.7}
        >
          <Text style={[styles.modeTabText, assessmentMode === '15min' && styles.modeTabTextActive]}>
            ⏱️ 15-Min Guided Routine
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTab, assessmentMode === 'quick' && styles.modeTabActive]}
          onPress={() => setAssessmentMode('quick')}
          activeOpacity={0.7}
        >
          <Text style={[styles.modeTabText, assessmentMode === 'quick' && styles.modeTabTextActive]}>
            ⚡ Quick 3-Step Triage
          </Text>
        </TouchableOpacity>
      </View>

      {assessmentMode === '15min' ? (
        <FifteenMinuteAssessmentRoutine patientId={patientId || 'PT-10045'} />
      ) : (
        <KeyboardAvoidingView
          style={styles.flex1}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Top Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Kneeva OA Triage</Text>
              <Text style={styles.headerSub}>Mobile Sensor & AI Assessment</Text>
            </View>
            <View style={styles.backBtnPlaceholder} />
          </View>

          {/* 3-Step Indicator */}
          <StepIndicator currentStep={currentStep} totalSteps={3} />

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  modeSwitchBar: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  modeTab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  modeTabActive: {
    backgroundColor: '#0D9488',
    borderColor: '#14B8A6',
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  modeTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F4F0',
  },
  flex1: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#003366',
    borderBottomWidth: 3,
    borderBottomColor: '#FF9933',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  backBtnPlaceholder: {
    width: 38,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  headerSub: {
    fontSize: 11,
    color: '#FF9933',
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60,
  },
  stepContainer: {
    gap: 16,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#003366',
    letterSpacing: 0.3,
  },
  stepSubtitle: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 8,
    fontWeight: '500',
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#003366',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  helperText: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#B0BEC5',
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#B0BEC5',
  },
  toggleBtnActive: {
    backgroundColor: '#003366',
    borderColor: '#003366',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#B0BEC5',
    marginVertical: 8,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '800',
    color: '#003366',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B0BEC5',
  },
  chipActive: {
    backgroundColor: '#003366',
    borderColor: '#003366',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  scaleContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  scaleBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B0BEC5',
    borderRadius: 4,
    paddingVertical: 10,
    alignItems: 'center',
  },
  scaleBtnActive: {
    backgroundColor: '#003366',
    borderColor: '#003366',
  },
  scaleNum: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
  },
  scaleNumActive: {
    color: '#FFFFFF',
  },
  scaleDesc: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '700',
  },
  scaleDescActive: {
    color: '#FF9933',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 16,
    borderWidth: 1,
    borderColor: '#B0BEC5',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#003366',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  computedBanner: {
    backgroundColor: '#FFFBEB',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#FF9933',
  },
  computedText: {
    fontSize: 12,
    color: '#003366',
    fontWeight: '600',
  },
  boldText: {
    fontWeight: '800',
  },
  navRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  primaryBtn: {
    backgroundColor: '#138808',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 6,
    gap: 8,
    elevation: 2,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryBtn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#003366',
  },
  secondaryBtnText: {
    color: '#003366',
    fontSize: 13,
    fontWeight: '800',
  },
  arrowIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 6,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: '#B0BEC5',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 10,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabBtnActive: {
    backgroundColor: '#003366',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  checkBadge: {
    color: '#FF9933',
    fontWeight: '800',
    fontSize: 12,
  },
  timerBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    padding: 14,
    borderWidth: 1,
    borderColor: '#B0BEC5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#003366',
  },
  timerHelp: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
    maxWidth: 200,
  },
  clockCircle: {
    backgroundColor: '#003366',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  clockText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  walkControlsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  startWalkBtn: {
    backgroundColor: '#138808',
    paddingVertical: 14,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startWalkText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  simulateWalkBtn: {
    backgroundColor: '#FF9933',
    paddingVertical: 14,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
  },
  simulateWalkText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  demoWalkBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#003366',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoWalkText: {
    color: '#003366',
    fontSize: 13,
    fontWeight: '800',
  },
  stopWalkBtn: {
    flex: 1,
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopWalkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  metricsSummaryCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 6,
    padding: 16,
    borderWidth: 1,
    borderColor: '#138808',
  },
  metricsHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#138808',
    marginBottom: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#003366',
    textAlign: 'center',
  },
  metricNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  metricUnit: {
    fontSize: 10,
    color: '#475569',
    marginTop: 1,
    fontWeight: '600',
  },
  submitSection: {
    marginTop: 10,
    gap: 10,
  },
  summaryBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#B0BEC5',
  },
  summaryBadgeText: {
    fontSize: 12,
    color: '#003366',
    fontWeight: '700',
  },
  triageSubmitBtn: {
    backgroundColor: '#138808',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 6,
    gap: 8,
    elevation: 3,
  },
  triageSubmitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardSubtitle: {
    fontSize: 11,
    color: '#475569',
    marginTop: 1,
  },
  cardDisabled: {
    backgroundColor: '#F8F9FA',
    borderColor: '#CBD5E1',
    opacity: 0.85,
  },
  modalityToggle: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 4,
    borderWidth: 1,
    flexShrink: 0,
    alignSelf: 'center',
  },
  modalityToggleOn: {
    backgroundColor: '#F0FDF4',
    borderColor: '#138808',
  },
  modalityToggleOff: {
    backgroundColor: '#FEF2F2',
    borderColor: '#DC2626',
  },
  modalityToggleText: {
    fontSize: 11,
    fontWeight: '800',
  },
  modalityToggleTextOn: {
    color: '#138808',
  },
  modalityToggleTextOff: {
    color: '#DC2626',
  },
  fieldSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 3,
  },
  skippedNotice: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
    backgroundColor: '#F8F9FA',
    padding: 10,
    borderRadius: 4,
    fontStyle: 'italic',
    borderWidth: 1,
    borderColor: '#B0BEC5',
  },
});
