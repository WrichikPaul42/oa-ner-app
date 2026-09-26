import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
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
    backgroundColor: '#F8FAFC',
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
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1E293B',
  },
  sessionText: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
  },
  riskBanner: {
    alignItems: 'center',
    paddingVertical: 24,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 32,
  },
  riskLabel: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  riskValue: {
    fontSize: 36,
    fontWeight: '800',
    marginBottom: 8,
  },
  scoreText: {
    fontSize: 15,
    color: '#475569',
    fontWeight: '500',
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 16,
  },
  modelCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  modelBadge: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  modelDesc: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  insightCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  insightIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  insightText: {
    flex: 1,
    fontSize: 15,
    color: '#334155',
    lineHeight: 22,
  },
  recItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingRight: 16,
  },
  recDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0D9488',
    marginTop: 8,
    marginRight: 12,
  },
  recText: {
    flex: 1,
    fontSize: 15,
    color: '#475569',
    lineHeight: 24,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  doneBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 16,
    borderRadius: 14,
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
});
