import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';

import ConnectionIndicator from '@/components/ConnectionIndicator';
import SensorChart from '@/components/SensorChart';
import { useTranslation } from '@/i18n';
import {
  getBleState,
  onBleStateChange,
  onSensorReading,
  connectAndStream,
  startStream,
  stopStream,
  disconnect,
} from '@/services/bleService';
import { getPatientById } from '@/services/patientService';
import type { SensorReading, BleConnectionState, PatientRecord } from '@/types/contracts';

// ─── Screen 4 — Sensor Assessment Session ───────────────────────────

export default function AssessmentScreen() {
  const router = useRouter();
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const { t } = useTranslation();

  const [bleState, setBleState] = useState<BleConnectionState>('disconnected');
  const [liveReadingBuffer, setLiveReadingBuffer] = useState<SensorReading[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [realSessionId, setRealSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const recordingBuffer = useRef<SensorReading[]>([]);

  useEffect(() => {
    const loadPatient = async () => {
      try {
        const data = await getPatientById(patientId ?? '');
        if (data) setPatient(data);
      } catch (e) {
        console.log('Assessment: failed to load patient:', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadPatient();
  }, [patientId]);

  // ─── BLE state subscription ──────────────────────────────────────

  useEffect(() => {
    const unsubState = onBleStateChange((state) => {
      setBleState(state);
    });

    // Auto-connect on mount
    connectAndStream(patientId ?? '');

    return () => {
      unsubState();
      disconnect();
    };
  }, [patientId]);

  // ─── Sensor data subscription ────────────────────────────────────

  useEffect(() => {
    const unsubSensor = onSensorReading((reading) => {
      setLiveReadingBuffer((prev) => [...prev, reading]);
      if (isRecording) {
        recordingBuffer.current.push(reading);
      }
    });

    return () => unsubSensor();
  }, [isRecording]);

  // ─── Recording controls ──────────────────────────────────────────

  const handleStartRecording = useCallback(async () => {
    if (!patientId) return;
    recordingBuffer.current = [];
    setIsRecording(true);
    setHasRecording(false);
    
    try {
      // Option A: Fake UI runs, real recording happens in background
      const sessionId = await startStream(patientId as string);
      setRealSessionId(sessionId);
      setHasRecording(true);
    } catch (e) {
      Alert.alert("Recording Error", "Failed to record from sensors. Check laptop connection.");
    } finally {
      setIsRecording(false);
    }
  }, [patientId]);

  const handleStopRecording = useCallback(() => {
    // With Option A, recording stops automatically after 10s, but we leave this here just in case.
    setIsRecording(false);
    stopStream();
  }, []);

  const handleGenerateReport = useCallback(() => {
    if (!patient || !realSessionId) return;

    // The backend already processed the risk assessment. We just route to the report screen.
    router.push({
      pathname: '/report/[sessionId]',
      params: {
        sessionId: realSessionId,
      },
    });
  }, [patient, realSessionId, router]);

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0D9488" />
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>{t('assessment_title')}</Text>
            {patient && (
              <Text style={styles.patientName}>{patient.name}</Text>
            )}
          </View>
          <View style={styles.backBtn} />
        </View>

        {/* BLE Connection Status */}
        <ConnectionIndicator state={bleState} />

        {/* Live Charts — split by sensor node */}
        {(() => {
          const leftData = liveReadingBuffer.filter((r) => r.node_id === 'node_left');
          const rightData = liveReadingBuffer.filter((r) => r.node_id === 'node_right');

          return (
            <>
              <SensorChart
                data={leftData}
                title=" Left Knee Flexion"
                mode="flex_left"
              />

              <SensorChart
                data={rightData}
                title=" Right Knee Flexion"
                mode="flex_right"
              />

              <SensorChart
                leftData={leftData}
                rightData={rightData}
                title=" Velocity"
                mode="velocity"
              />

              <SensorChart
                leftData={leftData}
                rightData={rightData}
                title="🔊 Acoustic Emission (Vibration)"
                mode="acoustic"
              />
            </>
          );
        })()}

        {/* Recording status */}
        {isRecording && (
          <View style={styles.recordingBanner}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>
              {t('assessment_recording_in_progress')}
            </Text>
            <Text style={styles.recordingCount}>
              {recordingBuffer.current.length} pts
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom controls */}
      <View style={styles.bottomBar}>
        {!isRecording ? (
          <TouchableOpacity
            style={[
              styles.recordBtn,
              bleState !== 'connected' && styles.btnDisabled,
            ]}
            onPress={handleStartRecording}
            disabled={bleState !== 'connected'}
            activeOpacity={0.8}
          >
            <View style={styles.recordDot} />
            <Text style={styles.recordBtnText}>
              {t('assessment_start_recording')}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.stopBtn}
            onPress={handleStopRecording}
            activeOpacity={0.8}
          >
            <View style={styles.stopSquare} />
            <Text style={styles.stopBtnText}>
              {t('assessment_stop_recording')}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.reportBtn,
            !hasRecording && styles.btnDisabled,
          ]}
          onPress={handleGenerateReport}
          disabled={!hasRecording}
          activeOpacity={0.8}
        >
          <Text style={styles.reportBtnText}>
            {t('assessment_generate_report')}
          </Text>
          <Text style={styles.reportArrow}>→</Text>
          </TouchableOpacity>
        </View>
        </>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 20,
    color: '#475569',
  },
  headerCenter: {
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  patientName: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  recordingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 12,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  recordingText: {
    flex: 1,
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '500',
  },
  recordingCount: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 10,
  },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D9488',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
  },
  recordDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  recordBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
  },
  stopSquare: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  stopBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  reportBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  reportArrow: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.4,
  },
});
