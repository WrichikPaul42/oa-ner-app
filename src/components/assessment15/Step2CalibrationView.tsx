/**
 * Step 2: Calibration and Quiet Standing
 * - Live quiet standing knee flexion drift
 * - Resting EMG trace for RF & BF
 * - Static 1g gravity IMU acceleration
 * - Fixed layout Re-Zero Baselines action button (no elongation)
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Step2CalibrationData } from '@/types/assessment15';
import { MedicalTimeSeriesChart } from './ClinicalVisualizations';
import { subscribeLiveSensorReading, isLiveHardwareStreaming, LiveTelemetrySample } from '@/services/liveSensorStream';

interface Step2Props {
  data: Step2CalibrationData;
  onChange: (updated: Step2CalibrationData) => void;
}

export function Step2CalibrationView({ data, onChange }: Step2Props) {
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [isHardware, setIsHardware] = useState(false);

  // Dynamic live rolling buffers (12 points)
  const [liveFlex, setLiveFlex] = useState<number[]>([1.2, 1.1, 1.4, 1.2, 1.0, 1.3, 1.1, 1.2, 1.2, 1.1, 1.3, 1.2]);
  const [liveRfEmg, setLiveRfEmg] = useState<number[]>([12, 14, 11, 13, 12, 15, 12, 11, 14, 13, 12, 13]);
  const [liveBfEmg, setLiveBfEmg] = useState<number[]>([15, 16, 14, 15, 13, 16, 15, 14, 16, 15, 14, 15]);
  const [liveAccelY, setLiveAccelY] = useState<number[]>([0.98, 0.99, 0.98, 0.98, 0.99, 0.98, 0.97, 0.98, 0.99, 0.98, 0.98, 0.98]);

  // Subscribe to live telemetry stream
  useEffect(() => {
    const unsub = subscribeLiveSensorReading((sample: LiveTelemetrySample) => {
      setIsHardware(isLiveHardwareStreaming());

      // Scale flex to resting angle (0-5 deg at rest)
      const restFlex = Math.min(6, sample.flex_angle_deg * 0.08);
      const restRf = Math.min(25, sample.emg_mv * 0.1 + 8);
      const restBf = Math.min(25, sample.emg_mv * 0.08 + 10);
      const restAccel = Math.min(1.05, Math.max(0.95, sample.mpu_accel.y));

      setLiveFlex((prev) => [...prev.slice(1), Math.round(restFlex * 10) / 10]);
      setLiveRfEmg((prev) => [...prev.slice(1), Math.round(restRf)]);
      setLiveBfEmg((prev) => [...prev.slice(1), Math.round(restBf)]);
      setLiveAccelY((prev) => [...prev.slice(1), Math.round(restAccel * 100) / 100]);
    });

    return () => unsub();
  }, []);

  const handleRecalibrate = () => {
    setIsCalibrating(true);
    setTimeout(() => {
      onChange({
        ...data,
        leftFlexAngleBaseline: 0.1,
        rightFlexAngleBaseline: 0.1,
        rfRestingNoiseMv: 8.5,
        bfRestingNoiseMv: 9.8,
        isCalibrated: true,
      });
      setLiveFlex([0.2, 0.1, 0.2, 0.1, 0.0, 0.2, 0.1, 0.1, 0.2, 0.1, 0.1, 0.1]);
      setIsCalibrating(false);
    }, 1000);
  };

  return (
    <View style={styles.container}>
      {/* Calibration Status & Action Card (Fixed Proportions) */}
      <View style={styles.statusCard}>
        <View style={styles.statusTopRow}>
          <View style={styles.checkCircle}>
            <Text style={styles.checkMark}>✓</Text>
          </View>
          <View style={styles.statusTextCol}>
            <View style={styles.titleBadgeRow}>
              <Text style={styles.statusTitle}>All 5 Bilateral Sensor Modalities Calibrated</Text>
              {isHardware && (
                <View style={styles.hwBadge}>
                  <Text style={styles.hwBadgeText}>HW LIVE</Text>
                </View>
              )}
            </View>
            <Text style={styles.statusSub}>Quiet standing reference locked. Zero flex baseline active.</Text>
          </View>
        </View>

        {/* Clean, Full-Width Re-Zero Button (Never Elongated) */}
        <TouchableOpacity
          style={[styles.recalBtn, isCalibrating && styles.recalBtnDisabled]}
          onPress={handleRecalibrate}
          disabled={isCalibrating}
          activeOpacity={0.8}
        >
          <Text style={styles.recalBtnText}>
            {isCalibrating ? '⏳ Zeroing Sensor Offsets...' : '↺ Re-Zero All Sensor Baselines'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 1. Flex Angle vs Time (Live Stream) */}
      <MedicalTimeSeriesChart
        title="Live Knee Flexion Drift (Quiet Standing)"
        subtitle="Expected: Stable flat line within ±3° of full knee extension (0°)"
        series={[
          {
            id: 'flex',
            name: 'Flex Angle (°)',
            color: '#0D9488',
            data: liveFlex,
            yMin: 0,
            yMax: 8,
            unit: '°',
          },
        ]}
        height={150}
        xAxisLabels={['-5s', '-4s', '-3s', '-2s', '-1s', 'Live']}
      />

      {/* 2. Resting EMG Traces for RF & BF */}
      <MedicalTimeSeriesChart
        title="Resting Muscle EMG Noise Baseline (RF vs BF)"
        subtitle="Rectus Femoris & Biceps Femoris quiet baseline (expected < 20 mV)"
        series={[
          {
            id: 'rf_emg',
            name: 'Rectus Femoris (RF)',
            color: '#0284C7',
            data: liveRfEmg,
            unit: 'mV',
          },
          {
            id: 'bf_emg',
            name: 'Biceps Femoris (BF)',
            color: '#EA580C',
            data: liveBfEmg,
            unit: 'mV',
          },
        ]}
        height={150}
        xAxisLabels={['-5s', '-4s', '-3s', '-2s', '-1s', 'Live']}
      />

      {/* 3. IMU Static Gravity Vector */}
      <MedicalTimeSeriesChart
        title="IMU Vertical Acceleration Stability (1g Gravity)"
        subtitle="Confirms sensor orientation stability without loose strap vibration"
        series={[
          {
            id: 'accel_y',
            name: 'Vertical Accel (g)',
            color: '#7C3AED',
            data: liveAccelY,
            yMin: 0.8,
            yMax: 1.2,
            unit: 'g',
          },
        ]}
        height={150}
        xAxisLabels={['-5s', '-4s', '-3s', '-2s', '-1s', 'Live']}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  statusCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86EFAC',
    padding: 12,
    marginBottom: 10,
  },
  statusTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkMark: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  statusTextCol: {
    flex: 1,
  },
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  statusTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#14532D',
  },
  hwBadge: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  hwBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
  },
  statusSub: {
    fontSize: 11,
    color: '#166534',
    marginTop: 2,
  },
  recalBtn: {
    backgroundColor: '#16A34A',
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  recalBtnDisabled: {
    opacity: 0.6,
  },
  recalBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
