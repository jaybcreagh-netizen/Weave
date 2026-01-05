/**
 * JournalSignals Model
 * Stores extracted signals from journal entries via LLM analysis.
 * 
 * Each entry is linked to a JournalEntry and contains:
 * - Sentiment analysis (-2 to +2 scale)
 * - Core themes (from predefined taxonomy)
 * - Emergent themes (freeform LLM-detected topics)
 * - Relationship dynamics (reciprocity, depth, tension indicators)
 */

import { Model } from '@nozbe/watermelondb'
import { field, text, readonly, date } from '@nozbe/watermelondb/decorators'

// Predefined core themes that the LLM should classify into
export const CORE_THEMES = [
    'support',
    'celebration',
    'vulnerability',
    'conflict',
    'growth',
    'gratitude',
    'planning',
    'reconnection',
    'shared_activity',
    'life_transition',
] as const

export type CoreTheme = typeof CORE_THEMES[number]

export type SentimentLabel = 'tense' | 'concerned' | 'neutral' | 'positive' | 'grateful'

export interface RelationshipDynamics {
    reciprocitySignal?: 'balanced' | 'giving' | 'receiving'
    depthSignal?: 'surface' | 'personal' | 'deep'
    tensionDetected?: boolean
    reconnectionRelevant?: boolean
}

export default class JournalSignals extends Model {
    static table = 'journal_signals'

    @text('journal_entry_id') journalEntryId!: string
    @field('sentiment') sentiment!: number // -2 to +2
    @text('sentiment_label') sentimentLabel!: SentimentLabel
    @text('core_themes_json') coreThemesJson!: string
    @text('emergent_themes_json') emergentThemesJson!: string
    @text('dynamics_json') dynamicsJson!: string
    @field('confidence') confidence!: number // 0-1
    @field('extracted_at') extractedAt!: number
    @text('extractor_version') extractorVersion!: string

    /** Get core themes as typed array */
    get coreThemes(): CoreTheme[] {
        try {
            const parsed = JSON.parse(this.coreThemesJson)
            return Array.isArray(parsed) ? parsed : []
        } catch {
            return []
        }
    }

    /** Get emergent themes (freeform strings) */
    get emergentThemes(): string[] {
        try {
            const parsed = JSON.parse(this.emergentThemesJson)
            return Array.isArray(parsed) ? parsed : []
        } catch {
            return []
        }
    }

    /** Get relationship dynamics */
    get dynamics(): RelationshipDynamics {
        try {
            return JSON.parse(this.dynamicsJson)
        } catch {
            return {}
        }
    }

    /** Check if this extraction meets confidence threshold for application */
    get isHighConfidence(): boolean {
        return this.confidence >= 0.7
    }

    /** Check if this extraction detected tension (for internal triage, not user display) */
    get hasTensionSignal(): boolean {
        return this.dynamics.tensionDetected === true || this.sentiment <= -1
    }
}
