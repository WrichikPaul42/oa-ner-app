package com.kneeva.triage.ui.screen

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

data class GuidancePillar(
    val title: String,
    val iconEmoji: String,
    val summary: String,
    val actionableSteps: List<String>,
    val badgeColor: Color
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PreventiveGuidanceScreen(
    riskCategory: String = "Moderate",
    onBackPressed: () -> Unit = {}
) {
    val scrollState = rememberScrollState()

    val pillars = listOf(
        GuidancePillar(
            title = "1. Knee Extensor Isometric Strengthening",
            iconEmoji = "🦵",
            summary = "Targeted non-weight-bearing exercises that strengthen the quadriceps without wearing down knee cartilage.",
            actionableSteps = listOf(
                "Straight Leg Raise: Lie flat, tighten thigh muscle, and raise leg 30cm off the floor. Hold for 5 seconds. Repeat 10 times.",
                "Seated Knee Extension: While sitting on a wooden bench, straighten the knee fully and point toes upward. Hold 5 seconds.",
                "Avoid deep squatting (<90°) during pain flare-ups."
            ),
            badgeColor = Color(0xFF1976D2)
        ),
        GuidancePillar(
            title = "2. Mountain Load Distribution & Ergonomics",
            iconEmoji = "⛰️",
            summary = "Preventing excessive patellofemoral joint contact pressure on hilly North Eastern Region terrain.",
            actionableSteps = listOf(
                "Use a walking staff or bamboo hiking pole when descending steep slopes to offload 25% of body impact.",
                "Distribute carried water containers and firewood into two balanced side-baskets rather than a single heavy headload.",
                "Take smaller, measured steps when ascending inclines to maintain rhythmic cadence."
            ),
            badgeColor = Color(0xFFE65100)
        ),
        GuidancePillar(
            title = "3. Indigenous Anti-Inflammatory Nutrition",
            iconEmoji = "🥗",
            summary = "Accessible, culturally familiar nutrition to support synovial joint fluid health.",
            actionableSteps = listOf(
                "Consume local raw turmeric (haldi/haldi-pani) with black pepper to activate anti-inflammatory curcumin.",
                "Incorporate local moringa (drumstick leaves) and green leafy vegetables rich in calcium and magnesium.",
                "Stay well-hydrated throughout agricultural and manual labor days."
            ),
            badgeColor = Color(0xFF388E3C)
        ),
        GuidancePillar(
            title = "4. Referral & Follow-up Timeline",
            iconEmoji = "🏥",
            summary = "Primary health center clinical navigation for frontline ASHA workers.",
            actionableSteps = listOf(
                "Moderate Risk: Re-screen every 3 months at community health sub-center.",
                "High / Severe Risk: Escort patient to Block Primary Health Center for bilateral standing knee X-rays and medical consult.",
                "Issue knee support sleeve if joint instability or crepitus was detected."
            ),
            badgeColor = Color(0xFF7B1FA2)
        )
    )

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Preventive Joint Guidance", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    TextButton(onClick = onBackPressed) {
                        Text("← Back", color = MaterialTheme.colorScheme.onPrimaryContainer)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp)
                .verticalScroll(scrollState),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Offline Infographic Banner
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = MaterialTheme.colorScheme.secondaryContainer,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.primary),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("🛡️", fontSize = 24.sp)
                    }
                    Spacer(modifier = Modifier.width(14.dp))
                    Column {
                        Text(
                            text = "Offline Joint Care Infographics",
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp
                        )
                        Text(
                            text = "Pre-cached on device — No internet required in rural health camps.",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSecondaryContainer
                        )
                    }
                }
            }

            // Cards for each pillar
            pillars.forEach { pillar ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(text = pillar.iconEmoji, fontSize = 24.sp)
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(
                                text = pillar.title,
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp,
                                color = pillar.badgeColor
                            )
                        }

                        Text(
                            text = pillar.summary,
                            fontSize = 13.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        Divider()

                        pillar.actionableSteps.forEach { step ->
                            Row(modifier = Modifier.fillMaxWidth()) {
                                Text(
                                    text = "• ",
                                    color = pillar.badgeColor,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = step,
                                    fontSize = 13.sp,
                                    lineHeight = 18.sp
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
