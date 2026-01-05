/**
 * useGuidedReflection Hook
 * 
 * React hook for managing guided reflection sessions.
 * Handles the conversation flow between Oracle and user.
 */

import { useState, useCallback } from 'react'
import { oracleService } from '../services/oracle/oracle-service'
import { GuidedSession, ReflectionContext, ComposedEntry } from '../services/oracle/types'
import { logger } from '@/shared/services/logger.service'

export type GuidedReflectionState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'in_progress'; session: GuidedSession; currentQuestion: string }
    | { status: 'draft_ready'; session: GuidedSession; composedEntry: string }
    | { status: 'complete'; result: ComposedEntry }
    | { status: 'error'; error: string; partialAnswers?: string[] }

export interface UseGuidedReflectionReturn {
    state: GuidedReflectionState
    startSession: (context: ReflectionContext) => Promise<void>
    submitAnswer: (answer: string) => Promise<void>
    editDraft: (newContent: string) => void
    confirmAndSave: () => Promise<ComposedEntry>
    escapeToFreeform: () => void
    reset: () => void
}

export function useGuidedReflection(): UseGuidedReflectionReturn {
    const [state, setState] = useState<GuidedReflectionState>({ status: 'idle' })

    const startSession = useCallback(async (context: ReflectionContext) => {
        setState({ status: 'loading' })

        try {
            const session = await oracleService.startGuidedReflection(context)

            if (session.pendingQuestion) {
                setState({
                    status: 'in_progress',
                    session,
                    currentQuestion: session.pendingQuestion
                })
            } else {
                throw new Error('No initial question generated')
            }
        } catch (error) {
            logger.error('useGuidedReflection', 'Failed to start session', { error })
            setState({
                status: 'error',
                error: 'Failed to start reflection. Try again?'
            })
        }
    }, [])

    const submitAnswer = useCallback(async (answer: string) => {
        if (state.status !== 'in_progress') {
            return
        }

        const previousSession = state.session
        setState({ status: 'loading' })

        try {
            const updatedSession = await oracleService.continueReflection(previousSession, answer)

            if (updatedSession.status === 'draft_ready' && updatedSession.composedDraft) {
                setState({
                    status: 'draft_ready',
                    session: updatedSession,
                    composedEntry: updatedSession.composedDraft
                })
            } else if (updatedSession.pendingQuestion) {
                setState({
                    status: 'in_progress',
                    session: updatedSession,
                    currentQuestion: updatedSession.pendingQuestion
                })
            } else {
                throw new Error('Unexpected session state')
            }
        } catch (error) {
            logger.error('useGuidedReflection', 'Failed to continue reflection', { error })

            // Collect partial answers for recovery
            const partialAnswers = previousSession.turns.map(t => t.userAnswer)
            partialAnswers.push(answer)

            setState({
                status: 'error',
                error: 'Something went wrong. Want to save your answers as notes?',
                partialAnswers
            })
        }
    }, [state])

    const editDraft = useCallback((newContent: string) => {
        if (state.status !== 'draft_ready') return

        setState({
            ...state,
            composedEntry: newContent
        })
    }, [state])

    const confirmAndSave = useCallback(async (): Promise<ComposedEntry> => {
        if (state.status !== 'draft_ready') {
            throw new Error('Not ready to save')
        }

        const session = state.session

        // If user edited the draft, update it
        if (state.composedEntry !== session.composedDraft) {
            session.composedDraft = state.composedEntry
        }

        const result = await oracleService.completeReflection(session)

        setState({
            status: 'complete',
            result
        })

        return result
    }, [state])

    const escapeToFreeform = useCallback(() => {
        if (state.status === 'in_progress' || state.status === 'draft_ready') {
            oracleService.escapeToFreeform(state.session, 'user_chose_freeform')
        }
        setState({ status: 'idle' })
    }, [state])

    const reset = useCallback(() => {
        setState({ status: 'idle' })
    }, [])

    return {
        state,
        startSession,
        submitAnswer,
        editDraft,
        confirmAndSave,
        escapeToFreeform,
        reset
    }
}
