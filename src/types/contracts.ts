/**
 * OA-NER Screening App — Frozen Integration Contracts
 *
 * These interfaces are the source of truth for all data shapes exchanged
 * between Developer A (core systems) and Developer B (UI layer).
 * DO NOT add, rename, or remove fields without a synchronous check-in.
 */

// ─── Contract 1 — Live Sensor Stream (BLE → Screen 4) ───────────────

export interface SensorReading {
  node_id: string; // e.g. "node_left", "node_right" — identifies which ESP32 sensor node
  patient_id: string;
  timestamp: string; // ISO8601
  flex_resistance: number;
  mpu_accel: { x: number; y: number; z: number };
  mpu_gyro: { x: number; y: number; z: number };
}

// ─── Contract 2 — Saved Patient Record (DB → Screens 2, 3, 5) ───────

export interface PainMapEntry {
  body_region: string;
  pain_level: number; // 1–10
}

export interface PatientRecord {
  patient_id: string;
  name: string;
  age: number;
  gender: string;
  village_block: string;
  pain_map: PainMapEntry[];
  sessions: string[]; // array of session_id strings
}

// ─── Contract 3 — Risk Assessment Result (Risk Engine → Screen 5) ────

export type RiskTier = 'Low' | 'Moderate' | 'High';

export interface SessionChartPoint {
  t: number;
  flex_resistance: number;
  gyro_x: number;
}

export interface RiskResult {
  session_id: string;
  patient_id: string;
  risk_tier: RiskTier;
  contributing_factors: string[];
  max_knee_flexion_deg: number;
  extension_lag_deg: number;
  session_chart_data: SessionChartPoint[];
  advice_key: string;
}

// ─── BLE Connection State enum (Phase 3.1) ───────────────────────────

export type BleConnectionState =
  | 'disconnected'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'error';
