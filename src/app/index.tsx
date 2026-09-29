import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, ScrollView, KeyboardAvoidingView, Platform, TextInput, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import PinPad from '@/components/PinPad';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { useTranslation } from '@/i18n';
import { SUPPORTED_LANGUAGES } from '@/i18n';
// Removed extra TextInput import
// ─── Screen 1 — Login/Auth ──────────────────────────────────────────

export default function LoginScreen() {
  const router = useRouter();
  const { isAuthenticated, login } = useAuth();
  const { backendIp, setBackendIp } = useSettings();
  const { t, currentLanguage } = useTranslation();

  const floatAnim = useRef(new Animated.Value(0)).current;

  // Floating logo animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [floatAnim]);

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, router]);

  const handlePinSubmit = (pin: string) => {
    const result = login(pin);
    if (result.success) {
      router.replace('/dashboard');
    }
    return result;
  };

  // Get current language display name
  const currentLangLabel =
    SUPPORTED_LANGUAGES.find((l) => l.code === currentLanguage)?.label ?? 'English';

  const translateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -15],
  });

  return (
    <LinearGradient colors={['#CCFBF1', '#FFFFFF']} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView 
          style={styles.flex} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Language indicator */}
        <View style={styles.languageIndicator}>
          <Text style={styles.languageIcon}>🌐</Text>
          <Text style={styles.languageText}>{currentLangLabel}</Text>
        </View>

        {/* Logo / App Name */}
        <View style={styles.logoSection}>
          <Animated.View style={[styles.logoCircle, { transform: [{ translateY }] }]}>
            <Image
              source={require('../../assets/images/kneeva-logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </Animated.View>
          <Text style={styles.appName}>{t('app_name')}</Text>
          <Text style={styles.loginTitle}>{t('login_title')}</Text>
          <View style={styles.versionBadge}>
            <Text style={styles.versionText}>v3.0 • XIAO ESP32-S3 Sense</Text>
          </View>
        </View>

        {/* PIN Pad */}
        <PinPad onSubmit={handlePinSubmit} />

        {/* Server IP Configuration (Bottom) */}
        <View style={styles.ipContainer}>
          <Text style={styles.ipLabel}>⚙️ Server IP</Text>
          <TextInput
            style={styles.ipInput}
            value={backendIp}
            onChangeText={setBackendIp}
            placeholder="10.104.28.241"
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
    alignItems: 'center',
  },
  languageIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
  },
  languageIcon: {
    fontSize: 16,
  },
  languageText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  logoSection: {
    alignItems: 'center',
    marginTop: 36,
    marginBottom: 28,
  },
  logoCircle: {
    width: 104,
    height: 104,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: '#CCFBF1',
    overflow: 'hidden',
  },
  logoImage: {
    width: 92,
    height: 92,
    borderRadius: 22,
  },
  appName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  loginTitle: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
  },
  versionBadge: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  versionText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0D9488',
    letterSpacing: 0.3,
  },
  ipContainer: {
    marginTop: 40, // Added margin top to push it down if there's space
    alignItems: 'center',
    width: '100%',
  },
  ipLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 8,
  },
  ipInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#1E293B',
    minWidth: 180,
    textAlign: 'center',
    fontWeight: '500',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
});
