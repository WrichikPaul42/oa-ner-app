/**
 * Step 6: Walking Analysis (Comfortable Pace & 40m Fast Walk)
 * - Mean gait cycle knee flexion (0-100% normalized), Left vs Right overlaid
 * - Stride time variability (CV %) and gait cadence
 * - Antagonist Co-contraction Index (CCI)
 * - Piezo acoustic joint crepitus bursts
 * - Comfortable vs Fast speed comparison bar
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Step6WalkingData } from '@/types/assessment15';
import { MedicalTimeSeriesChart, ComparisonBarChart } from './ClinicalVisualizations';

interface Step6Props {
  data: Step6WalkingData;
  onChange: (updated: Step6WalkingData) => void;
}

export function Step6GaitView({ data }: Step6Props) {
  const speedComparison = [
    { label: 'Comfortable', leftValue: data.comfortableSpeedMs, refValue: 1.25 },
    { label: '40m Fast Pace', leftValue: data.fastSpeedMs, refValue: 1.65 },
  ];

  return (
    <View style={styles.container}>
      {/* 1. Gait Metrics Header Banner */}
      <View style={styles.banner}>
        <View style={styles.bannerItem}>
          <Text style={styles.bannerLabel}>STRIDE TIME CV</Text>
          <Text style={[styles.bannerValue, data.strideTimeCvPct > 6.0 && { color: '#DC2626' }]}>
            {data.strideTimeCvPct}%
          </Text>
          <Text style={styles.bannerSub}>Norm: &lt;5.0%</Text>
        </View>

        <View style={styles.bannerDivider} />

        <View style={styles.bannerItem}>
          <Text style={styles.bannerLabel}>CO-CONTRACTION (CCI)</Text>
          <Text style={[styles.bannerValue, { color: '#D97706' }]}>
            {data.coContractionIndex.toFixed(2)}
          </Text>
          <Text style={styles.bannerSub}>Elevated Guarding</Text>
        </View>

        <View style={styles.bannerDivider} />

        <View style={styles.bannerItem}>
          <Text style={styles.bannerLabel}>PIEZO BURSTS</Text>
          <Text style={[styles.bannerValue, { color: '#0D9488' }]}>
            {data.piezoCrepitusBursts}
          </Text>
          <Text style={styles.bannerSub}>Acoustic spikes</Text>
        </View>
      </View>

      {/* 2. Mean Gait Cycle Knee Flexion (0-100% Stride) Left vs Right */}
      <MedicalTimeSeriesChart
        title="Mean Gait Cycle Knee Flexion (0 - 100% Stride)"
        subtitle="Left (symptomatic) vs Right (control) showing reduced swing peak & stance lag"
        series={[
          {
            id: 'left_gait',
            name: 'Left Knee Flexion (Peak: 62°)',
            color: '#D97706',
            data: data.meanGaitCycleFlexionLeft,
            unit: '°',
          },
          {
            id: 'right_gait',
            name: 'Right Knee Flexion (Peak: 67°)',
            color: '#0D9488',
            data: data.meanGaitCycleFlexionRight,
            unit: '°',
          },
        ]}
        height={180}
        xAxisLabels={['0% Heel', '25% Mid', '50% Toe-off', '75% Swing', '100% Stride']}
      />

      {/* 3. Walking Speed: Comfortable vs Fast Walk */}
      <ComparisonBarChart
        title="Walking Velocity Comparison (m/s)"
        subtitle="Comfortable pace vs 40-meter fast walk test against normative thresholds"
        groups={speedComparison}
        leftLabel="Patient Speed"
        leftColor="#0284C7"
        unit="m/s"
        height={165}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  banner: {
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
  bannerItem: {
    alignItems: 'center',
    flex: 1,
  },
  bannerDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E2E8F0',
  },
  bannerLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
  },
  bannerValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  bannerSub: {
    fontSize: 10,
    color: '#94A3B8',
  },
});
