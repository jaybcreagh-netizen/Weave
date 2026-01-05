/**
 * Thread Extractor
 * 
 * Extracts conversation threads (ongoing topics) from journal entries.
 * Threads are used for follow-up prompts: "Last time, Marcus was worried about..."
 */

import { database } from '@/db'
import { Q } from '@nozbe/watermelondb'
import ConversationThread, { ThreadStatus, ThreadSentiment } from '@/db/models/ConversationThread'
import { llmService } from '@/shared/services/llm'
import { getPrompt, interpolatePrompt } from '@/shared/services/llm/prompt-registry'
import { logger } from '@/shared/services/logger.service'

const PROMPT_ID = 'thread_extraction'

export interface ExtractedThread {
    topic: string
    sentiment: ThreadSentiment
    isNew: boolean
    matchesExisting?: string  // ID of existing thread if matched
}

interface ThreadExtractionResult {
    threads: ExtractedThread[]
}

/**
 * Extract threads from journal content for a specific friend
 */
export async function extractThreads(
    content: string,
    friendId: string,
    friendName: string,
    journalEntryId: string,
    aiEnabled: boolean = true
): Promise<ExtractedThread[]> {
    try {
        // 1. Fetch existing threads for this friend
        const existingThreads = await database.get<ConversationThread>('conversation_threads')
            .query(
                Q.where('friend_id', friendId),
                Q.where('status', Q.notEq('resolved'))
            )
            .fetch()

        const existingThreadsForPrompt = existingThreads.map(t => ({
            id: t.id,
            topic: t.topic,
            sentiment: t.sentiment
        }))

        // 2. Try LLM extraction if enabled
        if (aiEnabled && llmService.isAvailable()) {
            try {
                const extracted = await extractWithLLM(content, friendName, existingThreadsForPrompt)

                // 3. Save/update threads in database
                await saveExtractedThreads(extracted, friendId, journalEntryId, existingThreads)

                return extracted
            } catch (error) {
                logger.warn('ThreadExtractor', 'LLM extraction failed', { error })
            }
        }

        // No fallback for threads - they require LLM to extract meaningfully
        return []
    } catch (error) {
        logger.error('ThreadExtractor', 'Failed to extract threads', { error })
        return []
    }
}

/**
 * Extract threads using LLM
 */
async function extractWithLLM(
    content: string,
    friendName: string,
    existingThreads: { id: string; topic: string; sentiment: string }[]
): Promise<ExtractedThread[]> {
    const promptDef = getPrompt(PROMPT_ID)
    if (!promptDef) {
        throw new Error(`Prompt ${PROMPT_ID} not found`)
    }

    const existingThreadsStr = existingThreads.length > 0
        ? JSON.stringify(existingThreads, null, 2)
        : '[]'

    const userPrompt = interpolatePrompt(promptDef.userPromptTemplate, {
        friendName,
        content,
        existingThreads: existingThreadsStr
    })

    const response = await llmService.complete({
        system: promptDef.systemPrompt,
        user: userPrompt
    }, {
        ...promptDef.defaultOptions,
        jsonMode: true
    })

    // Parse response
    const result: ThreadExtractionResult = JSON.parse(response.text)

    // Validate threads
    if (!result.threads || !Array.isArray(result.threads)) {
        return []
    }

    return result.threads.map(t => ({
        topic: String(t.topic || '').slice(0, 200),
        sentiment: validateSentiment(t.sentiment),
        isNew: t.isNew !== false,
        matchesExisting: t.matchesExisting || undefined
    }))
}

/**
 * Save extracted threads to database
 */
async function saveExtractedThreads(
    extracted: ExtractedThread[],
    friendId: string,
    journalEntryId: string,
    existingThreads: ConversationThread[]
): Promise<void> {
    if (extracted.length === 0) return

    const now = Date.now()

    await database.write(async () => {
        for (const thread of extracted) {
            if (thread.isNew) {
                // Create new thread
                await database.get<ConversationThread>('conversation_threads').create(record => {
                    record.friendId = friendId
                    record.topic = thread.topic
                    record.sentiment = thread.sentiment
                    record.status = 'active'
                    record.firstMentioned = now
                    record.lastMentioned = now
                    record.mentionCount = 1
                    record.sourceEntryIdsRaw = JSON.stringify([journalEntryId])
                })
            } else if (thread.matchesExisting) {
                // Update existing thread
                const existingThread = existingThreads.find(t => t.id === thread.matchesExisting)
                if (existingThread) {
                    await existingThread.update(record => {
                        record.lastMentioned = now
                        record.mentionCount = (record.mentionCount || 1) + 1

                        // Update sentiment if changed
                        if (thread.sentiment !== record.sentiment) {
                            record.sentiment = thread.sentiment
                        }

                        // Reactivate if dormant
                        if (record.status === 'dormant') {
                            record.status = 'active'
                        }

                        // Add entry ID to sources
                        const existingIds = record.sourceEntryIds
                        if (!existingIds.includes(journalEntryId)) {
                            record.sourceEntryIdsRaw = JSON.stringify([...existingIds, journalEntryId].slice(-10))
                        }
                    })
                }
            }
        }
    })
}

/**
 * Transition stale threads to dormant status
 * Should be called periodically (e.g., daily)
 */
export async function transitionStaleThreads(): Promise<number> {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)

    const staleThreads = await database.get<ConversationThread>('conversation_threads')
        .query(
            Q.where('status', 'active'),
            Q.where('last_mentioned', Q.lt(thirtyDaysAgo))
        )
        .fetch()

    if (staleThreads.length === 0) return 0

    await database.write(async () => {
        for (const thread of staleThreads) {
            await thread.update(record => {
                record.status = 'dormant'
            })
        }
    })

    logger.info('ThreadExtractor', `Transitioned ${staleThreads.length} threads to dormant`)
    return staleThreads.length
}

/**
 * Get active threads for a friend
 */
export async function getActiveThreadsForFriend(friendId: string): Promise<ConversationThread[]> {
    return await database.get<ConversationThread>('conversation_threads')
        .query(
            Q.where('friend_id', friendId),
            Q.where('status', 'active'),
            Q.sortBy('last_mentioned', Q.desc)
        )
        .fetch()
}

// Validators
function validateSentiment(val: unknown): ThreadSentiment {
    const validSentiments: ThreadSentiment[] = ['concern', 'neutral', 'positive']
    if (typeof val === 'string' && validSentiments.includes(val as ThreadSentiment)) {
        return val as ThreadSentiment
    }
    return 'neutral'
}
