import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { FifteenMinuteAssessmentRoutine } from '@/components/assessment15/FifteenMinuteAssessmentRoutine';

export default function RoutineScreen() {
  const { patientId } = useLocalSearchParams<{ patientId?: string }>();

  return (
    <View style={styles.container}>
      <FifteenMinuteAssessmentRoutine patientId={patientId || 'PT-10045'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
});
