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

const RISK_COLORS: Record<RiskTier | 'none', { bg: string; text: string; border: string }> = {
  Low: { bg: '#F0FDF4', text: '#15803D', border: '#86EFAC' },
  Moderate: { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
  High: { bg: '#FEF2F2', text: '#DC2626', border: '#FCA5A5' },
  none: { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' },
};

// ─── Component ───────────────────────────────────────────────────────

export default function PatientCard({ patient, onPress }: PatientCardProps) {
  const { t } = useTranslation();

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
      activeOpacity={0.75}
    >
      <View style={styles.card}>
        <View style={[styles.cardBorder, { backgroundColor: tierColors.text }]} />

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
          <View style={[styles.riskChip, { backgroundColor: tierColors.bg, borderColor: tierColors.border }]}>
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
    marginBottom: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 14,
    paddingLeft: 18,
    position: 'relative',
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  cardBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#003366',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  details: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  sessions: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  riskChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    marginLeft: 8,
  },
  riskText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
