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
    <LinearGradient colors={['#F8FAFC', '#F1F5F9', '#E2E8F0']} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{t('dashboard_title')}</Text>
            <Text style={styles.subtitle}>
              {filteredPatients.length} {filteredPatients.length === 1 ? 'patient' : 'patients'}
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
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Kneeva Functional Triage Card */}
        <TouchableOpacity
          style={styles.kneevaBanner}
          onPress={() => router.push('/kneeva' as any)}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={['#0F766E', '#0D9488']}
            style={styles.kneevaBannerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.kneevaContent}>
              <View style={styles.kneevaHeaderRow}>
                <View style={styles.kneevaBadge}>
                  <Text style={styles.kneevaBadgeText}>NEW PROTOCOL</Text>
                </View>
                <Text style={styles.kneevaTagline}>AI & IMU Triage</Text>
              </View>
              <Text style={styles.kneevaTitle}>Kneeva OA Triage Assessment</Text>
              <Text style={styles.kneevaDesc}>
                3-Step Flow: Demographics & Mountain Questionnaire • Clinical Goniometer / Strength • 2-Part IMU Walk Test
              </Text>
              <View style={styles.kneevaActionRow}>
                <Text style={styles.kneevaActionText}>Start 3-Step Functional Walk Test</Text>
                <Text style={styles.kneevaArrow}>→</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Patient list */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0D9488" />
            <Text style={styles.loadingText}>Loading patients...</Text>
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
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#14B8A6', '#0D9488']}
            style={styles.fab}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.fabIcon}>+</Text>
            <Text style={styles.fabText}>{t('dashboard_add_patient')}</Text>
          </LinearGradient>
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
    </LinearGradient>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1E293B',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  languageIcon: {
    fontSize: 15,
  },
  languageButtonText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  chevron: {
    fontSize: 8,
    color: '#94A3B8',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    padding: 0,
  },
  clearIcon: {
    fontSize: 16,
    color: '#94A3B8',
    padding: 4,
  },
  listContent: {
    paddingBottom: 100,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyText: {
    fontSize: 16,
    color: '#94A3B8',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
  },
  fabWrapper: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 28,
    gap: 8,
  },
  fabIcon: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '300',
  },
  fabText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  // Language picker modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '80%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
    textAlign: 'center',
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
  },
  langOptionActive: {
    backgroundColor: '#F0FDFA',
  },
  langOptionText: {
    fontSize: 16,
    color: '#475569',
  },
  langOptionTextActive: {
    color: '#0D9488',
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 18,
    color: '#0D9488',
    fontWeight: '700',
  },
  kneevaBanner: {
    marginBottom: 20,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  kneevaBannerGradient: {
    padding: 16,
    borderRadius: 18,
  },
  kneevaContent: {
    gap: 6,
  },
  kneevaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  kneevaBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  kneevaBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  kneevaTagline: {
    color: '#CCFBF1',
    fontSize: 11,
    fontWeight: '600',
  },
  kneevaTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  kneevaDesc: {
    color: '#CCFBF1',
    fontSize: 12,
    lineHeight: 16,
  },
  kneevaActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  kneevaActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  kneevaArrow: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
