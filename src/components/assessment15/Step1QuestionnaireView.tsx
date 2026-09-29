/**
 * Step 1: Clinical Knee Health Survey & Intake
 * - Sliders for Baseline VAS Pain (0-10) and Clinical Domains (Pain, Stiffness, Function)
 * - Live Bar chart of symptom impairment levels
 * - Mountain lifestyle indicators (incline hours, carried load)
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Step1QuestionnaireData } from '@/types/assessment15';
import { ComparisonBarChart } from './ClinicalVisualizations';

interface Step1Props {
  data: Step1QuestionnaireData;
  onChange: (updated: Step1QuestionnaireData) => void;
}

export function Step1QuestionnaireView({ data, onChange }: Step1Props) {
  const updatePainBaseline = (val: number) => {
    onChange({ ...data, painScoreBaseline: Math.round(val * 10) / 10 });
  };

  const updateDomain = (domain: 'pain' | 'stiffness' | 'function', delta: number) => {
    let p = data.symptomPain;
    let s = data.symptomStiffness;
    let f = data.symptomFunction;

    if (domain === 'pain') p = Math.max(0, Math.min(20, p + delta));
    if (domain === 'stiffness') s = Math.max(0, Math.min(8, s + delta));
    if (domain === 'function') f = Math.max(0, Math.min(68, f + delta));

    const totalNorm = Math.round(((p / 20) * 0.35 + (s / 8) * 0.15 + (f / 68) * 0.50) * 1000) / 10;
    onChange({
      ...data,
      symptomPain: p,
      symptomStiffness: s,
      symptomFunction: f,
      symptomTotalNormalized: totalNorm,
    });
  };

  // Convert to percentage for the bar chart
  const domainBars = [
    { label: 'Pain', leftValue: Math.round((data.symptomPain / 20) * 100), refValue: 20 },
    { label: 'Stiffness', leftValue: Math.round((data.symptomStiffness / 8) * 100), refValue: 15 },
    { label: 'Function', leftValue: Math.round((data.symptomFunction / 68) * 100), refValue: 25 },
    { label: 'Total Index', leftValue: data.symptomTotalNormalized, refValue: 20 },
  ];

  return (
    <View style={styles.container}>
      {/* 1. VAS Baseline Pain Picker */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Baseline VAS Pain Score (0 - 10)</Text>
          <Text style={styles.badgeVal}>{data.painScoreBaseline} / 10</Text>
        </View>
        <Text style={styles.cardDesc}>
          Current knee pain severity prior to initiating functional biomechanical movement tests.
        </Text>

        <View style={styles.sliderRow}>
          {[0, 2, 4, 6, 8, 10].map((score) => {
            const isSelected = Math.round(data.painScoreBaseline) === score;
            return (
              <TouchableOpacity
                key={score}
                style={[styles.scoreBtn, isSelected && styles.scoreBtnActive]}
                onPress={() => updatePainBaseline(score)}
              >
                <Text style={[styles.scoreBtnText, isSelected && styles.scoreBtnTextActive]}>
                  {score}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 2. Clinical Domain Adjusters */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Knee Symptom & Functional Impairment Subscores</Text>
        <Text style={styles.cardDesc}>
          Standardized clinical pain, joint stiffness, and daily physical limitation evaluation.
        </Text>

        <View style={styles.domainRow}>
          <View style={styles.domainInfo}>
            <Text style={styles.domainName}>Knee Pain Domain</Text>
            <Text style={styles.domainSub}>{data.symptomPain} / 20 ({Math.round((data.symptomPain / 20) * 100)}%)</Text>
          </View>
          <View style={styles.btnStepper}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => updateDomain('pain', -1)}>
              <Text style={styles.stepBtnText}>−</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stepBtn} onPress={() => updateDomain('pain', 1)}>
              <Text style={styles.stepBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.domainRow}>
          <View style={styles.domainInfo}>
            <Text style={styles.domainName}>Morning & Post-Rest Stiffness</Text>
            <Text style={styles.domainSub}>{data.symptomStiffness} / 8 ({Math.round((data.symptomStiffness / 8) * 100)}%)</Text>
          </View>
          <View style={styles.btnStepper}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => updateDomain('stiffness', -1)}>
              <Text style={styles.stepBtnText}>−</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stepBtn} onPress={() => updateDomain('stiffness', 1)}>
              <Text style={styles.stepBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.domainRow}>
          <View style={styles.domainInfo}>
            <Text style={styles.domainName}>Physical Function & Mobility Deficit</Text>
            <Text style={styles.domainSub}>{data.symptomFunction} / 68 ({Math.round((data.symptomFunction / 68) * 100)}%)</Text>
          </View>
          <View style={styles.btnStepper}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => updateDomain('function', -2)}>
              <Text style={styles.stepBtnText}>−</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stepBtn} onPress={() => updateDomain('function', 2)}>
              <Text style={styles.stepBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 3. Live Symptom Impairment Levels Graph */}
      <ComparisonBarChart
        title="Clinical Knee Health Impairment Levels"
        subtitle="Domain severity normalized (0 - 100%) vs healthy reference (< 20%)"
        groups={domainBars}
        leftLabel="Patient Score"
        leftColor="#0284C7"
        unit="%"
        height={180}
      />
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
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardDesc: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 10,
  },
  badgeVal: {
    backgroundColor: '#EFF6FF',
    color: '#1D4ED8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    fontWeight: '700',
    fontSize: 12,
  },
  sliderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  scoreBtn: {
    width: 44,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  scoreBtnActive: {
    backgroundColor: '#0D9488',
    borderColor: '#0F766E',
  },
  scoreBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  scoreBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  domainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  domainInfo: {
    flex: 1,
  },
  domainName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  domainSub: {
    fontSize: 11,
    color: '#64748B',
  },
  btnStepper: {
    flexDirection: 'row',
    gap: 8,
  },
  stepBtn: {
    width: 34,
    height: 30,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  stepBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
});
