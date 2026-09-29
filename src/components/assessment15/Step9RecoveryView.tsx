/**
 * Step 9: Post-Test Pain & Joint Recovery
 * - Pain timeline line: Start → Post-Strength → End Movement → Recovery (5m)
 * - Post-exertional stiffness duration selector
 * - Recovery rate index
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Step9RecoveryData } from '@/types/assessment15';
import { PainSessionTimelineChart } from './ClinicalVisualizations';

interface Step9Props {
  data: Step9RecoveryData;
  onChange: (updated: Step9RecoveryData) => void;
}

export function Step9RecoveryView({ data, onChange }: Step9Props) {
  const updateRecoveryScore = (val: number) => {
    onChange({
      ...data,
      painTimeline: {
        ...data.painTimeline,
        recovery: val,
      },
    });
  };

  const updateStiffness = (mins: number) => {
    onChange({
      ...data,
      stiffnessDurationMinutes: mins,
    });
  };

  return (
    <View style={styles.container}>
      {/* 1. VAS Pain Progression Line across the entire session */}
      <PainSessionTimelineChart painTimeline={data.painTimeline} height={170} />

      {/* 2. Interactive Post-Test Pain Update */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Current Post-Test Pain Level (Recovery)</Text>
          <Text style={styles.badge}>{data.painTimeline.recovery} / 10</Text>
        </View>
        <Text style={styles.cardDesc}>
          5 minutes after completing walking, stairs, and balance tests.
        </Text>

        <View style={styles.scoreRow}>
          {[2, 3, 4, 5, 6, 7, 8].map((score) => {
            const isSel = Math.round(data.painTimeline.recovery) === score;
            return (
              <TouchableOpacity
                key={score}
                style={[styles.btn, isSel && styles.btnActive]}
                onPress={() => updateRecoveryScore(score)}
              >
                <Text style={[styles.btnText, isSel && styles.btnTextActive]}>{score}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 3. Joint Stiffness Duration */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Reported Knee Morning / Post-Rest Stiffness</Text>
        <Text style={styles.cardDesc}>
          How long does knee stiffness persist after rest or inactivity?
        </Text>

        <View style={styles.stiffnessRow}>
          {[10, 20, 30, 45, 60].map((mins) => {
            const isSel = data.stiffnessDurationMinutes === mins;
            return (
              <TouchableOpacity
                key={mins}
                style={[styles.stiffBtn, isSel && styles.stiffBtnActive]}
                onPress={() => updateStiffness(mins)}
              >
                <Text style={[styles.stiffText, isSel && styles.stiffTextActive]}>
                  {mins} min{mins >= 30 ? ' (OA)' : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 10,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardDesc: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 10,
  },
  badge: {
    backgroundColor: '#FFE4E6',
    color: '#E11D48',
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    fontSize: 12,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  btn: {
    flex: 1,
    marginHorizontal: 3,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  btnActive: {
    backgroundColor: '#E11D48',
    borderColor: '#BE123C',
  },
  btnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  btnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  stiffnessRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stiffBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  stiffBtnActive: {
    backgroundColor: '#0D9488',
    borderColor: '#0F766E',
  },
  stiffText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  stiffTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
