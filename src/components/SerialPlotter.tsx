import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import Svg, {
  Path,
  Rect,
  Line,
  Text as SvgText,
  G,
  Circle,
} from 'react-native-svg';
import type { SensorReading } from '@/types/contracts';
import { subscribeLiveSensorReading, type LiveTelemetrySample } from '@/services/liveSensorStream';

// ─── Channel Definitions Matching ESP32 Firmware ───────────────────────

export type ChannelKey =
  | 'EMG_raw_mV'
  | 'EMG_smooth_mV'
  | 'EMG_active'
  | 'Flex_raw'
  | 'Piezo_peak'
  | 'Accel_X_g'
  | 'Accel_Y_g'
  | 'Accel_Z_g'
  | 'Gyro_X_dps'
  | 'Gyro_Y_dps'
  | 'Gyro_Z_dps';

export interface ChannelConfig {
  key: ChannelKey;
  label: string;
  color: string;
  unit: string;
  group: 'emg' | 'acoustic' | 'flex' | 'accel' | 'gyro';
  defaultMin: number;
  defaultMax: number;
}

export const PLOTTER_CHANNELS: ChannelConfig[] = [
  { key: 'EMG_raw_mV',    label: 'EMG Raw',      color: '#EC4899', unit: 'mV',  group: 'emg',      defaultMin: 0,    defaultMax: 800 },
  { key: 'EMG_smooth_mV', label: 'EMG Smooth',   color: '#A855F7', unit: 'mV',  group: 'emg',      defaultMin: 0,    defaultMax: 800 },
  { key: 'EMG_active',    label: 'EMG Active',   color: '#F43F5E', unit: '×500',group: 'emg',      defaultMin: 0,    defaultMax: 500 },
  { key: 'Flex_raw',      label: 'Flex Raw',     color: '#10B981', unit: 'adc', group: 'flex',     defaultMin: 0,    defaultMax: 4095 },
  { key: 'Piezo_peak',    label: 'Piezo Crepitus',color: '#FB923C', unit: 'dev', group: 'acoustic', defaultMin: 0,    defaultMax: 500 },
  { key: 'Accel_X_g',     label: 'Accel X',      color: '#EF4444', unit: 'g',   group: 'accel',    defaultMin: -2.0, defaultMax: 2.0 },
  { key: 'Accel_Y_g',     label: 'Accel Y',      color: '#84CC16', unit: 'g',   group: 'accel',    defaultMin: -2.0, defaultMax: 2.0 },
  { key: 'Accel_Z_g',     label: 'Accel Z',      color: '#3B82F6', unit: 'g',   group: 'accel',    defaultMin: -2.0, defaultMax: 2.0 },
  { key: 'Gyro_X_dps',    label: 'Gyro X',       color: '#EAB308', unit: '°/s', group: 'gyro',     defaultMin: -250, defaultMax: 250 },
  { key: 'Gyro_Y_dps',    label: 'Gyro Y',       color: '#06B6D4', unit: '°/s', group: 'gyro',     defaultMin: -250, defaultMax: 250 },
  { key: 'Gyro_Z_dps',    label: 'Gyro Z',       color: '#94A3B8', unit: '°/s', group: 'gyro',     defaultMin: -250, defaultMax: 250 },
];

export interface SerialDataPoint {
  t: number;
  EMG_raw_mV: number;
  EMG_smooth_mV: number;
  EMG_active: number;
  Flex_raw: number;
  Piezo_peak: number;
  Accel_X_g: number;
  Accel_Y_g: number;
  Accel_Z_g: number;
  Gyro_X_dps: number;
  Gyro_Y_dps: number;
  Gyro_Z_dps: number;
  rawString?: string;
}

interface SerialPlotterProps {
  externalReadings?: SensorReading[];
  preferredNode?: 'node_right' | 'node_left';
  maxPoints?: number;
  height?: number;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function SerialPlotter({
  externalReadings,
  preferredNode = 'node_right',
  maxPoints = 60,
  height = 240,
}: SerialPlotterProps) {
  const [selectedNode, setSelectedNode] = useState<'node_right' | 'node_left'>(preferredNode);
  const [isPaused, setIsPaused] = useState(false);
  const [bufferSize, setBufferSize] = useState<number>(maxPoints);
  const [scaleMode, setScaleMode] = useState<'normalized' | 'raw'>('normalized');
  const [showTerminal, setShowTerminal] = useState(false);

  // Active channels toggle map
  const [activeChannels, setActiveChannels] = useState<Record<ChannelKey, boolean>>({
    EMG_raw_mV: true,
    EMG_smooth_mV: true,
    EMG_active: true,
    Flex_raw: true,
    Piezo_peak: true,
    Accel_X_g: true,
    Accel_Y_g: true,
    Accel_Z_g: true,
    Gyro_X_dps: false,
    Gyro_Y_dps: false,
    Gyro_Z_dps: false,
  });

  // Rolling points buffer
  const [pointsBuffer, setPointsBuffer] = useState<SerialDataPoint[]>([]);
  const latestSerialStringRef = useRef<string>('');
  const [terminalLines, setTerminalLines] = useState<string[]>([]);

  // ─── Convert generic reading into Plotter data point ─────────────
  const parsePoint = (
    reading: SensorReading | LiveTelemetrySample,
    seq: number
  ): SerialDataPoint => {
    const rawAx = reading.mpu_accel?.x ?? 0;
    const rawAy = reading.mpu_accel?.y ?? 0;
    const rawAz = reading.mpu_accel?.z ?? 0;
    const rawGx = reading.mpu_gyro?.x ?? 0;
    const rawGy = reading.mpu_gyro?.y ?? 0;
    const rawGz = reading.mpu_gyro?.z ?? 0;

    const flexRaw = reading.flex_resistance ?? 0;
    const piezoPeak = reading.piezo_peak ?? 0;
    const emgSmooth = reading.emg_mv ?? 0;
    const emgRaw = reading.emg_raw_mv ?? emgSmooth;
    const emgActive = reading.emg_active ? 500 : 0;

    const serialString =
      `EMG_raw_mV:${emgRaw.toFixed(0)},EMG_smooth_mV:${emgSmooth.toFixed(0)},EMG_active:${emgActive},` +
      `Flex_raw:${flexRaw},Piezo_peak:${piezoPeak},` +
      `Accel_X_g:${rawAx.toFixed(2)},Accel_Y_g:${rawAy.toFixed(2)},Accel_Z_g:${rawAz.toFixed(2)},` +
      `Gyro_X_dps:${rawGx.toFixed(1)},Gyro_Y_dps:${rawGy.toFixed(1)},Gyro_Z_dps:${rawGz.toFixed(1)}`;

    return {
      t: seq,
      EMG_raw_mV: emgRaw,
      EMG_smooth_mV: emgSmooth,
      EMG_active: emgActive,
      Flex_raw: flexRaw,
      Piezo_peak: piezoPeak,
      Accel_X_g: rawAx,
      Accel_Y_g: rawAy,
      Accel_Z_g: rawAz,
      Gyro_X_dps: rawGx,
      Gyro_Y_dps: rawGy,
      Gyro_Z_dps: rawGz,
      rawString: serialString,
    };
  };

  // ─── Connect to Live Sensor Stream Bridge ─────────────────────────
  const seqCounterRef = useRef(0);

  useEffect(() => {
    // 1. If external readings provided directly
    if (externalReadings && externalReadings.length > 0) {
      const filtered = externalReadings.filter((r) => r.node_id === selectedNode);
      if (filtered.length > 0) {
        const mapped = filtered.slice(-bufferSize).map((r, i) => parsePoint(r, i));
        setPointsBuffer(mapped);
        if (mapped.length > 0) {
          latestSerialStringRef.current = mapped[mapped.length - 1].rawString || '';
        }
      }
      return;
    }

    // 2. Otherwise subscribe to live streaming bridge (UDP / Mock telemetry)
    const unsub = subscribeLiveSensorReading((sample) => {
      if (isPaused) return;
      if (sample.node_id !== selectedNode) return;

      seqCounterRef.current += 1;
      const pt = parsePoint(sample, seqCounterRef.current);

      latestSerialStringRef.current = pt.rawString || '';

      setPointsBuffer((prev) => {
        const next = [...prev, pt];
        if (next.length > bufferSize) {
          return next.slice(-bufferSize);
        }
        return next;
      });

      setTerminalLines((prev) => {
        const next = [...prev, pt.rawString || ''];
        return next.slice(-15);
      });
    });

    return () => unsub();
  }, [selectedNode, isPaused, bufferSize, externalReadings]);

  // ─── Channel Filter Helpers ──────────────────────────────────────
  const toggleChannel = (key: ChannelKey) => {
    setActiveChannels((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const applyPreset = (preset: 'all' | 'emg' | 'kinematics' | 'flex' | 'none') => {
    const updated: Record<ChannelKey, boolean> = { ...activeChannels };
    PLOTTER_CHANNELS.forEach((ch) => {
      if (preset === 'all') updated[ch.key] = true;
      else if (preset === 'none') updated[ch.key] = false;
      else if (preset === 'emg') updated[ch.key] = ch.group === 'emg' || ch.group === 'acoustic';
      else if (preset === 'kinematics') updated[ch.key] = ch.group === 'accel' || ch.group === 'gyro';
      else if (preset === 'flex') updated[ch.key] = ch.group === 'flex';
    });
    setActiveChannels(updated);
  };

  // ─── Latest Instant Value Map ────────────────────────────────────
  const latestPoint = pointsBuffer.length > 0 ? pointsBuffer[pointsBuffer.length - 1] : null;

  // ─── Chart Sizing & SVG Coordinate Math ──────────────────────────
  const plotWidth = Math.max(300, SCREEN_WIDTH - 36);
  const padLeft = 44;
  const padRight = 14;
  const padTop = 16;
  const padBottom = 24;

  const innerW = plotWidth - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  // Determine scaling factors for each channel
  const renderedPaths = useMemo(() => {
    if (pointsBuffer.length < 2) return [];

    const activeList = PLOTTER_CHANNELS.filter((ch) => activeChannels[ch.key]);
    if (activeList.length === 0) return [];

    const nPoints = pointsBuffer.length;
    const getX = (idx: number) => padLeft + (idx / Math.max(1, nPoints - 1)) * innerW;

    return activeList.map((ch) => {
      let minY = ch.defaultMin;
      let maxY = ch.defaultMax;

      if (scaleMode === 'raw') {
        // Global autoscale across all visible channels
        const allVals = pointsBuffer.map((p) => p[ch.key]);
        const dataMin = Math.min(...allVals);
        const dataMax = Math.max(...allVals);
        minY = Math.min(minY, dataMin);
        maxY = Math.max(maxY, dataMax);
      }

      const span = maxY - minY || 1;
      const getY = (val: number) => {
        const clamped = Math.max(minY, Math.min(maxY, val));
        const norm = (clamped - minY) / span;
        return padTop + innerH - norm * innerH;
      };

      let d = '';
      pointsBuffer.forEach((p, idx) => {
        const x = getX(idx);
        const y = getY(p[ch.key]);
        if (idx === 0) d += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
        else d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      });

      const lastX = getX(nPoints - 1);
      const lastY = getY(pointsBuffer[nPoints - 1][ch.key]);

      return {
        ...ch,
        pathD: d,
        lastX,
        lastY,
        currentVal: pointsBuffer[nPoints - 1][ch.key],
      };
    });
  }, [pointsBuffer, activeChannels, scaleMode, innerW, innerH]);

  return (
    <View style={styles.container}>
      {/* ─── 1. Plotter Master Header ────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>📟 SERIAL PLOTTER</Text>
          </View>
          <View style={styles.liveIndicator}>
            <View style={[styles.liveDot, { backgroundColor: isPaused ? '#F59E0B' : '#10B981' }]} />
            <Text style={styles.liveText}>
              {isPaused ? 'PAUSED' : '50Hz STREAMING'}
            </Text>
          </View>
        </View>

        <Text style={styles.title}>USB Serial & Wi-Fi UDP Oscilloscope</Text>
        <Text style={styles.subtitle}>
          {Object.values(activeChannels).filter(Boolean).length}/11 Channels Active • {pointsBuffer.length} Samples Buffered • XIAO ESP32-S3
        </Text>

        {/* Node Selector Pills */}
        <View style={styles.nodeTabsRow}>
          <TouchableOpacity
            style={[styles.nodeTab, selectedNode === 'node_right' && styles.nodeTabActive]}
            onPress={() => setSelectedNode('node_right')}
            activeOpacity={0.8}
          >
            <Text style={[styles.nodeTabText, selectedNode === 'node_right' && styles.nodeTabTextActive]}>
              🦵 Right Knee (XIAO S3 Sense)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.nodeTab, selectedNode === 'node_left' && styles.nodeTabActive]}
            onPress={() => setSelectedNode('node_left')}
            activeOpacity={0.8}
          >
            <Text style={[styles.nodeTabText, selectedNode === 'node_left' && styles.nodeTabTextActive]}>
              🦵 Left Knee (Standard ESP32)
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── 2. Live Value HUD Readout Bar ────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.hudScrollContent}
        style={styles.hudScroll}
      >
        {PLOTTER_CHANNELS.map((ch) => {
          const isActive = activeChannels[ch.key];
          const val = latestPoint ? latestPoint[ch.key] : 0;
          const formatted =
            ch.unit === 'g'
              ? (val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2))
              : ch.unit === '°/s'
              ? `${val.toFixed(1)}`
              : `${Math.round(val)}`;

          return (
            <TouchableOpacity
              key={ch.key}
              style={[
                styles.hudChip,
                isActive && { borderColor: ch.color, backgroundColor: `${ch.color}15` },
              ]}
              onPress={() => toggleChannel(ch.key)}
              activeOpacity={0.7}
            >
              <View style={[styles.hudDot, { backgroundColor: ch.color, opacity: isActive ? 1 : 0.3 }]} />
              <View>
                <Text style={styles.hudLabel}>{ch.label}</Text>
                <Text style={[styles.hudValue, { color: isActive ? ch.color : '#64748B' }]}>
                  {formatted} <Text style={styles.hudUnit}>{ch.unit}</Text>
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ─── 3. The Oscilloscope / SVG Plot Canvas ─────────────────── */}
      <View style={[styles.canvasCard, { height }]}>
        <Svg width={plotWidth} height={height}>
          {/* Plot Background */}
          <Rect x={0} y={0} width={plotWidth} height={height} fill="#090D16" rx={12} />

          {/* Grid lines (horizontal divisions) */}
          {[0.0, 0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
            const y = padTop + frac * innerH;
            return (
              <G key={`hgrid-${idx}`}>
                <Line
                  x1={padLeft}
                  y1={y}
                  x2={plotWidth - padRight}
                  y2={y}
                  stroke="#1E293B"
                  strokeWidth="1"
                  strokeDasharray={frac === 0.5 ? '0' : '4 4'}
                />
                <SvgText
                  x={padLeft - 6}
                  y={y + 3.5}
                  fontSize="9"
                  fill="#64748B"
                  textAnchor="end"
                  fontFamily={Platform.OS === 'ios' ? 'Menlo' : 'monospace'}
                >
                  {scaleMode === 'normalized'
                    ? `${Math.round((1 - frac) * 100)}%`
                    : frac === 0
                    ? '+MAX'
                    : frac === 0.5
                    ? '0'
                    : '-MIN'}
                </SvgText>
              </G>
            );
          })}

          {/* Vertical Time Division Ticks */}
          {[0.2, 0.4, 0.6, 0.8].map((frac, idx) => {
            const x = padLeft + frac * innerW;
            return (
              <Line
                key={`vgrid-${idx}`}
                x1={x}
                y1={padTop}
                x2={x}
                y2={padTop + innerH}
                stroke="#172554"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
            );
          })}

          {/* Active Signal Polyline Traces */}
          {renderedPaths.map((p) => (
            <G key={`trace-${p.key}`}>
              {/* Glow filter simulation (layered thicker translucent path) */}
              <Path
                d={p.pathD}
                fill="none"
                stroke={p.color}
                strokeWidth="4"
                strokeOpacity="0.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Sharp primary signal line */}
              <Path
                d={p.pathD}
                fill="none"
                stroke={p.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Leading Spark Dot at rightmost sample */}
              <Circle cx={p.lastX} cy={p.lastY} r={3.5} fill="#FFFFFF" />
              <Circle cx={p.lastX} cy={p.lastY} r={6} fill={p.color} fillOpacity={0.4} />
            </G>
          ))}

          {/* Bottom Time Axis Label */}
          <SvgText
            x={padLeft}
            y={height - 8}
            fontSize="9"
            fill="#64748B"
            fontFamily={Platform.OS === 'ios' ? 'Menlo' : 'monospace'}
          >
            -{bufferSize} samples (~{Math.round(bufferSize / 10)}s)
          </SvgText>
          <SvgText
            x={plotWidth - padRight}
            y={height - 8}
            fontSize="9"
            fill="#10B981"
            textAnchor="end"
            fontFamily={Platform.OS === 'ios' ? 'Menlo' : 'monospace'}
          >
            NOW (0s)
          </SvgText>
        </Svg>
      </View>

      {/* ─── 4. Quick Preset Buttons & Controls ───────────────────── */}
      <View style={styles.controlsRow}>
        <View style={styles.presetGroup}>
          <TouchableOpacity
            style={styles.presetBtn}
            onPress={() => applyPreset('all')}
          >
            <Text style={styles.presetBtnText}>ALL (11)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.presetBtn}
            onPress={() => applyPreset('emg')}
          >
            <Text style={styles.presetBtnText}>EMG & PIEZO</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.presetBtn}
            onPress={() => applyPreset('kinematics')}
          >
            <Text style={styles.presetBtnText}>IMU 6-DOF</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.presetBtn}
            onPress={() => applyPreset('flex')}
          >
            <Text style={styles.presetBtnText}>FLEX ROM</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionGroup}>
          <TouchableOpacity
            style={[styles.actionBtn, isPaused && styles.actionBtnActive]}
            onPress={() => setIsPaused(!isPaused)}
          >
            <Text style={styles.actionBtnText}>{isPaused ? '▶ RESUME' : '⏸ PAUSE'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setScaleMode(scaleMode === 'normalized' ? 'raw' : 'normalized')}
          >
            <Text style={styles.actionBtnText}>
              {scaleMode === 'normalized' ? '📊 NORM' : '📈 RAW'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, showTerminal && styles.actionBtnActive]}
            onPress={() => setShowTerminal(!showTerminal)}
          >
            <Text style={styles.actionBtnText}>💻 RAW TX</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── 5. Serial Monitor Log Drawer (Arduino Serial Output) ─── */}
      {showTerminal && (
        <View style={styles.terminalContainer}>
          <View style={styles.terminalHeader}>
            <Text style={styles.terminalTitle}>ARDUINO SERIAL PLOTTER STRING OUTPUT</Text>
            <TouchableOpacity onPress={() => setTerminalLines([])}>
              <Text style={styles.terminalClear}>Clear</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.terminalScroll}
            contentContainerStyle={styles.terminalContent}
            showsVerticalScrollIndicator
          >
            {terminalLines.map((line, idx) => (
              <Text key={`line-${idx}`} style={styles.terminalText}>
                {line}
              </Text>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  header: {
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerBadge: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  headerBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
    marginTop: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  nodeTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  nodeTab: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  nodeTabActive: {
    backgroundColor: '#0369A1',
    borderColor: '#38BDF8',
  },
  nodeTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  nodeTabTextActive: {
    color: '#FFFFFF',
  },
  hudScroll: {
    marginBottom: 10,
  },
  hudScrollContent: {
    gap: 8,
    paddingVertical: 2,
  },
  hudChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 8,
  },
  hudDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  hudLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  hudValue: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  hudUnit: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  canvasCard: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 10,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  presetGroup: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
    flex: 1,
  },
  presetBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#1E293B',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  presetBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  actionGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: '#1E293B',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#475569',
  },
  actionBtnActive: {
    backgroundColor: '#B45309',
    borderColor: '#F59E0B',
  },
  actionBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  terminalContainer: {
    marginTop: 10,
    backgroundColor: '#020617',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  terminalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    paddingBottom: 4,
  },
  terminalTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38BDF8',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  terminalClear: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  terminalScroll: {
    maxHeight: 90,
  },
  terminalContent: {
    gap: 2,
  },
  terminalText: {
    fontSize: 9,
    color: '#4ADE80',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
