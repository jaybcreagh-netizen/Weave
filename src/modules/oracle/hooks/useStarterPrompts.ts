/**
 * useStarterPrompts Hook
 * Generates contextual and evergreen starter prompts for the Oracle.
 * Now context-aware based on where Oracle was opened from.
 */

import { useMemo, useState, useEffect } from 'react'
import { useFriendsObservable } from '@/shared/context/FriendsObservableContext'
import { generateFollowUpPrompts, FollowUpPrompt } from '@/modules/journal/services/followup-generator'
import { oracleService } from '../services/oracle-service'
import { oracleContextBuilder, ContextTier } from '../services/context-builder'
import { useSuggestions } from '@/modules/interactions'
import { database } from '@/db'
import { Q } from '@nozbe/watermelondb'
import Intention from '@/db/models/Intention'

export interface StarterPrompt {
    id: string
    text: string
    type: 'contextual' | 'evergreen' | 'followup'
}

// Context types for Oracle entry points
export type OracleEntryPoint = 'insights' | 'circle' | 'journal' | 'friend' | 'interaction' | 'default'

/**
 * Generate starter prompts for the Oracle empty state.
 * Returns a mix of follow-up prompts, contextual prompts, and evergreen prompts.
 * 
 * @param context - Where Oracle was opened from (affects chip suggestions)
 */
export function useStarterPrompts(context: OracleEntryPoint = 'default'): StarterPrompt[] {
    const { friends } = useFriendsObservable()
    const { suggestions } = useSuggestions()
    const [followUps, setFollowUps] = useState<FollowUpPrompt[]>([])
    const [activeIntentions, setActiveIntentions] = useState<any[]>([])

    const [personalizedContextPrompts, setPersonalizedContextPrompts] = useState<StarterPrompt[]>([])

    // Fetch active intentions
    useEffect(() => {
        if (context === 'insights') {
            const subscription = database.get<Intention>('intentions')
                .query(Q.where('status', 'active'))
                .observe()
                .subscribe(setActiveIntentions)
            return () => subscription.unsubscribe()
        }
    }, [context])

    // Fetch follow-up prompts on mount
    useEffect(() => {
        let mounted = true
        generateFollowUpPrompts(2).then(prompts => {
            if (mounted) setFollowUps(prompts)
        })
        return () => { mounted = false }
    }, [])

    // Fetch personalized prompts (async)
    useEffect(() => {
        let mounted = true
        const fetchPersonalized = async () => {
            if (context === 'default' || context === 'insights') {
                try {
                    // Use PATTERN tier to get journal sentiment
                    const oracleContext = await oracleContextBuilder.buildContext([], ContextTier.PATTERN)
                    const rawPrompts = await oracleService.getPersonalizedStarterPrompts(oracleContext)

                    if (mounted) {
                        setPersonalizedContextPrompts(rawPrompts.map((p, i) => ({
                            id: `pers-${i}-${Date.now()}`,
                            text: p.text,
                            type: 'contextual'
                        })))
                    }
                } catch (error) {
                    console.warn('Failed to fetch personalized prompts', error)
                }
            }
        }
        fetchPersonalized()
        return () => { mounted = false }
    }, [context])

    return useMemo(() => {
        const prompts: StarterPrompt[] = []

        // === 1. Context-Specific Prompts ===

        if (context === 'circle') {
            // === CIRCLE CONTEXT: Friend Actions (Suggestions & Intentions) ===

            // A. Suggestions (Max 2)
            const validSuggestions = suggestions
                .filter(s => {
                    // Strict filtering: distinct friend required
                    if (!s.friendId) return false
                    const f = friends.find(friend => friend.id === s.friendId)
                    return f && f.name // Must have a resolved friend with a name
                })
                .slice(0, 2)

            validSuggestions.forEach(s => {
                const friend = friends.find(f => f.id === s.friendId)!

                // Format: "catch_up" -> "Catch up"
                const humanType = s.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

                prompts.push({
                    id: `sugg-${s.id}`,
                    text: `${humanType} with ${friend.name}`,
                    type: 'contextual'
                })
            })

            // B. Intentions (Max 1)
            const validIntentions = activeIntentions
                .filter(i => i.description && i.description !== 'null') // Filter nulls
                .slice(0, 1)

            validIntentions.forEach(i => {
                const friend = i.friendId ? friends.find(f => f.id === i.friendId) : null
                const label = friend ? `Intention: ${i.description}` : `Intention: ${i.description}`
                prompts.push({
                    id: `int-${i.id}`,
                    text: label,
                    type: 'contextual'
                })
            })

            // C. Fallbacks for Circle
            if (prompts.length < 3) {
                const topFriend = friends.find(f => f.tier === 'InnerCircle')
                if (topFriend) {
                    prompts.push({
                        id: 'about-friend',
                        text: `How is ${topFriend.name} doing?`,
                        type: 'contextual',
                    })
                }
                prompts.push(
                    { id: 'who-needs-attention', text: 'Who needs attention?', type: 'evergreen' }
                )
            }
        }
        else if (context === 'insights') {
            // === INSIGHTS CONTEXT: Data & Journaling ===
            prompts.push(
                { id: 'summarise-week', text: 'Summarise my week', type: 'evergreen' },
                { id: 'patterns', text: 'What are my social patterns?', type: 'evergreen' },
                { id: 'battery-check', text: 'How is my social battery?', type: 'evergreen' }
            )
        }
        else if (context === 'journal') {
            // === JOURNAL CONTEXT ===
            prompts.push(
                { id: 'draft-reflection', text: 'Draft a reflection', type: 'evergreen' },
                { id: 'what-to-write', text: 'What should I write about?', type: 'evergreen' },
                { id: 'recent-highlights', text: 'Recent highlights', type: 'evergreen' },
            )
        }
        else {
            // === DEFAULT / OTHER CONTEXTS ===

            // 1. Personalized (Season/Battery)
            if (personalizedContextPrompts.length > 0) {
                prompts.push(...personalizedContextPrompts)
            }

            // 2. Follow-Ups (only in default/journal contexts mostly)
            for (const fu of followUps) {
                prompts.push({
                    id: `followup-${fu.threadId}`,
                    text: fu.question,
                    type: 'followup',
                })
            }

            // 3. Fallbacks
            if (prompts.length < 4) {
                prompts.push(
                    { id: 'who-to-see', text: 'Who should I see this week?', type: 'evergreen' },
                    { id: 'patterns', text: 'What are my social patterns?', type: 'evergreen' },
                )
            }
        }

        // Add follow-ups to Circle context if we have space (low priority there)
        if (context === 'circle' && prompts.length < 4) {
            for (const fu of followUps.slice(0, 1)) {
                prompts.push({
                    id: `followup-${fu.threadId}`,
                    text: fu.question,
                    type: 'followup',
                })
            }
        }

        return prompts.slice(0, 4) // Strict limit to 4
    }, [friends, followUps, context, personalizedContextPrompts, suggestions, activeIntentions])
}

