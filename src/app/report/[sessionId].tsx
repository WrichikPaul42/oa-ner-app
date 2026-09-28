import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { useTranslation } from '@/i18n';
import { getRiskAssessment } from '@/services/riskService';
import type { RiskResult, RiskTier } from '@/types/contracts';

// ─── Constants ───────────────────────────────────────────────────────

const TIER_COLORS: Record<RiskTier, { bg: string; border: string; text: string }> = {
  Low: { bg: '#F0FDF4', border: '#86EFAC', text: '#16A34A' },
  Moderate: { bg: '#FEFCE8', border: '#FDE047', text: '#CA8A04' },
  High: { bg: '#FEF2F2', border: '#FCA5A5', text: '#DC2626' },
};

// ─── Screen 5 — Report & Insights ────────────────────────────────────

export default function ReportScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { t } = useTranslation();

  const [riskResult, setRiskResult] = React.useState<RiskResult | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const loadRisk = async () => {
      try {
        if (sessionId) {
          const result = await getRiskAssessment(sessionId);
          setRiskResult(result);
        }
      } catch (e) {
        console.log('Report: failed to load risk result:', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadRisk();
  }, [sessionId]);

  const handleDone = () => {
    // Navigate all the way back to the dashboard, clearing the assessment stack
    router.dismissAll();
    router.replace('/dashboard');
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0D9488" />
          <Text style={styles.loadingText}>Analyzing AI Models...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!riskResult) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{t('report_generation_error')}</Text>
          <TouchableOpacity style={styles.doneBtn} onPress={handleDone}>
            <Text style={styles.doneBtnText}>{t('report_action_done')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const tierStyle = TIER_COLORS[riskResult.risk_tier];
  const translatedTier = t(`report_risk_${riskResult.risk_tier.toLowerCase() as 'low' | 'moderate' | 'high'}`);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('report_title')}</Text>
          <Text style={styles.sessionText}>
            {t('report_session_id')}: {sessionId}
          </Text>
        </View>

        {/* Risk Banner */}
        <View
          style={[
            styles.riskBanner,
            { backgroundColor: tierStyle.bg, borderColor: tierStyle.border },
          ]}
        >
          <Text style={[styles.riskLabel, { color: tierStyle.text }]}>
            {t('report_overall_risk')}
          </Text>
          <Text style={[styles.riskValue, { color: tierStyle.text }]}>
            {translatedTier}
          </Text>
          <Text style={styles.scoreText}>
            Max Flexion: {riskResult.max_knee_flexion_deg}° | Ext. Lag: {riskResult.extension_lag_deg}°
          </Text>
        </View>

        {/* Model Contributions (Dummy Data) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Model Contributions</Text>
          <Text style={styles.sectionSubtitle}>How AI models derived the final score</Text>
          
          <View style={styles.modelCard}>
            <View style={styles.modelHeader}>
              <Text style={styles.modelIcon}>📐</Text>
              <Text style={styles.modelName}>Kinematic Model</Text>
              <Text style={[styles.modelBadge, { backgroundColor: '#FEE2E2', color: '#DC2626' }]}>+25% Risk</Text>
            </View>
            <Text style={styles.modelDesc}>High flexion lag detected during the range of motion test. Contributes 40% to overall analysis weight.</Text>
          </View>

          <View style={styles.modelCard}>
            <View style={styles.modelHeader}>
              <Text style={styles.modelIcon}>🔊</Text>
              <Text style={styles.modelName}>Acoustic Model</Text>
              <Text style={[styles.modelBadge, { backgroundColor: '#FEF3C7', color: '#D97706' }]}>+30% Risk</Text>
            </View>
            <Text style={styles.modelDesc}>Abnormal crepitus (vibration) signature detected correlating with angular velocity spikes. Contributes 35% to overall analysis weight.</Text>
          </View>

          <View style={styles.modelCard}>
            <View style={styles.modelHeader}>
              <Text style={styles.modelIcon}>📋</Text>
              <Text style={styles.modelName}>Clinical Profile Model</Text>
              <Text style={[styles.modelBadge, { backgroundColor: '#FEFCE8', color: '#CA8A04' }]}>+15% Risk</Text>
            </View>
            <Text style={styles.modelDesc}>Matches demographic and pain-map pattern for early OA progression. Contributes 25% to overall analysis weight.</Text>
          </View>
        </View>

        {/* Insights / Contributing Factors */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('report_insights_title')}</Text>
          {riskResult.contributing_factors.map((insight: string, index: number) => (
            <View key={index} style={styles.insightCard}>
              <Text style={styles.insightIcon}>💡</Text>
              <Text style={styles.insightText}>{insight}</Text>
            </View>
          ))}
        </View>

        {/* Recommendations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('report_recommendations_title')}</Text>
          <View style={styles.recItem}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>{t(riskResult.advice_key)}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.doneBtn}
          onPress={handleDone}
          activeOpacity={0.8}
        >
          <Text style={styles.doneBtnText}>{t('report_action_done')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F4F0',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#003366',
    paddingVertical: 14,
    borderRadius: 6,
    borderBottomWidth: 3,
    borderBottomColor: '#FF9933',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  sessionText: {
    fontSize: 12,
    color: '#FF9933',
    marginTop: 4,
    fontWeight: '700',
  },
  riskBanner: {
    alignItems: 'center',
    paddingVertical: 20,
    borderRadius: 6,
    borderWidth: 2,
    marginBottom: 24,
  },
  riskLabel: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  riskValue: {
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 8,
  },
  scoreText: {
    fontSize: 14,
    color: '#003366',
    fontWeight: '700',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#003366',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 14,
    fontWeight: '500',
  },
  modelCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#B0BEC5',
  },
  modelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  modelIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  modelName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: '#003366',
  },
  modelBadge: {
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  modelDesc: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    fontWeight: '500',
  },
  insightCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#B0BEC5',
  },
  insightIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    lineHeight: 20,
    fontWeight: '600',
  },
  recItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingRight: 16,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF9933',
    marginTop: 6,
    marginRight: 12,
  },
  recText: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    lineHeight: 22,
    fontWeight: '600',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 2,
    borderTopColor: '#003366',
  },
  doneBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#003366',
    paddingVertical: 15,
    borderRadius: 6,
  },
  doneBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 24,
    backgroundColor: '#F4F4F0',
  },
  errorText: {
    fontSize: 16,
    color: '#DC2626',
    textAlign: 'center',
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F4F4F0',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#003366',
    fontWeight: '700',
  },
});
