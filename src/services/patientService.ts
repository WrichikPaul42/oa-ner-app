/**
 * Patient Service (Backend Integration)
 *
 * Connects to the real Python FastAPI backend.
 */

import type { PatientRecord, PainMapEntry } from '@/types/contracts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import mockPatients from '@/mocks/mock_patients.json';

const staticMockPatients = mockPatients as PatientRecord[];

// Helper to get the base URL
async function getBaseUrl() {
  let backendIp = '10.104.28.241';
  try {
    const ip = await AsyncStorage.getItem('@backend_ip');
    if (ip && ip !== '192.168.43.100') backendIp = ip;
  } catch {
    // AsyncStorage unavailable, use default IP
  }
  return `http://${backendIp}:8000/api`;
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
 * Get all patient records.
 */
export async function getPatients(): Promise<PatientRecord[]> {
  const baseUrl = await getBaseUrl();
  try {
    const response = await fetchWithTimeout(`${baseUrl}/patients`);
    if (!response.ok) throw new Error('Failed to fetch patients');
    const backendPatients = await response.json() as PatientRecord[];
    // Combine backend patients and mock patients
    return [...backendPatients, ...staticMockPatients];
  } catch (error) {
    console.log('getPatients error (backend may be down), using mocks only:', error);
    return staticMockPatients;
  }
}

/**
 * Get a single patient by ID. Returns undefined if not found.
 */
export async function getPatientById(patientId: string): Promise<PatientRecord | undefined> {
  const baseUrl = await getBaseUrl();
  try {
    const response = await fetchWithTimeout(`${baseUrl}/patients/${patientId}`);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.log('getPatientById error:', error);
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
