
import { useState, useCallback } from 'react'
import { oracleService, OracleTurn } from '../services/oracle-service'
import { logger } from '@/shared/services/logger.service'
import { database } from '@/db'
import JournalEntry from '@/db/models/JournalEntry'

export interface UseOracleResult {
    messages: OracleTurn[]
    isLoading: boolean
    error: string | null
    askQuestion: (text: string, context?: string, displayOverride?: string) => Promise<void>
    startWithContext: (instruction: string, context?: string) => Promise<void>
    loadConversation: (id: string) => Promise<void>
    remainingQuestions: number
    resetParams: () => void
    saveToJournal: () => Promise<void>
    isSaved: boolean
}

export function useOracle(): UseOracleResult {
    const [messages, setMessages] = useState<OracleTurn[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [remainingQuestions, setRemainingQuestions] = useState(oracleService.getRemainingQuestions())
    const [isSaved, setIsSaved] = useState(false)

    const askQuestion = useCallback(async (text: string, context?: string, displayOverride?: string) => {
        if (!text.trim()) return

        setIsLoading(true)
        setError(null)
        setIsSaved(false)

        const userMsg: OracleTurn = {
            role: 'user',
            content: displayOverride || text,
            timestamp: Date.now()
        }

        // Add user message immediately
        setMessages(prev => [...prev, userMsg])

        try {
            // Call Oracle (Non-streaming for Supabase Proxy compatibility)
            // Note: oracleService.ask returns { text, action }
            const response = await oracleService.ask(text, [], context)

            const assistantMsg: OracleTurn = {
                role: 'assistant',
                content: response.text,
                timestamp: Date.now(),
                action: response.action
            }

            setMessages(prev => [...prev, assistantMsg])
            setRemainingQuestions(oracleService.getRemainingQuestions())
        } catch (err) {
            handleError(err)

            // Remove user message on failure? 
            // Better to keep it so they can copy/retry
        } finally {
            setIsLoading(false)
        }
    }, [])

    const startWithContext = useCallback(async (instruction: string, context?: string) => {
        setIsLoading(true)
        setError(null)
        setIsSaved(false)

        try {
            // Send instruction as user message BUT do not add to local state
            // OracleService will track it in session, but UI won't show it
            const response = await oracleService.ask(instruction, [], context)

            const oracleMsg: OracleTurn = {
                role: 'assistant',
                content: response.text,
                timestamp: Date.now(),
                action: response.action
            }
            setMessages([oracleMsg]) // Start with this message
            setRemainingQuestions(oracleService.getRemainingQuestions())
        } catch (err) {
            handleError(err)
        } finally {
            setIsLoading(false)
        }
    }, [])

    const handleError = (err: any) => {
        logger.error('useOracle', 'Failed to ask Oracle', err)
        if (err instanceof Error && err.message === 'ORACLE_RATE_LIMIT_EXCEEDED') {
            setError('You have reached your daily limit of questions.')
        } else {
            setError('The Oracle is meditating. Please try again later.')
        }
    }

    const saveToJournal = useCallback(async () => {
        if (messages.length === 0 || isSaved) return

        try {
            // Format conversation as journal content
            const conversationText = messages.map(msg => {
                if (msg.role === 'user') {
                    return `**You asked:** ${msg.content}`
                } else {
                    return `**Oracle:** ${msg.content}`
                }
            }).join('\n\n')

            const title = messages.find(m => m.role === 'user')?.content.slice(0, 50) || 'Oracle Consultation'

            await database.write(async () => {
                await database.get<JournalEntry>('journal_entries').create(entry => {
                    entry.entryDate = Date.now()
                    entry.title = title.length === 50 ? title + '...' : title
                    entry.content = conversationText
                    entry.promptUsed = 'oracle' // Tag as Oracle conversation
                    entry.isDraft = false
                })
            })

            setIsSaved(true)
            logger.info('useOracle', 'Saved conversation to journal')
        } catch (err) {
            logger.error('useOracle', 'Failed to save to journal', err)
        }
    }, [messages, isSaved])

    const resetParams = useCallback(() => {
        oracleService.resetSession()
        setMessages([])
        setError(null)
        setIsSaved(false)
        setRemainingQuestions(oracleService.getRemainingQuestions())
    }, [])

    const loadConversation = useCallback(async (conversationId: string) => {
        setIsLoading(true)
        try {
            await oracleService.startConversation(conversationId)
            const session = oracleService.getCurrentSession()
            if (session) {
                setMessages(session.turns)
            }
        } catch (e) {
            handleError(e)
        } finally {
            setIsLoading(false)
        }
    }, [])

    return {
        messages,
        isLoading,
        error,
        askQuestion,
        startWithContext,
        loadConversation,
        remainingQuestions,
        resetParams,
        saveToJournal,
        isSaved
    }
}
