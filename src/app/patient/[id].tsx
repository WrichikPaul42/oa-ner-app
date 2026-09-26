import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import BodyMap from '@/components/BodyMap';
import PainSlider from '@/components/PainSlider';
import { useTranslation } from '@/i18n';
import { getPatientById, savePatient } from '@/services/patientService';
import type { PainMapEntry } from '@/types/contracts';

// ─── Screen 3 — Patient Profile & Pain Mapping ──────────────────────

const GENDER_OPTIONS = ['Male', 'Female', 'Other'] as const;

export default function PatientProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();

  const isNew = id === 'new';

  // ─── Form state ──────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(!isNew);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [villageBlock, setVillageBlock] = useState('');
  const [painMapEntries, setPainMapEntries] = useState<PainMapEntry[]>([]);
  const [activeRegion, setActiveRegion] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load existing patient if not new
  React.useEffect(() => {
    if (!isNew && id) {
      const loadPatient = async () => {
        try {
          const patient = await getPatientById(id);
          if (patient) {
            setName(patient.name);
            setAge(patient.age.toString());
            setGender(patient.gender);
            setVillageBlock(patient.village_block);
            setPainMapEntries(patient.pain_map || []);
          } else {
            Alert.alert('Error', 'Patient not found');
            router.back();
          }
        } catch (e) {
          console.log('Patient: failed to load patient:', e);
        } finally {
          setIsLoading(false);
        }
      };
      loadPatient();
    }
  }, [id, isNew, router]);

  // ─── Handlers ────────────────────────────────────────────────────

  const handleRegionPress = useCallback((regionId: string) => {
    setActiveRegion(regionId);
  }, []);

  const handlePainConfirm = useCallback(
    (level: number) => {
      if (!activeRegion) return;

      setPainMapEntries((prev) => {
        const existing = prev.findIndex((e) => e.body_region === activeRegion);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = { body_region: activeRegion, pain_level: level };
          return updated;
        }
        return [...prev, { body_region: activeRegion, pain_level: level }];
      });
      setActiveRegion(null);
    },
    [activeRegion]
  );

  const handlePainRemove = useCallback(() => {
    if (!activeRegion) return;
    setPainMapEntries((prev) => prev.filter((e) => e.body_region !== activeRegion));
    setActiveRegion(null);
  }, [activeRegion]);

  const handlePainCancel = useCallback(() => {
    setActiveRegion(null);
  }, []);

  const activeRegionEntry = useMemo(() => {
    if (!activeRegion) return null;
    return painMapEntries.find((e) => e.body_region === activeRegion) ?? null;
  }, [activeRegion, painMapEntries]);

  const handleSaveAndProceed = useCallback(async () => {
    if (!name.trim() || !age.trim() || !gender) {
      Alert.alert('', t('patient_required_fields'));
      return;
    }

    setIsSaving(true);
    try {
      // The backend currently creates a new patient via POST for both new/edit
      const saved = await savePatient({
        name: name.trim(),
        age: parseInt(age, 10),
        gender,
        village_block: villageBlock.trim(),
        pain_map: painMapEntries,
      });

      router.push(`/assessment/${saved.patient_id}`);
    } catch (e) {
      console.log('Patient: failed to save:', e);
    } finally {
      setIsSaving(false);
    }
  }, [name, age, gender, villageBlock, painMapEntries, router, t]);

  // ─── Render ──────────────────────────────────────────────────────

  const genderKeys: Record<string, string> = {
    Male: 'patient_gender_male',
    Female: 'patient_gender_female',
    Other: 'patient_gender_other',
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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
            keyboardShouldPersistTaps="handled"
          >
          {/* Top spacing for floating header */}
          <View style={{ height: 80 }} />

          {/* Demographics form */}
          <View style={styles.section}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('patient_name')} *</Text>
              <TextInput
                style={styles.input}
                placeholder={t('patient_name_placeholder')}
                placeholderTextColor="#94A3B8"
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.flex]}>
                <Text style={styles.label}>{t('patient_age')} *</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('patient_age_placeholder')}
                  placeholderTextColor="#94A3B8"
                  value={age}
                  onChangeText={setAge}
                  keyboardType="number-pad"
                  maxLength={3}
                />
              </View>

              <View style={[styles.inputGroup, { flex: 2 }]}>
                <Text style={styles.label}>{t('patient_gender')} *</Text>
                <View style={styles.genderRow}>
                  {GENDER_OPTIONS.map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[
                        styles.genderOption,
                        gender === g && styles.genderOptionActive,
                      ]}
                      onPress={() => setGender(g)}
                    >
                      <Text
                        style={[
                          styles.genderText,
                          gender === g && styles.genderTextActive,
                        ]}
                      >
                        {t(genderKeys[g])}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('patient_village_block')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('patient_village_placeholder')}
                placeholderTextColor="#94A3B8"
                value={villageBlock}
                onChangeText={setVillageBlock}
              />
            </View>
          </View>

          {/* Pain Map section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('patient_pain_map_title')}</Text>
            <Text style={styles.sectionSubtitle}>
              {t('patient_pain_map_instruction')}
            </Text>

            <BodyMap
              painEntries={painMapEntries}
              onRegionPress={handleRegionPress}
            />

            {/* Inline pain slider */}
            {activeRegion && (
              <PainSlider
                regionId={activeRegion}
                initialLevel={activeRegionEntry?.pain_level ?? 5}
                onConfirm={handlePainConfirm}
                onCancel={handlePainCancel}
                onRemove={handlePainRemove}
              />
            )}
          </View>
        </ScrollView>

        {/* Floating Glass Header */}
        <BlurView intensity={70} tint="light" style={styles.floatingHeader}>
          <SafeAreaView>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Text style={styles.backIcon}>←</Text>
              </TouchableOpacity>
              <Text style={styles.title}>
                {isNew ? t('patient_title_new') : t('patient_title_edit')}
              </Text>
              <View style={styles.backBtnPlaceholder} />
            </View>
          </SafeAreaView>
        </BlurView>

        {/* Bottom action button */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.proceedWrapper}
            onPress={handleSaveAndProceed}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#14B8A6', '#0D9488']}
              style={styles.proceedBtn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.proceedText}>
                    {t('patient_proceed_assessment')}
                  </Text>
                  <Text style={styles.proceedArrow}>→</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
          </View>
        </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  flex: {
    flex: 1,
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
    paddingBottom: 100,
  },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.4)',
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
  backBtnPlaceholder: {
    width: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 8,
  },
  genderOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  genderOptionActive: {
    backgroundColor: '#0D9488',
  },
  genderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  genderTextActive: {
    color: '#FFFFFF',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  proceedWrapper: {
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  proceedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  proceedText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  proceedArrow: {
    fontSize: 18,
    color: '#FFFFFF',
  },
});
