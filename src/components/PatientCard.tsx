import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { PatientRecord, RiskTier } from '@/types/contracts';
import { useTranslation } from '@/i18n';

// ─── Types ───────────────────────────────────────────────────────────

interface PatientCardProps {
  patient: PatientRecord;
  onPress: () => void;
}

// ─── Risk tier colors ────────────────────────────────────────────────

const RISK_COLORS: Record<RiskTier | 'none', { bg: string; text: string }> = {
  Low: { bg: '#DCFCE7', text: '#16A34A' },
  Moderate: { bg: '#FEF3C7', text: '#D97706' },
  High: { bg: '#FEE2E2', text: '#DC2626' },
  none: { bg: '#F1F5F9', text: '#64748B' },
};

// ─── Component ───────────────────────────────────────────────────────

export default function PatientCard({ patient, onPress }: PatientCardProps) {
  const { t } = useTranslation();

  // Determine risk tier from pain map (mock heuristic for display)
  const maxPain = patient.pain_map.reduce(
    (max, entry) => Math.max(max, entry.pain_level),
    0
  );
  let displayTier: RiskTier | 'none' = 'none';
  if (maxPain >= 8) displayTier = 'High';
  else if (maxPain >= 5) displayTier = 'Moderate';
  else if (maxPain > 0) displayTier = 'Low';

  const tierColors = RISK_COLORS[displayTier];

  const sessionInfo =
    patient.sessions.length > 0
      ? t('dashboard_sessions_count', { count: patient.sessions.length })
      : t('dashboard_no_sessions');

  return (
    <TouchableOpacity
      style={styles.cardContainer}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.card}>
        <LinearGradient
          colors={
            displayTier === 'High'
              ? ['#EF4444', '#F87171']
              : displayTier === 'Moderate'
              ? ['#F59E0B', '#FBBF24']
              : displayTier === 'Low'
              ? ['#10B981', '#34D399']
              : ['#0D9488', '#2DD4BF']
          }
          style={styles.cardBorder}
        />
        
        {/* Avatar */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {patient.name.charAt(0).toUpperCase()}
        </Text>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {patient.name}
        </Text>
        <Text style={styles.details}>
          {patient.age} yrs • {patient.village_block}
        </Text>
        <Text style={styles.sessions}>{sessionInfo}</Text>
      </View>

      {/* Risk chip */}
      {displayTier !== 'none' && (
        <View style={[styles.riskChip, { backgroundColor: tierColors.bg }]}>
          <Text style={[styles.riskText, { color: tierColors.text }]}>
            {t(`report_risk_${displayTier.toLowerCase() as 'low' | 'moderate' | 'high'}`)}
          </Text>
        </View>
      )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  cardContainer: {
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    paddingLeft: 20,
    overflow: 'hidden',
  },
  cardBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0D948815',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0D9488',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  details: {
    fontSize: 13,
    color: '#64748B',
  },
  sessions: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  riskChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  riskText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
