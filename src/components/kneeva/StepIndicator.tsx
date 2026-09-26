import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StepIndicatorProps {
  currentStep: number; // 1, 2, 3
  totalSteps?: number;
}

export default function StepIndicator({ currentStep, totalSteps = 3 }: StepIndicatorProps) {
  const steps = [
    { number: 1, label: 'Profile' },
    { number: 2, label: 'Clinical' },
    { number: 3, label: 'IMU Walk' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.stepsRow}>
        {steps.map((step, idx) => {
          const isActive = currentStep === step.number;
          const isDone = currentStep > step.number;

          return (
            <React.Fragment key={step.number}>
              <View style={styles.stepItem}>
                <View
                  style={[
                    styles.circle,
                    isActive && styles.circleActive,
                    isDone && styles.circleDone,
                  ]}
                >
                  <Text
                    style={[
                      styles.circleText,
                      isActive && styles.circleTextActive,
                      isDone && styles.circleTextDone,
                    ]}
                  >
                    {isDone ? '✓' : step.number}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.label,
                    isActive && styles.labelActive,
                    isDone && styles.labelDone,
                  ]}
                >
                  {step.label}
                </Text>
              </View>

              {idx < steps.length - 1 && (
                <View
                  style={[
                    styles.line,
                    currentStep > idx + 1 && styles.lineDone,
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepItem: {
    alignItems: 'center',
    minWidth: 64,
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  circleActive: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488',
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  circleDone: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  circleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  circleTextActive: {
    color: '#FFFFFF',
  },
  circleTextDone: {
    color: '#FFFFFF',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  labelActive: {
    color: '#0D9488',
    fontWeight: '700',
  },
  labelDone: {
    color: '#10B981',
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 8,
    marginBottom: 16,
  },
  lineDone: {
    backgroundColor: '#10B981',
  },
});
