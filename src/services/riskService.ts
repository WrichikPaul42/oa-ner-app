/**
 * Risk Service (Backend Integration)
 *
 * Connects to the real Python FastAPI backend.
 */

import type { RiskResult, RiskTier } from '@/types/contracts';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Fallback mocks if backend fails during pitch
import mockRiskLow from '@/mocks/mock_risk_low.json';
import mockRiskModerate from '@/mocks/mock_risk_moderate.json';
import mockRiskHigh from '@/mocks/mock_risk_high.json';

const mockResults: Record<RiskTier, RiskResult> = {
  Low: mockRiskLow as RiskResult,
  Moderate: mockRiskModerate as RiskResult,
  High: mockRiskHigh as RiskResult,
};

import Constants from 'expo-constants';

function getHostIp(): string | null {
  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest?.debuggerHost;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return ip;
    }
  }
  return null;
}

async function getBaseUrl() {
  try {
    const ip = await AsyncStorage.getItem('@backend_ip');
    if (ip && ip.trim().length > 0) {
      const val = ip.trim();
      if (val !== '10.104.28.241' && val !== '192.168.43.100') {
        if (val.startsWith('http://') || val.startsWith('https://')) {
          return `${val.replace(/\/+$/, '')}/api`;
        }
        return `http://${val}:8000/api`;
      }
    }
  } catch {}

  const lanIp = getHostIp();
  if (lanIp) return `http://${lanIp}:8000/api`;
  return `http://192.168.137.1:8000/api`;
}

// Timeout helper so unreachable IP doesn't hang for 2 minutes
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 2500) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Get the actual risk assessment from the backend.
 * Uses the session ID returned by startStream().
 */
export async function getRiskAssessment(sessionId: string): Promise<RiskResult> {
  const baseUrl = await getBaseUrl();
  try {
    const response = await fetchWithTimeout(`${baseUrl}/sessions/${sessionId}/risk`);
    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.log('Failed to get risk assessment from backend (backend may be down), using mock:', error);
    // Fallback to mock for smooth demo experience
    return {
      ...mockResults['Moderate'],
      patient_id: 'pat-fallback',
      session_id: sessionId,
    };
  }
}
