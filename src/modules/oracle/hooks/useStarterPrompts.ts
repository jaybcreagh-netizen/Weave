/**
 * useStarterPrompts Hook
 * Generates contextual and evergreen starter prompts for the Oracle.
 * Now context-aware based on where Oracle was opened from.
 */

import { useMemo, useState, useEffect } from 'react'
import { useFriendsObservable } from '@/shared/context/FriendsObservableContext'
import { generateFollowUpPrompts, FollowUpPrompt } from '@/modules/journal/services/followup-generator'

export interface StarterPrompt {
    id: string
    text: string
    type: 'contextual' | 'evergreen' | 'followup'
}

// Context types for Oracle entry points
export type OracleContext = 'insights' | 'circle' | 'journal' | 'friend' | 'interaction' | 'default'

/**
 * Generate starter prompts for the Oracle empty state.
 * Returns a mix of follow-up prompts, contextual prompts, and evergreen prompts.
 * 
 * @param context - Where Oracle was opened from (affects chip suggestions)
 */
export function useStarterPrompts(context: OracleContext = 'default'): StarterPrompt[] {
    const { friends } = useFriendsObservable()
    const [followUps, setFollowUps] = useState<FollowUpPrompt[]>([])

    // Fetch follow-up prompts on mount
    useEffect(() => {
        let mounted = true
        generateFollowUpPrompts(2).then(prompts => {
            if (mounted) setFollowUps(prompts)
        })
        return () => { mounted = false }
    }, [])

    return useMemo(() => {
        const prompts: StarterPrompt[] = []

        // === Follow-Up Prompts (highest priority) ===
        for (const fu of followUps) {
            prompts.push({
                id: `followup-${fu.threadId}`,
                text: fu.question,
                type: 'followup',
            })
        }

        // === Context-Aware Prompts ===
        switch (context) {
            case 'insights':
                // Reflection-focused chips
                prompts.push(
                    { id: 'summarise-week', text: 'Summarise my week', type: 'evergreen' },
                    { id: 'patterns', text: 'What are my social patterns?', type: 'evergreen' },
                    { id: 'how-doing', text: 'How am I doing socially?', type: 'evergreen' },
                )
                break

            case 'circle':
                // Friend-focused chips
                const topFriend = friends.find(f => f.tier === 'InnerCircle')
                if (topFriend) {
                    prompts.push({
                        id: 'about-friend',
                        text: `Tell me about ${topFriend.name}`,
                        type: 'contextual',
                    })
                }
                prompts.push(
                    { id: 'attention-needed', text: 'Who needs attention?', type: 'evergreen' },
                    { id: 'who-to-see', text: 'Who should I see today?', type: 'evergreen' },
                )
                break

            case 'journal':
                // Writing-focused chips
                prompts.push(
                    { id: 'draft-reflection', text: 'Draft a reflection', type: 'evergreen' },
                    { id: 'what-to-write', text: 'What should I write about?', type: 'evergreen' },
                    { id: 'recent-highlights', text: 'Recent highlights', type: 'evergreen' },
                )
                break

            default:
                // General prompts (legacy behavior)
                // Find a friend with low weave score (needs attention)
                const needsAttentionFriend = friends.find(f => f.needsAttention || f.weaveScore < 30)
                if (needsAttentionFriend && prompts.length < 3) {
                    prompts.push({
                        id: 'needs-attention',
                        text: `I haven't seen ${needsAttentionFriend.name} in a while`,
                        type: 'contextual',
                    })
                }

                // Find an Inner Circle friend for deep reflection
                const innerCircleFriend = friends.find(f => f.tier === 'InnerCircle')
                if (innerCircleFriend && !needsAttentionFriend && prompts.length < 3) {
                    prompts.push({
                        id: 'inner-circle',
                        text: `How are things going with ${innerCircleFriend.name}?`,
                        type: 'contextual',
                    })
                }

                // Add evergreen prompts
                prompts.push(
                    { id: 'who-to-see', text: 'Who should I see this week?', type: 'evergreen' },
                    { id: 'attention-needed', text: 'Which friends need attention?', type: 'evergreen' },
                    { id: 'patterns', text: 'What are my social patterns?', type: 'evergreen' },
                )
                break
        }

        return prompts.slice(0, 5)
    }, [friends, followUps, context])
}
