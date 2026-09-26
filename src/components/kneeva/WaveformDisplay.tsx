import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

interface WaveformDisplayProps {
  dataPoints: number[]; // normalized 0-1 or signal values
  lastPeakDetected: boolean;
  stepCount: number;
  currentCadence: number;
  label?: string;
}

export default function WaveformDisplay({
  dataPoints,
  lastPeakDetected,
  stepCount,
  currentCadence,
  label = 'IMU Forward Swing & Impact Waveform',
}: WaveformDisplayProps) {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (lastPeakDetected) {
      pulseAnim.setValue(1);
      Animated.timing(pulseAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start();
    }
  }, [lastPeakDetected, pulseAnim]);

  // Construct SVG path from data points
  const width = 320;
  const height = 90;
  const points = dataPoints.slice(-40); // keep last 40 samples

  let pathD = '';
  if (points.length > 1) {
    const stepX = width / Math.max(1, points.length - 1);
    const maxVal = Math.max(6, ...points);
    const minVal = Math.min(0, ...points);
    const range = maxVal - minVal || 1;

    points.forEach((val, idx) => {
      const x = idx * stepX;
      const normalized = (val - minVal) / range;
      const y = height - (normalized * (height - 20) + 10);
      if (idx === 0) {
        pathD += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      } else {
        pathD += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
    });
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>{label}</Text>
          <Text style={styles.subtitle}>Z-Accel Impact & Y-Gyro Forward Swing</Text>
        </View>

        <Animated.View
          style={[
            styles.strikeBadge,
            {
              opacity: pulseAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.25, 1],
              }),
              transform: [
                {
                  scale: pulseAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.15],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.strikeText}>👟 STRIKE</Text>
        </Animated.View>
      </View>

      <View style={styles.svgWrapper}>
        <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
          {/* Baseline grid line */}
          <Path
            d={`M 0 ${height / 2} L ${width} ${height / 2}`}
            stroke="#E2E8F0"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          {pathD ? (
            <Path
              d={pathD}
              fill="none"
              stroke="#0D9488"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <Path
              d={`M 0 ${height / 2} L ${width} ${height / 2}`}
              fill="none"
              stroke="#94A3B8"
              strokeWidth="1.5"
            />
          )}
        </Svg>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>STEPS DETECTED</Text>
          <Text style={styles.statValue}>{stepCount}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.statBox}>
          <Text style={styles.statLabel}>EST. CADENCE</Text>
          <Text style={[styles.statValue, { color: '#0D9488' }]}>
            {currentCadence > 0 ? `${currentCadence.toFixed(1)}` : '--'}{' '}
            <Text style={styles.unitText}>SPM</Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  strikeBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  strikeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  svgWrapper: {
    height: 90,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 2,
  },
  unitText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  divider: {
    width: 1,
    height: '80%',
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
  },
});
