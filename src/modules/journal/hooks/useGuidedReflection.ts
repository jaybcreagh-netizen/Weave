/**
 * useGuidedReflection Hook
 *
 * React hook for managing guided reflection sessions.
 * Handles the conversation flow between Oracle and user.
 *
 * Flow: Questions → Compose & Save → Complete (with entryId for receipt)
 * No draft review step — saves directly on composition.
 */

import { useState, useCallback } from 'react'
import { oracleService, GuidedSession, ReflectionContext, ComposedEntry } from '@/modules/oracle'
import { logger } from '@/shared/services/logger.service'
import { database } from '@/db'
import JournalEntry from '@/db/models/JournalEntry'
import JournalEntryFriend from '@/db/models/JournalEntryFriend'
import Interaction from '@/db/models/Interaction'
import { startOfDay, format } from 'date-fns'
import { Q } from '@nozbe/watermelondb'
import { extractThemesArray } from '@/modules/reflection'
import type { StructuredReflection, OracleReflectionMetadata } from '@/shared/types/common'

export type GuidedReflectionState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'in_progress'; session: GuidedSession; currentQuestion: string; turnCount: number }
    | { status: 'saving'; session: GuidedSession }
    | { status: 'complete'; result: ComposedEntry; entryId: string }
    | { status: 'error'; error: string; partialAnswers?: string[] }

export interface UseGuidedReflectionReturn {
    state: GuidedReflectionState
    startSession: (context: ReflectionContext) => Promise<void>
    submitAnswer: (answer: string) => Promise<void>
    forceComposeEarly: () => Promise<void>
    escapeToFreeform: () => void
    reset: () => void
}

export function useGuidedReflection(): UseGuidedReflectionReturn {
    const [state, setState] = useState<GuidedReflectionState>({ status: 'idle' })

    /**
     * Save a composed session to the database.
     * Called automatically when composition finishes — no manual "save" step.
     */
    const saveToJournal = async (session: GuidedSession, result: ComposedEntry): Promise<string> => {
        let targetId: string | undefined

        // Check for existing journal entry linked to this weave (duplicate prevention)
        if (session.context.interactionId) {
            const existingEntries = await database.get<JournalEntry>('journal_entries')
                .query(Q.where('linked_weave_id', session.context.interactionId))
                .fetch()

            if (existingEntries.length > 0) {
                await database.write(async () => {
                    await existingEntries[0].update(entry => {
                        entry.content = result.content
                    })
                })

                logger.info('useGuidedReflection', 'Updated existing journal entry', {
                    entryId: existingEntries[0].id,
                    linkedWeaveId: session.context.interactionId
                })
                return existingEntries[0].id
            }
        }

        // Fetch interaction data for smart title and correct date
        let entryTitle = ''
        let entryDate = startOfDay(new Date()).getTime()

        if (session.context.interactionId) {
            try {
                const interaction = await database.get<Interaction>('interactions')
                    .find(session.context.interactionId)

                entryDate = startOfDay(interaction.interactionDate).getTime()

                const activityLabel = interaction.title || interaction.activity || 'moment'
                const friendsLabel = session.context.friendNames.length > 0
                    ? session.context.friendNames.length <= 2
                        ? session.context.friendNames.join(' & ')
                        : `${session.context.friendNames[0]} & ${session.context.friendNames.length - 1} others`
                    : ''
                const dateLabel = format(interaction.interactionDate, 'MMM d')

                entryTitle = friendsLabel
                    ? `Reflection: ${activityLabel} with ${friendsLabel} · ${dateLabel}`
                    : `Reflection: ${activityLabel} · ${dateLabel}`
            } catch (err) {
                logger.warn('useGuidedReflection', 'Could not fetch interaction for title', { err })
            }
        }

        await database.write(async () => {
            const newEntry = await database.get<JournalEntry>('journal_entries').create((entry) => {
                entry.content = result.content
                entry.entryDate = entryDate
                entry.title = entryTitle
                entry.isDraft = false
                if (session.context.interactionId) {
                    entry.linkedWeaveId = session.context.interactionId
                }
            })

            // Link friends
            for (const friendId of result.friendIds) {
                await database.get<JournalEntryFriend>('journal_entry_friends').create(link => {
                    link.journalEntry.set(newEntry)
                    link.friendId = friendId
                })
            }

            // Update Interaction with Oracle reflection metadata (including raw Q&A)
            if (session.context.interactionId) {
                try {
                    const interaction = await database.get<Interaction>('interactions')
                        .find(session.context.interactionId)

                    const extractedThemes = extractThemesArray(result.content)

                    const oracleMetadata: OracleReflectionMetadata = {
                        turnCount: session.turns.length,
                        hasDeepened: false,
                        contentLength: result.content.length,
                        linkedJournalId: newEntry.id,
                        extractedThemes,
                        rawTurns: session.turns.map(t => ({
                            question: t.oracleQuestion,
                            answer: t.userAnswer
                        }))
                    }

                    let existingReflection: StructuredReflection = {}
                    if (interaction.reflectionJSON) {
                        try {
                            existingReflection = JSON.parse(interaction.reflectionJSON)
                        } catch {
                            // Invalid JSON, start fresh
                        }
                    }

                    const updatedReflection: StructuredReflection = {
                        ...existingReflection,
                        oracleGuided: oracleMetadata
                    }

                    await interaction.update(i => {
                        i.reflectionJSON = JSON.stringify(updatedReflection)
                    })

                    logger.info('useGuidedReflection', 'Updated interaction with Oracle metadata', {
                        interactionId: session.context.interactionId,
                        turnCount: oracleMetadata.turnCount,
                        themeCount: extractedThemes.length
                    })
                } catch (err) {
                    logger.warn('useGuidedReflection', 'Could not update interaction with Oracle metadata', { err })
                }
            }

            targetId = newEntry.id
        })

        logger.info('useGuidedReflection', 'Saved journal entry', {
            entryId: targetId,
            title: entryTitle,
            friendCount: result.friendIds.length,
            linkedWeaveId: session.context.interactionId || null
        })

        return targetId!
    }

    /**
     * Compose the entry from session Q&A, save to DB, and transition to complete.
     */
    const composeAndSave = async (session: GuidedSession) => {
        setState({ status: 'saving', session })

        try {
            const result = await oracleService.completeReflection(session)
            const entryId = await saveToJournal(session, result)

            setState({ status: 'complete', result, entryId })
        } catch (error) {
            logger.error('useGuidedReflection', 'Failed to compose and save', { error })
            setState({
                status: 'error',
                error: 'Something went wrong saving your reflection.',
                partialAnswers: session.turns.map(t => t.userAnswer)
            })
        }
    }

    const startSession = useCallback(async (context: ReflectionContext) => {
        setState({ status: 'loading' })

        try {
            const session = await oracleService.startGuidedReflection(context)

            if (session.pendingQuestion) {
                setState({
                    status: 'in_progress',
                    session,
                    currentQuestion: session.pendingQuestion,
                    turnCount: 0
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
        if (state.status !== 'in_progress') return

        const previousSession = state.session
        setState({ status: 'loading' })

        try {
            const updatedSession = await oracleService.continueReflection(previousSession, answer)

            if (updatedSession.status === 'draft_ready' && updatedSession.composedDraft) {
                // Auto-save: compose finished → save immediately
                await composeAndSave(updatedSession)
            } else if (updatedSession.pendingQuestion) {
                setState({
                    status: 'in_progress',
                    session: updatedSession,
                    currentQuestion: updatedSession.pendingQuestion,
                    turnCount: updatedSession.turns.length
                })
            } else {
                throw new Error('Unexpected session state')
            }
        } catch (error) {
            logger.error('useGuidedReflection', 'Failed to continue reflection', { error })

            const partialAnswers = previousSession.turns.map(t => t.userAnswer)
            partialAnswers.push(answer)

            setState({
                status: 'error',
                error: 'Something went wrong. Want to save your answers as notes?',
                partialAnswers
            })
        }
    }, [state])

    /**
     * Force compose and save early ("I'm done" button)
     * Requires at least 1 answer
     */
    const forceComposeEarly = useCallback(async () => {
        if (state.status !== 'in_progress' || state.session.turns.length === 0) return

        const previousSession = state.session
        setState({ status: 'loading' })

        try {
            const updatedSession = await oracleService.forceCompose(previousSession)

            if (updatedSession.composedDraft) {
                await composeAndSave(updatedSession)
            }
        } catch (error) {
            logger.error('useGuidedReflection', 'Failed to force compose', { error })
            setState({
                status: 'error',
                error: 'Something went wrong. Want to save your answers as notes?',
                partialAnswers: previousSession.turns.map(t => t.userAnswer)
            })
        }
    }, [state])

    const escapeToFreeform = useCallback(() => {
        if (state.status === 'in_progress') {
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
        forceComposeEarly,
        escapeToFreeform,
        reset
    }
}
