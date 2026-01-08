
import { llmService } from '@/shared/services/llm'
import { getPrompt, interpolatePrompt } from '@/shared/services/llm/prompt-registry'
import { oracleContextBuilder, ContextTier, OracleContext } from './context-builder'
import { logger } from '@/shared/services/logger.service'
import { trackEvent, AnalyticsEvents } from '@/shared/services/analytics.service'
import { getActiveThreadsForFriend } from '@/modules/journal/services/thread-extractor'
import {
    OracleAction,
    OracleStructuredResponse,
    ReflectionContext,
    ComposedEntry,
    InsightSignal,
    GuidedSession,
    GuidedTurn,
    OracleSuggestion,
    InsightAnalysisResult,
    AssessDraftResult,
    SmartAction
} from './types'
import { writeScheduler } from '@/shared/services/write-scheduler'
import { database } from '@/db'
import OracleConversation from '@/db/models/OracleConversation'
import { Q } from '@nozbe/watermelondb'
import Friend from '@/db/models/Friend'
import ProactiveInsight from '@/db/models/ProactiveInsight'
import UserFact from '@/db/models/UserFact'
import UserProfile from '@/db/models/UserProfile'
import JournalEntryFriend from '@/db/models/JournalEntryFriend'
import JournalEntry from '@/db/models/JournalEntry'
import JournalSignals from '@/db/models/JournalSignals'
import { INSIGHT_EXPIRY_HOURS } from './insight-rules'

// Daily limit for free users (if implemented later)
const DAILY_LIMIT = 20

// Tone modifiers for prompt injection
const TONE_MODIFIERS: Record<string, string> = {
    'grounded': 'Be concise and direct. Cite specific data. Avoid metaphors.',
    'warm': 'Be empathetic, supportive, and affirming. Use warm language.',
    'playful': 'Be light and slightly witty. Keep a casual, friendly tone.',
    'poetic': 'Use evocative metaphors and imagery. Be reflective and lyrical.'
}

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

    private activeGuidedSession: GuidedSession | null = null
    private currentConversationId: string | null = null

    constructor() {
        // Load initial state if needed
    }

    /**
     * Start a new conversation or resume an existing one
     */
    async startConversation(conversationId?: string, context = 'consultation', friendId?: string) {
        if (conversationId) {
            // Resume existing
            try {
                const conversation = await database.get<OracleConversation>('oracle_conversations').find(conversationId)
                if (conversation) {
                    this.currentConversationId = conversation.id
                    this.currentSession = {
                        id: conversation.id,
                        turns: conversation.turns,
                        contextTier: ContextTier.PATTERN, // Default for now, could be stored
                        lastUpdated: conversation.lastMessageAt.getTime()
                    }
                    return
                }
            } catch (e) {
                logger.warn('OracleService', 'Failed to load conversation', e)
            }
        }

        // Start new
        this.currentConversationId = null // Will be created on first save
        this.currentSession = {
            id: Date.now().toString(), // Temporary ID until saved
            turns: [],
            contextTier: ContextTier.PATTERN,
            lastUpdated: Date.now()
        }
    }

    /**
     * Persist current session to DB
     */
    private async persistSession(friendId?: string) {
        if (!this.currentSession || this.currentSession.turns.length === 0) return

        try {
            await database.write(async () => {
                const conversationsFn = database.get<OracleConversation>('oracle_conversations')

                if (this.currentConversationId) {
                    // Update existing
                    const conversation = await conversationsFn.find(this.currentConversationId)
                    await conversation.update(c => {
                        c.turns = this.currentSession!.turns as any
                        c.turnCount = this.currentSession!.turns.length
                        c.lastMessageAt = new Date()
                    })
                } else {
                    // Create new
                    const newConv = await conversationsFn.create(c => {
                        c.title = this.currentSession!.turns[0].content.slice(0, 50)
                        c.context = 'consultation'
                        c.friendId = friendId
                        c.turns = this.currentSession!.turns as any
                        c.turnCount = this.currentSession!.turns.length
                        c.startedAt = new Date()
                        c.lastMessageAt = new Date()
                        c.isArchived = false
                    })
                    this.currentConversationId = newConv.id
                }
            })
        } catch (error) {
            logger.error('OracleService', 'Failed to persist conversation', error)
        }
    }

    /**
     * Ask the Oracle a question
     * Returns both the text response and any suggested action
     */
    async ask(question: string, friendIds: string[] = [], additionalContext?: string): Promise<OracleResponse> {
        this.checkRateLimit()

        // Initialize session if needed
        if (!this.currentSession) {
            await this.startConversation(undefined, 'consultation', friendIds[0])
        }

        const session = this.currentSession!

        // 1. Build Context (pass question for friend name extraction)
        const contextData = await oracleContextBuilder.buildContext(friendIds, session.contextTier, question)
        let contextString = JSON.stringify(contextData, null, 2)

        if (additionalContext) {
            contextString += `\n\n[FOCUSED CONTEXT START]\nThe user is asking about this specific content (e.g. a journal entry):\n"${additionalContext}"\n[FOCUSED CONTEXT END]\n`
        }

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

        const tonePref = contextData.userProfile.oracleTonePreference || 'grounded'
        const toneModifier = TONE_MODIFIERS[tonePref] || TONE_MODIFIERS['grounded']

        const finalPrompt = interpolatePrompt(promptDef.userPromptTemplate, {
            context: contextString,
            conversationHistory: historyText,
            question: question,
            turnNumber: Math.floor(session.turns.length / 2) + 1,
            toneModifier: toneModifier // Assuming prompt registry supports this variable, or we inject into system prompt
        })

        // Inject tone modifier into system prompt
        const systemPromptWithTone = `${promptDef.systemPrompt}\n\n${toneModifier}`

        logger.info('OracleService', 'Asking Oracle', {
            questionLen: question.length,
            contextTier: session.contextTier
        })

        // 4. Call LLM
        const response = await llmService.complete({
            system: systemPromptWithTone,
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

        // Persist to DB
        await this.persistSession(friendIds[0])

        return parsed
    }

    /**
     * Ask the Oracle a question with streaming response
     * Yields the current text content as it generates
     */
    async *askStream(question: string, friendIds: string[] = [], additionalContext?: string): AsyncGenerator<string, OracleResponse, unknown> {
        this.checkRateLimit()

        // Initialize session if needed
        if (!this.currentSession) {
            await this.startConversation(undefined, 'consultation', friendIds[0])
        }

        const session = this.currentSession!

        // 1. Build Context
        const contextData = await oracleContextBuilder.buildContext(friendIds, session.contextTier, question)
        let contextString = JSON.stringify(contextData, null, 2)

        if (additionalContext) {
            contextString += `\n\n[FOCUSED CONTEXT START]\nThe user is asking about this specific content (e.g. a journal entry):\n"${additionalContext}"\n[FOCUSED CONTEXT END]\n`
        }

        // 2. Format History
        const historyText = session.turns
            .slice(-6)
            .map(t => `${t.role.toUpperCase()}: ${t.content}`)
            .join('\n\n')

        // 3. Prepare Prompt
        const promptDef = getPrompt('oracle_consultation')
        if (!promptDef) {
            throw new Error('Oracle consultation prompt not found in registry')
        }

        const tonePref = contextData.userProfile.oracleTonePreference || 'grounded'
        const toneModifier = TONE_MODIFIERS[tonePref] || TONE_MODIFIERS['grounded']

        const finalPrompt = interpolatePrompt(promptDef.userPromptTemplate, {
            context: contextString,
            conversationHistory: historyText,
            question: question,
            turnNumber: Math.floor(session.turns.length / 2) + 1,
            toneModifier: toneModifier
        })

        const systemPromptWithTone = `${promptDef.systemPrompt}\n\n${toneModifier}`

        logger.info('OracleService', 'Asking Oracle (Stream)', {
            questionLen: question.length,
            contextTier: session.contextTier
        })

        // 4. Call LLM Stream
        const stream = llmService.completeStream({
            system: systemPromptWithTone,
            user: finalPrompt,
        }, { ...promptDef.defaultOptions, jsonMode: true }) // Force JSON mode for better streaming parsing

        let fullRawText = ''
        let lastYieldedTextLength = 0

        try {
            for await (const chunk of stream) {
                fullRawText += chunk.text

                // Real-time JSON field extraction
                // Matches "text": "..." handling escaped quotes
                // We assume Gemini outputs "text" field first as per examples
                const textMatch = fullRawText.match(/"text":\s*"((?:[^"\\]|\\.)*)/)

                if (textMatch) {
                    let currentContent = textMatch[1]
                    // Unescape for display
                    currentContent = currentContent.replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\n/g, '\n')

                    if (currentContent.length > lastYieldedTextLength) {
                        yield currentContent
                        lastYieldedTextLength = currentContent.length
                    }
                } else if (!fullRawText.trim().startsWith('{') && fullRawText.length > 5) {
                    // Fallback: raw text if not JSON
                    yield fullRawText
                }
            }
        } catch (e) {
            logger.error('OracleService', 'Streaming failed', e)
            // Continue to parsing what we have or re-throwing?
            // If we have some text, we might want to save it.
            if (!fullRawText) throw e
        }

        // 5. Parse Final Response
        const parsed = this.parseResponse(fullRawText)

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

        // Persist to DB
        await this.persistSession(friendIds[0])

        return parsed
    }
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
            // Fallback 1: Try to extract text via regex if it looks like a JSON blob
            // Matches "text": "..." handling escaped quotes, even if truncated
            const textMatch = rawResponse.match(/"text":\s*"((?:[^"\\]|\\.)*)(?:"|$)/s)

            if (textMatch && textMatch[1]) {
                logger.warn('OracleService', 'JSON parse failed, but extracted text via regex', { error: e })
                let extractedText = textMatch[1]

                // Cleanup: replace escaped quotes
                extractedText = extractedText.replace(/\\"/g, '"').replace(/\\\\/g, '\\')

                return {
                    text: extractedText, // Might be truncated, but better than raw JSON
                    action: undefined
                }
            }

            // Fallback 2: If it really looks like broken JSON but we couldn't extract text, 
            // don't show the raw JSON soup to the user.
            if (rawResponse.trim().startsWith('{')) {
                logger.warn('OracleService', 'Failed to parse JSON response and extraction failed', { error: e })
                return {
                    text: "I'm having a little trouble connecting cleanly right now. Could you ask that again?",
                    action: undefined
                }
            }

            // Fallback 3: Treat as plain text (legacy behavior for non-JSON models)
            logger.warn('OracleService', 'Using raw text response', { error: e })
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
        try {
            // Remove markdown code blocks if present
            let clean = text.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1')

            // Remove any leading/trailing text outside valid JSON brackets
            // Find first '{' or '['
            const firstCurly = clean.indexOf('{')
            const firstSquare = clean.indexOf('[')

            let start = -1
            if (firstCurly !== -1 && firstSquare !== -1) {
                start = Math.min(firstCurly, firstSquare)
            } else if (firstCurly !== -1) {
                start = firstCurly
            } else {
                start = firstSquare
            }

            if (start !== -1) {
                // Find last '}' or ']'
                const lastCurly = clean.lastIndexOf('}')
                const lastSquare = clean.lastIndexOf(']')
                const end = Math.max(lastCurly, lastSquare)

                if (end > start) {
                    clean = clean.substring(start, end + 1)
                }
            }

            return clean.trim()
        } catch (e) {
            return text
        }
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
        this.activeGuidedSession = null
        this.currentConversationId = null
    }

    getCurrentSession(): OracleSession | null {
        return this.currentSession
    }

    /**
     * Analyze a journal entry to generate Contextual Lens suggestions
     */
    async analyzeEntryContext(entry: JournalEntry): Promise<OracleSuggestion[]> {
        logger.info('OracleService', 'Analyzing entry context', { entryId: entry.id })

        try {
            const promptDef = getPrompt('oracle_lens_analysis')
            if (!promptDef) {
                logger.error('OracleService', 'Oracle Lens prompt not found in registry')
                throw new Error('Oracle Lens prompt not found')
            }

            // Fetch related data
            const links = await entry.journalEntryFriends.fetch()
            const friends = await Promise.all(
                links.map(link => database.get<Friend>('friends').find(link.friendId))
            )

            const signals = await database.get<JournalSignals>('journal_signals')
                .query(Q.where('journal_entry_id', entry.id))
                .fetch()

            const signalData = signals.length > 0 ? signals[0] : null

            logger.info('OracleService', 'Context data prepared', {
                friendsCount: friends.length,
                hasSignals: !!signalData
            })

            const userPrompt = interpolatePrompt(promptDef.userPromptTemplate, {
                content: entry.content || '',
                friendNames: friends.map(f => f.name).join(', ') || 'None',
                sentimentLabel: signalData?.sentimentLabel || 'neutral',
                topics: signalData?.coreThemes?.join(', ') || 'General'
            })

            logger.info('OracleService', 'Sending prompt to LLM')

            const response = await llmService.complete({
                system: promptDef.systemPrompt,
                user: userPrompt
            }, promptDef.defaultOptions)

            logger.info('OracleService', 'LLM Response received', { length: response.text.length })

            try {
                const cleanedJson = this.extractJson(response.text)
                const suggestions = JSON.parse(cleanedJson)

                if (!Array.isArray(suggestions)) {
                    logger.error('OracleService', 'LLM response is not an array', { response: response.text })
                    return []
                }

                logger.info('OracleService', 'Parsed suggestions', { count: suggestions.length })

                // Assign UUIDs if missing (LLM might not generate them)
                // and validating minimal structure
                return suggestions.map((s: any) => ({
                    id: Math.random().toString(36).substring(7),
                    archetype: s.archetype || 'THE_HERMIT', // Fallback
                    title: s.title || 'Explore',
                    reasoning: s.reasoning || '',
                    initialQuestion: s.initialQuestion || 'What is on your mind?'
                })) as OracleSuggestion[]
            } catch (e) {
                logger.error('OracleService', 'Failed to parse Lens suggestions', { error: e, response: response.text })
                return [] // Fail gracefully
            }
        } catch (error) {
            logger.error('OracleService', 'Fatal error in analyzeEntryContext', error)
            throw error
        }
    }

    /**
     * Analyze a journal draft to see if needs expansion
     */
    async assessDraft(draft: string): Promise<AssessDraftResult> {
        // 1. Pre-check: extremely short drafts are always gaps
        if (draft.length < 10) {
            return {
                status: 'gaps',
                missing_elements: ['content'],
                clarifying_questions: ['What would you like to capture?'],
                confidence: 1.0
            }
        }

        // 2. Pre-check: extremely long drafts are always complete (don't annoy power users)
        if (draft.length > 300) {
            return {
                status: 'complete',
                missing_elements: [],
                clarifying_questions: [],
                confidence: 1.0
            }
        }

        const promptDef = getPrompt('oracle_assess_completeness')
        if (!promptDef) throw new Error('Assess completeness prompt not found')

        const userPrompt = interpolatePrompt(promptDef.userPromptTemplate, {
            draft
        })

        const response = await llmService.complete({
            system: promptDef.systemPrompt,
            user: userPrompt
        }, promptDef.defaultOptions)

        try {
            const json = this.extractJson(response.text)
            return JSON.parse(json) as AssessDraftResult
        } catch (e) {
            logger.warn('OracleService', 'Failed to parse assess draft result', e)
            // Fallback to complete to avoid blocking
            return {
                status: 'complete',
                missing_elements: [],
                clarifying_questions: [],
                confidence: 0.0
            }
        }
    }

    /**
     * Expand a draft into a full entry using QA context
     */
    async expandJournalEntry(draft: string, qa: { question: string, answer: string }[]): Promise<string> {
        const promptDef = getPrompt('oracle_deepen_composition')
        if (!promptDef) throw new Error('Deepen composition prompt not found')

        const conversationHistory = qa
            .map(t => `Q: ${t.question}\nA: ${t.answer}`)
            .join('\n\n')

        const userPrompt = interpolatePrompt(promptDef.userPromptTemplate, {
            originalDraft: draft,
            conversationHistory
        })

        const response = await llmService.complete({
            system: promptDef.systemPrompt,
            user: userPrompt
        }, promptDef.defaultOptions)

        return response.text.trim()
    }

    /**
     * Detect smart actions from arbitrary text
     */
    async detectActions(text: string, friendContext: string = ''): Promise<SmartAction[]> {
        const promptDef = getPrompt('journal_action_detection')
        if (!promptDef) throw new Error('Action detection prompt not found')

        const userPrompt = interpolatePrompt(promptDef.userPromptTemplate, {
            content: text,
            friendNames: friendContext || 'None'
        })

        const response = await llmService.complete({
            system: promptDef.systemPrompt,
            user: userPrompt
        }, promptDef.defaultOptions)

        try {
            const json = this.extractJson(response.text)
            return JSON.parse(json) as SmartAction[]
        } catch (e) {
            logger.warn('OracleService', 'Failed to parse actions', e)
            return []
        }
    }

    // ========================================================================
    // GUIDED REFLECTION MODE
    // ========================================================================
    // GUIDED REFLECTION MODE
    // Oracle asks, user answers, Oracle composes entry
    // ========================================================================

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
     * Hard limit: After 3 answers, always compose (no more questions)
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

        const turnCount = session.turns.length
        const MAX_QUESTIONS = 3

        // HARD LIMIT: After 3 answers, always compose
        if (turnCount >= MAX_QUESTIONS) {
            logger.info('OracleService', 'Hard limit reached, composing entry', { turnCount })
            session.composedDraft = await this.composeEntry(session)
            session.pendingQuestion = undefined
            session.status = 'draft_ready'
            this.activeGuidedSession = session
            return session
        }

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
            conversationHistory,
            turnCount: turnCount + 1, // Next turn number
            mustCompose: turnCount + 1 >= MAX_QUESTIONS // Signal to LLM if next is final
        })

        // Using complete() because supabase-proxy doesn't support native structured output
        const response = await llmService.complete({
            system: promptDef.systemPrompt,
            user: userPrompt
        }, promptDef.defaultOptions)

        const question = this.extractGuidedQuestion(response.text)

        // NEVER compose here - the hard limit above handles composition after 3 answers
        // Always ask the next question (LLM's or fallback)
        session.pendingQuestion = (question && question.length > 3)
            ? question
            : 'What else stood out to you?'

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

        // If this reflection was triggered from an insight, mark it as acted_on
        if (session.context.insightId) {
            try {
                const insight = await database.get<ProactiveInsight>('proactive_insights').find(session.context.insightId)
                await writeScheduler.important('markInsightActedOn', async () => {
                    await insight.update(rec => {
                        rec.status = 'acted_on'
                        rec.statusChangedAt = new Date()
                    })
                })
                logger.info('OracleService', 'Marked insight as acted_on', { insightId: session.context.insightId })
            } catch (error) {
                logger.warn('OracleService', 'Could not mark insight as acted_on', { insightId: session.context.insightId, error })
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
     * Force compose an entry early (user tapped "That's enough")
     * Requires at least 1 answer to compose from
     */
    async forceCompose(session: GuidedSession): Promise<GuidedSession> {
        if (session.status !== 'in_progress' || session.turns.length === 0) {
            throw new Error('Cannot force compose: no answers to compose from')
        }

        logger.info('OracleService', 'Force composing entry early', { turnCount: session.turns.length })

        session.composedDraft = await this.composeEntry(session)
        session.pendingQuestion = undefined
        session.status = 'draft_ready'

        this.activeGuidedSession = session
        return session
    }

    /**
     * Start deepening an existing draft with follow-up questions
     * Returns a session in 'deepening' mode
     */
    async startDeepening(session: GuidedSession): Promise<GuidedSession> {
        if (session.status !== 'draft_ready' || !session.composedDraft) {
            throw new Error('Cannot deepen: no draft available')
        }

        // Generate first deepening question
        const promptDef = getPrompt('oracle_deepen_question')
        if (!promptDef) throw new Error('Deepen question prompt not found')

        const userPrompt = interpolatePrompt(promptDef.userPromptTemplate, {
            originalDraft: session.composedDraft,
            conversationHistory: '(Starting deepening conversation)',
            turnCount: 1,
            mustCompose: false
        })

        // Using complete() because supabase-proxy doesn't support native structured output
        const response = await llmService.complete({
            system: promptDef.systemPrompt,
            user: userPrompt
        }, promptDef.defaultOptions)

        const question = this.extractGuidedQuestion(response.text)

        session.deepeningTurns = []
        session.originalDraft = session.composedDraft
        session.hasDeepened = true
        session.pendingQuestion = (question && question.length > 3) ? question : 'What else would you like to add?'
        session.status = 'deepening'

        logger.info('OracleService', 'Started deepening reflection', {
            originalLength: session.composedDraft.length
        })

        this.activeGuidedSession = session
        return session
    }

    /**
     * Continue deepening with user's answer
     * Hard limit: After 3 deepening answers, always compose refined entry
     */
    async continueDeepening(session: GuidedSession, answer: string): Promise<GuidedSession> {
        if (session.status !== 'deepening' || !session.pendingQuestion) {
            throw new Error('Session not in deepening mode')
        }

        // Record the deepening turn
        const turn: GuidedTurn = {
            oracleQuestion: session.pendingQuestion,
            userAnswer: answer
        }
        session.deepeningTurns = session.deepeningTurns || []
        session.deepeningTurns.push(turn)

        const turnCount = session.deepeningTurns.length
        const MAX_DEEPEN_QUESTIONS = 3

        // HARD LIMIT: After 3 deepening answers, always compose refined entry
        if (turnCount >= MAX_DEEPEN_QUESTIONS) {
            logger.info('OracleService', 'Deepening hard limit reached', { turnCount })
            session.composedDraft = await this.composeDeepenedEntry(session)
            session.pendingQuestion = undefined
            session.status = 'draft_ready'
            this.activeGuidedSession = session
            return session
        }

        // Generate next deepening question or compose
        const promptDef = getPrompt('oracle_deepen_question')
        if (!promptDef) throw new Error('Deepen question prompt not found')

        const conversationHistory = session.deepeningTurns
            .map((t: GuidedTurn) => `Oracle: ${t.oracleQuestion}\nUser: ${t.userAnswer}`)
            .join('\n\n')

        const userPrompt = interpolatePrompt(promptDef.userPromptTemplate, {
            originalDraft: session.originalDraft || session.composedDraft,
            conversationHistory,
            turnCount: turnCount + 1,
            mustCompose: turnCount + 1 >= MAX_DEEPEN_QUESTIONS
        })

        // Using complete() because supabase-proxy doesn't support native structured output
        const response = await llmService.complete({
            system: promptDef.systemPrompt,
            user: userPrompt
        }, promptDef.defaultOptions)

        const question = this.extractGuidedQuestion(response.text)

        // Check if response indicates ready to compose (look for the flag in raw response)
        const readyToCompose = response.text.toLowerCase().includes('"readytocompose": true') ||
            response.text.toLowerCase().includes('"readytocompose":true')

        if (readyToCompose) {
            session.composedDraft = await this.composeDeepenedEntry(session)
            session.pendingQuestion = undefined
            session.status = 'draft_ready'
        } else {
            session.pendingQuestion = (question && question.length > 3)
                ? question
                : 'What else would you like to add?'
        }

        this.activeGuidedSession = session
        return session
    }

    /**
     * Compose a deepened/refined entry from original + deepening Q&A
     */
    private async composeDeepenedEntry(session: GuidedSession): Promise<string> {
        const promptDef = getPrompt('oracle_deepen_composition')
        if (!promptDef) throw new Error('Deepen composition prompt not found')

        const conversationHistory = (session.deepeningTurns || [])
            .map((t: GuidedTurn) => `Q: ${t.oracleQuestion}\nA: ${t.userAnswer}`)
            .join('\n\n')

        const userPrompt = interpolatePrompt(promptDef.userPromptTemplate, {
            originalDraft: session.originalDraft || session.composedDraft,
            conversationHistory
        })

        const response = await llmService.complete({
            system: promptDef.systemPrompt,
            user: userPrompt
        }, promptDef.defaultOptions)

        return response.text.trim()
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

    /**
     * Generate personalized starter prompts based on user context
     * Uses LLM for dynamic variety, falls back to static logic
     */
    async getPersonalizedStarterPrompts(context: OracleContext): Promise<{ text: string, icon: string, prompt?: string }[]> {
        try {
            // 1. Try LLM generation
            const promptDef = getPrompt('oracle_starter_prompts')
            if (!promptDef) throw new Error('Starter prompts prompt not found')

            // Format context for prompt
            const topFriends = context.friends
                .slice(0, 3)
                .map(f => f.name)
                .join(', ') || 'None'

            const interpolatedUserPrompt = interpolatePrompt(promptDef.userPromptTemplate, {
                socialSeason: context.userProfile.socialSeason,
                socialBatteryTrend: context.userProfile.socialBattery.trend,
                socialBatteryLevel: context.userProfile.socialBattery.current,
                needingAttentionCount: context.socialHealth.needingAttentionCount.toString(),
                recentSentiment: context.recentJournaling?.[0]?.sentiment === 'reflective' ? 'Reflective' : 'Neutral',
                topFriends
            })

            const response = await llmService.complete(
                {
                    system: promptDef.systemPrompt,
                    user: interpolatedUserPrompt
                },
                {
                    temperature: 0.8,
                    jsonMode: true
                }
            )

            const json = this.extractJson(response.text)
            const generatedPrompts = JSON.parse(json) as { text: string, prompt: string, icon: string }[]

            if (Array.isArray(generatedPrompts) && generatedPrompts.length > 0) {
                return generatedPrompts
            }

            throw new Error('Empty or invalid prompts from LLM')

        } catch (error) {
            console.warn('[OracleService] Failed to generate dynamic prompts, falling back to static:', error)
            return this._getStaticStarterPrompts(context)
        }
    }

    /**
     * Fallback static prompts
     */
    private _getStaticStarterPrompts(context: OracleContext): { text: string, icon: string, prompt?: string }[] {
        const prompts: { text: string, icon: string, prompt?: string }[] = []

        // Social season awareness
        if (context.userProfile.socialSeason === 'resting') {
            prompts.push({
                text: "Reflect on my 'Resting' season",
                prompt: "My social season is currently 'Resting'. Help me check in with my energy levels and reflect on my need for rest.",
                icon: 'battery-low'
            })
        } else if (context.userProfile.socialSeason === 'blooming') {
            prompts.push({
                text: "Analyze my social momentum",
                prompt: "My social season is currently 'Blooming' and I have momentum. Help me reflect on how this feels and how to channel this energy sustainably.",
                icon: 'sparkles'
            })
        }

        // Friends needing attention
        if (context.socialHealth.needingAttentionCount > 0) {
            const count = context.socialHealth.needingAttentionCount
            prompts.push({
                text: "Who am I losing touch with?",
                prompt: `I have ${count} friends who haven't heard from me in a while. Help me identify who they might be and draft a quick message to one of them.`,
                icon: 'users'
            })
        }

        // Specific friend drift (highest priority one)
        // We'd need to find drifting friends from context.friends if we had that detail exposed easily
        // context.friends are generic FriendOracleContext.
        // Let's assume we can check socialHealth or just pick a random specific prompt if we have data.

        // Recent journal sentiment
        const recentJournal = context.recentJournaling?.[0]
        if (recentJournal?.sentiment === 'reflective') {
            prompts.push({
                text: "Go deeper on my last entry",
                prompt: "My last journal entry was quite reflective. Help me expand on those thoughts and go deeper.",
                icon: 'book-open'
            })
        }

        // Battery trend
        if (context.userProfile.socialBattery.trend === 'Draining') {
            prompts.push({
                text: "My battery is draining - help?",
                prompt: "My social battery has been draining recently. Suggest some ways I can recharge or protect my energy.",
                icon: 'battery-charging'
            })
        }

        // Fallback generic prompts if none matched (or to fill up)
        const fallbacks = [
            {
                text: "I need to vent...",
                prompt: "I want to vent or process something. Ask me what's on my mind.",
                icon: 'message-circle'
            },
            {
                text: "Who should I call?",
                prompt: "I've been thinking about connection. Help me figure out who I should reach out to.",
                icon: 'phone'
            },
            {
                text: "Check my social battery",
                prompt: "Help me assess my current social energy levels.",
                icon: 'battery'
            }
        ]

        // Add fallbacks to ensure we have at least 3
        let needed = 3 - prompts.length
        if (needed > 0) {
            prompts.push(...fallbacks.slice(0, needed))
        }

        return prompts
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
            conversationHistory,
            turnCount: previousTurns.length + 1,
            mustCompose: false
        })

        // Using complete() because supabase-proxy doesn't support native structured output
        const response = await llmService.complete({
            system: promptDef.systemPrompt,
            user: userPrompt
        }, promptDef.defaultOptions)

        // Robust parsing with multiple fallback strategies
        const question = this.extractGuidedQuestion(response.text)
        return question && question.length > 3 ? question : 'How was it?'
    }

    /**
     * Extract question from LLM response with multiple fallback strategies
     */
    private extractGuidedQuestion(responseText: string): string | undefined {
        logger.debug('OracleService', 'extractGuidedQuestion input', {
            responseLength: responseText?.length,
            responsePreview: responseText?.substring(0, 200)
        })

        // Strategy 1: Try to parse as JSON
        try {
            const json = this.extractJson(responseText)
            logger.debug('OracleService', 'extractJson result', { json: json?.substring(0, 200) })
            const parsed = JSON.parse(json)
            logger.debug('OracleService', 'Parsed JSON', { parsed })

            // If we successfully parsed JSON, use its values
            if (typeof parsed === 'object' && parsed !== null) {
                // If question exists and is a valid string, return it
                if (parsed.question && typeof parsed.question === 'string' && parsed.question.length > 3) {
                    logger.info('OracleService', 'Strategy 1 succeeded: JSON parse with question', { question: parsed.question })
                    return parsed.question
                }

                // If readyToCompose is true, return undefined to trigger composition
                if (parsed.readyToCompose === true) {
                    logger.info('OracleService', 'Strategy 1: readyToCompose=true, returning undefined')
                    return undefined
                }
            }
        } catch (e) {
            logger.debug('OracleService', 'JSON parse failed', { error: (e as Error).message })
        }

        // Strategy 2: Extract question field via regex
        const questionMatch = responseText.match(/"question"\s*:\s*"([^"]+)"/)
        if (questionMatch?.[1] && questionMatch[1].length > 3) {
            logger.info('OracleService', 'Strategy 2 succeeded: regex extraction', { question: questionMatch[1] })
            return questionMatch[1]
        }

        // Strategy 3: Look for a question in the text (ends with ?)
        const questionSentence = responseText.match(/([^.!?]*\?)\s*$/)?.[1]?.trim()
        if (questionSentence && questionSentence.length > 10) {
            logger.info('OracleService', 'Strategy 3 succeeded: question sentence', { question: questionSentence })
            return questionSentence
        }

        // Strategy 4: Clean up raw text as last resort
        // SKIP if the response looks like JSON (contains readyToCompose or structured data)
        if (responseText.includes('readyToCompose') || responseText.includes('"question"')) {
            logger.debug('OracleService', 'Strategy 4 skipped: response appears to be JSON')
            return undefined
        }

        const cleaned = responseText
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/```\s*$/, '')
            .replace(/^[{[\s"']+/, '')
            .replace(/[}\]"'\s]+$/, '')
            .trim()

        if (cleaned.length > 10 && !cleaned.includes('{') && !cleaned.includes(':')) {
            logger.info('OracleService', 'Strategy 4 succeeded: cleaned text', { question: cleaned })
            return cleaned
        }

        logger.warn('OracleService', 'All extraction strategies failed', {
            responseText: responseText?.substring(0, 300)
        })
        return undefined
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
    /**
     * Generate a narrative summary for the Weekly Reflection
     */
    /**
     * Generate a narrative summary for the Weekly Reflection
     */
    async generateWeeklyNarrative(summary: any, season: string | null = null): Promise<string> {
        // Sanitize summary to avoid circular JSON (WatermelonDB models)
        // We extract only what the LLM needs for the narrative
        const sanitizedSummary = {
            totalInteractions: summary.totalInteractions,
            uniqueFriends: summary.uniqueFriends?.length || 0,
            interactionsPerDay: summary.interactionsPerDay,
            topFriends: summary.friendActivity?.slice(0, 5).map((f: any) => ({
                name: f.friendName,
                count: f.count,
                tier: f.tier
            })) || [],
            reconnections: summary.reconnections?.map((r: any) => r.friendName) || [],
            weekStreak: summary.weekStreak,
            socialBatteryAvg: summary.socialBatteryAvg
        };

        const seasonContext = season ? `The user is currently in a "${season}" social season phase.` : "";

        const prompt = `
        You are the Oracle, a calm and observant guide. Your tone is grounded, minimalist, and deeply mindful. 
        Think: "A quiet observation shared over a cup of tea."

        DATA FOR THE WEEK:
        ${JSON.stringify(sanitizedSummary, null, 2)}
        Season: ${seasonContext}

        INSTRUCTIONS:
        1. Write 2-3 sentences reflecting on the user's social rhythm this week.
        2. Focus on "Relational Architecture": Use words like rhythm, presence, space, consistency, or gravity instead of flowery metaphors (no "glow," "magic," or "whispers"). "Threads" is okay.
        3. Acknowledge the reality of their effort. If they were quiet, validate the "Resting" phase as intentional space. If they are "Blooming" but inactive, describe it as a "quiet readiness" rather than a failure.
        4. Be specific about the data without sounding like a report.
        5. End with one brief, actionable suggestion.

        STYLE CONSTRAINTS:
        - No flowery adjectives or romanticized metaphors.
        - No Markdown. Plain text only.
        - Use "They/Them" or the person's Name.
        - Keep the language spare and intentional.
        `;

        try {
            const response = await llmService.complete({
                system: "You are a wise relationship counselor.",
                user: prompt
            });
            return response.text;
        } catch (e) {
            logger.error('OracleService', 'Error generating narrative', e);
            return "The stars have been quiet this week, but your journey continues. Take this time to reflect on what matters most.";
        }
    }


    // ========================================================================
    // SIGNAL PROCESSING (Proactive Insights)
    // ========================================================================

    /**
     * Process raw signals into polished insights via LLM
     */
    async synthesizeInsights(signals: InsightSignal[]): Promise<void> {
        // 1. Fetch active insights to prevent duplicates/spam
        const activeInsights = await database.get<ProactiveInsight>('proactive_insights').query(
            Q.where('status', Q.oneOf(['unseen', 'seen']))
        ).fetch()

        // 2. Filter out signals that are already "covered" by active insights
        // Simplification: If we have ANY active synthesis insight, maybe we don't gen another?
        // Or if the signals match exactly? behavior:
        // For now, allow generation if > 2 signals or if distinct enough.
        // Actually, with biweekly frequency, we assume the previous ones are expired/archived by the time we run this.
        // But let's be safe.

        // If we have a very recent insight (last 24h), skip
        const recent = activeInsights.find(i =>
            i.generatedAt.getTime() > Date.now() - 24 * 60 * 60 * 1000
        )
        if (recent) {
            logger.info('OracleService', 'Skipping synthesis: Recent insight exists')
            return
        }

        // 3. Prepare Prompt Context
        const signalContexts = await Promise.all(signals.map(async s => {
            let friendName = 'Unknown'
            if (s.friendId) {
                try {
                    const friend = await database.get<Friend>('friends').find(s.friendId)
                    friendName = friend.name
                } catch { }
            }
            return {
                type: s.type,
                friendName,
                data: s.data,
                priority: s.priority
            }
        }))

        // 4. Generate Synthesis
        try {
            const toneModifier = await this.getUserToneModifier()
            const prompt = `
            DATA SIGNALS:
            ${JSON.stringify(signalContexts, null, 2)}

            INSTRUCTIONS:
            Synthesize these signals into a single, cohesive "letter" from the Oracle.
            - Do not list them item by item.
            - Find the narrative thread connecting them (e.g. "You've been focused on inner circle..." or "A lot of drifting lately...").
            - If signals are contradictory, note the balance.
            - Length: 2-3 short paragraphs.
            - Tone: ${toneModifier}.
            - End with a gentle question or thought.
            
            Output JSON: { "headline": "...", "body": "..." }
            `

            const response = await llmService.complete({
                system: "You are the Oracle, a wise relationship synthesizer.",
                user: prompt
            }, {
                jsonMode: true
            })

            const result = JSON.parse(response.text)

            // 5. Save Insight
            await writeScheduler.important('createProactiveInsight', async () => {
                const newInsight = await database.get<ProactiveInsight>('proactive_insights').create(insight => {
                    insight.ruleId = `synthesis_${Date.now()}`
                    insight.type = 'pattern' // Synthesis is a pattern of signals
                    insight.headline = result.headline || 'Oracle Insight'
                    insight.body = result.body
                    insight.groundingDataJson = JSON.stringify({ signalCount: signals.length })
                    insight.sourceSignalsJson = JSON.stringify(signals)
                    insight.actionType = 'guided_reflection' // Default for synthesis
                    insight.actionLabel = 'Reflect'
                    insight.severity = Math.max(...signals.map(s => s.priority))
                    insight.generatedAt = new Date()
                    insight.expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days expiry
                    insight.status = 'unseen'
                })

                // Track Event
                trackEvent(AnalyticsEvents.INSIGHT_GENERATED, {
                    insightId: newInsight.id,
                    signalCount: signals.length,
                    severity: newInsight.severity
                })
            })

            logger.info('OracleService', `Generated Synthesis from ${signals.length} signals`)

        } catch (e) {
            logger.error('OracleService', 'Synthesis failed', e)
        }
    }

    /**
     * @deprecated Used for single-signal processing. Replaced by synthesizeInsights in v58.
     */
    async processSignals(signals: InsightSignal[]): Promise<void> {
        // ... legacy implementation ...
        // 1. Fetch active insights to prevent duplicates
        const activeInsights = await database.get<ProactiveInsight>('proactive_insights').query(
            Q.where('status', Q.oneOf(['unseen', 'seen']))
        ).fetch()

        // 2. Build map of existing signals
        // Key format: `${signal.type}:${signal.friendId || 'pattern'}`
        const activeKeys = new Set(activeInsights.map(insight => {
            // Map insight ruleId back to signal type if possible, or just use identifying info
            // Insight ruleId is `signal_${signal.type}`
            const type = insight.ruleId.replace('signal_', '')
            return `${type}:${insight.friendId || 'pattern'}`
        }))

        // 3. Filter out signals that are already active
        const newSignals = signals.filter(signal => {
            const key = `${signal.type}:${signal.friendId || 'pattern'}`
            // If we already have this insight active, skip it
            return !activeKeys.has(key)
        })

        // 4. Sort by priority
        const sorted = newSignals.sort((a, b) => b.priority - a.priority)

        // 5. Take top 1 (Reduced from 3 to prevent backlog/fatigue)
        const topSignals = sorted.slice(0, 1)

        logger.info('OracleService', `Processing ${topSignals.length} signals (from ${signals.length} raw, ${newSignals.length} new)`)

        // 6. Process in parallel
        await Promise.all(topSignals.map(signal => this.polishSignal(signal)))
    }

    /**
     * Use LLM to transform a signal into a magical, gender-neutral insight
     */
    /**
     * Use LLM to transform a signal into a magical, gender-neutral insight
     */
    private async polishSignal(signal: InsightSignal): Promise<void> {
        let prompt = ''
        let friend: Friend | undefined

        // Fetch friend if present
        if (signal.friendId) {
            try {
                friend = await database.get<Friend>('friends').find(signal.friendId)
            } catch (e) {
                // If friend not found, proceed as pattern
            }
        }

        // BRANCH 1: Journal Signal (Inferred Life Event)
        if (signal.type === 'journal_signal') {
            const themes = signal.data.coreThemes || []
            const isCelebration = themes.includes('celebration') || themes.includes('reconnection')

            prompt = `
            You are the Oracle, identifying a significant moment from the user's journal.
            
            SIGNAL: Journal Entry with themes: ${themes.join(', ')}
            FRIEND: ${friend ? friend.name : 'Unknown User'}
            CONTEXT: ${JSON.stringify(signal.data)}

            INSTRUCTIONS:
            1. Write a 1-2 sentence observation.
            2. If it's a 'celebration' or 'life_transition', suggest adding it as a Life Event so they remember it.
            3. Be warm and architectural. 
            
            Example: "It sounds like a major milestone for Sarah. Would you like to mark this 'Engagement' on her timeline?"

            Output format: Just the text.
            `
        }
        // BRANCH 2: Friend-based Insight
        else if (signal.friendId && friend) {
            prompt = `
            You are the Weave Oracle, a calm and observant guide. 
            Your tone is grounded, minimalist, and deeply mindful. Think: "A quiet observation shared over a cup of tea."
            
            Write a short observation for the user about their friend ${friend.name}.
    
            SIGNAL INPUT:
            Type: ${signal.type}
            Data: ${JSON.stringify(signal.data)}
            Friend Tier: ${friend.tier}
            
            INSTRUCTIONS:
            1. Focus on "Relational Architecture": Use words like rhythm, presence, space, consistency, or gravity instead of flowery metaphors.
            2. Gender: Use "They/Them" or the friend's name (${friend.name}). Do NOT use He/She unless you are 100% certain.
            3. Brevity: Keep insights to 1-2 short sentences.
            4. Context: If "lastActivityType" is present, subtly weave it in (e.g. "since that last coffee").
    
            STYLE CONSTRAINTS:
            - No flowery adjectives (no "glow", "magic", "whispers").
            - "Threads" is okay (it's the app name), but keep it grounded.
            - Avoid the "Robot": Never say "Based on your data" or "You haven't seen them in X days."
            - Keep the language spare and intentional.
            
            Output format: Just the text.
            `
        }
        // BRANCH 3: Pattern-based Insight (Activity/Location/Vibe)
        else if (signal.type === 'activity_habit') {
            const activity = signal.data.activity || 'Unknown Activity'
            const count = signal.data.count || 0
            prompt = `
            TASK: Write a 1-sentence insight about the user's recurring activity.
            
            DATA:
            - Activity: "${activity}"
            - Frequency: ${count} times this month
            
            TEMPLATE: Start your response with: "Your '${activity}' routine..."
            
            Then add ONE short sentence explaining why this is valuable (e.g., consistency, social anchor, low-effort connection).
            
            Example: "Your 'Coffee' routine has become a reliable anchor for connection. 4 times this month suggests it works for you."
            
            Output: Just the 1-2 sentence text. No quotes.
            `
        }
        else if (signal.type === 'location_pattern') {
            const location = signal.data.location || 'Unknown Place'
            const count = signal.data.count || 0
            prompt = `
            TASK: Write a 1-sentence insight about the user's go-to spot.
            
            DATA:
            - Location: "${location}"
            - Frequency: ${count} visits this month
            
            TEMPLATE: Start your response with: "${location} has become..."
            
            Then add ONE short sentence on why this spot is meaningful (e.g., familiar territory, low effort, reliable memories).
            
            Example: "Central Park has become your familiar ground. ${count} visits this month shows it's your default weave setting."
            
            Output: Just the 1-2 sentence text. No quotes.
            `
        }
        else if (signal.type === 'vibe_trend') {
            const vibe = signal.data.vibe || 'undefined'
            const count = signal.data.count || 0
            const total = signal.data.total || 0
            prompt = `
            TASK: Write a 1-sentence insight about the user's recent energy trend.
            
            DATA:
            - Dominant Vibe: "${vibe}"
            - How often: ${count} out of ${total} recent interactions
            
            TEMPLATE: Start your response with: "Your recent vibe has been mostly '${vibe}'..."
            
            Then add ONE sentence with a gentle observation or encouragement.
            
            Example: "Your recent vibe has been mostly 'high energy'. That's ${count} out of ${total} weaves feeling good—maintain that momentum."
            
            Output: Just the 1-2 sentence text. No quotes.
            `
        }
        else {
            // Fallback for unknown pattern types
            prompt = `
            TASK: Summarize the following data in ONE sentence. Be specific.
            DATA: ${JSON.stringify(signal.data)}
            Output: Just the text.
            `
        }

        try {
            // Fetch user's tone preference
            const toneModifier = await this.getUserToneModifier()

            const response = await llmService.complete({
                system: `You are a wise relationship companion. ${toneModifier}`,
                user: prompt
            })

            const polishedText = response.text.trim().replace(/^["']|["']$/g, '')
            if (!polishedText) return

            // Save to DB
            await writeScheduler.important('createProactiveInsight', async () => {
                await database.get<ProactiveInsight>('proactive_insights').create(insight => {
                    insight.ruleId = `signal_${signal.type}`
                    insight.type = signal.friendId ? 'friend' : 'pattern'
                    insight.friendId = signal.friendId // Optional
                    insight.headline = this.getHeadlineForSignal(signal.type, friend?.name || 'You', signal.data)
                    insight.body = polishedText
                    insight.groundingDataJson = JSON.stringify(signal.data)
                    insight.actionType = this.getActionTypeForSignal(signal.type)
                    insight.actionLabel = this.getActionLabelForSignal(signal.type)
                    // Customize action params for journal signal
                    const actionParams = signal.type === 'journal_signal'
                        ? {
                            friendId: signal.friendId,
                            eventType: 'milestone', // Default
                            eventDescription: 'Imported from Journal'
                        }
                        : (signal.friendId ? { friendId: signal.friendId } : {})

                    insight.actionParamsJson = JSON.stringify(actionParams)
                    insight.severity = signal.priority
                    insight.generatedAt = new Date()
                    insight.expiresAt = new Date(Date.now() + INSIGHT_EXPIRY_HOURS * 60 * 60 * 1000)
                    insight.status = 'unseen'
                })
            })

            logger.info('OracleService', `Generated insight (${signal.type}): ${polishedText}`)

        } catch (e) {
            logger.error('OracleService', 'Failed to polish signal', e)
        }
    }

    private getHeadlineForSignal(type: string, name: string, data?: Record<string, any>): string {
        switch (type) {
            case 'drifting': return `Drifting from ${name}`
            case 'deepening': return `Deepening with ${name}`
            case 'reconnection_win': return `Welcome back, ${name}`
            case 'consistency_win': return `On a roll with ${name}`
            case 'one_sided': return `One-sided with ${name}?`
            case 'location_pattern': return data?.location ? `Your Spot: ${data.location}` : 'Familiar Ground'
            case 'activity_habit': return data?.activity ? `Your ${data.activity} Habit` : 'Your Ritual'
            case 'vibe_trend': return data?.vibe ? `Vibe Check: ${data.vibe}` : 'Energy Check'
            case 'journal_signal': return `Moment with ${name}`
            default: return `Insight: ${name}`
        }
    }

    private getActionTypeForSignal(type: string): string {
        switch (type) {
            case 'deepening': return 'guided_reflection'
            case 'location_pattern': return 'log_weave' // Encourage logging more at this spot
            case 'activity_habit': return 'plan_weave' // Plan another one?
            case 'vibe_trend': return 'create_reflection' // Reflect on why energy is high/low
            case 'journal_signal': return 'add_life_event'
            default: return 'plan_weave'
        }
    }

    private getActionLabelForSignal(type: string): string {
        switch (type) {
            case 'deepening': return 'Reflect'
            case 'drifting': return 'Reach out'
            case 'reconnection_win': return 'Keep it up'
            case 'location_pattern': return 'Log another'
            case 'activity_habit': return 'Plan again'
            case 'vibe_trend': return 'Journal'
            case 'journal_signal': return 'Add Event'
            default: return 'Connect'
        }
    }

    /**
     * CRYSTALIZED MEMORY (Phase 3)
     * Save a fact about the user or a friend based on accepted insight or direct feedback.
     */
    async learnFact(content: string, category: string, confidence = 1.0, friendId?: string): Promise<void> {
        await writeScheduler.important('learnFact', async () => {
            // Check if similar fact exists to avoid duplicates
            const existing = await database.get<UserFact>('user_facts')
                .query(Q.where('fact_content', content))
                .fetch()

            if (existing.length > 0) return

            await database.get<UserFact>('user_facts').create(fact => {
                fact.factContent = content
                fact.category = category
                fact.confidence = confidence
                fact.source = 'oracle_feedback'
                fact.relevantFriendId = friendId
            })
        })
    }

    /**
     * Get the user's preferred tone modifier for Oracle prompts.
     */
    private async getUserToneModifier(): Promise<string> {
        try {
            const profile = await database.get<UserProfile>('user_profile').query().fetch()
            if (profile.length > 0 && profile[0].oracleTonePreference) {
                return TONE_MODIFIERS[profile[0].oracleTonePreference] || TONE_MODIFIERS['grounded']
            }
        } catch (e) {
            // Default
        }
        return TONE_MODIFIERS['grounded']
    }

    /**
     * Invalidate (mark as acted_on) insights for specific friends when user interacts with them.
     */
    async invalidateInsightsForFriends(friendIds: string[]): Promise<void> {
        if (!friendIds || friendIds.length === 0) return

        try {
            // Find active insights for these friends
            const insights = await database.get<ProactiveInsight>('proactive_insights').query(
                Q.where('status', Q.oneOf(['unseen', 'seen'])),
                Q.where('friend_id', Q.oneOf(friendIds))
            ).fetch()

            if (insights.length === 0) return

            await writeScheduler.important('invalidateInsights', async () => {
                await database.batch(
                    ...insights.map(insight => insight.prepareUpdate(rec => {
                        rec.status = 'acted_on'
                        rec.statusChangedAt = new Date()
                    }))
                )
            })

            logger.info('OracleService', `Invalidated ${insights.length} insights for friends`, { friendIds })
        } catch (error) {
            logger.error('OracleService', 'Failed to invalidate insights', error)
        }
    }

    /**
     * Phase 3: Insight Assessment Engine
     * Analyzes a user's question to identify underlying patterns before answering.
     */
    async analyzeInsightIntent(query: string, friendId?: string): Promise<InsightAnalysisResult> {
        try {
            // 1. Build context
            let contextSummary = "No specific friend context selected.";
            if (friendId) {
                const context = await oracleContextBuilder.buildContext([friendId], ContextTier.PATTERN);
                const friend = context.friends[0];
                if (friend) {
                    contextSummary = `
                    Friend: ${friend.name}
                    Tier: ${friend.tier}
                    Archetype: ${friend.archetype}
                    
                    Pattern Signals:
                    ${friend.themes?.map(s => `- ${s}`).join('\n') || 'None'}
                    
                    Recent Dynamics:
                    - Trend: ${friend.dynamics?.trend || 'Unknown'}
                    - Reciprocity: ${friend.dynamics?.reciprocity || 'Unknown'}
                    `;
                }
            }

            // 2. Call LLM Service
            const response = await llmService.completeFromRegistry(
                'oracle_insight_analysis',
                {
                    context_summary: contextSummary,
                    user_query: query
                },
                {
                    jsonMode: true,
                    temperature: 0.3
                }
            );

            if (!response.text) {
                throw new Error('Empty response from LLM');
            }

            // 3. Parse JSON
            // Clean markdown code blocks if present (common LLM artifact)
            const cleanJson = response.text.replace(/```json\n|\n```/g, '').trim();
            const result = JSON.parse(cleanJson) as InsightAnalysisResult;
            return result;

        } catch (error) {
            logger.error('OracleService', 'Failed to analyze insight intent', error);
            // Fallback result
            return {
                analysis: "Unable to analyze deeply at this moment.",
                identified_pattern: "Unknown",
                clarifying_question: "Could you tell me a bit more about what's on your mind?",
                confidence: 0
            };
        }
    }
}

export const oracleService = new OracleService()
