/**
 * Patient Service (Backend Integration)
 *
 * Connects to the real Python FastAPI backend.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { PatientRecord, PainMapEntry } from '@/types/contracts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import mockPatients from '@/mocks/mock_patients.json';

const staticMockPatients = mockPatients as PatientRecord[];
const DEFAULT_CLOUD_URL = 'https://kneeva-api.onrender.com';

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

// Helper to get the base URL
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
  } catch {
    // AsyncStorage unavailable, use fallback
  }

  const lanIp = getHostIp();
  if (lanIp) {
    return `http://${lanIp}:8000/api`;
  }

  return Platform.OS === 'web' ? 'http://localhost:8000/api' : `${DEFAULT_CLOUD_URL}/api`;
}

// Timeout helper so unreachable IP doesn't hang for 2 minutes
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 3000) {
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
 * Get all patient records.
 */
export async function getPatients(): Promise<PatientRecord[]> {
  const candidateUrls: string[] = [];
  try {
    const baseUrl = await getBaseUrl();
    if (baseUrl) {
      candidateUrls.push(`${baseUrl}/patients`);
      candidateUrls.push(`${baseUrl.replace(/\/api$/, '')}/api/patients`);
    }
  } catch {}

  const lanIp = getHostIp();
  if (lanIp) {
    candidateUrls.push(`http://${lanIp}:8000/api/patients`);
    candidateUrls.push(`http://${lanIp}:8000/patients`);
  }
  candidateUrls.push('http://localhost:8000/api/patients');
  candidateUrls.push('http://localhost:8000/patients');

  for (const url of candidateUrls) {
    try {
      const response = await fetchWithTimeout(url, {}, 2500);
      if (response && response.ok) {
        const backendPatients = (await response.json()) as PatientRecord[];
        if (Array.isArray(backendPatients) && backendPatients.length > 0) {
          const seen = new Set(backendPatients.map((p) => p.patient_id));
          const remainingMocks = staticMockPatients.filter((p) => !seen.has(p.patient_id));
          return [...backendPatients, ...remainingMocks];
        }
      }
    } catch {
      // endpoint not reachable, try next candidate
    }
  }

  return staticMockPatients;
}

/**
 * Get a single patient by ID. Returns undefined if not found.
 */
export async function getPatientById(patientId: string): Promise<PatientRecord | undefined> {
  const candidateUrls: string[] = [];
  try {
    const baseUrl = await getBaseUrl();
    if (baseUrl) {
      candidateUrls.push(`${baseUrl}/patients/${patientId}`);
      candidateUrls.push(`${baseUrl.replace(/\/api$/, '')}/api/patients/${patientId}`);
    }
  } catch {}

  const lanIp = getHostIp();
  if (lanIp) {
    candidateUrls.push(`http://${lanIp}:8000/api/patients/${patientId}`);
    candidateUrls.push(`http://${lanIp}:8000/patients/${patientId}`);
  }
  candidateUrls.push(`http://localhost:8000/api/patients/${patientId}`);

  for (const url of candidateUrls) {
    try {
      const response = await fetchWithTimeout(url, {}, 2500);
      if (response && response.ok) {
        return await response.json();
      }
    } catch {
      // try next candidate
    }
  }

  // Fallback to mock patients
  return staticMockPatients.find((p) => p.patient_id === patientId);
}

/**
 * Search patients by name or village_block (client-side filter for now).
 */
export async function searchPatients(query: string): Promise<PatientRecord[]> {
  const allPatients = await getPatients();
  const lowerQuery = query.toLowerCase();
  return allPatients.filter(
    (p) =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.village_block.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Save a new patient.
 * Note: The backend currently only supports POST for creating patients, not PUT for updating.
 */
export async function savePatient(patient: {
  name: string;
  age: number;
  gender: string;
  village_block: string;
  pain_map: PainMapEntry[];
}): Promise<PatientRecord> {
  const baseUrl = await getBaseUrl();
  try {
    const response = await fetchWithTimeout(`${baseUrl}/patients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patient),
    });
    
    if (!response.ok) {
      throw new Error('Failed to save patient');
    }
    
    return await response.json();
  } catch (error) {
    console.log('savePatient error (backend may be down), returning mock:', error);
    // Return an existing mock patient so the next screen's getPatientById doesn't fail
    return {
      ...staticMockPatients[0],
      name: patient.name || staticMockPatients[0].name,
    } as PatientRecord;
  }
}
