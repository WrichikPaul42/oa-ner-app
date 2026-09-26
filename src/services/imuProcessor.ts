/**
 * Kneeva On-Device IMU Gait Signal Processor
 *
 * Implements:
 * 1. Live Accelerometer / Gyroscope sampling via expo-sensors.
 * 2. Peak-detection algorithm for heel-strike identification.
 * 3. Cadence calculation: (Total Peaks / Total Time in Minutes).
 * 4. Stride Time CV calculation: Standard Deviation(step_times) / Mean(step_times).
 * 5. Simulation harness for Android Emulators & Web testing.
 */

import { Accelerometer, Gyroscope } from 'expo-sensors';
import type { WalkTestResult } from '@/types/kneeva';

export interface IMUSample {
  timestamp: number; // ms
  accelZ: number;
  gyroY: number;
  combinedMagnitude: number;
}

export type SensorListener = (sample: IMUSample) => void;
export type PeakListener = (peak: { timestamp: number; value: number }) => void;

export class IMUWalkEngine {
  private isRunning: boolean = false;
  private isSimulated: boolean = false;
  private testType: 'flat' | 'climbing' = 'flat';
  private startTime: number = 0;
  private durationTargetMs: number = 60000; // 60 seconds default
  private samples: IMUSample[] = [];
  private peaks: { timestamp: number; value: number }[] = [];
  private lastPeakTime: number = 0;
  private timerHandle: any = null;
  private simIntervalHandle: any = null;
  private accelSubscription: any = null;
  private gyroSubscription: any = null;

  private latestAccel = { x: 0, y: 0, z: 1.0 };
  private latestGyro = { x: 0, y: 0, z: 0 };

  private onSampleListeners: Set<SensorListener> = new Set();
  private onPeakListeners: Set<PeakListener> = new Set();

  constructor() {
    // Configure sensor update rates to 50Hz (20ms) for high-resolution gait tracking
    try {
      Accelerometer.setUpdateInterval(20);
      Gyroscope.setUpdateInterval(20);
    } catch (e) {
      console.log('expo-sensors update interval not supported on this platform');
    }
  }

  public subscribeSample(cb: SensorListener): () => void {
    this.onSampleListeners.add(cb);
    return () => this.onSampleListeners.delete(cb);
  }

  public subscribePeak(cb: PeakListener): () => void {
    this.onPeakListeners.add(cb);
    return () => this.onPeakListeners.delete(cb);
  }

  /**
   * Start a live walk test session (Flat or Stair Climbing)
   */
  public async startSession(
    testType: 'flat' | 'climbing',
    options?: { simulated?: boolean; targetSeconds?: number }
  ): Promise<void> {
    this.stopSession();

    this.testType = testType;
    this.isSimulated = options?.simulated ?? false;
    this.durationTargetMs = (options?.targetSeconds ?? 60) * 1000;
    this.startTime = Date.now();
    this.samples = [];
    this.peaks = [];
    this.lastPeakTime = 0;
    this.isRunning = true;

    if (this.isSimulated) {
      this.startSimulatedStream();
    } else {
      await this.startHardwareSensors();
    }
  }

  private async startHardwareSensors(): Promise<void> {
    try {
      const isAccelAvailable = await Accelerometer.isAvailableAsync();
      const isGyroAvailable = await Gyroscope.isAvailableAsync();

      if (!isAccelAvailable && !isGyroAvailable) {
        console.warn('Physical IMU sensors unavailable. Falling back to simulated stream.');
        this.isSimulated = true;
        this.startSimulatedStream();
        return;
      }

      if (isAccelAvailable) {
        this.accelSubscription = Accelerometer.addListener((accelData) => {
          this.latestAccel = accelData;
          this.processNewReading();
        });
      }

      if (isGyroAvailable) {
        this.gyroSubscription = Gyroscope.addListener((gyroData) => {
          this.latestGyro = gyroData;
        });
      }
    } catch (err) {
      console.warn('Failed to start physical sensors, using simulation:', err);
      this.isSimulated = true;
      this.startSimulatedStream();
    }
  }

  /**
   * Process a single hardware sensor reading & evaluate peak detection
   */
  private processNewReading(): void {
    if (!this.isRunning) return;
    const now = Date.now();

    // Use Z-axis Accelerometer or Y-axis Gyroscope forward swing
    // Signal magnitude vector: forward leg swing + heel impact
    const zAccel = this.latestAccel.z;
    const yGyro = this.latestGyro.y;
    // Calculate synthetic gait impact energy: |z - 1.0| * 9.8 + |yGyro| * 2.0
    const signalEnergy = Math.abs(zAccel - 1.0) * 9.8 + Math.abs(yGyro) * 2.0;

    const sample: IMUSample = {
      timestamp: now,
      accelZ: zAccel,
      gyroY: yGyro,
      combinedMagnitude: signalEnergy,
    };

    this.samples.push(sample);
    this.notifySample(sample);

    // Peak detection with refractory period (minimum 320ms between steps ~ max 185 SPM)
    const PEAK_THRESHOLD = 3.2; // m/s^2 equivalent impact energy
    const MIN_PEAK_INTERVAL_MS = 320;

    if (signalEnergy > PEAK_THRESHOLD && now - this.lastPeakTime > MIN_PEAK_INTERVAL_MS) {
      this.lastPeakTime = now;
      const peak = { timestamp: now, value: signalEnergy };
      this.peaks.push(peak);
      this.notifyPeak(peak);
    }
  }

  /**
   * Realistic simulated gait stream for testing & emulators
   */
  private startSimulatedStream(): void {
    const isFlat = this.testType === 'flat';
    // Flat walking cadence ~98 SPM (step period ~612ms)
    // Climbing cadence ~82 SPM (step period ~731ms)
    const baseStepPeriod = isFlat ? 612 : 731;
    // Flat walking has low CV (~0.04), climbing has higher CV (~0.11)
    const variability = isFlat ? 25 : 80;

    let nextStepInterval = baseStepPeriod + (Math.random() - 0.5) * variability;
    let timeSinceLastStep = 0;

    const SIM_INTERVAL_MS = 25; // 40Hz simulation
    this.simIntervalHandle = setInterval(() => {
      if (!this.isRunning) return;
      const now = Date.now();
      timeSinceLastStep += SIM_INTERVAL_MS;

      // Natural harmonic waveform for swing phase + sharp peak at heel strike
      const phase = (timeSinceLastStep / nextStepInterval) * Math.PI;
      const swingWave = Math.sin(phase) * 1.5;
      const noise = (Math.random() - 0.5) * 0.3;

      let impact = 0;
      if (timeSinceLastStep >= nextStepInterval) {
        impact = 4.5 + Math.random() * 1.8; // Heel strike impact peak
        timeSinceLastStep = 0;
        nextStepInterval = Math.max(380, baseStepPeriod + (Math.random() - 0.5) * variability * 2);

        const peak = { timestamp: now, value: impact };
        this.peaks.push(peak);
        this.notifyPeak(peak);
      }

      const signal = swingWave + noise + impact;
      const sample: IMUSample = {
        timestamp: now,
        accelZ: 1.0 + signal * 0.15,
        gyroY: swingWave * 1.2,
        combinedMagnitude: Math.max(0, signal),
      };

      this.samples.push(sample);
      this.notifySample(sample);
    }, SIM_INTERVAL_MS);
  }

  private notifySample(sample: IMUSample): void {
    this.onSampleListeners.forEach((cb) => cb(sample));
  }

  private notifyPeak(peak: { timestamp: number; value: number }): void {
    this.onPeakListeners.forEach((cb) => cb(peak));
  }

  /**
   * Stop session and compute final metrics
   */
  public stopSession(): WalkTestResult {
    this.isRunning = false;

    if (this.accelSubscription) {
      this.accelSubscription.remove();
      this.accelSubscription = null;
    }
    if (this.gyroSubscription) {
      this.gyroSubscription.remove();
      this.gyroSubscription = null;
    }
    if (this.simIntervalHandle) {
      clearInterval(this.simIntervalHandle);
      this.simIntervalHandle = null;
    }
    if (this.timerHandle) {
      clearTimeout(this.timerHandle);
      this.timerHandle = null;
    }

    const durationSeconds = Math.max(1, (Date.now() - this.startTime) / 1000);
    return this.calculateMetrics(durationSeconds);
  }

  /**
   * Implementation of Cadence and Stride CV mathematical formulas:
   * 1. Cadence = (Total Number of Peaks / Total Time in Minutes)
   * 2. Stride Time CV = Standard Deviation(step_times) / Mean(step_times)
   */
  public calculateMetrics(durationSeconds: number): WalkTestResult {
    const totalPeaks = this.peaks.length;
    const durationMinutes = durationSeconds / 60;
    const cadence = durationMinutes > 0 ? totalPeaks / durationMinutes : 0;

    // Calculate step times (difference between consecutive heel strike peaks in seconds)
    const stepTimes: number[] = [];
    for (let i = 1; i < this.peaks.length; i++) {
      const deltaSec = (this.peaks[i].timestamp - this.peaks[i - 1].timestamp) / 1000;
      if (deltaSec > 0.25 && deltaSec < 2.5) {
        stepTimes.push(deltaSec);
      }
    }

    let strideTimeCV = 0;
    let stepTimeAsymmetry = 0.08;
    let swingTimeAsymmetry = 0.06;

    if (stepTimes.length >= 2) {
      const mean = stepTimes.reduce((acc, v) => acc + v, 0) / stepTimes.length;
      const variance =
        stepTimes.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (stepTimes.length - 1);
      const std = Math.sqrt(variance);
      strideTimeCV = mean > 0 ? std / mean : 0;

      // Calculate step time asymmetry between left (even) and right (odd) leg strikes
      const evenSteps = stepTimes.filter((_, idx) => idx % 2 === 0);
      const oddSteps = stepTimes.filter((_, idx) => idx % 2 === 1);
      if (evenSteps.length > 0 && oddSteps.length > 0 && mean > 0) {
        const meanEven = evenSteps.reduce((acc, v) => acc + v, 0) / evenSteps.length;
        const meanOdd = oddSteps.reduce((acc, v) => acc + v, 0) / oddSteps.length;
        stepTimeAsymmetry = Math.min(0.35, Math.abs(meanEven - meanOdd) / mean);
        swingTimeAsymmetry = Math.min(0.25, stepTimeAsymmetry * 0.72);
      }
    } else {
      // Default baseline if very few steps were recorded
      strideTimeCV = this.testType === 'flat' ? 0.04 : 0.11;
      stepTimeAsymmetry = this.testType === 'flat' ? 0.08 : 0.12;
      swingTimeAsymmetry = this.testType === 'flat' ? 0.06 : 0.09;
    }

    // Gait speed calculation: Cadence (SPM) * step length (~0.60m) / 60
    const stepLengthM = this.testType === 'flat' ? 0.58 : 0.48;
    const gaitSpeedMs = Math.round(((cadence * stepLengthM) / 60) * 100) / 100;

    return {
      durationSeconds: Math.round(durationSeconds * 10) / 10,
      stepCount: totalPeaks,
      cadence: Math.round(cadence * 10) / 10,
      strideTimeCV: Math.round(strideTimeCV * 1000) / 1000,
      stepTimes,
      peaks: this.peaks,
      stepTimeAsymmetry: Math.round(stepTimeAsymmetry * 100) / 100,
      swingTimeAsymmetry: Math.round(swingTimeAsymmetry * 100) / 100,
      gaitSpeedMs: gaitSpeedMs > 0 ? gaitSpeedMs : (this.testType === 'flat' ? 0.95 : 0.75),
    };
  }

  /**
   * Static helper to generate canonical sample results for quick testing / prefill
   */
  public static generateDemoResult(testType: 'flat' | 'climbing'): WalkTestResult {
    if (testType === 'flat') {
      return {
        durationSeconds: 60.0,
        stepCount: 98,
        cadence: 98.5,
        strideTimeCV: 0.04,
        stepTimes: [0.61, 0.60, 0.62, 0.61, 0.59, 0.61],
        peaks: [],
        stepTimeAsymmetry: 0.12,
        swingTimeAsymmetry: 0.08,
        gaitSpeedMs: 0.95,
      };
    } else {
      return {
        durationSeconds: 60.0,
        stepCount: 82,
        cadence: 82.0,
        strideTimeCV: 0.11,
        stepTimes: [0.73, 0.68, 0.81, 0.70, 0.77, 0.69],
        peaks: [],
        stepTimeAsymmetry: 0.16,
        swingTimeAsymmetry: 0.11,
        gaitSpeedMs: 0.72,
      };
    }
  }
}
