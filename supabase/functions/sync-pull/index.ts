import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

/**
 * Sync Pull Edge Function
 *
 * Implements WatermelonDB sync protocol - pull phase.
 * Returns all changes since lastPulledAt for the authenticated user.
 *
 * Request body:
 * {
 *   lastPulledAt: number | null,  // Timestamp in milliseconds (null for first sync)
 *   schemaVersion: number,
 *   migration: object | null
 * }
 *
 * Response:
 * {
 *   changes: SyncDatabaseChangeSet,
 *   timestamp: number  // Current server time in milliseconds
 * }
 *
 * @see https://watermelondb.dev/docs/Sync/Backend
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Tables to sync with their configuration
 * Order matters for foreign key dependencies
 */
const SYNC_TABLES = [
  // Core tables (no foreign keys to other synced tables)
  { name: 'user_profile', hasCreatedAt: true },
  { name: 'user_progress', hasCreatedAt: true },
  { name: 'friends', hasCreatedAt: true },

  // Dependent tables
  { name: 'interactions', hasCreatedAt: true },
  { name: 'intentions', hasCreatedAt: true },
  { name: 'life_events', hasCreatedAt: true },

  // Join tables
  { name: 'interaction_friends', hasCreatedAt: false },
  { name: 'intention_friends', hasCreatedAt: false },
  { name: 'weekly_reflections', hasCreatedAt: true },
  { name: 'journal_entries', hasCreatedAt: true },
]

interface SyncPullRequest {
  lastPulledAt: number | null
  schemaVersion?: number
  migration?: unknown
}

interface TableChanges {
  created: Record<string, unknown>[]
  updated: Record<string, unknown>[]
  deleted: string[]
}

type SyncDatabaseChangeSet = Record<string, TableChanges>

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
    const body: SyncPullRequest = await req.json()
    const lastPulledAt = body.lastPulledAt

    // Convert lastPulledAt to ISO timestamp for Postgres comparison
    // WatermelonDB sends milliseconds, Postgres uses TIMESTAMPTZ
    const lastPulledAtISO = lastPulledAt
      ? new Date(lastPulledAt).toISOString()
      : new Date(0).toISOString() // Epoch for first sync

    console.log(`[sync-pull] User ${user.id}, lastPulledAt: ${lastPulledAtISO}`)

    // Build changes object for all tables
    const changes: SyncDatabaseChangeSet = {}

    for (const table of SYNC_TABLES) {
      const tableChanges = await pullTableChanges(
        supabase,
        user.id,
        table.name,
        lastPulledAtISO,
        table.hasCreatedAt
      )
      changes[table.name] = tableChanges
    }

    // Get current server timestamp
    const timestamp = Date.now()

    console.log(`[sync-pull] Completed for user ${user.id}`)

    return new Response(
      JSON.stringify({ changes, timestamp }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('[sync-pull] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Pull changes for a single table
 */
async function pullTableChanges(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  tableName: string,
  lastPulledAtISO: string,
  hasCreatedAt: boolean
): Promise<TableChanges> {
  const created: Record<string, unknown>[] = []
  const updated: Record<string, unknown>[] = []
  const deleted: string[] = []

  try {
    // Fetch all records modified since lastPulledAt
    const { data: records, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('user_id', userId)
      .gt('server_updated_at', lastPulledAtISO)
      .order('server_updated_at', { ascending: true })

    if (error) {
      console.error(`[sync-pull] Error fetching ${tableName}:`, error)
      return { created, updated, deleted }
    }

    if (!records || records.length === 0) {
      return { created, updated, deleted }
    }

    console.log(`[sync-pull] ${tableName}: ${records.length} records changed`)

    // Separate into created vs updated
    // A record is "created" if it was created after lastPulledAt
    // Otherwise it's "updated"
    for (const record of records) {
      // Transform record for WatermelonDB (remove server-only fields)
      const syncRecord = transformRecordForClient(record, tableName)

      if (hasCreatedAt) {
        // Check if this is a new record (created after last sync)
        // Use created_at_ts if available, otherwise use created_at
        const createdAt = record.created_at_ts
          ? new Date(record.created_at_ts).toISOString()
          : record.created_at
            ? new Date(record.created_at).toISOString()
            : lastPulledAtISO

        if (createdAt > lastPulledAtISO) {
          created.push(syncRecord)
        } else {
          updated.push(syncRecord)
        }
      } else {
        // Join tables without created_at - treat as updates
        // WatermelonDB handles this correctly with sendCreatedAsUpdated
        updated.push(syncRecord)
      }
    }

    // Fetch deleted records from tombstone table
    const deletedIds = await fetchDeletedRecords(
      supabase,
      userId,
      tableName,
      lastPulledAtISO
    )
    deleted.push(...deletedIds)

  } catch (err) {
    console.error(`[sync-pull] Error processing ${tableName}:`, err)
  }

  return { created, updated, deleted }
}

/**
 * Transform a database record for WatermelonDB client
 * - Converts timestamps to milliseconds
 * - Removes server-only metadata
 */
function transformRecordForClient(
  record: Record<string, unknown>,
  tableName: string
): Record<string, unknown> {
  const syncRecord: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(record)) {
    // Skip server-only fields
    if (key === 'created_at_ts' || key === 'updated_at_ts') {
      continue
    }

    // Convert TIMESTAMPTZ to milliseconds for server_updated_at
    if (key === 'server_updated_at' && value) {
      syncRecord[key] = new Date(value as string).getTime()
      continue
    }

    // Keep everything else as-is (WatermelonDB expects snake_case)
    syncRecord[key] = value
  }

  return syncRecord
}

/**
 * Fetch IDs of records deleted since lastPulledAt
 * Uses a tombstone table to track deletions
 */
async function fetchDeletedRecords(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  tableName: string,
  lastPulledAtISO: string
): Promise<string[]> {
  try {
    // Check if deleted_records tombstone table exists
    const { data, error } = await supabase
      .from('deleted_records')
      .select('record_id')
      .eq('user_id', userId)
      .eq('table_name', tableName)
      .gt('deleted_at', lastPulledAtISO)

    if (error) {
      // Table might not exist yet - that's OK for initial implementation
      if (error.code === '42P01') { // relation does not exist
        console.log(`[sync-pull] deleted_records table not found, skipping delete sync`)
        return []
      }
      console.error(`[sync-pull] Error fetching deleted records:`, error)
      return []
    }

    return (data || []).map(d => d.record_id)

  } catch (err) {
    console.error(`[sync-pull] Error in fetchDeletedRecords:`, err)
    return []
  }
}
