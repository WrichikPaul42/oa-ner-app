package com.kneeva.triage.data.repository

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.math.abs
import kotlin.math.pow
import kotlin.math.sqrt
import kotlin.random.Random

enum class GaitTestType {
    FLAT_WALK,
    INCLINE_OR_STAIRS
}

data class RawSensorPacket(
    val timestampMs: Long,
    val ax: Float,
    val ay: Float,
    val az: Float,
    val gx: Float,
    val gy: Float,
    val gz: Float
)

data class GaitExtractedMetrics(
    val cadence: Float,
    val strideTimeCv: Float,
    val stepCount: Int,
    val stepTimeAsymmetry: Float,
    val gaitSpeedMs: Float
)

/**
 * Repository managing Bluetooth Low Energy (BLE) / IoT wearable sensor stream.
 * Implements edge peak detection and feature extraction on the device.
 */
class BleSensorRepository {

    private val PEAK_THRESHOLD = 13.2f // m/s^2 combined magnitude threshold
    private val MIN_PEAK_INTERVAL_MS = 320L // Refractory period (~185 max SPM)

    /**
     * Simulates capturing 50Hz raw IMU data from BLE wearable node over the test duration
     * and executes on-device peak detection to extract cadence & stride time CV.
     */
    suspend fun extractGaitMetrics(
        testType: GaitTestType,
        durationSeconds: Int = 60
    ): GaitExtractedMetrics = withContext(Dispatchers.Default) {
        val samples = generateSimulatedBleStream(testType, durationSeconds)
        return@withContext processRawStream(samples, durationSeconds, testType)
    }

    /**
     * Edge mathematical peak-detection algorithm on resultant acceleration magnitude.
     */
    private fun processRawStream(
        stream: List<RawSensorPacket>,
        durationSeconds: Int,
        testType: GaitTestType
    ): GaitExtractedMetrics {
        val peakTimestamps = mutableListOf<Long>()
        var lastPeakTime = 0L

        for (packet in stream) {
            // Compute Euclidean acceleration vector magnitude
            val magnitude = sqrt(packet.ax.pow(2) + packet.ay.pow(2) + packet.az.pow(2))

            if (magnitude > PEAK_THRESHOLD && (packet.timestampMs - lastPeakTime) > MIN_PEAK_INTERVAL_MS) {
                peakTimestamps.add(packet.timestampMs)
                lastPeakTime = packet.timestampMs
            }
        }

        // 1. Cadence calculation: (Total Steps / Minutes)
        val durationMinutes = durationSeconds / 60.0f
        val cadence = if (durationMinutes > 0) peakTimestamps.size / durationMinutes else 0f

        // 2. Step times (inter-heel-strike intervals)
        val stepTimes = mutableListOf<Float>()
        for (i in 1 until peakTimestamps.size) {
            val deltaSec = (peakTimestamps[i] - peakTimestamps[i - 1]) / 1000.0f
            if (deltaSec in 0.25f..2.5f) {
                stepTimes.add(deltaSec)
            }
        }

        // 3. Stride Time Coefficient of Variation (CV = StdDev / Mean)
        var strideCv = if (testType == GaitTestType.FLAT_WALK) 0.05f else 0.11f
        var asymmetry = 0.08f

        if (stepTimes.size >= 2) {
            val mean = stepTimes.average().toFloat()
            val variance = stepTimes.map { (it - mean).pow(2) }.sum() / (stepTimes.size - 1)
            val std = sqrt(variance)
            strideCv = if (mean > 0) std / mean else 0f

            // Asymmetry between even and odd steps (Left vs Right leg)
            val evenSteps = stepTimes.filterIndexed { index, _ -> index % 2 == 0 }
            val oddSteps = stepTimes.filterIndexed { index, _ -> index % 2 == 1 }
            if (evenSteps.isNotEmpty() && oddSteps.isNotEmpty() && mean > 0) {
                val meanEven = evenSteps.average().toFloat()
                val meanOdd = oddSteps.average().toFloat()
                asymmetry = abs(meanEven - meanOdd) / mean
            }
        }

        val speed = if (testType == GaitTestType.FLAT_WALK) {
            (cadence * 0.58f) / 60.0f
        } else {
            (cadence * 0.48f) / 60.0f
        }

        return GaitExtractedMetrics(
            cadence = (Math.round(cadence * 10f) / 10f),
            strideTimeCv = (Math.round(strideCv * 1000f) / 1000f),
            stepCount = peakTimestamps.size,
            stepTimeAsymmetry = (Math.round(asymmetry * 100f) / 100f),
            gaitSpeedMs = (Math.round(speed * 100f) / 100f)
        )
    }

    /**
     * Synthesizes 50Hz realistic gait motion stream with periodic heel impacts.
     */
    private fun generateSimulatedBleStream(
        testType: GaitTestType,
        durationSeconds: Int
    ): List<RawSensorPacket> {
        val packets = mutableListOf<RawSensorPacket>()
        val totalSamples = durationSeconds * 50 // 50 Hz
        val stepIntervalMs = if (testType == GaitTestType.FLAT_WALK) 640L else 780L
        var timeSinceLastStep = 0L

        var currentTime = System.currentTimeMillis()
        for (i in 0 until totalSamples) {
            currentTime += 20L
            timeSinceLastStep += 20L

            var az = 9.8f // Gravity baseline
            val ax = (Random.nextFloat() - 0.5f) * 1.2f
            val ay = (Random.nextFloat() - 0.5f) * 1.2f

            if (timeSinceLastStep >= stepIntervalMs) {
                // Heel strike impact impulse
                az += 6.5f + Random.nextFloat() * 3.5f
                timeSinceLastStep = 0L
            }

            packets.add(
                RawSensorPacket(
                    timestampMs = currentTime,
                    ax = ax,
                    ay = ay,
                    az = az,
                    gx = 0.1f,
                    gy = 0.2f,
                    gz = 0.0f
                )
            )
        }
        return packets
    }
}
