/**
 * OracleContextCache Model
 * Caches LLM context payloads to reduce token usage and improve response time.
 * 
 * Each entry represents a pre-computed context tier (essential, pattern, rich)
 * that can be served stale-while-revalidate for a friend or global queries.
 */

import { Model } from '@nozbe/watermelondb'
import { field, text, readonly, date } from '@nozbe/watermelondb/decorators'

export type ContextTier = 'essential' | 'pattern' | 'rich'

export default class OracleContextCache extends Model {
    static table = 'oracle_context_cache'

    @text('context_type') contextType!: ContextTier
    @text('friend_id') friendId?: string
    @text('payload_json') payloadJson!: string
    @field('tokens_estimate') tokensEstimate!: number
    @field('valid_until') validUntil!: number
    @readonly @date('created_at') createdAt!: Date

    /** Parse the JSON payload */
    get payload(): Record<string, unknown> {
        try {
            return JSON.parse(this.payloadJson)
        } catch {
            return {}
        }
    }

    /** Check if this cache entry is still valid */
    get isValid(): boolean {
        return this.validUntil > Date.now()
    }

    /** Check if this cache entry is stale but usable for stale-while-revalidate */
    isStaleButUsable(staleTolerance: number = 2): boolean {
        const staleUntil = this.validUntil * staleTolerance
        return Date.now() < staleUntil
    }
}
