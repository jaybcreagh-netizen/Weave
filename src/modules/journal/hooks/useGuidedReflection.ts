/**
 * useGuidedReflection Hook
 * 
 * React hook for managing guided reflection sessions.
 * Handles the conversation flow between Oracle and user.
 */

import { useState, useCallback } from 'react'
import { oracleService, GuidedSession, ReflectionContext, ComposedEntry, actionExtractionService } from '@/modules/oracle'
import { logger } from '@/shared/services/logger.service'
import { database } from '@/db'
import JournalEntry from '@/db/models/JournalEntry'
import JournalEntryFriend from '@/db/models/JournalEntryFriend'
import Interaction from '@/db/models/Interaction'
import { startOfDay, format } from 'date-fns'
import { Q } from '@nozbe/watermelondb'
import { extractThemesArray } from '@/modules/reflection/utils/text-analysis'
import type { StructuredReflection, OracleReflectionMetadata } from '@/shared/types/common'

export type GuidedReflectionState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'in_progress'; session: GuidedSession; currentQuestion: string; turnCount: number }
    | { status: 'deepening'; session: GuidedSession; currentQuestion: string; turnCount: number }
    | { status: 'draft_ready'; session: GuidedSession; composedEntry: string; canDeepen: boolean }
    | { status: 'complete'; result: ComposedEntry }
    | { status: 'error'; error: string; partialAnswers?: string[] }

export interface UseGuidedReflectionReturn {
    state: GuidedReflectionState
    startSession: (context: ReflectionContext) => Promise<void>
    submitAnswer: (answer: string) => Promise<void>
    forceComposeEarly: () => Promise<void>  // "That's enough" button
    goDeeper: () => Promise<void>           // "Go Deeper" button
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
        if (state.status !== 'in_progress' && state.status !== 'deepening') {
            return
        }

        const previousSession = state.session
        const isDeepening = state.status === 'deepening'
        setState({ status: 'loading' })

        try {
            const updatedSession = isDeepening
                ? await oracleService.continueDeepening(previousSession, answer)
                : await oracleService.continueReflection(previousSession, answer)

            if (updatedSession.status === 'draft_ready' && updatedSession.composedDraft) {
                setState({
                    status: 'draft_ready',
                    session: updatedSession,
                    composedEntry: updatedSession.composedDraft,
                    canDeepen: !updatedSession.hasDeepened // Only allow deepening once
                })
            } else if (updatedSession.status === 'deepening' && updatedSession.pendingQuestion) {
                setState({
                    status: 'deepening',
                    session: updatedSession,
                    currentQuestion: updatedSession.pendingQuestion,
                    turnCount: updatedSession.deepeningTurns?.length || 0
                })
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

    /**
     * Force compose an entry early ("That's enough" button)
     * Requires at least 1 answer
     */
    const forceComposeEarly = useCallback(async () => {
        if (state.status !== 'in_progress' || state.session.turns.length === 0) {
            return
        }

        const previousSession = state.session
        setState({ status: 'loading' })

        try {
            const updatedSession = await oracleService.forceCompose(previousSession)

            if (updatedSession.composedDraft) {
                setState({
                    status: 'draft_ready',
                    session: updatedSession,
                    composedEntry: updatedSession.composedDraft,
                    canDeepen: !updatedSession.hasDeepened
                })
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

    /**
     * Start deepening the current draft ("Go Deeper" button)
     */
    const goDeeper = useCallback(async () => {
        if (state.status !== 'draft_ready' || !state.canDeepen) {
            return
        }

        const previousSession = state.session
        setState({ status: 'loading' })

        try {
            const updatedSession = await oracleService.startDeepening(previousSession)

            if (updatedSession.pendingQuestion) {
                setState({
                    status: 'deepening',
                    session: updatedSession,
                    currentQuestion: updatedSession.pendingQuestion,
                    turnCount: 0
                })
            }
        } catch (error) {
            logger.error('useGuidedReflection', 'Failed to start deepening', { error })
            // Return to draft state on error
            setState({
                status: 'draft_ready',
                session: previousSession,
                composedEntry: previousSession.composedDraft || '',
                canDeepen: false
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

        // Actually save to the database as a JournalEntry
        try {
            // Check for existing journal entry linked to this weave (duplicate prevention)
            if (session.context.interactionId) {
                const existingEntries = await database.get<JournalEntry>('journal_entries')
                    .query(Q.where('linked_weave_id', session.context.interactionId))
                    .fetch()

                if (existingEntries.length > 0) {
                    // Update existing entry instead of creating duplicate
                    await database.write(async () => {
                        await existingEntries[0].update(entry => {
                            entry.content = result.content
                        })
                    })

                    logger.info('useGuidedReflection', 'Updated existing journal entry', {
                        entryId: existingEntries[0].id,
                        linkedWeaveId: session.context.interactionId
                    })

                    setState({ status: 'complete', result })
                    return result
                }
            }

            // Fetch interaction data for smart title and correct date
            let entryTitle = ''
            let entryDate = startOfDay(new Date()).getTime()

            if (session.context.interactionId) {
                try {
                    const interaction = await database.get<Interaction>('interactions')
                        .find(session.context.interactionId)

                    // Use interaction date instead of today
                    entryDate = startOfDay(interaction.interactionDate).getTime()

                    // Build smart title: "Reflection: [Title/Activity] with [Friends] · [Date]"
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

            let targetId: string | undefined;

            await database.write(async () => {
                const newEntry = await database.get<JournalEntry>('journal_entries').create((entry) => {
                    entry.content = result.content
                    entry.entryDate = entryDate
                    entry.title = entryTitle
                    entry.isDraft = false
                    // Link to interaction if this was a post-weave reflection
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

                logger.info('useGuidedReflection', 'Saved journal entry', {
                    entryId: newEntry.id,
                    title: entryTitle,
                    friendCount: result.friendIds.length,
                    linkedWeaveId: session.context.interactionId || null
                })

                // Update Interaction with Oracle reflection metadata
                if (session.context.interactionId) {
                    try {
                        const interaction = await database.get<Interaction>('interactions')
                            .find(session.context.interactionId)

                        // Extract themes from the composed content
                        const extractedThemes = extractThemesArray(result.content)

                        // Build Oracle reflection metadata
                        const oracleMetadata: OracleReflectionMetadata = {
                            turnCount: session.turns.length + (session.deepeningTurns?.length || 0),
                            hasDeepened: session.hasDeepened || false,
                            contentLength: result.content.length,
                            linkedJournalId: newEntry.id,
                            extractedThemes
                        }

                        // Parse existing reflection or create new one
                        let existingReflection: StructuredReflection = {}
                        if (interaction.reflectionJSON) {
                            try {
                                existingReflection = JSON.parse(interaction.reflectionJSON)
                            } catch {
                                // Invalid JSON, start fresh
                            }
                        }

                        // Merge Oracle metadata into reflection
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
                            hasDeepened: oracleMetadata.hasDeepened,
                            contentLength: oracleMetadata.contentLength,
                            themeCount: extractedThemes.length
                        })
                    } catch (err) {
                        // Non-critical - log but don't fail the save
                        logger.warn('useGuidedReflection', 'Could not update interaction with Oracle metadata', { err })
                    }
                }

                targetId = newEntry.id;
            })

            // TRIGGER SILENT AUDIT
            if (targetId) {
                actionExtractionService.queueEntry(targetId)
            }

        } catch (error) {
            logger.error('useGuidedReflection', 'Failed to save journal entry', { error })
            throw error
        }

        setState({
            status: 'complete',
            result
        })

        return result
    }, [state])

    const escapeToFreeform = useCallback(() => {
        if (state.status === 'in_progress' || state.status === 'draft_ready' || state.status === 'deepening') {
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
        goDeeper,
        editDraft,
        confirmAndSave,
        escapeToFreeform,
        reset
    }
}
