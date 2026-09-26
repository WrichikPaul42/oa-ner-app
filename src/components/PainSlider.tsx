import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from '@/i18n';

// ─── Types ───────────────────────────────────────────────────────────

interface PainSliderProps {
  regionId: string;
  initialLevel: number;
  onConfirm: (level: number) => void;
  onCancel: () => void;
  onRemove?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────

export default function PainSlider({
  regionId,
  initialLevel,
  onConfirm,
  onCancel,
  onRemove,
}: PainSliderProps) {
  const { t } = useTranslation();
  const [level, setLevel] = useState(initialLevel || 5);

  const regionLabel = t(`body_region_${regionId}`);

  function getLevelColor(val: number): string {
    if (val <= 3) return '#22C55E';
    if (val <= 5) return '#EAB308';
    if (val <= 7) return '#F97316';
    return '#EF4444';
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.regionName}>{regionLabel}</Text>
        <Text style={styles.levelLabel}>{t('patient_pain_level')}</Text>
      </View>

      {/* Level selector — tappable number bar */}
      <View style={styles.levelBar}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((val) => (
          <TouchableOpacity
            key={val}
            style={[
              styles.levelButton,
              val <= level && {
                backgroundColor: getLevelColor(level),
              },
              val === level && styles.levelButtonActive,
            ]}
            onPress={() => setLevel(val)}
          >
            <Text
              style={[
                styles.levelButtonText,
                val <= level && styles.levelButtonTextActive,
              ]}
            >
              {val}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Intensity label */}
      <Text style={[styles.intensityLabel, { color: getLevelColor(level) }]}>
        {level <= 3 ? 'Mild' : level <= 5 ? 'Moderate' : level <= 7 ? 'Severe' : 'Very Severe'}
      </Text>

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelText}>{t('patient_pain_cancel')}</Text>
        </TouchableOpacity>

        {onRemove && initialLevel > 0 && (
          <TouchableOpacity style={styles.removeBtn} onPress={onRemove}>
            <Text style={styles.removeText}>{t('patient_pain_remove')}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.confirmBtn, { backgroundColor: getLevelColor(level) }]}
          onPress={() => onConfirm(level)}
        >
          <Text style={styles.confirmText}>{t('patient_pain_confirm')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  regionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  levelLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  levelBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
    marginBottom: 10,
  },
  levelButton: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelButtonActive: {
    transform: [{ scale: 1.1 }],
  },
  levelButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  levelButtonTextActive: {
    color: '#FFFFFF',
  },
  intensityLabel: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  removeBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
  },
  removeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
