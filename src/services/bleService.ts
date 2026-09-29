import type { SensorReading, BleConnectionState } from '@/types/contracts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { subscribeLiveSensorReading, LiveTelemetrySample, isLiveHardwareStreaming } from './liveSensorStream';

// ─── Types ───────────────────────────────────────────────────────────

type BleStateListener = (state: BleConnectionState) => void;
type SensorListener = (reading: SensorReading) => void;

// ─── Internal state ──────────────────────────────────────────────────

let connectionState: BleConnectionState = 'disconnected';
let liveUnsub: (() => void) | null = null;

const stateListeners: Set<BleStateListener> = new Set();
const sensorListeners: Set<SensorListener> = new Set();

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

async function getBackendBaseUrl(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem('@backend_ip');
    if (saved && saved.trim().length > 0) {
      const val = saved.trim();
      if (val !== '10.104.28.241' && val !== '192.168.43.100') {
        if (val.startsWith('http://') || val.startsWith('https://')) {
          return val.replace(/\/+$/, '');
        }
        return `http://${val}:8000`;
      }
    }
  } catch {}
  const lanIp = getHostIp();
  if (lanIp) return `http://${lanIp}:8000`;
  return 'http://192.168.137.1:8000';
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 4000) {
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

export function getBleState(): BleConnectionState {
  return connectionState;
}

export function onBleStateChange(listener: BleStateListener): () => void {
  stateListeners.add(listener);
  listener(connectionState);
  return () => stateListeners.delete(listener);
}

export function onSensorReading(listener: SensorListener): () => void {
  sensorListeners.add(listener);

  // Hook directly into real-time live sensor stream
  if (!liveUnsub) {
    liveUnsub = subscribeLiveSensorReading((sample: LiveTelemetrySample) => {
      const sensorReading: SensorReading = {
        node_id: sample.node_id,
        timestamp: sample.timestamp,
        flex_resistance: sample.flex_resistance,
        flex_angle_deg: sample.flex_angle_deg,
        mpu_accel: sample.mpu_accel,
        mpu_gyro: sample.mpu_gyro,
        piezo_peak: sample.piezo_peak,
        piezo_event: sample.piezo_event,
        emg_raw_mv: sample.emg_raw_mv,
        emg_mv: sample.emg_mv,
        emg_active: sample.emg_active,
      };
      notifySensor(sensorReading);
    });
  }

  return () => {
    sensorListeners.delete(listener);
    if (sensorListeners.size === 0 && liveUnsub) {
      liveUnsub();
      liveUnsub = null;
    }
  };
}

export function connectAndStream(patientId: string): void {
  notifyState('scanning');
  setTimeout(() => {
    notifyState('connecting');
    setTimeout(() => {
      notifyState('connected');
    }, 400);
  }, 400);
}

export async function startStream(patientId: string): Promise<string> {
  const baseUrl = await getBackendBaseUrl();

  try {
    const res = await fetchWithTimeout(
      `${baseUrl}/api/sessions/start-stream?patient_id=${patientId}&duration_seconds=10.0&simulated=false`,
      { method: 'POST' },
      12000
    );

    if (res.ok) {
      const result = await res.json();
      return result.session_id || `sess-${Date.now()}`;
    }
  } catch (e) {
    console.log('startStream backend call failed (using active live stream buffer):', e);
  }

  return `sess-${Date.now()}`;
}

export function stopStream(): void {
  // Live stream is managed by listeners
}

export function disconnect(): void {
  if (liveUnsub) {
    liveUnsub();
    liveUnsub = null;
  }
  notifyState('disconnected');
}
