import { database } from '@/db'
import JournalEntry from '@/db/models/JournalEntry'
import UserFact from '@/db/models/UserFact'
import { Q } from '@nozbe/watermelondb'
import { logger } from '@/shared/services/logger.service'
import { writeScheduler } from '@/shared/services/write-scheduler'

/**
 * StyleAnalyzer: Emergent Style Learning
 * 
 * Analyzes user's journal writing to detect communication preferences.
 * Stores findings as UserFacts for Oracle prompt injection.
 */

export interface StyleProfile {
    sentenceLength: 'short' | 'medium' | 'long'
    emojiUsage: 'frequent' | 'occasional' | 'never'
    formality: 'casual' | 'balanced' | 'formal'
}

// Thresholds for classification
const SENTENCE_LENGTH_SHORT = 12 // words average
const SENTENCE_LENGTH_LONG = 25

const EMOJI_FREQUENT_THRESHOLD = 0.1 // 10% of characters are emoji
const EMOJI_OCCASIONAL_THRESHOLD = 0.01 // 1%

class StyleAnalyzerService {
    private readonly FACT_CATEGORY = 'communication_style'
    private readonly MIN_ENTRIES_FOR_ANALYSIS = 5
    private readonly MIN_WORDS_FOR_ANALYSIS = 200

    /**
     * Analyze recent journal entries to build a style profile.
     * Should be called periodically (e.g., after every 5 journal entries).
     */
    async analyzeAndStoreStyle(): Promise<StyleProfile | null> {
        try {
            // Fetch recent journal entries
            const entries = await database.get<JournalEntry>('journal_entries')
                .query(
                    Q.sortBy('created_at', Q.desc),
                    Q.take(20)
                )
                .fetch()

            if (entries.length < this.MIN_ENTRIES_FOR_ANALYSIS) {
                logger.info('StyleAnalyzer', 'Not enough entries for analysis', { count: entries.length })
                return null
            }

            // Combine all content
            const allContent = entries.map(e => e.content || '').join(' ')

            if (allContent.split(/\s+/).length < this.MIN_WORDS_FOR_ANALYSIS) {
                logger.info('StyleAnalyzer', 'Not enough words for analysis')
                return null
            }

            // Analyze
            const profile = this.analyzeContent(allContent)

            // Store as UserFact
            await this.storeStyleFact(profile)

            logger.info('StyleAnalyzer', 'Style profile generated', profile)
            return profile

        } catch (e) {
            logger.error('StyleAnalyzer', 'Analysis failed', e)
            return null
        }
    }

    /**
     * Analyze a single piece of content and return style metrics.
     */
    private analyzeContent(content: string): StyleProfile {
        const sentenceLength = this.analyzeSentenceLength(content)
        const emojiUsage = this.analyzeEmojiUsage(content)
        const formality = this.analyzeFormality(content)

        return { sentenceLength, emojiUsage, formality }
    }

    private analyzeSentenceLength(content: string): 'short' | 'medium' | 'long' {
        // Split by sentence-ending punctuation
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0)
        if (sentences.length === 0) return 'medium'

        const totalWords = sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0)
        const avgWords = totalWords / sentences.length

        if (avgWords <= SENTENCE_LENGTH_SHORT) return 'short'
        if (avgWords >= SENTENCE_LENGTH_LONG) return 'long'
        return 'medium'
    }

    private analyzeEmojiUsage(content: string): 'frequent' | 'occasional' | 'never' {
        // Unicode emoji regex (simplified)
        const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu
        const emojiMatches = content.match(emojiRegex) || []
        const ratio = emojiMatches.length / Math.max(content.length, 1)

        if (ratio >= EMOJI_FREQUENT_THRESHOLD) return 'frequent'
        if (ratio >= EMOJI_OCCASIONAL_THRESHOLD) return 'occasional'
        return 'never'
    }

    private analyzeFormality(content: string): 'casual' | 'balanced' | 'formal' {
        const lowerContent = content.toLowerCase()

        // Casual indicators
        const casualPatterns = [
            /\blol\b/, /\bhaha\b/, /\bomg\b/, /\bidk\b/, /\btbh\b/, /\bimo\b/,
            /gonna/, /wanna/, /kinda/, /sorta/, /ya\b/, /yep/, /nope/,
            /!{2,}/, /\?{2,}/, /\.{3,}/ // Multiple punctuation
        ]

        // Formal indicators
        const formalPatterns = [
            /\bhowever\b/, /\bfurthermore\b/, /\bmoreover\b/, /\btherefore\b/,
            /\bregarding\b/, /\bsubsequently\b/, /\bnevertheless\b/,
            /\bI believe\b/, /\bIt appears\b/
        ]

        let casualScore = 0
        let formalScore = 0

        casualPatterns.forEach(p => { if (p.test(lowerContent)) casualScore++ })
        formalPatterns.forEach(p => { if (p.test(lowerContent)) formalScore++ })

        // Normalize by content length (per 1000 chars)
        const normalizer = Math.max(content.length / 1000, 1)
        casualScore /= normalizer
        formalScore /= normalizer

        if (casualScore > formalScore + 1) return 'casual'
        if (formalScore > casualScore + 0.5) return 'formal'
        return 'balanced'
    }

    private async storeStyleFact(profile: StyleProfile): Promise<void> {
        const factContent = this.profileToFactContent(profile)

        await writeScheduler.important('storeStyleFact', async () => {
            // Check for existing style fact and update if needed
            const existing = await database.get<UserFact>('user_facts')
                .query(Q.where('category', this.FACT_CATEGORY))
                .fetch()

            if (existing.length > 0) {
                // Update existing
                await existing[0].update(fact => {
                    fact.factContent = factContent
                    fact.confidence = 0.8
                })
            } else {
                // Create new
                await database.get<UserFact>('user_facts').create(fact => {
                    fact.factContent = factContent
                    fact.category = this.FACT_CATEGORY
                    fact.confidence = 0.8
                    fact.source = 'oracle_feedback'
                })
            }
        })
    }

    private profileToFactContent(profile: StyleProfile): string {
        const parts: string[] = []

        // Sentence length
        if (profile.sentenceLength === 'short') {
            parts.push('User writes in short, punchy sentences.')
        } else if (profile.sentenceLength === 'long') {
            parts.push('User writes in longer, reflective sentences.')
        }

        // Emoji
        if (profile.emojiUsage === 'frequent') {
            parts.push('User frequently uses emojis.')
        } else if (profile.emojiUsage === 'never') {
            parts.push('User rarely uses emojis.')
        }

        // Formality
        if (profile.formality === 'casual') {
            parts.push('User prefers casual, conversational tone.')
        } else if (profile.formality === 'formal') {
            parts.push('User prefers a more formal tone.')
        }

        return parts.length > 0
            ? parts.join(' ')
            : 'User has a balanced, neutral writing style.'
    }

    /**
     * Get the current stored style fact, if any.
     */
    async getCurrentStyleFact(): Promise<string | null> {
        try {
            const facts = await database.get<UserFact>('user_facts')
                .query(Q.where('category', this.FACT_CATEGORY))
                .fetch()
            return facts[0]?.factContent || null
        } catch {
            return null
        }
    }
}

export const styleAnalyzer = new StyleAnalyzerService()
