
import { llmService } from '@/shared/services/llm'
import { getPrompt, interpolatePrompt } from '@/shared/services/llm/prompt-registry'
import { oracleContextBuilder, ContextTier } from './context-builder'
import { logger } from '@/shared/services/logger.service'
import { trackEvent, AnalyticsEvents } from '@/shared/services/analytics.service'
import { getActiveThreadsForFriend } from '@/modules/journal/services/thread-extractor'
import {
    OracleAction,
    OracleStructuredResponse,
    GuidedSession,
    GuidedTurn,
    ReflectionContext,
    ComposedEntry
} from './types'

export interface OracleTurn {
    role: 'user' | 'assistant'
    content: string
    timestamp: number
    action?: OracleAction  // New: attached action for assistant turns
}

export interface OracleSession {
    id: string
    turns: OracleTurn[]
    contextTier: ContextTier
    lastUpdated: number
}

export interface OracleResponse {
    text: string
    action?: OracleAction
}

class OracleService {
    private currentSession: OracleSession | null = null

    // Rate limit tracking (simple memory store for MVP, ideally persisted)
    // For 5/day limit.
    private dailyUsage = {
        date: new Date().toLocaleDateString(),
        count: 0
    }

    private readonly MAX_DAILY_QUESTIONS = 999 // TODO: Change back to 5 for production
    private readonly MAX_TURNS_PER_SESSION = 10

    /**
     * Ask the Oracle a question
     * Returns both the text response and any suggested action
     */
    async ask(question: string, friendIds: string[] = []): Promise<OracleResponse> {
        this.checkRateLimit()

        // Initialize session if needed
        if (!this.currentSession) {
            this.currentSession = {
                id: Date.now().toString(),
                turns: [],
                contextTier: ContextTier.PATTERN,
                lastUpdated: Date.now()
            }
        }

        const session = this.currentSession

        // 1. Build Context (pass question for friend name extraction)
        const contextData = await oracleContextBuilder.buildContext(friendIds, session.contextTier, question)
        const contextString = JSON.stringify(contextData, null, 2)

        // 2. Format History
        const historyText = session.turns
            .slice(-6) // Last 3 exchanges
            .map(t => `${t.role.toUpperCase()}: ${t.content}`)
            .join('\n\n')

        // 3. Prepare Prompt
        const promptDef = getPrompt('oracle_consultation')
        if (!promptDef) {
            throw new Error('Oracle consultation prompt not found in registry')
        }

        const finalPrompt = interpolatePrompt(promptDef.userPromptTemplate, {
            context: contextString,
            conversationHistory: historyText,
            question: question,
            turnNumber: Math.floor(session.turns.length / 2) + 1
        })

        logger.info('OracleService', 'Asking Oracle', {
            questionLen: question.length,
            contextTier: session.contextTier
        })

        // 4. Call LLM
        const response = await llmService.complete({
            system: promptDef.systemPrompt,
            user: finalPrompt,
        }, promptDef.defaultOptions)

        // 5. Parse structured response
        const parsed = this.parseResponse(response.text)

        // 6. Update Session
        session.turns.push({ role: 'user', content: question, timestamp: Date.now() })
        session.turns.push({
            role: 'assistant',
            content: parsed.text,
            timestamp: Date.now(),
            action: parsed.action
        })
        session.lastUpdated = Date.now()

        // Increment usage
        this.incrementUsage()

        return parsed
    }

    /**
     * Parse the LLM response, handling both JSON and plain text fallback
     */
    private parseResponse(rawResponse: string): OracleResponse {
        try {
            // Try to parse as JSON
            const cleaned = this.extractJson(rawResponse)
            const parsed: OracleStructuredResponse = JSON.parse(cleaned)

            return {
                text: parsed.text,
                action: parsed.suggestedAction
            }
        } catch (e) {
            // Fallback: treat as plain text
            logger.warn('OracleService', 'Failed to parse JSON response, using raw text', { error: e })
            return {
                text: rawResponse,
                action: undefined
            }
        }
    }

    /**
     * Extract JSON from a response that might have markdown code blocks
     */
    private extractJson(text: string): string {
        // Remove markdown code blocks if present
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (jsonMatch) {
            return jsonMatch[1].trim()
        }

        // Try to find JSON object directly
        const objectMatch = text.match(/\{[\s\S]*\}/)
        if (objectMatch) {
            return objectMatch[0]
        }

        return text
    }

    private checkRateLimit() {
        const today = new Date().toLocaleDateString()
        if (this.dailyUsage.date !== today) {
            this.dailyUsage = { date: today, count: 0 }
        }

        if (this.dailyUsage.count >= this.MAX_DAILY_QUESTIONS) {
            throw new Error('ORACLE_RATE_LIMIT_EXCEEDED')
        }
    }

    private incrementUsage() {
        this.dailyUsage.count++
    }

    getRemainingQuestions(): number {
        const today = new Date().toLocaleDateString()
        if (this.dailyUsage.date !== today) {
            return this.MAX_DAILY_QUESTIONS
        }
        return Math.max(0, this.MAX_DAILY_QUESTIONS - this.dailyUsage.count)
    }

    resetSession() {
        this.currentSession = null
    }

    // ========================================================================
    // GUIDED REFLECTION MODE
    // Oracle asks, user answers, Oracle composes entry
    // ========================================================================

    private activeGuidedSession: GuidedSession | null = null

    /**
     * Start a guided reflection session
     */
    async startGuidedReflection(context: ReflectionContext): Promise<GuidedSession> {
        // Fetch active threads for the friends
        const activeThreads: ReflectionContext['activeThreads'] = []
        for (const friendId of context.friendIds) {
            const threads = await getActiveThreadsForFriend(friendId)
            for (const thread of threads.slice(0, 2)) {
                activeThreads.push({
                    id: thread.id,
                    topic: thread.topic,
                    sentiment: thread.sentiment,
                    daysSinceLastMention: thread.daysSinceLastMention
                })
            }
        }
        context.activeThreads = activeThreads

        // Generate first question
        const firstQuestion = await this.generateNextQuestion(context, [])

        const session: GuidedSession = {
            id: Date.now().toString(),
            mode: 'guided_reflection',
            context,
            turns: [],
            pendingQuestion: firstQuestion,
            status: 'in_progress',
            startedAt: Date.now()
        }

        this.activeGuidedSession = session
        logger.info('OracleService', 'Started guided reflection', {
            type: context.type,
            friendIds: context.friendIds
        })

        // Analytics
        trackEvent(AnalyticsEvents.GUIDED_REFLECTION_STARTED, {
            reflectionType: context.type,
            friendCount: context.friendIds.length,
            activeThreadCount: activeThreads.length
        })

        return session
    }

    /**
     * Continue guided reflection with user's answer
     */
    async continueReflection(session: GuidedSession, answer: string): Promise<GuidedSession> {
        if (session.status !== 'in_progress' || !session.pendingQuestion) {
            throw new Error('Session not in progress or no pending question')
        }

        // Record the turn
        const turn: GuidedTurn = {
            oracleQuestion: session.pendingQuestion,
            userAnswer: answer
        }
        session.turns.push(turn)

        // Generate next question or transition to composition
        const promptDef = getPrompt('oracle_guided_question')
        if (!promptDef) throw new Error('Guided question prompt not found')

        const conversationHistory = session.turns
            .map(t => `Oracle: ${t.oracleQuestion}\nUser: ${t.userAnswer}`)
            .join('\n\n')

        const userPrompt = interpolatePrompt(promptDef.userPromptTemplate, {
            friendName: session.context.friendNames.join(' and '),
            archetype: '',
            lastSeen: 'recently',
            activity: session.context.activity || 'spending time together',
            activeThreads: session.context.activeThreads?.length
                ? session.context.activeThreads.map(t => `- ${t.topic} (${t.sentiment})`).join('\n')
                : 'No active threads',
            conversationHistory
        })

        const response = await llmService.complete({
            system: promptDef.systemPrompt,
            user: userPrompt
        }, promptDef.defaultOptions)

        const result = JSON.parse(this.extractJson(response.text))

        if (result.readyToCompose) {
            // Time to compose the entry
            session.composedDraft = await this.composeEntry(session)
            session.pendingQuestion = undefined
            session.status = 'draft_ready'
        } else {
            session.pendingQuestion = result.question
        }

        this.activeGuidedSession = session
        return session
    }

    /**
     * Complete the guided reflection and save the entry
     */
    async completeReflection(session: GuidedSession): Promise<ComposedEntry> {
        if (session.status !== 'draft_ready' || !session.composedDraft) {
            throw new Error('Session not ready for completion')
        }

        session.status = 'complete'
        this.activeGuidedSession = null

        const result: ComposedEntry = {
            content: session.composedDraft,
            friendIds: session.context.friendIds,
            metadata: {
                source: 'guided_reflection',
                turnCount: session.turns.length,
                reflectionType: session.context.type
            }
        }

        logger.info('OracleService', 'Completed guided reflection', {
            turnCount: session.turns.length,
            entryLength: result.content.length
        })

        // Analytics
        trackEvent(AnalyticsEvents.GUIDED_REFLECTION_COMPLETED, {
            reflectionType: session.context.type,
            turnCount: session.turns.length,
            entryLength: result.content.length,
            durationMs: Date.now() - session.startedAt
        })

        return result
    }

    /**
     * User escapes to freeform writing
     */
    escapeToFreeform(session: GuidedSession, reason: 'user_chose_freeform' | 'timeout' | 'error' = 'user_chose_freeform'): void {
        session.escapedAt = {
            turnNumber: session.turns.length,
            reason
        }
        session.status = 'complete'
        this.activeGuidedSession = null

        logger.info('OracleService', 'User escaped to freeform', {
            turnNumber: session.turns.length,
            reason
        })

        // Analytics
        trackEvent(AnalyticsEvents.GUIDED_REFLECTION_ESCAPED, {
            reflectionType: session.context.type,
            turnNumber: session.turns.length,
            reason,
            durationMs: Date.now() - session.startedAt
        })
    }

    /**
     * Generate a draft from freeform context (topic + subject + seed)
     */
    async generateFreeformDraft(context: {
        topic: 'gratitude' | 'realization' | 'memory' | 'worry' | 'celebration'
        subjectType: 'friend' | 'myself' | 'something_else'
        friendName?: string
        abstractSubject?: string
        seed: string
    }): Promise<string> {
        const promptDef = getPrompt('oracle_freeform_draft')
        if (!promptDef) throw new Error('Freeform draft prompt not found')

        // Build human-readable labels
        const topicLabels: Record<string, string> = {
            gratitude: 'Gratitude',
            realization: 'A realization',
            memory: 'A memory',
            worry: 'Something on my mind',
            celebration: 'Something to celebrate'
        }

        let subjectLabel = 'General / myself'
        if (context.subjectType === 'friend' && context.friendName) {
            subjectLabel = context.friendName
        } else if (context.subjectType === 'something_else' && context.abstractSubject) {
            subjectLabel = context.abstractSubject
        }

        const userPrompt = interpolatePrompt(promptDef.userPromptTemplate, {
            topicLabel: topicLabels[context.topic] || context.topic,
            subjectLabel,
            seed: context.seed
        })

        const response = await llmService.complete({
            system: promptDef.systemPrompt,
            user: userPrompt
        }, promptDef.defaultOptions)

        this.incrementUsage()

        return response.text.trim().replace(/^["']|["']$/g, '')
    }

    /**
     * Get current guided session
     */
    getActiveGuidedSession(): GuidedSession | null {
        return this.activeGuidedSession
    }

    // ========================================================================
    // PRIVATE HELPERS
    // ========================================================================

    private async generateNextQuestion(
        context: ReflectionContext,
        previousTurns: GuidedTurn[]
    ): Promise<string> {
        const promptDef = getPrompt('oracle_guided_question')
        if (!promptDef) throw new Error('Guided question prompt not found')

        const conversationHistory = previousTurns.length > 0
            ? previousTurns.map(t => `Oracle: ${t.oracleQuestion}\nUser: ${t.userAnswer}`).join('\n\n')
            : '(Starting conversation)'

        const userPrompt = interpolatePrompt(promptDef.userPromptTemplate, {
            friendName: context.friendNames.join(' and '),
            archetype: '',
            lastSeen: 'recently',
            activity: context.activity || 'spending time together',
            activeThreads: context.activeThreads?.length
                ? context.activeThreads.map(t => `- ${t.topic} (${t.sentiment})`).join('\n')
                : 'No active threads',
            conversationHistory
        })

        const response = await llmService.complete({
            system: promptDef.systemPrompt,
            user: userPrompt
        }, promptDef.defaultOptions)

        const result = JSON.parse(this.extractJson(response.text))
        return result.question || 'How was it?'
    }

    private async composeEntry(session: GuidedSession): Promise<string> {
        const promptDef = getPrompt('oracle_entry_composition')
        if (!promptDef) throw new Error('Entry composition prompt not found')

        const conversationHistory = session.turns
            .map(t => `Q: ${t.oracleQuestion}\nA: ${t.userAnswer}`)
            .join('\n\n')

        const userPrompt = interpolatePrompt(promptDef.userPromptTemplate, {
            friendName: session.context.friendNames.join(' and '),
            activity: session.context.activity || 'spending time together',
            conversationHistory
        })

        const response = await llmService.complete({
            system: promptDef.systemPrompt,
            user: userPrompt
        }, promptDef.defaultOptions)

        return response.text.trim()
    }
}

export const oracleService = new OracleService()
