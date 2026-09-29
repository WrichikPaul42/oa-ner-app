/**
 * Step 7: Stair Ascent & Descent Analysis
 * - Flex angle vs time with Ascent & Descent phases labeled
 * - RF & BF EMG envelopes on same axis as flexion angle
 * - Co-contraction index: Ascent vs Descent comparison bar
 * - Deep flexion acoustic crepitus spike count
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Step7StairsData } from '@/types/assessment15';
import { MedicalTimeSeriesChart, ComparisonBarChart } from './ClinicalVisualizations';

interface Step7Props {
  data: Step7StairsData;
  onChange: (updated: Step7StairsData) => void;
}

export function Step7StairsView({ data }: Step7Props) {
  const stairPhases = [
    { label: 'Ascent (Concentric)', startIdx: 0, endIdx: 6, fillColor: '#CCFBF1' },
    { label: 'Descent (Eccentric)', startIdx: 6, endIdx: 11, fillColor: '#FFEDD5' },
  ];

  const cciBars = [
    { label: 'Ascent CCI', leftValue: Math.round(data.ascentCci * 100), refValue: 35 },
    { label: 'Descent CCI', leftValue: Math.round(data.descentCci * 100), refValue: 40 },
  ];

  return (
    <View style={styles.container}>
      {/* 1. Stair Biomechanics Summary */}
      <View style={styles.summaryCard}>
        <View style={styles.col}>
          <Text style={styles.colLabel}>STAIR ASCENT</Text>
          <Text style={styles.colValue}>{data.ascentDurationSeconds}s</Text>
          <Text style={styles.colSub}>Peak Flex: {data.ascentPeakFlexionDeg}°</Text>
          <Text style={styles.colCci}>CCI: {data.ascentCci.toFixed(2)}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.col}>
          <Text style={styles.colLabel}>DEEP CREPITUS</Text>
          <Text style={[styles.colValue, { color: '#DC2626' }]}>{data.crepitusDeepFlexionCount}</Text>
          <Text style={styles.colSub}>Acoustic spikes</Text>
          <Text style={[styles.colCci, { color: '#B91C1C' }]}>&gt;90° Flexion</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.col}>
          <Text style={styles.colLabel}>STAIR DESCENT</Text>
          <Text style={styles.colValue}>{data.descentDurationSeconds}s</Text>
          <Text style={styles.colSub}>Peak Flex: {data.descentPeakFlexionDeg}°</Text>
          <Text style={[styles.colCci, { color: '#D97706' }]}>CCI: {data.descentCci.toFixed(2)}</Text>
        </View>
      </View>

      {/* 2. Flexion Angle & EMG Envelope with Ascent / Descent Shading */}
      <MedicalTimeSeriesChart
        title="Stair Climbing Kinematics & Muscle Activation"
        subtitle="Ascent (concentric drive) vs Descent (eccentric braking & guarding)"
        series={[
          {
            id: 'flex',
            name: 'Knee Flexion (°)',
            color: '#0D9488',
            data: data.timeSeriesFlexion,
            unit: '°',
          },
          {
            id: 'rf',
            name: 'RF Quadriceps (mV)',
            color: '#0284C7',
            data: data.timeSeriesRfEmg,
            dashed: true,
            unit: 'mV',
          },
          {
            id: 'bf',
            name: 'BF Hamstrings (mV)',
            color: '#EA580C',
            data: data.timeSeriesBfEmg,
            dashed: true,
            unit: 'mV',
          },
        ]}
        phases={stairPhases}
        height={195}
        xAxisLabels={['Start', 'Mid-Ascent', 'Turn Landing', 'Descent', 'Finish']}
      />

      {/* 3. Co-Contraction Index (CCI): Ascent vs Descent */}
      <ComparisonBarChart
        title="Antagonist Co-Contraction Index (% CCI)"
        subtitle="Markedly elevated descent CCI indicates knee instability compensation"
        groups={cciBars}
        leftLabel="Patient CCI %"
        leftColor="#D97706"
        unit="%"
        height={165}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  col: {
    alignItems: 'center',
    flex: 1,
  },
  divider: {
    width: 1,
    height: 48,
    backgroundColor: '#E2E8F0',
  },
  colLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
  },
  colValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  colSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  colCci: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0D9488',
    marginTop: 2,
  },
});
