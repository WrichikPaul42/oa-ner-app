import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useTranslation } from '@/i18n';

// ─── Types ───────────────────────────────────────────────────────────

interface PinPadProps {
  onSubmit: (pin: string) => { success: boolean; attemptsRemaining: number; lockoutSeconds: number };
}

// ─── Constants ───────────────────────────────────────────────────────

const PIN_LENGTH = 4;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

// ─── Component ───────────────────────────────────────────────────────

export default function PinPad({ onSubmit }: PinPadProps) {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const lockoutTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up lockout timer on unmount
  useEffect(() => {
    return () => {
      if (lockoutTimer.current) clearInterval(lockoutTimer.current);
    };
  }, []);

  // Lockout countdown
  useEffect(() => {
    if (lockoutSeconds > 0) {
      lockoutTimer.current = setInterval(() => {
        setLockoutSeconds((prev) => {
          if (prev <= 1) {
            if (lockoutTimer.current) clearInterval(lockoutTimer.current);
            setError('');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => {
        if (lockoutTimer.current) clearInterval(lockoutTimer.current);
      };
    }
  }, [lockoutSeconds]);

  // Shake animation on error
  const triggerShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (pin.length === PIN_LENGTH) {
      const result = onSubmit(pin);
      if (!result.success) {
        triggerShake();
        setPin('');
        if (result.lockoutSeconds > 0) {
          setError(t('login_lockout', { seconds: result.lockoutSeconds }));
          setLockoutSeconds(result.lockoutSeconds);
        } else {
          setError(t('login_error'));
        }
      }
    }
  }, [pin, onSubmit, triggerShake, t]);

  const handleKeyPress = useCallback(
    (key: string) => {
      if (lockoutSeconds > 0) return;

      if (key === 'del') {
        setPin((prev) => prev.slice(0, -1));
        setError('');
      } else if (key !== '' && pin.length < PIN_LENGTH) {
        setPin((prev) => prev + key);
      }
    },
    [pin, lockoutSeconds]
  );

  const isLocked = lockoutSeconds > 0;

  return (
    <View style={styles.container}>
      {/* PIN dots */}
      <Animated.View
        style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}
      >
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < pin.length ? styles.dotFilled : styles.dotEmpty,
            ]}
          />
        ))}
      </Animated.View>

      {/* Error message */}
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <Text style={styles.subtitleText}>{t('login_subtitle')}</Text>
      )}

      {/* Keypad */}
      <BlurView intensity={50} tint="light" style={styles.glassContainer}>
        <View style={styles.keypad}>
          {KEYS.map((key, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.key,
                key === '' && styles.keyInvisible,
                isLocked && key !== '' && styles.keyDisabled,
              ]}
              onPress={() => handleKeyPress(key)}
              disabled={key === '' || isLocked}
              activeOpacity={0.6}
            >
              {key === 'del' ? (
                <Text style={[styles.keyText, styles.delText]}>⌫</Text>
              ) : (
                <Text style={[styles.keyText, isLocked && styles.keyTextDisabled]}>
                  {key}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </BlurView>

      {/* Forgot PIN link */}
      <TouchableOpacity style={styles.forgotLink} onPress={() => {}}>
        <Text style={styles.forgotText}>{t('login_forgot_pin')}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const { width } = Dimensions.get('window');
const keySize = Math.min(width * 0.2, 80);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 18,
    marginBottom: 16,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  dotEmpty: {
    borderColor: '#94A3B8',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    borderColor: '#0D9488',
    backgroundColor: '#0D9488',
  },
  subtitleText: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 28,
    height: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    marginBottom: 28,
    height: 20,
    fontWeight: '600',
  },
  glassContainer: {
    borderRadius: 32,
    padding: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: keySize * 3 + 48,
    gap: 16,
  },
  key: {
    width: keySize,
    height: keySize,
    borderRadius: keySize / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyInvisible: {
    backgroundColor: 'transparent',
  },
  keyDisabled: {
    opacity: 0.3,
  },
  keyText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#1E293B',
  },
  keyTextDisabled: {
    color: '#94A3B8',
  },
  delText: {
    fontSize: 24,
  },
  forgotLink: {
    marginTop: 24,
    padding: 8,
  },
  forgotText: {
    fontSize: 14,
    color: '#0D9488',
    textDecorationLine: 'underline',
  },
});
