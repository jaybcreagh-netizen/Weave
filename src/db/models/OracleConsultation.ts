/**
 * OracleConsultation Model
 * Records user consultations with the Social Oracle.
 * 
 * Supports organic multi-turn dialogue (up to 5 turns) and
 * optionally links to a journal entry if the user saves the exchange.
 */

import { Model } from '@nozbe/watermelondb'
import { field, text, readonly, date } from '@nozbe/watermelondb/decorators'

export interface GroundingCitation {
    type: 'interaction' | 'journal' | 'pattern' | 'friend_attribute'
    friendName?: string
    summary: string
    date?: string
}

export default class OracleConsultation extends Model {
    static table = 'oracle_consultations'

    @text('question') question!: string
    @text('response') response!: string
    @text('grounding_data_json') groundingDataJson!: string
    @text('context_tier_used') contextTierUsed!: string
    @field('tokens_used') tokensUsed!: number
    @field('turn_count') turnCount!: number
    @field('saved_to_journal') savedToJournal!: boolean
    @text('journal_entry_id') journalEntryId?: string
    @readonly @date('created_at') createdAt!: Date

    /** Get grounding citations as typed array */
    get groundingCitations(): GroundingCitation[] {
        try {
            const parsed = JSON.parse(this.groundingDataJson)
            return Array.isArray(parsed) ? parsed : []
        } catch {
            return []
        }
    }

    /** Check if this is a multi-turn consultation */
    get isMultiTurn(): boolean {
        return this.turnCount > 1
    }

    /** Format citations for display */
    get formattedCitations(): string {
        return this.groundingCitations
            .map(c => {
                if (c.friendName) {
                    return `[${c.friendName}] ${c.summary}`
                }
                return c.summary
            })
            .join('\n')
    }
}
