/**
 * Schema Repair Utility
 * 
 * Adds missing columns from v53 migration that may not have been applied.
 * This is a one-time repair to fix databases stuck on older schema versions.
 * 
 * Safe to run multiple times - uses "ADD COLUMN IF NOT EXISTS" pattern.
 */

import { database } from './index';
import { logger } from '@/shared/services/logger.service';

/**
 * Repairs the database schema by adding any missing columns from v53.
 * This should be called early in app initialization, before any queries.
 */
export async function repairSchemaIfNeeded(): Promise<void> {
    try {
        const adapter = database.adapter as any;

        // Use the correct API for unsafe SQL execution
        // The adapter exposes unsafeExecute with { sqlString } format
        const executeSql = async (sql: string): Promise<void> => {
            await adapter.unsafeExecute({
                sqlString: sql,
            });
        };

        // Check if ai_features_enabled column exists by querying PRAGMA
        const testQuery = `PRAGMA table_info(user_profile)`;

        try {
            const result = await adapter.unsafeExecute({
                sqlString: testQuery,
            });

            // Check if the column exists in the result
            const columns = result?.rows || result || [];
            const hasAiColumn = Array.isArray(columns) && columns.some(
                (col: any) => col.name === 'ai_features_enabled'
            );

            if (hasAiColumn) {
                logger.info('SchemaRepair', 'Schema is up to date, no repair needed');
                return;
            }

            // Column doesn't exist, run repair
            logger.warn('SchemaRepair', 'Missing columns detected, running schema repair...');
            await runSchemaRepair(executeSql);

        } catch (error: any) {
            // If PRAGMA fails, try the repair anyway
            logger.warn('SchemaRepair', 'Could not check schema, attempting repair:', error.message);
            await runSchemaRepair(executeSql);
        }
    } catch (error) {
        // Don't throw - just log and continue. The app may still work if migrations ran correctly.
        logger.error('SchemaRepair', 'Failed to check/repair schema:', error);
    }
}

async function runSchemaRepair(executeSql: (sql: string) => Promise<void>): Promise<void> {
    // v53 columns that need to be added to user_profile
    const userProfileColumns = [
        `ALTER TABLE user_profile ADD COLUMN ai_features_enabled INTEGER`,
        `ALTER TABLE user_profile ADD COLUMN ai_journal_analysis_enabled INTEGER`,
        `ALTER TABLE user_profile ADD COLUMN ai_oracle_enabled INTEGER`,
        `ALTER TABLE user_profile ADD COLUMN ai_disclosure_acknowledged_at INTEGER`,
    ];

    // v53 columns for friends table
    const friendsColumns = [
        `ALTER TABLE friends ADD COLUMN detected_themes_raw TEXT`,
        `ALTER TABLE friends ADD COLUMN last_journal_sentiment REAL`,
        `ALTER TABLE friends ADD COLUMN journal_mention_count INTEGER`,
        `ALTER TABLE friends ADD COLUMN reflection_activity_score REAL`,
        `ALTER TABLE friends ADD COLUMN needs_attention INTEGER`,
        `ALTER TABLE friends ADD COLUMN avg_weave_duration_minutes REAL`,
        `ALTER TABLE friends ADD COLUMN preferred_weave_types_raw TEXT`,
        `ALTER TABLE friends ADD COLUMN best_time_of_day TEXT`,
        `ALTER TABLE friends ADD COLUMN best_day_of_week INTEGER`,
        `ALTER TABLE friends ADD COLUMN topic_clusters_raw TEXT`,
        `ALTER TABLE friends ADD COLUMN topic_trend TEXT`,
        `ALTER TABLE friends ADD COLUMN reconnection_attempts INTEGER`,
        `ALTER TABLE friends ADD COLUMN successful_reconnections INTEGER`,
        `ALTER TABLE friends ADD COLUMN last_reconnection_date INTEGER`,
    ];

    // v53 new tables
    const createTableStatements = [
        `CREATE TABLE IF NOT EXISTS oracle_context_cache (
      id TEXT PRIMARY KEY NOT NULL,
      _status TEXT,
      _changed TEXT,
      context_type TEXT NOT NULL,
      friend_id TEXT,
      payload_json TEXT NOT NULL,
      tokens_estimate INTEGER NOT NULL,
      valid_until INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )`,
        `CREATE INDEX IF NOT EXISTS oracle_context_cache_friend_id ON oracle_context_cache (friend_id)`,
        `CREATE INDEX IF NOT EXISTS oracle_context_cache_valid_until ON oracle_context_cache (valid_until)`,

        `CREATE TABLE IF NOT EXISTS journal_signals (
      id TEXT PRIMARY KEY NOT NULL,
      _status TEXT,
      _changed TEXT,
      journal_entry_id TEXT NOT NULL,
      sentiment REAL NOT NULL,
      sentiment_label TEXT NOT NULL,
      core_themes_json TEXT NOT NULL,
      emergent_themes_json TEXT NOT NULL,
      dynamics_json TEXT NOT NULL,
      confidence REAL NOT NULL,
      extracted_at INTEGER NOT NULL,
      extractor_version TEXT NOT NULL
    )`,
        `CREATE INDEX IF NOT EXISTS journal_signals_journal_entry_id ON journal_signals (journal_entry_id)`,

        `CREATE TABLE IF NOT EXISTS oracle_consultations (
      id TEXT PRIMARY KEY NOT NULL,
      _status TEXT,
      _changed TEXT,
      question TEXT NOT NULL,
      response TEXT NOT NULL,
      grounding_data_json TEXT NOT NULL,
      context_tier_used TEXT NOT NULL,
      tokens_used INTEGER NOT NULL,
      turn_count INTEGER NOT NULL,
      saved_to_journal INTEGER NOT NULL,
      journal_entry_id TEXT,
      created_at INTEGER NOT NULL
    )`,
        `CREATE INDEX IF NOT EXISTS oracle_consultations_created_at ON oracle_consultations (created_at)`,

        `CREATE TABLE IF NOT EXISTS conversation_threads (
      id TEXT PRIMARY KEY NOT NULL,
      _status TEXT,
      _changed TEXT,
      friend_id TEXT NOT NULL,
      topic TEXT NOT NULL,
      first_mentioned INTEGER NOT NULL,
      last_mentioned INTEGER NOT NULL,
      mention_count INTEGER NOT NULL,
      status TEXT NOT NULL,
      sentiment TEXT NOT NULL,
      source_entry_ids_raw TEXT NOT NULL
    )`,
        `CREATE INDEX IF NOT EXISTS conversation_threads_friend_id ON conversation_threads (friend_id)`,
        `CREATE INDEX IF NOT EXISTS conversation_threads_last_mentioned ON conversation_threads (last_mentioned)`,

        `CREATE TABLE IF NOT EXISTS llm_quality_log (
      id TEXT PRIMARY KEY NOT NULL,
      _status TEXT,
      _changed TEXT,
      prompt_id TEXT NOT NULL,
      prompt_version TEXT NOT NULL,
      input_hash TEXT NOT NULL,
      output_hash TEXT NOT NULL,
      latency_ms INTEGER NOT NULL,
      tokens_used INTEGER NOT NULL,
      error_type TEXT,
      user_feedback TEXT,
      created_at INTEGER NOT NULL
    )`,
        `CREATE INDEX IF NOT EXISTS llm_quality_log_prompt_id ON llm_quality_log (prompt_id)`,
        `CREATE INDEX IF NOT EXISTS llm_quality_log_created_at ON llm_quality_log (created_at)`,
    ];

    let successCount = 0;
    let skipCount = 0;

    // Execute all ALTER TABLE statements (these will fail silently if column already exists)
    for (const sql of [...userProfileColumns, ...friendsColumns]) {
        try {
            await executeSql(sql);
            successCount++;
            logger.info('SchemaRepair', `Added column: ${sql.substring(30, 70)}...`);
        } catch (error: any) {
            // Ignore "duplicate column" errors - this is expected
            if (error.message?.includes('duplicate column')) {
                skipCount++;
            } else {
                logger.warn('SchemaRepair', `Failed: ${sql.substring(0, 40)}...`, error.message);
            }
        }
    }

    // Execute CREATE TABLE statements
    for (const sql of createTableStatements) {
        try {
            await executeSql(sql);
        } catch (error: any) {
            // Tables likely already exist, ignore
            if (!error.message?.includes('already exists')) {
                logger.warn('SchemaRepair', `Table creation issue:`, error.message);
            }
        }
    }

    logger.info('SchemaRepair', `Repair completed: ${successCount} columns added, ${skipCount} already existed`);
}
