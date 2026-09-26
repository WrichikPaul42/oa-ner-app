/**
 * BLE Service (Mock)
 *
 * Simulates Developer A's BLE connection manager and live sensor stream.
 * Replays mock_live_stream.json data on a timer to fake a live feed.
 *
 * Developer B subscribes to bleConnectionState and latestSensorReading.
 * When Developer A's real BLE module is ready, swap this file — same interface.
 */

import type { SensorReading, BleConnectionState } from '@/types/contracts';
import mockStreamData from '@/mocks/mock_live_stream.json';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ───────────────────────────────────────────────────────────

type BleStateListener = (state: BleConnectionState) => void;
type SensorListener = (reading: SensorReading) => void;

// ─── Internal state ──────────────────────────────────────────────────

let connectionState: BleConnectionState = 'disconnected';
let streamInterval: ReturnType<typeof setInterval> | null = null;
let streamIndex = 0;

const stateListeners: Set<BleStateListener> = new Set();
const sensorListeners: Set<SensorListener> = new Set();

// ─── Helpers ─────────────────────────────────────────────────────────

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

function notifyState(state: BleConnectionState) {
  connectionState = state;
  stateListeners.forEach((cb) => cb(state));
}

function notifySensor(reading: SensorReading) {
  sensorListeners.forEach((cb) => cb(reading));
}

// ─── Exposed Functions ───────────────────────────────────────────────

/**
 * Get the current BLE connection state.
 */
export function getBleState(): BleConnectionState {
  return connectionState;
}

/**
 * Subscribe to BLE connection state changes.
 * Returns an unsubscribe function.
 */
export function onBleStateChange(listener: BleStateListener): () => void {
  stateListeners.add(listener);
  // Immediately emit current state
  listener(connectionState);
  return () => stateListeners.delete(listener);
}

/**
 * Subscribe to incoming sensor readings.
 * Returns an unsubscribe function.
 */
export function onSensorReading(listener: SensorListener): () => void {
  sensorListeners.add(listener);
  return () => sensorListeners.delete(listener);
}

/**
 * Simulate BLE connection sequence: disconnected → scanning → connecting → connected.
 * Then begins streaming mock sensor data.
 */
export function connectAndStream(patientId: string): void {
  // Simulate connection sequence with delays
  notifyState('scanning');

  setTimeout(() => {
    notifyState('connecting');

    setTimeout(() => {
      notifyState('connected');
    }, 800);
  }, 1200);
}

/**
 * Start streaming mock sensor data at 200ms intervals (5Hz) for the UI,
 * WHILE SIMULTANEOUSLY hitting the real backend API to do the actual recording.
 *
 * Returns the final session_id from the backend once the recording finishes.
 */
export async function startStream(patientId: string): Promise<string> {
  if (streamInterval) return 'mock-session'; // Already streaming

  // Read the IP address the user configured on the Login screen
  let backendIp = '10.104.28.241';
  try {
    const savedIp = await AsyncStorage.getItem('@backend_ip');
    if (savedIp && savedIp !== '192.168.43.100') backendIp = savedIp;
  } catch {
    // AsyncStorage unavailable, use default IP
  }

  // Start the fake UI animation
  streamIndex = 0;
  const data = mockStreamData as SensorReading[];

  streamInterval = setInterval(() => {
    if (streamIndex >= data.length) {
      streamIndex = 0;
    }
    const reading = {
      ...data[streamIndex],
      node_id: streamIndex % 2 === 0 ? 'node_left' : 'node_right',
      timestamp: new Date().toISOString(),
    };
    notifySensor(reading);
    streamIndex++;
  }, 200);

  // --- Real Hardware Integration (Option A) ---
  try {
    // This will block for ~20 seconds while the backend records from UDP
    const res = await fetchWithTimeout(`http://${backendIp}:8000/api/sessions/start-stream?patient_id=${patientId}&duration_seconds=20.0&simulated=false`, {
      method: 'POST'
    }, 25000); // Give it 25 seconds since the recording itself takes 20s
    
    if (!res.ok) {
      throw new Error(`Backend returned status ${res.status}`);
    }
    const result = await res.json();
    
    // Stop the fake animation when the real recording is done
    stopStream();
    
    return result.session_id || `sess-${Date.now()}`;
  } catch(e) {
    console.log("startStream error (backend may be down), using mock session:", e);
    stopStream();
    return `sess-mock-${Date.now()}`;
  }
}

/**
 * Stop the mock sensor stream.
 */
export function stopStream(): void {
  if (streamInterval) {
    clearInterval(streamInterval);
    streamInterval = null;
  }
}

/**
 * Disconnect and clean up.
 */
export function disconnect(): void {
  stopStream();
  streamIndex = 0;
  notifyState('disconnected');
}
