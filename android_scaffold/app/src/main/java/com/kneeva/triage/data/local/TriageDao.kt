package com.kneeva.triage.data.local

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface TriageDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTriageRecord(entity: TriageEntity): Long

    @Query("SELECT * FROM triage_cache WHERE syncStatus = 'PENDING' ORDER BY createdAtTimestamp ASC")
    suspend fun getPendingSyncRecords(): List<TriageEntity>

    @Query("SELECT COUNT(*) FROM triage_cache WHERE syncStatus = 'PENDING'")
    fun observePendingCount(): Flow<Int>

    @Query("UPDATE triage_cache SET syncStatus = :status, syncedAtTimestamp = :syncedAt, serverRiskScore = :score, serverRiskCategory = :category WHERE id = :id")
    suspend fun markSynced(id: Long, status: String, syncedAt: Long, score: Float, category: String)

    @Query("UPDATE triage_cache SET syncStatus = 'FAILED' WHERE id = :id")
    suspend fun markFailed(id: Long)

    @Query("SELECT * FROM triage_cache ORDER BY createdAtTimestamp DESC")
    fun observeAllRecords(): Flow<List<TriageEntity>>
}
