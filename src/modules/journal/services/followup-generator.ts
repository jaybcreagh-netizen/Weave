/**
 * Follow-Up Generator
 * 
 * Generates follow-up prompts based on active conversation threads.
 * Example: "A few weeks ago, you mentioned Marcus's job interview. Any updates?"
 */

import { database } from '@/db'
import { Q } from '@nozbe/watermelondb'
import ConversationThread from '@/db/models/ConversationThread'
import Friend from '@/db/models/Friend'
import { logger } from '@/shared/services/logger.service'

export interface FollowUpPrompt {
    friendId: string
    friendName: string
    threadId: string
    prefix: string      // "A few weeks ago, you mentioned..."
    topic: string       // "Marcus's job interview at Google"
    question: string    // Full question to show user
    sentiment: 'concern' | 'neutral' | 'positive'
    priority: number    // Higher = more urgent (concerns > neutral > positive)
}

/**
 * Generate follow-up prompts from active conversation threads
 */
export async function generateFollowUpPrompts(limit: number = 3): Promise<FollowUpPrompt[]> {
    try {
        // 1. Fetch active threads that are in the "sweet spot" (7-60 days since mention)
        const now = Date.now()
        const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000)
        const sixtyDaysAgo = now - (60 * 24 * 60 * 60 * 1000)

        const threads = await database.get<ConversationThread>('conversation_threads')
            .query(
                Q.where('status', 'active'),
                Q.where('last_mentioned', Q.lt(sevenDaysAgo)),
                Q.where('last_mentioned', Q.gt(sixtyDaysAgo)),
                Q.sortBy('last_mentioned', Q.asc)  // Oldest first (most in need of follow-up)
            )
            .fetch()

        if (threads.length === 0) {
            return []
        }

        // 2. Score and sort threads
        const scoredThreads = threads.map(thread => ({
            thread,
            score: calculatePriority(thread)
        })).sort((a, b) => b.score - a.score)

        // 3. Take top N and generate prompts
        const topThreads = scoredThreads.slice(0, limit)
        const prompts: FollowUpPrompt[] = []

        for (const { thread, score } of topThreads) {
            // Fetch friend name
            const friends = await database.get<Friend>('friends')
                .query(Q.where('id', thread.friendId))
                .fetch()

            const friend = friends[0]
            if (!friend) continue

            const prompt = generatePromptForThread(thread, friend.name, score)
            prompts.push(prompt)
        }

        return prompts
    } catch (error) {
        logger.error('FollowUpGenerator', 'Failed to generate follow-up prompts', { error })
        return []
    }
}

/**
 * Calculate priority score for a thread
 * Higher priority for concerns, topics mentioned multiple times, and optimal timing
 */
function calculatePriority(thread: ConversationThread): number {
    let score = 0

    // Sentiment weighting (concerns are highest priority)
    if (thread.sentiment === 'concern') score += 30
    else if (thread.sentiment === 'positive') score += 10
    else score += 15  // neutral

    // Mention count bonus (recurring topics are important)
    score += Math.min(thread.mentionCount * 5, 25)

    // Timing bonus: 2-4 weeks since mention is optimal
    const daysSince = thread.daysSinceLastMention
    if (daysSince >= 14 && daysSince <= 28) {
        score += 20  // Sweet spot
    } else if (daysSince >= 7 && daysSince <= 45) {
        score += 10  // Good timing
    }

    return score
}

/**
 * Generate a natural follow-up prompt for a thread
 */
function generatePromptForThread(
    thread: ConversationThread,
    friendName: string,
    priority: number
): FollowUpPrompt {
    const daysSince = thread.daysSinceLastMention

    // Generate time-aware prefix
    let prefix: string
    if (daysSince <= 10) {
        prefix = 'Recently, you mentioned'
    } else if (daysSince <= 21) {
        prefix = 'A couple weeks ago, you mentioned'
    } else if (daysSince <= 35) {
        prefix = 'About a month ago, you mentioned'
    } else {
        prefix = 'A while back, you mentioned'
    }

    // Generate sentiment-aware question
    let questionSuffix: string
    switch (thread.sentiment) {
        case 'concern':
            questionSuffix = 'Any updates on that?'
            break
        case 'positive':
            questionSuffix = 'How did that go?'
            break
        default:
            questionSuffix = 'What happened with that?'
    }

    // Build full question
    const question = `${prefix} ${thread.topic.toLowerCase()}. ${questionSuffix}`

    return {
        friendId: thread.friendId,
        friendName,
        threadId: thread.id,
        prefix,
        topic: thread.topic,
        question,
        sentiment: thread.sentiment,
        priority
    }
}

/**
 * Get follow-up prompts for a specific friend
 */
export async function getFollowUpPromptsForFriend(
    friendId: string,
    friendName: string,
    limit: number = 2
): Promise<FollowUpPrompt[]> {
    try {
        const now = Date.now()
        const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000)

        const threads = await database.get<ConversationThread>('conversation_threads')
            .query(
                Q.where('friend_id', friendId),
                Q.where('status', 'active'),
                Q.where('last_mentioned', Q.lt(sevenDaysAgo)),
                Q.sortBy('last_mentioned', Q.asc)
            )
            .fetch()

        if (threads.length === 0) return []

        return threads
            .slice(0, limit)
            .map(thread => generatePromptForThread(
                thread,
                friendName,
                calculatePriority(thread)
            ))
    } catch (error) {
        logger.error('FollowUpGenerator', 'Failed to get prompts for friend', { error })
        return []
    }
}
