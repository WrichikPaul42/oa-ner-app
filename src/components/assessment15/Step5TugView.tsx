/**
 * Step 5: Timed Up and Go (TUG)
 * - IMU angular velocity with shaded phases (Stand, Walk Out, Turn, Walk Back, Sit)
 * - Knee flex angle across whole test
 * - Phase duration breakdown
 * - EMG effort peaks during stand & sit
 * - Total TUG duration vs clinical normative threshold
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Step5TugData } from '@/types/assessment15';
import { MedicalTimeSeriesChart, ComparisonBarChart } from './ClinicalVisualizations';

interface Step5Props {
  data: Step5TugData;
  onChange: (updated: Step5TugData) => void;
}

export function Step5TugView({ data }: Step5Props) {
  // Phase zones for time series shading
  const phases = [
    { label: 'Stand', startIdx: 0, endIdx: 2, fillColor: '#BAE6FD' },
    { label: 'Walk Out', startIdx: 2, endIdx: 6, fillColor: '#D1FAE5' },
    { label: 'Turn 180°', startIdx: 6, endIdx: 9, fillColor: '#FED7AA' },
    { label: 'Walk Back', startIdx: 9, endIdx: 12, fillColor: '#D1FAE5' },
    { label: 'Sit Down', startIdx: 12, endIdx: 14, fillColor: '#E9D5FF' },
  ];

  const phaseBars = [
    { label: 'Stand', leftValue: data.phaseDurations.stand, refValue: 1.2 },
    { label: 'Walk Out', leftValue: data.phaseDurations.walkOut, refValue: 2.8 },
    { label: 'Turn', leftValue: data.phaseDurations.turn, refValue: 1.5 },
    { label: 'Return', leftValue: data.phaseDurations.walkBack, refValue: 2.8 },
    { label: 'Sit', leftValue: data.phaseDurations.sit, refValue: 1.2 },
  ];

  return (
    <View style={styles.container}>
      {/* 1. TUG Clinical Score Card */}
      <View style={styles.scoreCard}>
        <View style={styles.scoreLeft}>
          <Text style={styles.scoreLabel}>TOTAL TUG TIME</Text>
          <View style={styles.timeRow}>
            <Text style={styles.timeMain}>{data.totalDurationSeconds}s</Text>
            <Text style={styles.timeRef}>/ &lt;{data.referenceThresholdSeconds}s norm</Text>
          </View>
          <Text style={styles.delayTag}>+{ (data.totalDurationSeconds - data.referenceThresholdSeconds).toFixed(1) }s clinical delay</Text>
        </View>

        <View style={[styles.riskBadge, data.fallRiskTier === 'Moderate' ? styles.badgeMod : styles.badgeHigh]}>
          <Text style={styles.riskBadgeLabel}>FALL RISK TIER</Text>
          <Text style={styles.riskBadgeText}>{data.fallRiskTier.toUpperCase()}</Text>
          <Text style={styles.riskBadgeSub}>Cautious turn velocity</Text>
        </View>
      </View>

      {/* 2. Phase-Shaded Angular Velocity & Flexion */}
      <MedicalTimeSeriesChart
        title="TUG Phase Segmentation & Kinematics"
        subtitle="Shaded segments: Stand → 3m Walk → 180° Turn → Return → Sit Down"
        series={[
          {
            id: 'gyro',
            name: 'Angular Velocity (°/s)',
            color: '#7C3AED',
            data: data.timeSeriesVelocity,
            unit: '°/s',
          },
          {
            id: 'flex',
            name: 'Flex Angle (°)',
            color: '#0D9488',
            data: data.timeSeriesFlexion,
            dashed: true,
            unit: '°',
          },
        ]}
        phases={phases}
        height={195}
        xAxisLabels={['0s', '3s', '6s', '9s', '12.8s']}
      />

      {/* 3. Phase Duration Breakdown vs Healthy Norm */}
      <ComparisonBarChart
        title="Phase Duration Breakdown vs Reference (s)"
        subtitle="Elevated turn duration (2.2s) and return walk indicate movement hesitation"
        groups={phaseBars}
        leftLabel="Patient Phase Time"
        leftColor="#0284C7"
        unit="s"
        height={170}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  scoreCard: {
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
  scoreLeft: {
    flex: 1,
  },
  scoreLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  timeMain: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  timeRef: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  delayTag: {
    fontSize: 10,
    color: '#D97706',
    fontWeight: '600',
    marginTop: 2,
  },
  riskBadge: {
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  badgeMod: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  badgeHigh: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  riskBadgeLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#92400E',
  },
  riskBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#D97706',
  },
  riskBadgeSub: {
    fontSize: 9,
    color: '#B45309',
  },
});
