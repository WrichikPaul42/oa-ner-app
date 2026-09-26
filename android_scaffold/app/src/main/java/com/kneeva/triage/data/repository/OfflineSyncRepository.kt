package com.kneeva.triage.data.repository

import com.google.gson.Gson
import com.kneeva.triage.data.local.TriageDao
import com.kneeva.triage.data.local.TriageEntity
import com.kneeva.triage.data.model.TierAPatientData
import com.kneeva.triage.data.model.TierBBiomechanicalSensors
import com.kneeva.triage.data.model.TriageRequest
import com.kneeva.triage.data.model.TriageResponse
import com.kneeva.triage.data.network.KneevaApiService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext

data class BatchSyncResult(
    val totalProcessed: Int,
    val successfulCount: Int,
    val failedCount: Int
)

class OfflineSyncRepository(
    private val triageDao: TriageDao,
    private val apiService: KneevaApiService = KneevaApiService.create(),
    private val gson: Gson = Gson()
) {

    /**
     * Caches patient assessment locally in Room database for offline queueing.
     */
    suspend fun saveTriageLocally(request: TriageRequest): Long = withContext(Dispatchers.IO) {
        val entity = TriageEntity(
            patientId = request.patientId,
            abhaId = null,
            tierAJson = gson.toJson(request.tierA),
            tierBJson = gson.toJson(request.tierB),
            syncStatus = "PENDING",
            createdAtTimestamp = System.currentTimeMillis()
        )
        return@withContext triageDao.insertTriageRecord(entity)
    }

    /**
     * Executes batch synchronization of all pending records when internet connectivity is restored.
     */
    suspend fun syncPendingBatch(): BatchSyncResult = withContext(Dispatchers.IO) {
        val pendingList = triageDao.getPendingSyncRecords()
        var success = 0
        var failed = 0

        for (record in pendingList) {
            try {
                val tierA = gson.fromJson(record.tierAJson, TierAPatientData::class.java)
                val tierB = gson.fromJson(record.tierBJson, TierBBiomechanicalSensors::class.java)

                val request = TriageRequest(
                    patientId = record.patientId,
                    tierA = tierA,
                    tierB = tierB
                )

                val response = apiService.submitTriage(request)
                if (response.isSuccessful && response.body() != null) {
                    val body: TriageResponse = response.body()!!
                    triageDao.markSynced(
                        id = record.id,
                        status = "SYNCED",
                        syncedAt = System.currentTimeMillis(),
                        score = body.riskScore,
                        category = body.riskCategory
                    )
                    success++
                } else {
                    triageDao.markFailed(record.id)
                    failed++
                }
            } catch (e: Exception) {
                triageDao.markFailed(record.id)
                failed++
            }
        }

        return@withContext BatchSyncResult(
            totalProcessed = pendingList.size,
            successfulCount = success,
            failedCount = failed
        )
    }

    fun observePendingCount(): Flow<Int> = triageDao.observePendingCount()
}
