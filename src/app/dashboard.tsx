import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import PatientCard from '@/components/PatientCard';
import { useTranslation, SUPPORTED_LANGUAGES, type LanguageCode } from '@/i18n';
import { useAuth } from '@/context/AuthContext';
import { getPatients, searchPatients } from '@/services/patientService';
import type { PatientRecord } from '@/types/contracts';

// ─── Screen 2 — Dashboard ───────────────────────────────────────────

export default function DashboardScreen() {
  const router = useRouter();
  const { t, currentLanguage, setLanguage } = useTranslation();
  const { logout } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [allPatients, setAllPatients] = useState<PatientRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch patients when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const loadPatients = async () => {
        setIsLoading(true);
        try {
          const data = await getPatients();
          if (isActive) setAllPatients(data);
        } catch (e) {
          console.log('Dashboard: failed to load patients, mocks will be used:', e);
        } finally {
          if (isActive) setIsLoading(false);
        }
      };
      loadPatients();
      return () => {
        isActive = false;
      };
    }, [])
  );

  const filteredPatients = useMemo(() => {
    if (!searchQuery.trim()) return allPatients;
    // Client side filtering since searchPatients is async now
    const lowerQuery = searchQuery.toLowerCase();
    return allPatients.filter(
      (p) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.village_block.toLowerCase().includes(lowerQuery)
    );
  }, [searchQuery, allPatients]);

  const handlePatientPress = useCallback(
    (patient: PatientRecord) => {
      router.push(`/patient/${patient.patient_id}`);
    },
    [router]
  );

  const handleAddPatient = useCallback(() => {
    router.push('/patient/new');
  }, [router]);

  const handleLanguageSelect = useCallback(
    (lang: LanguageCode) => {
      setLanguage(lang);
      setShowLanguagePicker(false);
    },
    [setLanguage]
  );

  const currentLangLabel =
    SUPPORTED_LANGUAGES.find((l) => l.code === currentLanguage)?.label ?? 'English';

  return (
    <View style={styles.govContainer}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Official NIC Top Header Bar */}
          <View style={styles.header}>
            <Image
              source={require('../../assets/images/kneeva-logo.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <View style={{ flex: 1 }}>
              <View style={styles.emblemRow}>
                <View style={styles.emblemBadge}>
                  <Text style={styles.emblemBadgeText}>🇮🇳 NHM • ABHA SYNCED</Text>
                </View>
              </View>
              <Text style={styles.title}>Kneeva OA Triage</Text>
              <Text style={styles.subtitle}>
                National Health Portal • {filteredPatients.length} Registered {filteredPatients.length === 1 ? 'Patient' : 'Patients'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.languageButton}
              onPress={() => setShowLanguagePicker(true)}
            >
              <Text style={styles.languageIcon}>🌐</Text>
              <Text style={styles.languageButtonText}>{currentLangLabel}</Text>
              <Text style={styles.chevron}>▼</Text>
            </TouchableOpacity>
          </View>

          {/* Search bar */}
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder={t('dashboard_search_placeholder')}
              placeholderTextColor="#64748B"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text style={styles.clearIcon}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Single Official Protocol: Kneeva 15-Minute Comprehensive Assessment */}
          <TouchableOpacity
            style={[styles.kneevaBanner, { backgroundColor: '#042F2E', borderColor: '#0D9488' }]}
            onPress={() => router.push('/routine' as any)}
            activeOpacity={0.9}
          >
            <View style={styles.kneevaContent}>
              <View style={styles.kneevaHeaderRow}>
                <View style={[styles.kneevaBadge, { backgroundColor: '#0D9488' }]}>
                  <Text style={styles.kneevaBadgeText}>OFFICIAL PROTOCOL</Text>
                </View>
                <Text style={[styles.kneevaTagline, { color: '#2DD4BF' }]}>Dual ESP32 Live Telemetry • 9 Steps</Text>
              </View>
              <Text style={styles.kneevaTitle}>15-Minute Comprehensive Clinical Assessment</Text>
              <Text style={[styles.kneevaDesc, { color: '#CCFBF1' }]}>
                Standardized diagnostic routine: Calibration, Quad Strength, Sit-to-Stand, TUG, 6-Min Gait, Stairs, Single-Leg Balance, Flare Recovery & CatBoost Multimodal AI.
              </Text>
              <View style={styles.kneevaActionRow}>
                <Text style={[styles.kneevaActionText, { color: '#5EEAD4', flex: 1 }]}>⏱️ Start 15-Minute Assessment Routine →</Text>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    router.push('/assessment/pat-active' as any);
                  }}
                  style={{
                    backgroundColor: '#0F172A',
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: '#38BDF8',
                  }}
                >
                  <Text style={{ color: '#38BDF8', fontSize: 11, fontWeight: '800' }}>
                    📟 Serial Plotter
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>

          {/* Section Header */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>📋 REGISTERED PATIENT RECORDS</Text>
            <Text style={styles.sectionHeaderCount}>{filteredPatients.length} Total</Text>
          </View>

          {/* Patient list */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#003366" />
              <Text style={styles.loadingText}>Fetching official registry...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredPatients}
              keyExtractor={(item) => item.patient_id}
              renderItem={({ item }) => (
                <PatientCard
                  patient={item}
                  onPress={() => handlePatientPress(item)}
                />
              )}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyIcon}>📋</Text>
                  <Text style={styles.emptyText}>{t('dashboard_no_patients')}</Text>
                </View>
              }
            />
          )}

          {/* FAB — Add New Patient */}
          <TouchableOpacity
            style={styles.fabWrapper}
            onPress={handleAddPatient}
            activeOpacity={0.85}
          >
            <View style={styles.fab}>
              <Text style={styles.fabIcon}>+</Text>
              <Text style={styles.fabText}>{t('dashboard_add_patient')}</Text>
            </View>
          </TouchableOpacity>

        {/* Language Picker Modal */}
        <Modal
          visible={showLanguagePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowLanguagePicker(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowLanguagePicker(false)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('language_label')}</Text>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.langOption,
                    lang.code === currentLanguage && styles.langOptionActive,
                  ]}
                  onPress={() => handleLanguageSelect(lang.code)}
                >
                  <Text
                    style={[
                      styles.langOptionText,
                      lang.code === currentLanguage && styles.langOptionTextActive,
                    ]}
                  >
                    {lang.label}
                  </Text>
                  {lang.code === currentLanguage && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    </SafeAreaView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  govContainer: {
    flex: 1,
    backgroundColor: '#F4F4F0',
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#003366',
    padding: 14,
    borderRadius: 8,
    marginBottom: 14,
    elevation: 3,
    gap: 12,
  },
  headerLogo: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  emblemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  emblemBadge: {
    backgroundColor: '#FF9933',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  emblemBadgeText: {
    color: '#003366',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 12,
    color: '#E2E8F0',
    marginTop: 2,
    fontWeight: '600',
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  languageIcon: {
    fontSize: 13,
  },
  languageButtonText: {
    fontSize: 12,
    color: '#003366',
    fontWeight: '800',
  },
  chevron: {
    fontSize: 8,
    color: '#003366',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  searchIcon: {
    fontSize: 15,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
    padding: 0,
  },
  clearIcon: {
    fontSize: 15,
    color: '#64748B',
    padding: 4,
  },
  kneevaBanner: {
    backgroundColor: '#003366',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E3A8A',
    marginBottom: 14,
    elevation: 3,
    overflow: 'hidden',
  },
  kneevaContent: {
    padding: 14,
    gap: 6,
  },
  kneevaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kneevaBadge: {
    backgroundColor: '#138808',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  kneevaBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  kneevaTagline: {
    color: '#FF9933',
    fontSize: 11,
    fontWeight: '800',
  },
  kneevaTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  kneevaDesc: {
    color: '#E2E8F0',
    fontSize: 12,
    lineHeight: 16,
  },
  kneevaActionRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  kneevaActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#003366',
    letterSpacing: 0.5,
  },
  sectionHeaderCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  listContent: {
    paddingBottom: 90,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 50,
    gap: 10,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 50,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#003366',
    fontWeight: '700',
  },
  fabWrapper: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    elevation: 6,
    shadowColor: '#138808',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#138808',
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 28,
    gap: 8,
  },
  fabIcon: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  fabText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#003366',
    padding: 20,
    width: '85%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#003366',
    marginBottom: 14,
    textAlign: 'center',
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 4,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  langOptionActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#138808',
  },
  langOptionText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
  },
  langOptionTextActive: {
    color: '#138808',
    fontWeight: '800',
  },
  checkmark: {
    fontSize: 16,
    color: '#138808',
    fontWeight: '800',
  },
});
