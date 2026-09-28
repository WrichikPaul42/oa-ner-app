import { Platform } from 'react-native';

let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
  if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }
} catch {
  // Graceful fallback when running inside Expo Go SDK 53+ sandbox
  Notifications = null;
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Notifications || Platform.OS === 'web') return true;
  try {
    if (typeof Notifications.getPermissionsAsync === 'function') {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted' && typeof Notifications.requestPermissionsAsync === 'function') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      return finalStatus === 'granted';
    }
  } catch {
    // Silent catch for Expo Go environment limits
  }
  return true;
}

export async function sendLocalNotification(title: string, body: string, data: object = {}) {
  try {
    if (Notifications && typeof Notifications.scheduleNotificationAsync === 'function') {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
        },
        trigger: null, // Send immediately
      });
    }
  } catch {
    // Expo Go SDK 53+ restricts OS push notifications; swallowed for clean dev console
  }
}

export async function notifyReportSentToAI(patientId: string) {
  await sendLocalNotification(
    '📤 AI Analysis Started',
    `Sensor telemetry for ${patientId} has been sent to the CatBoost & SHAP AI model.`,
    { type: 'AI_SUBMITTED', patientId }
  );
}

export async function notifyReportReceivedFromAI(patientId: string, riskCategory: string) {
  const emoji = riskCategory.toLowerCase() === 'high' ? '🚨' : riskCategory.toLowerCase() === 'moderate' ? '⚠️' : '✅';
  await sendLocalNotification(
    `${emoji} Diagnostic Report Generated`,
    `AI triage result for ${patientId} is ready (${riskCategory.toUpperCase()} Risk). Tap to review referral slip.`,
    { type: 'AI_REPORT_READY', patientId, riskCategory }
  );
}

export async function notifyAbhaForwarded(patientId: string, abhaId: string) {
  await sendLocalNotification(
    '🛡️ Ayushman Bharat Health Record Linked',
    `Report for ${patientId} successfully synced to Ayushman Bharat (ABHA #${abhaId}).`,
    { type: 'ABHA_LINKED', patientId, abhaId }
  );
}
