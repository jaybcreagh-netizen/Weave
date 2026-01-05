/**
 * ConversationThread Model
 * Tracks ongoing conversation topics per friend, extracted by LLM.
 * 
 * Threads are used to:
 * - Generate follow-up prompts ("Last time, Marcus was worried about...")
 * - Inform triage recommendations
 * - Provide Oracle grounding context
 */

import { Model } from '@nozbe/watermelondb'
import { field, text, readonly, date } from '@nozbe/watermelondb/decorators'

export type ThreadStatus = 'active' | 'resolved' | 'dormant'
export type ThreadSentiment = 'concern' | 'neutral' | 'positive'

export default class ConversationThread extends Model {
    static table = 'conversation_threads'

    @text('friend_id') friendId!: string
    @text('topic') topic!: string
    @field('first_mentioned') firstMentioned!: number
    @field('last_mentioned') lastMentioned!: number
    @field('mention_count') mentionCount!: number
    @text('status') status!: ThreadStatus
    @text('sentiment') sentiment!: ThreadSentiment
    @text('source_entry_ids_raw') sourceEntryIdsRaw!: string

    /** Get source journal entry IDs */
    get sourceEntryIds(): string[] {
        try {
            const parsed = JSON.parse(this.sourceEntryIdsRaw)
            return Array.isArray(parsed) ? parsed : []
        } catch {
            return []
        }
    }

    /** Calculate days since thread was last mentioned */
    get daysSinceLastMention(): number {
        const now = Date.now()
        return Math.floor((now - this.lastMentioned) / (1000 * 60 * 60 * 24))
    }

    /** Check if thread is stale (not mentioned in 30+ days) */
    get isStale(): boolean {
        return this.daysSinceLastMention > 30
    }

    /** Check if this is a concern that should inform triage */
    get isConcernForTriage(): boolean {
        return this.sentiment === 'concern' && this.status === 'active'
    }

    /** Format for follow-up prompt */
    get followUpPromptPrefix(): string {
        const timeAgo = this.daysSinceLastMention
        let timeStr = 'recently'
        if (timeAgo > 7) timeStr = 'a few weeks ago'
        if (timeAgo > 30) timeStr = 'about a month ago'
        if (timeAgo > 60) timeStr = 'a while back'

        return `${timeStr}, you mentioned "${this.topic}"`
    }
}
