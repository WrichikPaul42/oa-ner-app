import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { I18nProvider } from '@/i18n';
import { AuthProvider } from '@/context/AuthContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { prewarmRenderBackend } from '@/services/kneevaService';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    // Fire silent background pre-warm ping to Render free-tier container
    prewarmRenderBackend();

    // Hide splash screen after a brief delay to allow providers to initialize
    const timer = setTimeout(() => {
      SplashScreen.hideAsync();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <I18nProvider>
      <SettingsProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#FFFFFF' },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="dashboard" />
            <Stack.Screen name="patient/[id]" />
            <Stack.Screen name="assessment/[patientId]" />
            <Stack.Screen name="report/[sessionId]" />
            <Stack.Screen name="kneeva/index" />
            <Stack.Screen name="kneeva/results" />
            <Stack.Screen name="routine" />
          </Stack>
        </AuthProvider>
      </SettingsProvider>
    </I18nProvider>
  );
}
