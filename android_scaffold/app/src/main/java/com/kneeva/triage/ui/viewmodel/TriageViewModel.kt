package com.kneeva.triage.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.kneeva.triage.data.model.TierAPatientData
import com.kneeva.triage.data.model.TierBBiomechanicalSensors
import com.kneeva.triage.data.model.TriageRequest
import com.kneeva.triage.data.model.TriageResponse
import com.kneeva.triage.data.network.KneevaApiService
import com.kneeva.triage.data.repository.BleSensorRepository
import com.kneeva.triage.data.repository.GaitExtractedMetrics
import com.kneeva.triage.data.repository.GaitTestType
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * 2-Part Clinical Test Stages as specified in system state machine.
 */
enum class ClinicalTestStage {
    IDLE,
    TEST_1_FLAT_RUNNING,
    TEST_1_COMPLETE,
    TEST_2_INCLINE_RUNNING,
    READY_TO_SUBMIT,
    SUBMITTING,
    SUCCESS,
    ERROR
}

data class TriageUiState(
    // State Machine
    val stage: ClinicalTestStage = ClinicalTestStage.IDLE,
    val secondsRemaining: Int = 60,

    // Patient Questionnaire Inputs
    val patientId: String = "pat_asha_001",
    val ageText: String = "58",
    val sex: String = "female",
    val heightCmText: String = "156.0",
    val weightKgText: String = "64.0",
    val dailyLoadKgText: String = "15.0",
    val activityLevel: Int = 3, // 1 to 4 scale
    val squattingDifficulty: Int = 3, // 0 to 4 scale

    // Extracted Biomechanical Features
    val flatMetrics: GaitExtractedMetrics? = null,
    val inclineMetrics: GaitExtractedMetrics? = null,

    // Backend Response & Error
    val response: TriageResponse? = null,
    val errorMessage: String? = null
)

class TriageViewModel(
    private val bleRepository: BleSensorRepository = BleSensorRepository(),
    private val apiService: KneevaApiService = KneevaApiService.create()
) : ViewModel() {

    private val _uiState = MutableStateFlow(TriageUiState())
    val uiState: StateFlow<TriageUiState> = _uiState.asStateFlow()

    private var timerJob: Job? = null

    // --- Input Update Functions ---
    fun onAgeChanged(value: String) = _uiState.update { it.copy(ageText = value) }
    fun onWeightChanged(value: String) = _uiState.update { it.copy(weightKgText = value) }
    fun onHeightChanged(value: String) = _uiState.update { it.copy(heightCmText = value) }
    fun onDailyLoadChanged(value: String) = _uiState.update { it.copy(dailyLoadKgText = value) }
    fun onActivityLevelChanged(value: Int) = _uiState.update { it.copy(activityLevel = value) }

    /**
     * Stage 1: Flat Ground Walk Test (60 Seconds)
     */
    fun startTest1FlatWalk() {
        if (_uiState.value.stage != ClinicalTestStage.IDLE && _uiState.value.stage != ClinicalTestStage.ERROR) return

        timerJob?.cancel()
        _uiState.update {
            it.copy(
                stage = ClinicalTestStage.TEST_1_FLAT_RUNNING,
                secondsRemaining = 60,
                errorMessage = null
            )
        }

        timerJob = viewModelScope.launch {
            for (sec in 60 downTo 1) {
                _uiState.update { it.copy(secondsRemaining = sec) }
                delay(1000L)
            }
            _uiState.update { it.copy(secondsRemaining = 0) }

            // Extract metrics from BLE raw stream
            val metrics = bleRepository.extractGaitMetrics(GaitTestType.FLAT_WALK, 60)
            _uiState.update {
                it.copy(
                    stage = ClinicalTestStage.TEST_1_COMPLETE,
                    flatMetrics = metrics
                )
            }
        }
    }

    /**
     * Stage 2: Incline / Stair Climbing Walk Test (60 Seconds)
     */
    fun startTest2InclineWalk() {
        if (_uiState.value.stage != ClinicalTestStage.TEST_1_COMPLETE) return

        timerJob?.cancel()
        _uiState.update {
            it.copy(
                stage = ClinicalTestStage.TEST_2_INCLINE_RUNNING,
                secondsRemaining = 60,
                errorMessage = null
            )
        }

        timerJob = viewModelScope.launch {
            for (sec in 60 downTo 1) {
                _uiState.update { it.copy(secondsRemaining = sec) }
                delay(1000L)
            }
            _uiState.update { it.copy(secondsRemaining = 0) }

            // Extract metrics from BLE raw stream
            val metrics = bleRepository.extractGaitMetrics(GaitTestType.INCLINE_OR_STAIRS, 60)
            _uiState.update {
                it.copy(
                    stage = ClinicalTestStage.READY_TO_SUBMIT,
                    inclineMetrics = metrics
                )
            }
        }
    }

    /**
     * Submits the fused questionnaire + extracted sensor features to POST /triage/
     */
    fun submitTriageAssessment() {
        if (_uiState.value.stage != ClinicalTestStage.READY_TO_SUBMIT) return

        val state = _uiState.value
        val age = state.ageText.toIntOrNull() ?: 50
        val weight = state.weightKgText.toFloatOrNull() ?: 60.0f
        val height = state.heightCmText.toFloatOrNull() ?: 155.0f
        val dailyLoad = state.dailyLoadKgText.toFloatOrNull() ?: 0.0f

        val tierA = TierAPatientData(
            age = age,
            sex = state.sex,
            heightCm = height,
            weightKg = weight,
            dailyLoadKg = dailyLoad,
            dailyInclineHours = 2.0f,
            squattingDifficulty = state.squattingDifficulty,
            previousInjury = 0,
            activityLevel = state.activityLevel
        )

        val tierB = TierBBiomechanicalSensors(
            flatGaitCadence = state.flatMetrics?.cadence,
            flatGaitStrideTimeCv = state.flatMetrics?.strideTimeCv,
            climbingCadence = state.inclineMetrics?.cadence,
            climbingStrideTimeCv = state.inclineMetrics?.strideTimeCv,
            gaitStepTimeAsymmetry = state.flatMetrics?.stepTimeAsymmetry,
            gaitSpeedMs = state.flatMetrics?.gaitSpeedMs
        )

        val request = TriageRequest(
            patientId = state.patientId,
            tierA = tierA,
            tierB = tierB
        )

        _uiState.update { it.copy(stage = ClinicalTestStage.SUBMITTING, errorMessage = null) }

        viewModelScope.launch {
            try {
                val apiResponse = apiService.submitTriage(request)
                if (apiResponse.isSuccessful && apiResponse.body() != null) {
                    _uiState.update {
                        it.copy(
                            stage = ClinicalTestStage.SUCCESS,
                            response = apiResponse.body()
                        )
                    }
                } else {
                    _uiState.update {
                        it.copy(
                            stage = ClinicalTestStage.ERROR,
                            errorMessage = "API Error ${apiResponse.code()}: ${apiResponse.message()}"
                        )
                    }
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        stage = ClinicalTestStage.ERROR,
                        errorMessage = "Network connection failed: ${e.localizedMessage ?: "Unknown error"}"
                    )
                }
            }
        }
    }

    fun resetState() {
        timerJob?.cancel()
        _uiState.update {
            TriageUiState(patientId = "pat_asha_${System.currentTimeMillis() % 10000}")
        }
    }

    override fun onCleared() {
        super.onCleared()
        timerJob?.cancel()
    }
}
