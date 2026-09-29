/**
 * 15-Minute Routine Header & Master Timer
 * Supports two view modes:
 *  - Full Mode: 15:00 session elapsed clock, progress bar, pill carousel, and step description card.
 *  - Compact Mode (when slided up): Session clock and bulky elements disappear so entire graphs are visible,
 *    leaving only the countdown timer for the current step and quick actions!
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { ASSESSMENT_15_STEPS, StepExecutionLog } from '@/types/assessment15';

interface RoutineHeaderProps {
  currentStepIndex: number; // 0 - 8
  stepTimeRemainingSeconds: number;
  totalSessionElapsedSeconds: number; // 0 - 900
  isRunning: boolean;
  isHardwareStreaming?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onToggleTimer: () => void;
  onNextEarly: () => void;
  onSkipCurrentStep: () => void;
  onSelectStepIndex: (index: number) => void;
  logs: StepExecutionLog[];
}

export function RoutineHeader({
  currentStepIndex,
  stepTimeRemainingSeconds,
  totalSessionElapsedSeconds,
  isRunning,
  isHardwareStreaming = false,
  isCollapsed = false,
  onToggleCollapse,
  onToggleTimer,
  onNextEarly,
  onSkipCurrentStep,
  onSelectStepIndex,
  logs,
}: RoutineHeaderProps) {
  const currentStep = ASSESSMENT_15_STEPS[currentStepIndex];

  const formatMinSec = (sec: number) => {
    const m = Math.floor(Math.max(0, sec) / 60);
    const s = Math.floor(Math.max(0, sec) % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const totalProgressPct = Math.min(100, Math.round((totalSessionElapsedSeconds / 900) * 100));

  // ─────────────────────────────────────────────────────────────
  // 1. Compact Header (When Slided Up / Scrolled)
  // Only shows: Step Number + Time Remaining Countdown + Quick Actions
  // ─────────────────────────────────────────────────────────────
  if (isCollapsed) {
    return (
      <View style={styles.compactHeaderContainer}>
        {/* Step Identifier */}
        <View style={styles.compactLeft}>
          <View style={styles.compactStepBadge}>
            <Text style={styles.compactStepBadgeText}>
              {isHardwareStreaming ? '⚡ HW LIVE • ' : ''}STEP {currentStep.stepNumber}/9
            </Text>
          </View>
          <Text style={styles.compactStepTitle} numberOfLines={1}>
            {currentStep.shortName}
          </Text>
        </View>

        {/* TIME REMAINING COUNTDOWN (Prominent & Focused) */}
        <View style={styles.compactCountdownBox}>
          <Text style={styles.compactCountdownLabel}>TIME REMAINING</Text>
          <Text
            style={[
              styles.compactCountdownVal,
              stepTimeRemainingSeconds <= 10 && styles.warningTime,
            ]}
          >
            ⏱️ {formatMinSec(stepTimeRemainingSeconds)}
          </Text>
        </View>

        {/* Compact Controls */}
        <View style={styles.compactActions}>
          <TouchableOpacity
            style={styles.compactSkipBtn}
            onPress={onSkipCurrentStep}
            activeOpacity={0.7}
          >
            <Text style={styles.compactSkipText}>Skip</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.compactNextBtn}
            onPress={onNextEarly}
            activeOpacity={0.7}
          >
            <Text style={styles.compactNextText}>
              {currentStepIndex === 8 ? 'Report' : 'Next →'}
            </Text>
          </TouchableOpacity>

          {onToggleCollapse && (
            <TouchableOpacity
              style={styles.expandChevronBtn}
              onPress={onToggleCollapse}
              activeOpacity={0.7}
            >
              <Text style={styles.expandChevronText}>▼</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. Full Header (Default expanded state)
  // ─────────────────────────────────────────────────────────────
  return (
    <View style={styles.headerContainer}>
      {/* Global Session Clock & Progress Bar */}
      <View style={styles.topSessionRow}>
        <View>
          <Text style={styles.sessionClockLabel}>SESSION CLOCK (SHARED 15:00 BUDGET)</Text>
          <View style={styles.timeBadgeRow}>
            <Text style={styles.sessionClockTime}>
              {formatMinSec(totalSessionElapsedSeconds)} <Text style={styles.dimText}>/ 15:00</Text>
            </Text>
            <View style={[styles.statusBadge, isRunning ? styles.runningBadge : styles.pausedBadge]}>
              <View style={[styles.statusDot, isRunning ? styles.runningDot : styles.pausedDot]} />
              <Text style={styles.statusBadgeText}>
                {isHardwareStreaming ? '🟢 DUAL ESP32 LIVE' : isRunning ? 'LIVE RECORDING' : 'PAUSED'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.topRightControls}>
          <TouchableOpacity style={styles.timerControlBtn} onPress={onToggleTimer} activeOpacity={0.7}>
            <Text style={styles.timerControlBtnText}>{isRunning ? '⏸ Pause' : '▶ Resume'}</Text>
          </TouchableOpacity>

          {onToggleCollapse && (
            <TouchableOpacity
              style={styles.collapseToggleBtn}
              onPress={onToggleCollapse}
              activeOpacity={0.7}
            >
              <Text style={styles.collapseToggleText}>▲ Slide Up</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Progress Line */}
      <View style={styles.progressBarTrack}>
        <View style={[styles.progressBarFill, { width: `${totalProgressPct}%` }]} />
      </View>

      {/* Step Navigator Carousel with Jump Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stepPillsContainer}
      >
        {ASSESSMENT_15_STEPS.map((s, idx) => {
          const isActive = idx === currentStepIndex;
          const log = logs.find((l) => l.stepNumber === s.stepNumber);
          const isDone = log?.status === 'completed';
          const isSkipped = log?.status === 'skipped';

          return (
            <TouchableOpacity
              key={s.id}
              style={[
                styles.stepPill,
                isActive && styles.stepPillActive,
                isDone && styles.stepPillDone,
                isSkipped && styles.stepPillSkipped,
              ]}
              onPress={() => onSelectStepIndex(idx)}
              activeOpacity={0.7}
            >
              <Text style={[styles.stepPillNum, isActive && styles.stepPillTextActive]}>
                {s.stepNumber}
              </Text>
              <Text style={[styles.stepPillName, isActive && styles.stepPillTextActive]} numberOfLines={1}>
                {s.shortName}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Current Step Budget Card */}
      <View style={styles.currentStepCard}>
        <View style={styles.stepInfoLeft}>
          <Text style={styles.stepTag}>
            STEP {currentStep.stepNumber} OF 9 • PLANNED: {currentStep.plannedStart} → {currentStep.plannedEnd}
          </Text>
          <Text style={styles.stepTitle}>{currentStep.name}</Text>
          <Text style={styles.stepPurpose}>{currentStep.purpose}</Text>
        </View>

        <View style={styles.countdownBox}>
          <Text style={styles.countdownLabel}>TIME REMAINING</Text>
          <Text style={[styles.countdownNumber, stepTimeRemainingSeconds <= 10 && styles.warningTime]}>
            {formatMinSec(stepTimeRemainingSeconds)}
          </Text>
          <Text style={styles.budgetRef}>budget: {formatMinSec(currentStep.durationSeconds)}</Text>
        </View>
      </View>

      {/* Action Buttons (Skip & Next) */}
      <View style={styles.actionButtonsRow}>
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={onSkipCurrentStep}
          activeOpacity={0.75}
        >
          <Text style={styles.skipBtnText}>⏭ Skip Step (Use Prototype Data)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.nextEarlyBtn}
          onPress={onNextEarly}
          activeOpacity={0.75}
        >
          <Text style={styles.nextEarlyBtnText}>
            {currentStepIndex === 8 ? '🏁 View Final 15m Report' : 'Complete Step Early →'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: '#0F172A',
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 14,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  // ─── Compact Header Styles ───────────────────────────────────────────
  compactHeaderContainer: {
    backgroundColor: '#0F172A',
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: '#0D9488',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  compactLeft: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactStepBadge: {
    backgroundColor: '#1E293B',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  compactStepBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#38BDF8',
  },
  compactStepTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC',
    flex: 1,
  },
  compactCountdownBox: {
    backgroundColor: '#1E293B',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0D9488',
    marginHorizontal: 6,
  },
  compactCountdownLabel: {
    fontSize: 7,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.4,
  },
  compactCountdownVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#10B981',
    fontVariant: ['tabular-nums'],
  },
  compactActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  compactExitBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  compactExitText: {
    color: '#F87171',
    fontSize: 10,
    fontWeight: '700',
  },
  compactSkipBtn: {
    backgroundColor: '#334155',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  compactSkipText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '600',
  },
  compactNextBtn: {
    backgroundColor: '#0D9488',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 6,
  },
  compactNextText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  expandChevronBtn: {
    backgroundColor: '#1E293B',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#475569',
  },
  expandChevronText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  // ─── Full Header Styles ──────────────────────────────────────────────
  topSessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  topRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sessionClockLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  timeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 10,
  },
  sessionClockTime: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
    fontVariant: ['tabular-nums'],
  },
  dimText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  runningBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  pausedBadge: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  runningDot: {
    backgroundColor: '#10B981',
  },
  pausedDot: {
    backgroundColor: '#FBBF24',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  exitRoutineBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  exitRoutineBtnText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '700',
  },
  timerControlBtn: {
    backgroundColor: '#1E293B',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  timerControlBtnText: {
    color: '#F1F5F9',
    fontSize: 11,
    fontWeight: '600',
  },
  collapseToggleBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0284C7',
  },
  collapseToggleText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: '#1E293B',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#0D9488',
  },
  stepPillsContainer: {
    gap: 6,
    paddingBottom: 8,
  },
  stepPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  stepPillActive: {
    backgroundColor: '#0D9488',
    borderColor: '#14B8A6',
  },
  stepPillDone: {
    borderColor: '#10B981',
  },
  stepPillSkipped: {
    opacity: 0.65,
  },
  stepPillNum: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    marginRight: 5,
  },
  stepPillName: {
    fontSize: 11,
    color: '#CBD5E1',
    fontWeight: '500',
  },
  stepPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  currentStepCard: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  stepInfoLeft: {
    flex: 1,
    paddingRight: 10,
  },
  stepTag: {
    fontSize: 9,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  stepPurpose: {
    fontSize: 11,
    color: '#94A3B8',
  },
  countdownBox: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    minWidth: 92,
  },
  countdownLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#94A3B8',
  },
  countdownNumber: {
    fontSize: 19,
    fontWeight: '800',
    color: '#10B981',
    fontVariant: ['tabular-nums'],
    marginVertical: 1,
  },
  warningTime: {
    color: '#F43F5E',
  },
  budgetRef: {
    fontSize: 9,
    color: '#64748B',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  skipBtn: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtnText: {
    color: '#F1F5F9',
    fontSize: 11,
    fontWeight: '600',
  },
  nextEarlyBtn: {
    flex: 1.2,
    backgroundColor: '#0D9488',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextEarlyBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
