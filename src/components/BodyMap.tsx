import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';
import type { PainMapEntry } from '@/types/contracts';
import { useTranslation } from '@/i18n';

// ─── Types ───────────────────────────────────────────────────────────

interface BodyMapProps {
  painEntries: PainMapEntry[];
  onRegionPress: (region: string) => void;
}

// ─── Joint region definitions ────────────────────────────────────────

interface JointRegion {
  id: string;
  cx: number;
  cy: number;
  r: number;
  labelKey: string;
}

const JOINT_REGIONS: JointRegion[] = [
  // Hips
  { id: 'left_hip', cx: 85, cy: 185, r: 16, labelKey: 'body_region_left_hip' },
  { id: 'right_hip', cx: 115, cy: 185, r: 16, labelKey: 'body_region_right_hip' },
  // Knees
  { id: 'left_knee', cx: 80, cy: 265, r: 16, labelKey: 'body_region_left_knee' },
  { id: 'right_knee', cx: 120, cy: 265, r: 16, labelKey: 'body_region_right_knee' },
  // Ankles
  { id: 'left_ankle', cx: 78, cy: 345, r: 14, labelKey: 'body_region_left_ankle' },
  { id: 'right_ankle', cx: 122, cy: 345, r: 14, labelKey: 'body_region_right_ankle' },
  // Hands
  { id: 'left_hand', cx: 32, cy: 230, r: 14, labelKey: 'body_region_left_hand' },
  { id: 'right_hand', cx: 168, cy: 230, r: 14, labelKey: 'body_region_right_hand' },
];

// ─── Pain level to color ─────────────────────────────────────────────

function getPainColor(level: number): string {
  if (level <= 0) return 'transparent';
  if (level <= 3) return '#86EFAC'; // green
  if (level <= 5) return '#FDE047'; // yellow
  if (level <= 7) return '#FB923C'; // orange
  return '#EF4444'; // red
}

function getPainOpacity(level: number): number {
  if (level <= 0) return 0;
  return 0.4 + (level / 10) * 0.5; // 0.4 to 0.9
}

// ─── Component ───────────────────────────────────────────────────────

export default function BodyMap({ painEntries, onRegionPress }: BodyMapProps) {
  const { t } = useTranslation();

  const getPainLevel = (regionId: string): number => {
    const entry = painEntries.find((e) => e.body_region === regionId);
    return entry?.pain_level ?? 0;
  };

  return (
    <View style={styles.container}>
      <Svg width="200" height="380" viewBox="0 0 200 380">
        {/* Body outline — simplified human figure */}
        <G opacity={0.15}>
          {/* Head */}
          <Circle cx="100" cy="35" r="22" fill="#475569" />
          {/* Neck */}
          <Path d="M93 55 L107 55 L107 65 L93 65 Z" fill="#475569" />
          {/* Torso */}
          <Path
            d="M65 65 L135 65 L140 130 L130 180 L70 180 L60 130 Z"
            fill="#475569"
          />
          {/* Left arm */}
          <Path
            d="M65 70 L45 100 L38 160 L30 225 L42 228 L52 165 L55 110 L65 80"
            fill="#475569"
          />
          {/* Right arm */}
          <Path
            d="M135 70 L155 100 L162 160 L170 225 L158 228 L148 165 L145 110 L135 80"
            fill="#475569"
          />
          {/* Left leg */}
          <Path
            d="M75 175 L70 250 L72 320 L68 355 L88 355 L85 320 L88 250 L95 175"
            fill="#475569"
          />
          {/* Right leg */}
          <Path
            d="M105 175 L112 250 L115 320 L112 355 L132 355 L128 320 L130 250 L125 175"
            fill="#475569"
          />
        </G>

        {/* Interactive joint circles */}
        {JOINT_REGIONS.map((region) => {
          const painLevel = getPainLevel(region.id);
          const hasPain = painLevel > 0;

          return (
            <G key={region.id}>
              {/* Outer glow for active regions */}
              {hasPain && (
                <G>
                  <Circle cx={region.cx} cy={region.cy} r={region.r + 12} fill={getPainColor(painLevel)} opacity={0.1} />
                  <Circle cx={region.cx} cy={region.cy} r={region.r + 8} fill={getPainColor(painLevel)} opacity={0.2} />
                  <Circle cx={region.cx} cy={region.cy} r={region.r + 4} fill={getPainColor(painLevel)} opacity={0.35} />
                </G>
              )}
              {/* Main circle */}
              <Circle
                cx={region.cx}
                cy={region.cy}
                r={region.r}
                fill={hasPain ? getPainColor(painLevel) : '#E2E8F0'}
                opacity={hasPain ? getPainOpacity(painLevel) : 0.7}
                stroke={hasPain ? getPainColor(painLevel) : '#94A3B8'}
                strokeWidth={2}
                onPress={() => onRegionPress(region.id)}
              />
              {/* Pain level number */}
              {hasPain && (
                <G onPress={() => onRegionPress(region.id)}>
                  <Circle
                    cx={region.cx}
                    cy={region.cy}
                    r={10}
                    fill="#FFFFFF"
                    opacity={0.9}
                  />
                </G>
              )}
            </G>
          );
        })}
      </Svg>

      {/* Region legend below body */}
      <View style={styles.legend}>
        {JOINT_REGIONS.map((region) => {
          const painLevel = getPainLevel(region.id);
          const hasPain = painLevel > 0;
          return (
            <TouchableOpacity
              key={region.id}
              style={[
                styles.legendItem,
                hasPain && { backgroundColor: getPainColor(painLevel) + '20' },
              ]}
              onPress={() => onRegionPress(region.id)}
            >
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: hasPain ? getPainColor(painLevel) : '#CBD5E1' },
                ]}
              />
              <Text style={[styles.legendText, hasPain && styles.legendTextActive]}>
                {t(region.labelKey)}
              </Text>
              {hasPain && (
                <Text style={[styles.legendLevel, { color: getPainColor(painLevel) }]}>
                  {painLevel}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
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
  legendTextActive: {
    color: '#475569',
    fontWeight: '500',
  },
  legendLevel: {
    fontSize: 11,
    fontWeight: '700',
  },
});
