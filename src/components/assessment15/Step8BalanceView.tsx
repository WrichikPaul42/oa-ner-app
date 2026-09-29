/**
 * Step 8: Single-Leg Stance Balance Test
 * - Postural sway area (cm²) & X-Y sway trajectory comparison
 * - Balance hold duration per leg vs 30s normative threshold
 * - RF & BF EMG stabilization effort bursts
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Step8BalanceData } from '@/types/assessment15';
import { PosturalSwayScatterChart, ComparisonBarChart } from './ClinicalVisualizations';

interface Step8Props {
  data: Step8BalanceData;
  onChange: (updated: Step8BalanceData) => void;
}

export function Step8BalanceView({ data }: Step8Props) {
  const balanceBars = [
    {
      label: 'Single Leg Stance',
      leftValue: data.leftHoldSeconds,
      rightValue: data.rightHoldSeconds,
      refValue: data.normativeHoldSeconds,
    },
  ];

  return (
    <View style={styles.container}>
      {/* 1. Stance Duration & Area Banner */}
      <View style={styles.banner}>
        <View style={styles.col}>
          <Text style={styles.label}>LEFT LEG STANCE</Text>
          <Text style={[styles.val, { color: '#D97706' }]}>{data.leftHoldSeconds}s</Text>
          <Text style={styles.sub}>Sway Area: {data.leftSwayAreaCm2} cm²</Text>
          <Text style={styles.tagDeficit}>-13.5s below norm</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.col}>
          <Text style={styles.label}>RIGHT LEG STANCE</Text>
          <Text style={[styles.val, { color: '#0D9488' }]}>{data.rightHoldSeconds}s</Text>
          <Text style={styles.sub}>Sway Area: {data.rightSwayAreaCm2} cm²</Text>
          <Text style={styles.tagNorm}>Normal balance</Text>
        </View>
      </View>

      {/* 2. Postural Sway Trajectory Scatter (X-Y Scatter Plot) */}
      <PosturalSwayScatterChart
        title="Unipedal Center-of-Mass Sway Trajectory (X-Y Plane)"
        subtitle="Left (amber, symptomatic) shows enlarged 8.4 cm² sway ellipse vs Right (3.8 cm²)"
        leftPath={data.leftSwayPathXy}
        rightPath={data.rightSwayPathXy}
        leftArea={data.leftSwayAreaCm2}
        rightArea={data.rightSwayAreaCm2}
      />

      {/* 3. Balance Hold Time Comparison vs 30s Norm */}
      <ComparisonBarChart
        title="Unipedal Balance Duration vs Norm (s)"
        subtitle="30-second standard clinical unipedal stance cut-off"
        groups={balanceBars}
        leftLabel="Left Leg Hold"
        rightLabel="Right Leg Hold"
        leftColor="#D97706"
        rightColor="#0D9488"
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
  col: {
    alignItems: 'center',
    flex: 1,
  },
  divider: {
    width: 1,
    height: 44,
    backgroundColor: '#E2E8F0',
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
  },
  val: {
    fontSize: 20,
    fontWeight: '800',
  },
  sub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  tagDeficit: {
    fontSize: 9,
    color: '#DC2626',
    fontWeight: '700',
    marginTop: 2,
  },
  tagNorm: {
    fontSize: 9,
    color: '#16A34A',
    fontWeight: '700',
    marginTop: 2,
  },
});
