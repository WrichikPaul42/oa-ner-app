package com.kneeva.triage.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Room Database Entity for Offline Triage Cache.
 * Enables ASHA healthcare workers to queue patient screenings in remote NER villages
 * without internet connectivity for subsequent batch sync.
 */
@Entity(tableName = "triage_cache")
data class TriageEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    val patientId: String,
    val abhaId: String? = null,

    // Serialized JSON of Tier A demographics & questionnaire
    val tierAJson: String,

    // Serialized JSON of Tier B extracted biomechanical features
    val tierBJson: String,

    // Sync State: "PENDING", "SYNCED", "FAILED"
    val syncStatus: String = "PENDING",

    val createdAtTimestamp: Long = System.currentTimeMillis(),
    val syncedAtTimestamp: Long? = null,
    val serverRiskScore: Float? = null,
    val serverRiskCategory: String? = null
)
