package com.kneeva.triage.ui.screen

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.kneeva.triage.data.model.TriageResponse
import com.kneeva.triage.ui.viewmodel.ClinicalTestStage
import com.kneeva.triage.ui.viewmodel.TriageUiState
import com.kneeva.triage.ui.viewmodel.TriageViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TriageScreen(
    viewModel: TriageViewModel = viewModel(),
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    val scrollState = rememberScrollState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Kneeva OA-NER Triage", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp)
                .verticalScroll(scrollState),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // 1. Patient Demographics & Questionnaire Card
            PatientQuestionnaireCard(uiState = uiState, viewModel = viewModel)

            // 2. 2-Part Clinical Test State Controller Card
            ClinicalTestControllerCard(uiState = uiState, viewModel = viewModel)

            // 3. Error Banner (if any)
            uiState.errorMessage?.let { errorText ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)
                ) {
                    Text(
                        text = errorText,
                        color = MaterialTheme.colorScheme.onErrorContainer,
                        modifier = Modifier.padding(12.dp),
                        fontSize = 14.sp
                    )
                }
            }

            // 4. Clinical Triage Results Card (on SUCCESS)
            uiState.response?.let { result ->
                TriageResultCard(result = result, onReset = { viewModel.resetState() })
            }
        }
    }
}

@Composable
fun PatientQuestionnaireCard(
    uiState: TriageUiState,
    viewModel: TriageViewModel
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text(
                text = "1. Patient Questionnaire (Tier A)",
                fontWeight = FontWeight.SemiBold,
                fontSize = 18.sp,
                color = MaterialTheme.colorScheme.primary
            )

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = uiState.ageText,
                    onValueChange = { viewModel.onAgeChanged(it) },
                    label = { Text("Age (yrs)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.weight(1f)
                )
                OutlinedTextField(
                    value = uiState.weightKgText,
                    onValueChange = { viewModel.onWeightChanged(it) },
                    label = { Text("Weight (kg)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.weight(1f)
                )
            }

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = uiState.heightCmText,
                    onValueChange = { viewModel.onHeightChanged(it) },
                    label = { Text("Height (cm)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.weight(1f)
                )
                OutlinedTextField(
                    value = uiState.dailyLoadKgText,
                    onValueChange = { viewModel.onDailyLoadChanged(it) },
                    label = { Text("Daily Load (kg)") },
                    supportingText = { Text("Carried head/water load") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.weight(1f)
                )
            }

            Text(
                text = "Physical Activity Level (1=Sedentary to 4=Heavy Labor): ${uiState.activityLevel}",
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium
            )
            Slider(
                value = uiState.activityLevel.toFloat(),
                onValueChange = { viewModel.onActivityLevelChanged(it.toInt()) },
                valueRange = 1f..4f,
                steps = 2
            )
        }
    }
}

@Composable
fun ClinicalTestControllerCard(
    uiState: TriageUiState,
    viewModel: TriageViewModel
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "2. Two-Part Clinical Biomechanics Test",
                fontWeight = FontWeight.SemiBold,
                fontSize = 18.sp,
                color = MaterialTheme.colorScheme.primary
            )

            // Current State Indicator Badge
            StatusStageBadge(stage = uiState.stage, secondsRemaining = uiState.secondsRemaining)

            // Button: Test 1 Flat Walk
            Button(
                onClick = { viewModel.startTest1FlatWalk() },
                modifier = Modifier.fillMaxWidth(),
                enabled = uiState.stage == ClinicalTestStage.IDLE || uiState.stage == ClinicalTestStage.ERROR
            ) {
                Text(
                    text = if (uiState.stage == ClinicalTestStage.TEST_1_FLAT_RUNNING)
                        "Test 1 in Progress (${uiState.secondsRemaining}s)..."
                    else "Start Test 1: Flat Walk (60s)"
                )
            }

            // Test 1 Extracted Metrics Summary
            uiState.flatMetrics?.let { metrics ->
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "✔ Flat Walk Complete: Cadence = ${metrics.cadence} SPM | Stride CV = ${metrics.strideTimeCv}",
                        modifier = Modifier.padding(8.dp),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }

            // Button: Test 2 Incline Walk
            Button(
                onClick = { viewModel.startTest2InclineWalk() },
                modifier = Modifier.fillMaxWidth(),
                enabled = uiState.stage == ClinicalTestStage.TEST_1_COMPLETE
            ) {
                Text(
                    text = if (uiState.stage == ClinicalTestStage.TEST_2_INCLINE_RUNNING)
                        "Test 2 in Progress (${uiState.secondsRemaining}s)..."
                    else "Start Test 2: Incline/Stairs (60s)"
                )
            }

            // Test 2 Extracted Metrics Summary
            uiState.inclineMetrics?.let { metrics ->
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "✔ Incline Walk Complete: Cadence = ${metrics.cadence} SPM | Stride CV = ${metrics.strideTimeCv}",
                        modifier = Modifier.padding(8.dp),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }

            // Submit Button
            Button(
                onClick = { viewModel.submitTriageAssessment() },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.secondary
                ),
                enabled = uiState.stage == ClinicalTestStage.READY_TO_SUBMIT
            ) {
                if (uiState.stage == ClinicalTestStage.SUBMITTING) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = MaterialTheme.colorScheme.onSecondary,
                        strokeWidth = 2.dp
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Executing Multimodal Fusion...")
                } else {
                    Text("Submit Triage Assessment to Backend")
                }
            }
        }
    }
}

@Composable
fun StatusStageBadge(stage: ClinicalTestStage, secondsRemaining: Int) {
    val (label, bgColor) = when (stage) {
        ClinicalTestStage.IDLE -> "State: Ready for Test 1" to Color(0xFF607D8B)
        ClinicalTestStage.TEST_1_FLAT_RUNNING -> "⏱️ Flat Walk Sampling: ${secondsRemaining}s left" to Color(0xFF1976D2)
        ClinicalTestStage.TEST_1_COMPLETE -> "✔ Test 1 Finished. Ready for Test 2." to Color(0xFF388E3C)
        ClinicalTestStage.TEST_2_INCLINE_RUNNING -> "⏱️ Incline Walk Sampling: ${secondsRemaining}s left" to Color(0xFF00796B)
        ClinicalTestStage.READY_TO_SUBMIT -> "★ Both Tests Complete — Ready to Submit" to Color(0xFFE65100)
        ClinicalTestStage.SUBMITTING -> "⏳ Sending payload to FastAPI server..." to Color(0xFF7B1FA2)
        ClinicalTestStage.SUCCESS -> "✔ Triage Assessment Evaluated Successfully" to Color(0xFF2E7D32)
        ClinicalTestStage.ERROR -> "⚠ Evaluation Error" to Color(0xFFC62828)
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(bgColor, shape = RoundedCornerShape(6.dp))
            .padding(vertical = 8.dp, horizontal = 12.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(text = label, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
    }
}

@Composable
fun TriageResultCard(result: TriageResponse, onReset: () -> Unit) {
    val tierColor = when (result.riskCategory) {
        "Low" -> Color(0xFF2E7D32)
        "Moderate" -> Color(0xFFF57C00)
        "High" -> Color(0xFFD32F2F)
        else -> Color(0xFFB71C1C)
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Screening Outcome", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = tierColor
                ) {
                    Text(
                        text = "${result.riskCategory} Risk (${result.riskScore.toInt()}/100)",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        fontSize = 13.sp
                    )
                }
            }

            Divider()

            Text(
                text = "Effective Contextual BMI: ${result.tierC.effectiveBmi} kg/m² " +
                        "(Standard: ${result.tierC.standardBmi} kg/m² | WHO Category: ${result.tierC.whoAsianBmiCategory})",
                fontWeight = FontWeight.Medium,
                fontSize = 13.sp
            )

            Text("Clinical Rationale (SHAP):", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Text(result.clinicalExplanation, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)

            Text("Key Driving Biomarkers:", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            result.primaryDrivers.forEach { driver ->
                Text("• $driver", fontSize = 12.sp)
            }

            Text("Actionable Recommendations:", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            result.recommendations.forEach { rec ->
                Text("→ $rec", fontSize = 12.sp, color = MaterialTheme.colorScheme.primary)
            }

            Spacer(modifier = Modifier.height(6.dp))

            OutlinedButton(
                onClick = onReset,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Start Next Patient Assessment")
            }
        }
    }
}
