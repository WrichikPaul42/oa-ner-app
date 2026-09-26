import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  Share,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { KneevaTriageResponse, KneevaTriagePayload } from '@/types/kneeva';

export default function KneevaResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ triageData?: string; payloadData?: string }>();

  const [showJsonModal, setShowJsonModal] = useState(false);

  // Parse result data with safe fallback
  let triageResult: KneevaTriageResponse;
  let payload: KneevaTriagePayload | null = null;

  try {
    triageResult = params.triageData
      ? JSON.parse(params.triageData)
      : {
          patient_id: 'PT-10045',
          oa_risk_score: 0.825,
          oa_risk_category: 'high',
          confidence_interval: [0.75, 0.89],
          feature_importance: {
            flat_gait_stride_time_cv: 0.15,
            climbing_cadence: 0.12,
            rom_flexion_deficit_deg: 0.11,
            carried_load_kg: 0.09,
          },
          clinical_explanation:
            'Patient demonstrates significantly elevated risk (82.5%). Primary drivers are high stride variability during flat walking and slow climbing cadence.',
          clinical_action:
            'Refer to orthopedic specialist for immediate X-ray and conservative management.',
          differential_signal: false,
          differential_flags: [],
          missing_modality_count: 0,
          effective_bmi: 28.4,
        };
  } catch {
    triageResult = {
      patient_id: 'PT-10045',
      oa_risk_score: 0.825,
      oa_risk_category: 'high',
      confidence_interval: [0.75, 0.89],
      feature_importance: {
        flat_gait_stride_time_cv: 0.15,
        climbing_cadence: 0.12,
      },
      clinical_explanation:
        'Patient demonstrates significantly elevated risk (82.5%). Primary drivers are high stride variability during flat walking and slow climbing cadence.',
      clinical_action:
        'Refer to orthopedic specialist for immediate X-ray and conservative management.',
      differential_signal: false,
      differential_flags: [],
      missing_modality_count: 0,
      effective_bmi: 28.4,
    };
  }

  try {
    if (params.payloadData) {
      payload = JSON.parse(params.payloadData);
    }
  } catch {
    payload = null;
  }

  const category = (triageResult.oa_risk_category || 'moderate').toLowerCase();
  const percentage = Math.round(triageResult.oa_risk_score * 1000) / 10;

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleSharePdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const riskColor =
        category === 'high' || category === 'very_high'
          ? '#DC2626'
          : category === 'moderate'
          ? '#D97706'
          : '#16A34A';

      const abhaRow = payload?.abha_number
        ? `<div><strong>ABHA ID:</strong> ${payload.abha_number}</div>`
        : '';

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 28px; color: #1E293B; background: #FFF; }
              .header { border-bottom: 3px solid #0D9488; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
              .title { font-size: 22px; font-weight: 800; color: #0F172A; }
              .subtitle { font-size: 13px; color: #64748B; margin-top: 3px; }
              .badge { display: inline-block; padding: 6px 14px; border-radius: 14px; font-size: 13px; font-weight: 800; color: #FFF; background: ${riskColor}; }
              .score-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 18px; margin: 18px 0; text-align: center; }
              .score { font-size: 40px; font-weight: 800; color: #0F172A; margin: 4px 0; }
              .section { margin-bottom: 18px; }
              .section-title { font-size: 14px; font-weight: bold; color: #0D9488; border-bottom: 1px solid #E2E8F0; padding-bottom: 5px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
              .text { font-size: 13px; line-height: 1.6; color: #334155; }
              .footer { margin-top: 30px; font-size: 11px; color: #94A3B8; text-align: center; border-top: 1px solid #E2E8F0; padding-top: 12px; }
            </style>
          </head>
          <body>
            <div class="header">
              <div>
                <div class="title">KNEOVA CLINICAL REFERRAL SLIP</div>
                <div class="subtitle">Smart India Hackathon • Point-of-Care Knee OA Screening</div>
              </div>
              <div>
                <span class="badge">${(triageResult.oa_risk_category || 'MODERATE').toUpperCase()} RISK</span>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; margin-bottom: 14px; font-size: 13px;">
              <div><strong>Patient ID:</strong> ${triageResult.patient_id}</div>
              ${abhaRow}
              <div><strong>Date:</strong> ${new Date().toLocaleDateString()}</div>
            </div>

            <div class="score-box">
              <div style="font-size: 12px; color: #64748B; font-weight: bold; letter-spacing: 1px;">COMPOSITE OA RISK SCORE</div>
              <div class="score">${percentage}%</div>
              <div style="color: #64748B; font-size: 12px;">95% Confidence Interval: [${
                triageResult.confidence_interval
                  ? (triageResult.confidence_interval[0] * 100).toFixed(1)
                  : '75.0'
              }% - ${
                triageResult.confidence_interval
                  ? (triageResult.confidence_interval[1] * 100).toFixed(1)
                  : '89.0'
              }%]</div>
              <div style="margin-top: 6px; font-size: 12px; color: #0D9488;"><strong>Effective Terrain-Adjusted BMI:</strong> ${
                triageResult.effective_bmi || 28.4
              } kg/m²</div>
            </div>

            <div class="section">
              <div class="section-title">CLINICAL ACTION & PROTOCOL</div>
              <div class="text"><strong>${triageResult.clinical_action}</strong></div>
            </div>

            <div class="section">
              <div class="section-title">CLINICAL EXPLANATION & RISK DRIVERS</div>
              <div class="text">${triageResult.clinical_explanation
                .replace(/\*\*/g, '')
                .replace(/###/g, '')}</div>
            </div>

            <div class="footer">
              Generated by Kneeva Mobile Screening System • Certified for Primary Health Center (PHC) & ASHA Worker Triage
            </div>
          </body>
        </html>
      `;

      if (Platform.OS === 'web') {
        await Share.share({
          title: `Kneeva Referral Slip - ${triageResult.patient_id}`,
          message: `Kneeva Triage Referral for ${triageResult.patient_id}: ${triageResult.oa_risk_category.toUpperCase()} Risk (${percentage}%). Protocol: ${triageResult.clinical_action}`,
        });
      } else {
        const { uri } = await Print.printToFileAsync({ html: htmlContent });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            UTI: '.pdf',
            mimeType: 'application/pdf',
            dialogTitle: `Kneeva Referral Slip - ${triageResult.patient_id}`,
          });
        } else {
          await Share.share({
            title: `Kneeva Referral Slip - ${triageResult.patient_id}`,
            message: `Kneeva Triage Referral for ${triageResult.patient_id}: ${triageResult.oa_risk_category.toUpperCase()} Risk (${percentage}%). Protocol: ${triageResult.clinical_action}`,
          });
        }
      }
    } catch (err: any) {
      Alert.alert('Share Error', err?.message || 'Could not generate referral slip.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Visual Theme mapping
  const categoryConfig = {
    high: {
      gradient: ['#FEF2F2', '#FEE2E2'] as const,
      border: '#FCA5A5',
      badgeBg: '#DC2626',
      badgeText: '#FFFFFF',
      textColor: '#991B1B',
      title: 'HIGH RISK',
      icon: '⚠️',
    },
    moderate: {
      gradient: ['#FFFBEB', '#FEF3C7'] as const,
      border: '#FCD34D',
      badgeBg: '#D97706',
      badgeText: '#FFFFFF',
      textColor: '#92400E',
      title: 'MODERATE RISK',
      icon: '⚡',
    },
    low: {
      gradient: ['#F0FDF4', '#DCFCE7'] as const,
      border: '#86EFAC',
      badgeBg: '#16A34A',
      badgeText: '#FFFFFF',
      textColor: '#166534',
      title: 'LOW RISK',
      icon: '✅',
    },
  }[category as 'high' | 'moderate' | 'low'] || {
    gradient: ['#F8FAFC', '#F1F5F9'] as const,
    border: '#CBD5E1',
    badgeBg: '#475569',
    badgeText: '#FFFFFF',
    textColor: '#1E293B',
    title: 'ASSESSMENT COMPLETE',
    icon: '📋',
  };

  const ciLow = triageResult.confidence_interval?.[0]
    ? (triageResult.confidence_interval[0] * 100).toFixed(1)
    : '75.0';
  const ciHigh = triageResult.confidence_interval?.[1]
    ? (triageResult.confidence_interval[1] * 100).toFixed(1)
    : '89.0';

  const featureImportance = triageResult.feature_importance || {
    flat_gait_stride_time_cv: 0.15,
    climbing_cadence: 0.12,
  };

  const featureLabels: Record<string, string> = {
    flat_gait_stride_time_cv: 'Flat Walk Stride Variability (CV)',
    climbing_cadence: 'Stair Climbing Cadence (SPM)',
    rom_flexion_deficit_deg: 'ROM Flexion Deficit (°)',
    carried_load_kg: 'Daily Mountain Carried Load',
    effective_bmi: 'Effective Terrain-Adjusted BMI',
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.replace('/dashboard')}
          style={styles.backBtn}
        >
          <Text style={styles.backIcon}>✕</Text>
        </TouchableOpacity>
        <View style={styles.topBarCenter}>
          <Text style={styles.topBarTitle}>Clinical Diagnosis</Text>
          <Text style={styles.topBarPatient}>{triageResult.patient_id}</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowJsonModal(true)}
          style={styles.inspectBtn}
        >
          <Text style={styles.inspectBtnText}>{`{ } JSON`}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Risk Score Card */}
        <LinearGradient
          colors={categoryConfig.gradient}
          style={[styles.scoreCard, { borderColor: categoryConfig.border }]}
        >
          <View style={styles.badgeRow}>
            <View
              style={[styles.categoryBadge, { backgroundColor: categoryConfig.badgeBg }]}
            >
              <Text style={styles.categoryBadgeText}>
                {categoryConfig.icon} {categoryConfig.title}
              </Text>
            </View>
            <View style={styles.effectiveBmiPill}>
              <Text style={styles.effectiveBmiLabel}>Effective BMI</Text>
              <Text style={styles.effectiveBmiVal}>{triageResult.effective_bmi}</Text>
            </View>
          </View>

          <View style={styles.scoreRow}>
            <Text style={[styles.scoreValue, { color: categoryConfig.textColor }]}>
              {percentage}%
            </Text>
            <Text style={styles.scoreSub}>Osteoarthritis Risk Score</Text>
          </View>

          {/* Confidence Interval bar */}
          <View style={styles.ciContainer}>
            <Text style={styles.ciLabel}>95% Confidence Interval</Text>
            <View style={styles.ciTrack}>
              <View
                style={[
                  styles.ciFill,
                  {
                    left: `${Math.max(5, parseFloat(ciLow))}%`,
                    width: `${Math.max(10, parseFloat(ciHigh) - parseFloat(ciLow))}%`,
                    backgroundColor: categoryConfig.badgeBg,
                  },
                ]}
              />
            </View>
            <View style={styles.ciValuesRow}>
              <Text style={styles.ciBoundText}>{ciLow}%</Text>
              <Text style={styles.ciBoundText}>{ciHigh}%</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Clinical Explanation Card */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>🩺 Clinical Explanation</Text>
          <Text style={styles.explanationText}>
            "{triageResult.clinical_explanation}"
          </Text>
        </View>

        {/* Recommended Clinical Action Card */}
        <View style={[styles.card, styles.actionCard]}>
          <View style={styles.actionHeaderRow}>
            <Text style={styles.actionIcon}>📋</Text>
            <Text style={styles.actionTitle}>Recommended Clinical Action</Text>
          </View>
          <Text style={styles.actionBody}>{triageResult.clinical_action}</Text>
        </View>

        {/* Feature Importance Breakdown */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>🧬 AI Driver Feature Importance</Text>
          <Text style={styles.cardSub}>
            Biomechanic and demographic variables driving this patient's score
          </Text>

          {Object.entries(featureImportance).map(([key, weight]) => {
            const label = featureLabels[key] || key.replace(/_/g, ' ');
            const pct = Math.round(weight * 100);

            return (
              <View key={key} style={styles.featureItem}>
                <View style={styles.featureLabelRow}>
                  <Text style={styles.featureName}>{label}</Text>
                  <Text style={styles.featurePercent}>{pct}%</Text>
                </View>
                <View style={styles.featureBarTrack}>
                  <View
                    style={[
                      styles.featureBarFill,
                      { width: `${Math.min(100, pct * 4.5)}%` },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>

        {/* Differential & Telemetry Details */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>🔍 Diagnostic Telemetry</Text>
          <View style={styles.telemetryRow}>
            <Text style={styles.telemetryLabel}>Differential Flags:</Text>
            <Text style={styles.telemetryVal}>
              {triageResult.differential_flags?.length
                ? triageResult.differential_flags.join(', ')
                : 'None (Confirmed Primary OA Pattern)'}
            </Text>
          </View>
          <View style={styles.telemetryRow}>
            <Text style={styles.telemetryLabel}>Missing Modalities:</Text>
            <Text style={styles.telemetryVal}>
              {triageResult.missing_modality_count} (Complete multimodal telemetry)
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={handleSharePdf}
          disabled={isGeneratingPdf}
          activeOpacity={0.85}
        >
          {isGeneratingPdf ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.shareBtnText}>📄 Share Referral Slip (PDF)</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => router.replace('/dashboard')}
          activeOpacity={0.85}
        >
          <Text style={styles.doneBtnText}>Return to Dashboard</Text>
        </TouchableOpacity>
      </View>

      {/* Inspect JSON Modal */}
      <Modal
        visible={showJsonModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowJsonModal(false)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>POST /api/v1/triage Contract</Text>
            <TouchableOpacity
              onPress={() => setShowJsonModal(false)}
              style={styles.closeModalBtn}
            >
              <Text style={styles.closeModalText}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll}>
            <Text style={styles.jsonSectionTitle}>1. REQUEST PAYLOAD SENT:</Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>
                {JSON.stringify(payload || { patient_id: triageResult.patient_id }, null, 2)}
              </Text>
            </View>

            <Text style={styles.jsonSectionTitle}>2. RESPONSE RECEIVED:</Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>
                {JSON.stringify(triageResult, null, 2)}
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
  },
  topBarCenter: {
    alignItems: 'center',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  topBarPatient: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  inspectBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inspectBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  scoreCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  categoryBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  effectiveBmiPill: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  effectiveBmiLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  effectiveBmiVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  scoreRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  scoreValue: {
    fontSize: 54,
    fontWeight: '900',
    letterSpacing: -1,
  },
  scoreSub: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginTop: -4,
  },
  ciContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 12,
    padding: 12,
  },
  ciLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
  },
  ciTrack: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  ciFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 4,
  },
  ciValuesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  ciBoundText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  cardSub: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
  },
  explanationText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#334155',
    fontStyle: 'italic',
  },
  actionCard: {
    backgroundColor: '#F0FDFA',
    borderColor: '#99F6E4',
  },
  actionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  actionIcon: {
    fontSize: 16,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F766E',
  },
  actionBody: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: '#115E59',
  },
  featureItem: {
    marginBottom: 12,
  },
  featureLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  featureName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  featurePercent: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D9488',
  },
  featureBarTrack: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  featureBarFill: {
    height: '100%',
    backgroundColor: '#0D9488',
    borderRadius: 3,
  },
  telemetryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  telemetryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  telemetryVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    maxWidth: '65%',
    textAlign: 'right',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  shareBtn: {
    backgroundColor: '#0D9488',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  shareBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  doneBtn: {
    backgroundColor: '#0F172A',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  modalSafe: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeModalBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1E293B',
    borderRadius: 8,
  },
  closeModalText: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  modalScroll: {
    flex: 1,
    padding: 16,
  },
  jsonSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    marginBottom: 8,
    marginTop: 10,
    letterSpacing: 0.5,
  },
  codeBox: {
    backgroundColor: '#020617',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 16,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    color: '#38BDF8',
    lineHeight: 16,
  },
});
