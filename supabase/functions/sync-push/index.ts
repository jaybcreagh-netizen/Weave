import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

/**
 * Sync Push Edge Function
 *
 * Implements WatermelonDB sync protocol - push phase.
 * Applies client changes (created, updated, deleted records) to the database.
 *
 * Request body:
 * {
 *   changes: SyncDatabaseChangeSet,
 *   lastPulledAt: number  // Timestamp of last successful pull
 * }
 *
 * Response:
 * { success: true } or { error: string }
 *
 * @see https://watermelondb.dev/docs/Sync/Backend
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Tables that can be synced
 */
const ALLOWED_TABLES = new Set([
  'user_profile',
  'user_progress',
  'friends',
  'interactions',
  'intentions',
  'life_events',
  'interaction_friends',
  'intention_friends',
  'weekly_reflections',
  'journal_entries',
])

interface TableChanges {
  created: Record<string, unknown>[]
  updated: Record<string, unknown>[]
  deleted: string[]
}

type SyncDatabaseChangeSet = Record<string, TableChanges>

interface SyncPushRequest {
  changes: SyncDatabaseChangeSet
  lastPulledAt: number
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get auth token from request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with user's auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    })

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body: SyncPushRequest = await req.json()
    const { changes, lastPulledAt } = body

    if (!changes) {
      return new Response(
        JSON.stringify({ error: 'Missing changes in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[sync-push] User ${user.id}, processing changes`)

    // Track statistics
    let totalCreated = 0
    let totalUpdated = 0
    let totalDeleted = 0

    // Process changes for each table
    for (const [tableName, tableChanges] of Object.entries(changes)) {
      // Security: Only allow syncing to known tables
      if (!ALLOWED_TABLES.has(tableName)) {
        console.warn(`[sync-push] Skipping unauthorized table: ${tableName}`)
        continue
      }

      const { created, updated, deleted } = tableChanges as TableChanges

      // Process created records
      if (created && created.length > 0) {
        const count = await processCreatedRecords(supabase, user.id, tableName, created)
        totalCreated += count
      }

      // Process updated records
      if (updated && updated.length > 0) {
        const count = await processUpdatedRecords(supabase, user.id, tableName, updated)
        totalUpdated += count
      }

      // Process deleted records
      if (deleted && deleted.length > 0) {
        const count = await processDeletedRecords(supabase, user.id, tableName, deleted)
        totalDeleted += count
      }
    }

    console.log(`[sync-push] Completed for user ${user.id}: ${totalCreated} created, ${totalUpdated} updated, ${totalDeleted} deleted`)

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          created: totalCreated,
          updated: totalUpdated,
          deleted: totalDeleted,
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('[sync-push] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Process created records for a table
 */
async function processCreatedRecords(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  tableName: string,
  records: Record<string, unknown>[]
): Promise<number> {
  let count = 0

  for (const record of records) {
    try {
      // Ensure user_id is set correctly (security)
      const sanitizedRecord = sanitizeRecord(record, userId)

      // Use upsert to handle potential conflicts (record might already exist)
      const { error } = await supabase
        .from(tableName)
        .upsert(sanitizedRecord, {
          onConflict: 'id',
          ignoreDuplicates: false, // Update if exists
        })

      if (error) {
        console.error(`[sync-push] Error creating ${tableName} record:`, error)
        continue
      }

      count++
    } catch (err) {
      console.error(`[sync-push] Error processing created record in ${tableName}:`, err)
    }
  }

  if (count > 0) {
    console.log(`[sync-push] ${tableName}: ${count} records created`)
  }

  return count
}

/**
 * Process updated records for a table
 */
async function processUpdatedRecords(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  tableName: string,
  records: Record<string, unknown>[]
): Promise<number> {
  let count = 0

  for (const record of records) {
    try {
      const recordId = record.id as string
      if (!recordId) {
        console.warn(`[sync-push] Skipping record without id in ${tableName}`)
        continue
      }

      // Ensure user_id matches (security)
      const sanitizedRecord = sanitizeRecord(record, userId)

      // Update the record (only if user owns it via RLS)
      const { error } = await supabase
        .from(tableName)
        .update(sanitizedRecord)
        .eq('id', recordId)
        .eq('user_id', userId) // Extra security check

      if (error) {
        // If record doesn't exist, try to create it
        // This handles the case where WatermelonDB sends "updated" for new records
        // (when using sendCreatedAsUpdated: true)
        if (error.code === 'PGRST116') { // No rows matched
          const { error: insertError } = await supabase
            .from(tableName)
            .insert(sanitizedRecord)

          if (insertError) {
            console.error(`[sync-push] Error inserting ${tableName} record:`, insertError)
            continue
          }
        } else {
          console.error(`[sync-push] Error updating ${tableName} record:`, error)
          continue
        }
      }

      count++
    } catch (err) {
      console.error(`[sync-push] Error processing updated record in ${tableName}:`, err)
    }
  }

  if (count > 0) {
    console.log(`[sync-push] ${tableName}: ${count} records updated`)
  }

  return count
}

/**
 * Process deleted records for a table
 */
async function processDeletedRecords(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  tableName: string,
  recordIds: string[]
): Promise<number> {
  let count = 0

  for (const recordId of recordIds) {
    try {
      // Delete the record (RLS ensures user owns it)
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', recordId)
        .eq('user_id', userId) // Extra security check

      if (error) {
        console.error(`[sync-push] Error deleting ${tableName} record ${recordId}:`, error)
        continue
      }

      // Record the deletion in tombstone table for other devices
      await recordDeletion(supabase, userId, tableName, recordId)

      count++
    } catch (err) {
      console.error(`[sync-push] Error processing deleted record in ${tableName}:`, err)
    }
  }

  if (count > 0) {
    console.log(`[sync-push] ${tableName}: ${count} records deleted`)
  }

  return count
}

/**
 * Sanitize a record before inserting/updating
 * - Ensures user_id is set correctly
 * - Removes WatermelonDB internal fields
 * - Converts timestamps if needed
 */
function sanitizeRecord(
  record: Record<string, unknown>,
  userId: string
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(record)) {
    // Skip WatermelonDB internal fields
    if (key === '_status' || key === '_changed') {
      continue
    }

    // Skip sync status fields (managed by server)
    if (key === 'sync_status' || key === 'synced_at') {
      continue
    }

    sanitized[key] = value
  }

  // Always set user_id to authenticated user (security)
  sanitized.user_id = userId

  return sanitized
}

/**
 * Record a deletion in the tombstone table
 * This allows other devices to know about the deletion
 */
async function recordDeletion(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  tableName: string,
  recordId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('deleted_records')
      .upsert({
        user_id: userId,
        table_name: tableName,
        record_id: recordId,
        deleted_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,table_name,record_id',
      })

    if (error) {
      // Table might not exist yet - log but don't fail
      if (error.code === '42P01') { // relation does not exist
        console.log(`[sync-push] deleted_records table not found, skipping tombstone`)
        return
      }
      console.error(`[sync-push] Error recording deletion:`, error)
    }
  } catch (err) {
    console.error(`[sync-push] Error in recordDeletion:`, err)
  }
}
