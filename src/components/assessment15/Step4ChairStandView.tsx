/**
 * Step 4: 30-Second Chair Stand (Sit-to-Stand)
 * - Repeating flexion peaks with live rep counter
 * - IMU angular velocity vs. time
 * - RF & BF EMG envelopes aligned with knee angle
 * - Time per rep across 30s (fatigue decay)
 * - Piezo crepitus spike bursts during knee flexion
 * - Total reps vs reference norm bar chart
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Step4ChairStandData } from '@/types/assessment15';
import { MedicalTimeSeriesChart, ComparisonBarChart } from './ClinicalVisualizations';

interface Step4Props {
  data: Step4ChairStandData;
  onChange: (updated: Step4ChairStandData) => void;
}

export function Step4ChairStandView({ data }: Step4Props) {
  const repsComparison = [
    {
      label: '30s Stand Reps',
      leftValue: data.totalReps,
      refValue: data.referenceThresholdReps,
    },
  ];

  // Fatigue curve: duration of each rep from rep 1 to rep 11
  const repDurations = data.repList.map((r) => ({
    label: `R${r.repNumber}`,
    leftValue: r.durationSeconds,
  }));

  return (
    <View style={styles.container}>
      {/* 1. Live Counters & Metrics Banner */}
      <View style={styles.metricsBanner}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>TOTAL REPS (30s)</Text>
          <View style={styles.counterRow}>
            <Text style={styles.counterMain}>{data.totalReps}</Text>
            <Text style={styles.counterRef}>/ {data.referenceThresholdReps} norm</Text>
          </View>
          <Text style={styles.deficitTag}>Deficit: -{data.referenceThresholdReps - data.totalReps} reps</Text>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>FATIGUE SLOWING</Text>
          <Text style={[styles.counterMain, { color: '#E11D48' }]}>+{data.fatigueDecayPct}%</Text>
          <Text style={styles.metricSub}>2.1s → 3.4s / rep</Text>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>PIEZO CREPITUS</Text>
          <Text style={[styles.counterMain, { color: '#D97706' }]}>{data.crepitusTotalEvents}</Text>
          <Text style={styles.metricSub}>Acoustic spikes</Text>
        </View>
      </View>

      {/* 2. Knee Flexion Peaks aligned with Angular Velocity */}
      <MedicalTimeSeriesChart
        title="Knee Flexion Peaks & Sit-to-Stand Angular Velocity"
        subtitle="Flex angle repeating peaks (0-106°) aligned with stand/sit velocity spikes"
        series={[
          {
            id: 'flex',
            name: 'Flex Angle (°)',
            color: '#0D9488',
            data: data.timeSeriesFlexion,
            unit: '°',
          },
          {
            id: 'gyro',
            name: 'Angular Velocity (°/s)',
            color: '#7C3AED',
            data: data.timeSeriesAngularVelocity,
            dashed: true,
            unit: '°/s',
          },
        ]}
        height={180}
        xAxisLabels={['0s', '6s', '12s', '18s', '24s', '30s']}
      />

      {/* 3. RF & BF EMG Envelope aligned with Piezo Crepitus Bursts */}
      <MedicalTimeSeriesChart
        title="Neuromuscular Drive & Piezo Acoustic Emission"
        subtitle="RF extension drive, BF co-contraction, and high-frequency piezo crepitus"
        series={[
          {
            id: 'rf',
            name: 'RF Quadriceps (mV)',
            color: '#0284C7',
            data: data.timeSeriesRfEmg,
            unit: 'mV',
          },
          {
            id: 'piezo',
            name: 'Piezo Joint Vibration',
            color: '#EA580C',
            data: data.timeSeriesPiezo,
            unit: 'raw',
          },
          {
            id: 'bf',
            name: 'BF Hamstrings (mV)',
            color: '#64748B',
            data: data.timeSeriesBfEmg,
            dashed: true,
            unit: 'mV',
          },
        ]}
        height={180}
        xAxisLabels={['0s', '6s', '12s', '18s', '24s', '30s']}
      />

      {/* 4. Fatigue Deceleration: Time Per Rep across test */}
      <ComparisonBarChart
        title="Time Required Per Repetition Across 30s (Fatigue Decay)"
        subtitle="Progressive lengthening indicates quadriceps motor unit exhaustion"
        groups={repDurations}
        leftLabel="Rep Time (s)"
        leftColor="#F59E0B"
        unit="s"
        height={165}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  metricsBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricDivider: {
    width: 1,
    height: 38,
    backgroundColor: '#E2E8F0',
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  counterMain: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  counterRef: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  metricSub: {
    fontSize: 10,
    color: '#94A3B8',
  },
  deficitTag: {
    fontSize: 9,
    color: '#DC2626',
    fontWeight: '700',
  },
});
