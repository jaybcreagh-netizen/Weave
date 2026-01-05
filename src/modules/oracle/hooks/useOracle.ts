
import { useState, useCallback } from 'react'
import { oracleService, OracleTurn } from '../services/oracle-service'
import { logger } from '@/shared/services/logger.service'
import { database } from '@/db'
import JournalEntry from '@/db/models/JournalEntry'

export interface UseOracleResult {
    messages: OracleTurn[]
    isLoading: boolean
    error: string | null
    askQuestion: (text: string) => Promise<void>
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

    const askQuestion = useCallback(async (text: string) => {
        if (!text.trim()) return

        setIsLoading(true)
        setError(null)
        setIsSaved(false) // Reset saved state for new conversation

        // Optimistic update
        const userMsg: OracleTurn = { role: 'user', content: text, timestamp: Date.now() }
        setMessages(prev => [...prev, userMsg])

        try {
            const response = await oracleService.ask(text)
            const oracleMsg: OracleTurn = {
                role: 'assistant',
                content: response.text,
                timestamp: Date.now(),
                action: response.action
            }
            setMessages(prev => [...prev, oracleMsg])
            setRemainingQuestions(oracleService.getRemainingQuestions())
        } catch (err) {
            logger.error('useOracle', 'Failed to ask Oracle', err)
            if (err instanceof Error && err.message === 'ORACLE_RATE_LIMIT_EXCEEDED') {
                setError('You have reached your daily limit of questions.')
            } else {
                setError('The Oracle is meditating. Please try again later.')
            }
            // Remove optimistic message if needed? No, keep it so user can retry or copy.
        } finally {
            setIsLoading(false)
        }
    }, [])

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

    return {
        messages,
        isLoading,
        error,
        askQuestion,
        remainingQuestions,
        resetParams,
        saveToJournal,
        isSaved
    }
}
