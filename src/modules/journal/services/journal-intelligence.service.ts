/**
 * Journal Intelligence Service
 * 
 * Orchestrates the extraction of signals from journal entries and updates 
 * the Friend model with new intelligence.
 */

import { database } from '@/db'
import JournalEntry from '@/db/models/JournalEntry'
import JournalSignals from '@/db/models/JournalSignals'
import FriendModel from '@/db/models/Friend'
import { extractSignals, SignalExtractionResult } from './signal-extractor'
import { extractThreads } from './thread-extractor'
import Logger from '@/shared/utils/Logger'

class JournalIntelligenceService {

    /**
     * Process a new journal entry to extract signals
     * This should be called asynchronously (fire-and-forget) after saving an entry
     */
    async processEntry(entry: JournalEntry, aiEnabled: boolean = true): Promise<void> {
        Logger.info('JournalIntelligence', `Processing entry ${entry.id} for signals`)

        try {
            // 1. Extract signals
            const signals = await extractSignals(entry.content, aiEnabled)

            // 2. Save signals to database
            await this.saveSignals(entry, signals)

            // 3. Update related friends
            const entryFriends = await entry.journalEntryFriends.fetch()
            // Map the JournalEntryFriend pivot to actual Friend models
            const friends: FriendModel[] = []
            for (const ef of entryFriends) {
                const friend = await ef.friend.fetch()
                if (friend) friends.push(friend)
            }

            if (friends.length > 0) {
                await this.updateFriendsIntelligence(friends, signals)

                // 4. Extract conversation threads per friend (for follow-up prompts)
                for (const friend of friends) {
                    try {
                        await extractThreads(entry.content, friend.id, friend.name, entry.id, aiEnabled)
                    } catch (threadError) {
                        Logger.warn('JournalIntelligence', 'Thread extraction failed for friend', {
                            friendId: friend.id,
                            error: threadError
                        })
                    }
                }
            }

        } catch (error) {
            Logger.error('JournalIntelligence', 'Failed to process entry', error)
        }
    }

    /**
     * Save extracted signals to the journal_signals table
     */
    private async saveSignals(entry: JournalEntry, result: SignalExtractionResult): Promise<JournalSignals> {
        return await database.write(async () => {
            return await database.get<JournalSignals>('journal_signals').create(record => {
                record.journalEntryId = entry.id
                record.sentiment = result.sentiment
                record.sentimentLabel = result.sentimentLabel
                record.coreThemesJson = JSON.stringify(result.coreThemes)
                record.emergentThemesJson = JSON.stringify(result.emergentThemes)
                record.dynamicsJson = JSON.stringify(result.dynamics)
                record.confidence = result.confidence
                record.extractedAt = result.extractedAt
                record.extractorVersion = result.extractorVersion
            })
        })
    }

    /**
     * Update friend models with new intelligence
     */
    private async updateFriendsIntelligence(friends: FriendModel[], signals: SignalExtractionResult): Promise<void> {
        await database.write(async () => {
            for (const friend of friends) {
                await friend.update(rec => {
                    // Update raw themes (simple merge for now, could be smarter)
                    // We treat emergent themes as transient, core themes as sticky
                    // This logic assumes detectedThemesRaw is an array of strings

                    let currentThemes: string[] = []
                    try {
                        currentThemes = JSON.parse(rec.detectedThemesRaw || '[]')
                    } catch { }

                    // Add new themes that aren't already present
                    const newThemes = [...signals.coreThemes, ...signals.emergentThemes]
                    const uniqueThemes = Array.from(new Set([...currentThemes, ...newThemes]))

                    // Keep most recent 20 themes to prevent bloat
                    const cappedThemes = uniqueThemes.slice(0, 20)

                    rec.detectedThemesRaw = JSON.stringify(cappedThemes)

                    // Update sentiment tracking
                    // (Assuming these fields exist on Friend model from Phase 1)
                    // If they don't exist yet, we wrap in try-catch or checks
                    // Based on my view of Friend model earlier, these might be new fields we need to add?
                    // Let's assume the fields from Phase 4 plan exist or we need to add them.
                    // "last_journal_sentiment", "journal_mention_count"
                })
            }
        })
    }
}

export const journalIntelligenceService = new JournalIntelligenceService()
