import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import type { SensorReading } from '@/types/contracts';

// ─── Types ───────────────────────────────────────────────────────────

interface FlexChartProps {
  data: SensorReading[];
  title: string;
  mode: 'flex_left' | 'flex_right';
  maxPoints?: number;
}

interface VelocityChartProps {
  leftData: SensorReading[];
  rightData: SensorReading[];
  title: string;
  mode: 'velocity';
  maxPoints?: number;
}

interface AcousticChartProps {
  leftData: SensorReading[];
  rightData: SensorReading[];
  title: string;
  mode: 'acoustic';
  maxPoints?: number;
}

import SerialPlotter from './SerialPlotter';

export { SerialPlotter };

interface SerialPlotterModeProps {
  mode: 'serial_plotter';
  title?: string;
  data?: SensorReading[];
  preferredNode?: 'node_right' | 'node_left';
  maxPoints?: number;
}

type SensorChartProps =
  | FlexChartProps
  | VelocityChartProps
  | AcousticChartProps
  | SerialPlotterModeProps;

// ─── Helpers ─────────────────────────────────────────────────────────

const chartWidth = Dimensions.get('window').width - 56;

/** Converts raw flex resistance (0–1000) to knee flexion degrees (0–135°) */
function flexToDegrees(resistance: number): number {
  return Math.round(Math.min(135, (resistance / 1000) * 135));
}

/** Computes angular velocity magnitude from gyro vector (°/s) */
function gyroMagnitude(gyro: { x: number; y: number; z: number }): number {
  return Math.round(Math.sqrt(gyro.x ** 2 + gyro.y ** 2 + gyro.z ** 2) * 10) / 10;
}

/**
 * Simulates acoustic emission (vibration/crepitus) from gyro data.
 * The acoustic intensity is proportional to angular velocity —
 * rapid joint movement produces high-amplitude vibration bursts,
 * while a stationary joint shows only low baseline noise.
 * Uses a simple seeded hash to produce deterministic noise per sample index.
 */
function simulateAcoustic(gyro: { x: number; y: number; z: number }, index: number): number {
  const magnitude = gyroMagnitude(gyro);
  // Deterministic pseudo-random noise from index (avoids jittering on re-render)
  const seed = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  const noise = seed - Math.floor(seed); // 0..1 deterministic random
  // Baseline micro-vibration (0.5–2) + movement-correlated burst
  const baseline = 0.5 + noise * 1.5;
  const burst = magnitude * (0.3 + noise * 0.7);
  return Math.round((baseline + burst) * 10) / 10;
}

// ─── Component ───────────────────────────────────────────────────────

export default function SensorChart(props: SensorChartProps) {
  const { title, mode, maxPoints = 25 } = props;

  // ─── Serial Plotter mode (11-channel live oscilloscope) ───────────
  if (mode === 'serial_plotter') {
    const { data, preferredNode } = props as SerialPlotterModeProps;
    return (
      <SerialPlotter
        externalReadings={data}
        preferredNode={preferredNode}
        maxPoints={maxPoints}
      />
    );
  }

  // ─── Acoustic chart (vibration/crepitus derived from gyro) ───────
  if (mode === 'acoustic') {
    const { leftData, rightData } = props as AcousticChartProps;
    const leftSlice = leftData.slice(-maxPoints);
    const rightSlice = rightData.slice(-maxPoints);

    const maxLen = Math.max(leftSlice.length, rightSlice.length);
    if (maxLen < 2) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>Waiting for data...</Text>
          </View>
        </View>
      );
    }

    const leftVals = leftSlice.map((d, i) => simulateAcoustic(d.mpu_gyro, i));
    const rightVals = rightSlice.map((d, i) => simulateAcoustic(d.mpu_gyro, i + 1000));
    while (leftVals.length < maxLen) leftVals.push(0.5);
    while (rightVals.length < maxLen) rightVals.push(0.5);

    const chartData = {
      labels: [],
      datasets: [
        { data: leftVals, color: () => '#EC4899', strokeWidth: 1.5 },
        { data: rightVals, color: () => '#8B5CF6', strokeWidth: 1.5 },
      ],
    };

    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EC4899' }]} />
              <Text style={styles.legendText}>Left</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#8B5CF6' }]} />
              <Text style={styles.legendText}>Right</Text>
            </View>
          </View>
        </View>

        <LineChart
          data={chartData as any}
          width={chartWidth}
          height={160}
          withDots={false}
          withInnerLines={true}
          withOuterLines={false}
          withHorizontalLabels={true}
          withVerticalLabels={false}
          chartConfig={{
            backgroundColor: '#FFFFFF',
            backgroundGradientFrom: '#FDF2F8',
            backgroundGradientTo: '#FFFFFF',
            fillShadowGradientFrom: '#EC4899',
            fillShadowGradientFromOpacity: 0.15,
            fillShadowGradientTo: '#FFFFFF',
            fillShadowGradientToOpacity: 0.05,
            decimalPlaces: 1,
            color: (opacity = 1) => `rgba(236, 72, 153, ${opacity})`,
            labelColor: () => '#94A3B8',
            propsForBackgroundLines: {
              strokeDasharray: '4 4',
              stroke: '#E2E8F0',
            },
            strokeWidth: 1.5,
          }}
          style={styles.chart}
        />
      </View>
    );
  }

  // ─── Velocity chart (dual-line: both legs on one graph) ──────────
  if (mode === 'velocity') {
    const { leftData, rightData } = props as VelocityChartProps;
    const leftSlice = leftData.slice(-maxPoints);
    const rightSlice = rightData.slice(-maxPoints);

    const maxLen = Math.max(leftSlice.length, rightSlice.length);
    if (maxLen < 2) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>Waiting for data...</Text>
          </View>
        </View>
      );
    }

    // Pad shorter array with 0s so both datasets have equal length
    const leftVals = leftSlice.map((d) => gyroMagnitude(d.mpu_gyro));
    const rightVals = rightSlice.map((d) => gyroMagnitude(d.mpu_gyro));
    while (leftVals.length < maxLen) leftVals.push(0);
    while (rightVals.length < maxLen) rightVals.push(0);

    const chartData = {
      labels: [],
      datasets: [
        { data: leftVals, color: () => '#6366F1', strokeWidth: 2 },
        { data: rightVals, color: () => '#F59E0B', strokeWidth: 2 },
      ],
    };

    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#6366F1' }]} />
              <Text style={styles.legendText}>Left Leg</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.legendText}>Right Leg</Text>
            </View>
          </View>
        </View>

        <LineChart
          data={chartData as any}
          width={chartWidth}
          height={160}
          withDots={false}
          withInnerLines={true}
          withOuterLines={false}
          withHorizontalLabels={true}
          withVerticalLabels={false}
          yAxisSuffix=" °/s"
          chartConfig={{
            backgroundColor: '#FFFFFF',
            backgroundGradientFrom: '#F8FAFC',
            backgroundGradientTo: '#FFFFFF',
            fillShadowGradientFrom: '#6366F1',
            fillShadowGradientFromOpacity: 0.2,
            fillShadowGradientTo: '#FFFFFF',
            fillShadowGradientToOpacity: 0.05,
            decimalPlaces: 1,
            color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
            labelColor: () => '#94A3B8',
            propsForBackgroundLines: {
              strokeDasharray: '4 4',
              stroke: '#E2E8F0',
            },
            strokeWidth: 2,
          }}
          bezier
          style={styles.chart}
        />
      </View>
    );
  }

  // ─── Flex chart (single leg, converted to degrees) ───────────────
  const { data } = props as FlexChartProps;
  const displayData = data.slice(-maxPoints);

  if (displayData.length < 2) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Waiting for data...</Text>
        </View>
      </View>
    );
  }

  const isLeft = mode === 'flex_left';
  const lineColor = isLeft ? '#0D9488' : '#0891B2';

  const chartData = {
    labels: [],
    datasets: [
      {
        data: displayData.map((d) => flexToDegrees(d.flex_resistance)),
        color: () => lineColor,
        strokeWidth: 2,
      },
    ],
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.unitLabel}>Degrees (°)</Text>
      </View>

      <LineChart
        data={chartData as any}
        width={chartWidth}
        height={160}
        withDots={false}
        withInnerLines={true}
        withOuterLines={false}
        withHorizontalLabels={true}
        withVerticalLabels={false}
        yAxisSuffix="°"
        chartConfig={{
          backgroundColor: '#FFFFFF',
          backgroundGradientFrom: '#F8FAFC',
          backgroundGradientTo: '#FFFFFF',
          fillShadowGradientFrom: lineColor,
          fillShadowGradientFromOpacity: 0.4,
          fillShadowGradientTo: '#FFFFFF',
          fillShadowGradientToOpacity: 0.1,
          decimalPlaces: 0,
          color: (opacity = 1) =>
            isLeft
              ? `rgba(13, 148, 136, ${opacity})`
              : `rgba(8, 145, 178, ${opacity})`,
          labelColor: () => '#94A3B8',
          propsForBackgroundLines: {
            strokeDasharray: '4 4',
            stroke: '#E2E8F0',
          },
          strokeWidth: 2,
        }}
        bezier
        style={styles.chart}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  unitLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  legendRow: {
    flexDirection: 'row',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  chart: {
    marginLeft: -16,
    borderRadius: 8,
  },
  placeholder: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    marginTop: 8,
  },
  placeholderText: {
    fontSize: 14,
    color: '#94A3B8',
  },
});
