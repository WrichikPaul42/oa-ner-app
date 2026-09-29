/**
 * Step 3: Strength Test (Force Proxy, 3 Trials)
 * - Direct force input (Left peak force & Right peak force in Newtons)
 * - Real-time calculation of Bilateral Asymmetry %
 * - Force vs. time per trial with marked peak
 * - RF & BF EMG envelope overlaid on force curve (muscle drive)
 * - Bar chart of peak force across trials 1-3 (fatigue curve)
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Step3StrengthData, StrengthTrial } from '@/types/assessment15';
import { MedicalTimeSeriesChart, ComparisonBarChart } from './ClinicalVisualizations';

interface Step3Props {
  data: Step3StrengthData;
  onChange: (updated: Step3StrengthData) => void;
}

export function Step3StrengthView({ data, onChange }: Step3Props) {
  const [selectedTrial, setSelectedTrial] = useState<1 | 2 | 3>(1);
  const [activeLeg, setActiveLeg] = useState<'left' | 'right'>('left');

  // Local text input states to allow smooth typing
  const [leftInput, setLeftInput] = useState(data.peakForceLeftN.toString());
  const [rightInput, setRightInput] = useState(data.peakForceRightN.toString());

  // Helper to regenerate scaled trials for a given peak force
  const generateScaledTrials = (peak: number): StrengthTrial[] => {
    // Normal shape curve (normalized 0.0 - 1.0)
    const baseCurve = [0.12, 0.35, 0.68, 0.93, 1.0, 0.98, 0.86, 0.51, 0.16];
    const rfBase = [0.15, 0.36, 0.72, 0.94, 1.0, 0.96, 0.80, 0.44, 0.17];
    const bfBase = [0.21, 0.34, 0.57, 0.89, 1.0, 0.97, 0.78, 0.47, 0.26];

    return [1, 2, 3].map((trialNum) => {
      // Trial 1 is 100%, Trial 2 drops ~5%, Trial 3 drops ~11% (fatigue)
      const fatigueFactor = trialNum === 1 ? 1.0 : trialNum === 2 ? 0.95 : 0.89;
      const trialPeak = Math.round(peak * fatigueFactor);
      const rfPeak = Math.round(trialPeak * 1.65);
      const bfPeak = Math.round(trialPeak * 0.58);

      return {
        trialNumber: trialNum,
        peakForceN: trialPeak,
        rfEmgPeakMv: rfPeak,
        bfEmgPeakMv: bfPeak,
        timeToPeakSeconds: 1.6 + (trialNum - 1) * 0.2,
        forceTimeSeries: baseCurve.map((v) => Math.round(v * trialPeak)),
        rfEmgSeries: rfBase.map((v) => Math.round(v * rfPeak)),
        bfEmgSeries: bfBase.map((v) => Math.round(v * bfPeak)),
      };
    });
  };

  // Update force values and push back to state
  const handleUpdateForces = (newLeft: number, newRight: number) => {
    const validLeft = Math.max(50, Math.min(800, newLeft));
    const validRight = Math.max(50, Math.min(800, newRight));

    const maxVal = Math.max(validLeft, validRight);
    const asym = Math.round((Math.abs(validRight - validLeft) / maxVal) * 1000) / 10;

    const updatedLeftTrials = generateScaledTrials(validLeft);
    const updatedRightTrials = generateScaledTrials(validRight);

    setLeftInput(validLeft.toString());
    setRightInput(validRight.toString());

    onChange({
      ...data,
      peakForceLeftN: validLeft,
      peakForceRightN: validRight,
      asymmetryPct: asym,
      leftTrials: updatedLeftTrials,
      rightTrials: updatedRightTrials,
    });
  };

  const adjustForce = (leg: 'left' | 'right', delta: number) => {
    if (leg === 'left') {
      handleUpdateForces(data.peakForceLeftN + delta, data.peakForceRightN);
    } else {
      handleUpdateForces(data.peakForceLeftN, data.peakForceRightN + delta);
    }
  };

  const trials = activeLeg === 'left' ? data.leftTrials : data.rightTrials;
  const currentTrial = trials.find((t) => t.trialNumber === selectedTrial) || trials[0];

  const peakVal = Math.max(...currentTrial.forceTimeSeries);
  const peakIdx = currentTrial.forceTimeSeries.indexOf(peakVal);

  const trialsComparison = [
    {
      label: 'Trial 1',
      leftValue: data.leftTrials[0]?.peakForceN || data.peakForceLeftN,
      rightValue: data.rightTrials[0]?.peakForceN || data.peakForceRightN,
    },
    {
      label: 'Trial 2',
      leftValue: data.leftTrials[1]?.peakForceN || Math.round(data.peakForceLeftN * 0.95),
      rightValue: data.rightTrials[1]?.peakForceN || Math.round(data.peakForceRightN * 0.95),
    },
    {
      label: 'Trial 3',
      leftValue: data.leftTrials[2]?.peakForceN || Math.round(data.peakForceLeftN * 0.89),
      rightValue: data.rightTrials[2]?.peakForceN || Math.round(data.peakForceRightN * 0.89),
    },
  ];

  return (
    <View style={styles.container}>
      {/* 1. Asymmetry & Summary Banner */}
      <View style={styles.summaryCard}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>LEFT PEAK FORCE</Text>
          <Text style={[styles.statValue, { color: '#0284C7' }]}>{data.peakForceLeftN} N</Text>
          <Text style={styles.statSub}>Symptomatic</Text>
        </View>

        <View style={styles.asymBadge}>
          <Text style={styles.asymLabel}>ASYMMETRY</Text>
          <Text style={styles.asymValue}>{data.asymmetryPct.toFixed(1)}%</Text>
          <Text style={styles.asymWarning}>
            {data.asymmetryPct > 15 ? 'Significant Deficit' : 'Symmetric'}
          </Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statLabel}>RIGHT PEAK FORCE</Text>
          <Text style={[styles.statValue, { color: '#0D9488' }]}>{data.peakForceRightN} N</Text>
          <Text style={styles.statSub}>Contralateral</Text>
        </View>
      </View>

      {/* 2. Interactive Force Input Panel */}
      <View style={styles.inputPanelCard}>
        <Text style={styles.inputPanelTitle}>Isometric Force Input (Dynamometer / Load Cell)</Text>
        <Text style={styles.inputPanelSub}>
          Input peak extension push force measured or adjust using steppers:
        </Text>

        <View style={styles.inputRowsContainer}>
          {/* Left Knee Force Input */}
          <View style={styles.legInputBox}>
            <View style={styles.legInputHeader}>
              <Text style={[styles.legName, { color: '#0284C7' }]}>Left Knee Peak</Text>
              <Text style={styles.unitTag}>Newtons (N)</Text>
            </View>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.forceTextInput}
                keyboardType="numeric"
                value={leftInput}
                onChangeText={(txt) => {
                  setLeftInput(txt);
                  const num = parseInt(txt, 10);
                  if (!isNaN(num) && num > 0) {
                    handleUpdateForces(num, data.peakForceRightN);
                  }
                }}
              />
              <View style={styles.stepperBtns}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => adjustForce('left', -10)}>
                  <Text style={styles.stepBtnText}>-10</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.stepBtn} onPress={() => adjustForce('left', 10)}>
                  <Text style={styles.stepBtnText}>+10</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Right Knee Force Input */}
          <View style={styles.legInputBox}>
            <View style={styles.legInputHeader}>
              <Text style={[styles.legName, { color: '#0D9488' }]}>Right Knee Peak</Text>
              <Text style={styles.unitTag}>Newtons (N)</Text>
            </View>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.forceTextInput}
                keyboardType="numeric"
                value={rightInput}
                onChangeText={(txt) => {
                  setRightInput(txt);
                  const num = parseInt(txt, 10);
                  if (!isNaN(num) && num > 0) {
                    handleUpdateForces(data.peakForceLeftN, num);
                  }
                }}
              />
              <View style={styles.stepperBtns}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => adjustForce('right', -10)}>
                  <Text style={styles.stepBtnText}>-10</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.stepBtn} onPress={() => adjustForce('right', 10)}>
                  <Text style={styles.stepBtnText}>+10</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Presets */}
        <View style={styles.presetsRow}>
          <Text style={styles.presetsLabel}>Quick Presets:</Text>
          <TouchableOpacity
            style={styles.presetChip}
            onPress={() => handleUpdateForces(310, 375)}
          >
            <Text style={styles.presetChipText}>Mild (310/375N)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.presetChip}
            onPress={() => handleUpdateForces(220, 390)}
          >
            <Text style={styles.presetChipText}>Severe (220/390N)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.presetChip}
            onPress={() => handleUpdateForces(370, 380)}
          >
            <Text style={styles.presetChipText}>Symmetric (370/380N)</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Trial & Leg Selectors */}
      <View style={styles.filterRow}>
        <View style={styles.pillGroup}>
          <TouchableOpacity
            style={[styles.filterPill, activeLeg === 'left' && styles.filterPillActive]}
            onPress={() => setActiveLeg('left')}
          >
            <Text style={[styles.filterPillText, activeLeg === 'left' && styles.filterPillTextActive]}>
              Left Knee
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterPill, activeLeg === 'right' && styles.filterPillActive]}
            onPress={() => setActiveLeg('right')}
          >
            <Text style={[styles.filterPillText, activeLeg === 'right' && styles.filterPillTextActive]}>
              Right Knee
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.pillGroup}>
          {[1, 2, 3].map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.trialPill, selectedTrial === t && styles.trialPillActive]}
              onPress={() => setSelectedTrial(t as any)}
            >
              <Text style={[styles.trialPillText, selectedTrial === t && styles.trialPillTextActive]}>
                Trial {t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 3. Force Curve overlaid with RF & BF EMG Envelope */}
      <MedicalTimeSeriesChart
        title={`${activeLeg.toUpperCase()} KNEE — TRIAL ${selectedTrial}: Force & EMG Drive`}
        subtitle="Isometric force curve (N) with peak marker overlaid with RF & BF EMG drive (mV)"
        series={[
          {
            id: 'force',
            name: `Force (Peak: ${currentTrial.peakForceN}N)`,
            color: '#0F172A',
            data: currentTrial.forceTimeSeries,
            unit: 'N',
          },
          {
            id: 'rf_emg',
            name: `RF Drive (${currentTrial.rfEmgPeakMv}mV)`,
            color: '#0284C7',
            data: currentTrial.rfEmgSeries,
            dashed: true,
            unit: 'mV',
          },
          {
            id: 'bf_emg',
            name: `BF Antagonist (${currentTrial.bfEmgPeakMv}mV)`,
            color: '#EA580C',
            data: currentTrial.bfEmgSeries,
            dashed: true,
            unit: 'mV',
          },
        ]}
        highlightPeakIndex={peakIdx}
        height={190}
        xAxisLabels={['0.0s', '0.8s', '1.6s', '2.4s', '3.2s']}
      />

      {/* 4. Bar Chart: Left vs Right across Trials 1-3 */}
      <ComparisonBarChart
        title="Peak Isometric Force Across Trials (Fatigue Curve)"
        subtitle="Left (symptomatic) vs Right (control) showing motor unit exhaustion"
        groups={trialsComparison}
        leftLabel="Left Peak"
        rightLabel="Right Peak"
        leftColor="#0284C7"
        rightColor="#0D9488"
        unit="N"
        height={175}
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
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  statSub: {
    fontSize: 10,
    color: '#94A3B8',
  },
  asymBadge: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  asymLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#991B1B',
  },
  asymValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#DC2626',
  },
  asymWarning: {
    fontSize: 9,
    color: '#B91C1C',
    fontWeight: '600',
  },
  inputPanelCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 10,
  },
  inputPanelTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  inputPanelSub: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 10,
  },
  inputRowsContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  legInputBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 8,
  },
  legInputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  legName: {
    fontSize: 11,
    fontWeight: '700',
  },
  unitTag: {
    fontSize: 9,
    color: '#94A3B8',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  forceTextInput: {
    flex: 1,
    height: 36,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#94A3B8',
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  stepperBtns: {
    flexDirection: 'row',
    gap: 4,
  },
  stepBtn: {
    backgroundColor: '#E2E8F0',
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  stepBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
  presetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  presetsLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  presetChip: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  presetChipText: {
    fontSize: 10,
    color: '#334155',
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pillGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  filterPill: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  filterPillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  trialPill: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  trialPillActive: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488',
  },
  trialPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  trialPillTextActive: {
    color: '#FFFFFF',
  },
});
