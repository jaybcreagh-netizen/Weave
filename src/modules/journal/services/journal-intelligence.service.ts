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
import UserProfile from '@/db/models/UserProfile'
import JournalEntryFriend from '@/db/models/JournalEntryFriend'
import { Q } from '@nozbe/watermelondb'
import { extractSignals, SignalExtractionResult } from './signal-extractor'
import { extractThreads, ExtractedThread } from './thread-extractor'
import { insightOrchestratorService } from '@/modules/intelligence'
import { memoryBridgeService } from './memory-bridge.service'
import Logger from '@/shared/utils/Logger'
import { writeScheduler } from '@/shared/services/write-scheduler'

import { SmartAction, actionExtractionService } from '@/modules/oracle'

export interface ProcessingResult {
    signals: SignalExtractionResult | null;
    threads: ExtractedThread[];
    actions: SmartAction[];
    memoryCount: number;
}

class JournalIntelligenceService {

    /**
     * Process a new journal entry to extract signals
     * Returns a result object that can be used for the InsightReceipt
     */
    async processEntry(entry: JournalEntry, aiEnabled?: boolean): Promise<ProcessingResult | void> {
        Logger.info('JournalIntelligence', `Processing entry ${entry.id} for signals`)

        try {
            const resolvedAiEnabled = await this.resolveAiEnabled(aiEnabled)
            const resultThreads: ExtractedThread[] = []
            let resultMemoryCount = 0
            let resultActions: SmartAction[] = []

            // 1. Extract signals
            const signals = await extractSignals(entry.content, resolvedAiEnabled)

            // 1b. Save LLM-generated title to entry if missing
            if (signals.title && (!entry.title || entry.title.trim().length === 0)) {
                await database.write(async () => {
                    await entry.update(rec => {
                        rec.title = signals.title!;
                    });
                });
            }

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

                await insightOrchestratorService.processJournalEntry(friends.map(friend => friend.id))

                // 4. Extract conversation threads per friend (for follow-up prompts)
                const extractedThreadsByFriend: Record<string, ExtractedThread[]> = {}
                for (const friend of friends) {
                    try {
                        const extractedThreads = await extractThreads(entry.content, friend.id, friend.name, entry.id, resolvedAiEnabled)
                        extractedThreadsByFriend[friend.id] = extractedThreads
                        resultThreads.push(...extractedThreads)
                    } catch (threadError) {
                        extractedThreadsByFriend[friend.id] = []
                        Logger.warn('JournalIntelligence', 'Thread extraction failed for friend', {
                            friendId: friend.id,
                            error: threadError
                        })
                    }
                }

                // 5. Bridge existing extraction output into friend memory candidates
                resultMemoryCount = await memoryBridgeService.ingestSignalsAndThreads(entry, friends, signals, extractedThreadsByFriend)
            }

            // 6. Extract Smart Actions (NEW JUX-A02)
            try {
                resultActions = await actionExtractionService.extractActions(entry.id)
            } catch (actionError) {
                Logger.warn('JournalIntelligence', 'Action extraction failed', actionError)
            }

            // 7. Trigger style analysis (fire-and-forget, runs periodically)
            this.maybeAnalyzeStyle()

            // Return the ProcessingResult
            return {
                signals,
                threads: resultThreads,
                actions: resultActions,
                memoryCount: resultMemoryCount
            }

        } catch (error) {
            Logger.error('JournalIntelligence', 'Failed to process entry', error)
            // Re-throw or return empty? Design says callers might await it.
            // If we throw, we might break the calling UI if not careful, but returning void implies failure/fire-and-forget.
            // Let's rely on the fact that existing callers don't await, so they won't catch.
            // New callers should wrap in try/catch.
        }
    }

    /**
     * Resolve journal AI analysis preference.
     * Falls back to profile settings when callers don't provide an explicit value.
     */
    private async resolveAiEnabled(aiEnabled?: boolean): Promise<boolean> {
        if (typeof aiEnabled === 'boolean') {
            return aiEnabled
        }

        try {
            const profiles = await database
                .get<UserProfile>('user_profile')
                .query(Q.take(1))
                .fetch()

            return profiles[0]?.isJournalAnalysisEnabled ?? false
        } catch {
            return false
        }
    }

    private entryCountSinceLastAnalysis = 0
    private readonly ANALYZE_EVERY_N_ENTRIES = 5

    /**
     * Trigger style analysis every N entries
     */
    private maybeAnalyzeStyle(): void {
        this.entryCountSinceLastAnalysis++
        if (this.entryCountSinceLastAnalysis >= this.ANALYZE_EVERY_N_ENTRIES) {
            this.entryCountSinceLastAnalysis = 0
            // Fire-and-forget
            import('@/modules/oracle/services/style-analyzer').then(({ styleAnalyzer }) => {
                styleAnalyzer.analyzeAndStoreStyle().catch(e => {
                    Logger.warn('JournalIntelligence', 'Style analysis failed', e)
                })
            })
        }
    }

    /**
     * Save extracted signals to the journal_signals table
     */
    private async saveSignals(entry: JournalEntry, result: SignalExtractionResult): Promise<JournalSignals> {
        return await database.write(async () => {
            const existing = await database
                .get<JournalSignals>('journal_signals')
                .query(Q.where('journal_entry_id', entry.id), Q.take(1))
                .fetch()

            if (existing.length > 0) {
                await existing[0].update(record => {
                    record.sentiment = result.sentiment
                    record.sentimentLabel = result.sentimentLabel
                    record.coreThemesJson = JSON.stringify(result.coreThemes)
                    record.emergentThemesJson = JSON.stringify(result.emergentThemes)
                    record.dynamicsJson = JSON.stringify(result.dynamics)
                    record.confidence = result.confidence
                    record.extractedAt = result.extractedAt
                    record.extractorVersion = result.extractorVersion
                })
                return existing[0]
            }

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
     *
     * Uses writeScheduler.background() to avoid race conditions with user-initiated
     * friend updates (e.g., saving notes from journal).
     */
    private async updateFriendsIntelligence(friends: FriendModel[], signals: SignalExtractionResult): Promise<void> {
        const friendIds = friends.map(friend => friend.id)
        const mentionLinks = friendIds.length > 0
            ? await database.get<JournalEntryFriend>('journal_entry_friends')
                .query(Q.where('friend_id', Q.oneOf(friendIds)))
                .fetch()
            : []

        const mentionsByFriend = new Map<string, Set<string>>()
        for (const link of mentionLinks) {
            const existing = mentionsByFriend.get(link.friendId) || new Set<string>()
            existing.add(link.journalEntryId)
            mentionsByFriend.set(link.friendId, existing)
        }

        // Use writeScheduler.background() to serialize with other friend updates
        // This prevents "Cannot update a record with pending changes" errors
        await writeScheduler.background('JournalIntelligence:updateFriends', async () => {
            // Use prepareUpdate() + batch() instead of individual update() calls
            // to perform all updates atomically
            const updates = friends.map(friend => {
                const mentionCount = mentionsByFriend.get(friend.id)?.size ?? 0

                return friend.prepareUpdate(rec => {
                    // Update raw themes (simple merge for now, could be smarter)
                    // We treat emergent themes as transient, core themes as sticky
                    // This logic assumes detectedThemesRaw is an array of strings

                    const currentThemes: string[] = (() => {
                        try {
                            return JSON.parse(rec.detectedThemesRaw || '[]')
                        } catch {
                            return []
                        }
                    })()

                    // Add new themes that aren't already present
                    const newThemes = [...signals.coreThemes, ...signals.emergentThemes]
                    const uniqueThemes = Array.from(new Set([...currentThemes, ...newThemes]))

                    // Keep most recent 20 themes to prevent bloat
                    const cappedThemes = uniqueThemes.slice(0, 20)

                    rec.detectedThemesRaw = JSON.stringify(cappedThemes)

                    // Update sentiment tracking and mention counts
                    rec.lastJournalSentiment = signals.sentiment
                    rec.journalMentionCount = mentionCount
                })
            })

            await database.batch(...updates)
        })
    }
}

export const journalIntelligenceService = new JournalIntelligenceService()
