import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import type { BleConnectionState } from '@/types/contracts';
import { useTranslation } from '@/i18n';

// ─── Types ───────────────────────────────────────────────────────────

interface ConnectionIndicatorProps {
  state: BleConnectionState;
}

// ─── State config ────────────────────────────────────────────────────

const STATE_CONFIG: Record<
  BleConnectionState,
  { color: string; pulseColor: string; labelKey: string }
> = {
  disconnected: {
    color: '#94A3B8',
    pulseColor: '#94A3B8',
    labelKey: 'assessment_ble_disconnected',
  },
  scanning: {
    color: '#F59E0B',
    pulseColor: '#FDE047',
    labelKey: 'assessment_ble_scanning',
  },
  connecting: {
    color: '#F59E0B',
    pulseColor: '#FDE047',
    labelKey: 'assessment_ble_connecting',
  },
  connected: {
    color: '#22C55E',
    pulseColor: '#86EFAC',
    labelKey: 'assessment_ble_connected',
  },
  error: {
    color: '#EF4444',
    pulseColor: '#FCA5A5',
    labelKey: 'assessment_ble_error',
  },
};

// ─── Component ───────────────────────────────────────────────────────

export default function ConnectionIndicator({ state }: ConnectionIndicatorProps) {
  const { t } = useTranslation();
  const config = STATE_CONFIG[state];

  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (state === 'scanning' || state === 'connecting' || state === 'connected') {
      Animated.loop(
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        })
      ).start();
    } else {
      pulseAnim.setValue(0);
      pulseAnim.stopAnimation();
    }
  }, [state, pulseAnim]);

  const scale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.5],
  });

  const opacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 0],
  });

  return (
    <View style={styles.container}>
      <View style={styles.dotContainer}>
        {/* Pulse ring for active states */}
        {(state === 'scanning' || state === 'connecting' || state === 'connected') && (
          <Animated.View
            style={[
              styles.pulse,
              { backgroundColor: config.pulseColor, transform: [{ scale }], opacity },
            ]}
          />
        )}
        <View style={[styles.dot, { backgroundColor: config.color }]} />
      </View>
      <View>
        <Text style={styles.statusLabel}>{t('assessment_ble_status')}</Text>
        <Text style={[styles.statusText, { color: config.color }]}>
          {t(config.labelKey)}
        </Text>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  dotContainer: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    opacity: 0.3,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  statusLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 2,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
