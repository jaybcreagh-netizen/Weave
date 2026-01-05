/**
 * Prompt Context Builder
 * 
 * Transforms journal context data into a format suitable for LLM prompt generation.
 * This bridges the journal-context-engine (which provides raw data) and the
 * LLM prompt registry (which expects specific template variables).
 */

import { MeaningfulWeave, FriendJournalContext } from './journal-context-engine'
import { PromptContext } from './journal-prompts'
import { formatDistanceToNowStrict } from 'date-fns'

// ============================================================================
// Types
// ============================================================================

/**
 * Payload structure expected by the journal_prompt template in prompt-registry.ts
 */
export interface PromptContextPayload {
    friendName: string
    archetype: string
    tier: string
    daysSince: number
    recentInteraction: string  // Human-readable summary of last weave
    patterns: string           // Detected relationship patterns
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Build a context payload for the LLM journal prompt generator.
 * Transforms raw PromptContext into template variables.
 */
export function buildPromptContextPayload(context: PromptContext): PromptContextPayload {
    switch (context.type) {
        case 'weave':
            return buildWeaveContextPayload(context.weave)
        case 'friend':
            return buildFriendContextPayload(context.friendContext)
        case 'general':
        default:
            return buildGeneralContextPayload()
    }
}

// ============================================================================
// Context Type Builders
// ============================================================================

/**
 * Build payload from a recent weave
 */
function buildWeaveContextPayload(weave: MeaningfulWeave): PromptContextPayload {
    const primaryFriend = weave.friends?.[0]
    const interaction = weave.interaction

    // Calculate actual days since interaction
    const daysSince = Math.floor(
        (Date.now() - new Date(interaction.interactionDate).getTime()) / (1000 * 60 * 60 * 24)
    )

    // Build human-readable interaction summary
    const category = interaction.interactionCategory || interaction.activity || 'connection'
    const duration = formatDuration(interaction.duration)
    const vibe = formatVibe(interaction.vibe)
    const timeAgo = formatDistanceToNowStrict(new Date(interaction.interactionDate), { addSuffix: true })

    let recentInteraction = `${category} ${timeAgo}`
    if (duration) {
        recentInteraction += `, ${duration}`
    }
    if (vibe) {
        recentInteraction += `, ${vibe}`
    }
    if (interaction.note && interaction.note.length > 20) {
        // Include a snippet of notes if they're substantial
        const notePreview = interaction.note.slice(0, 50).trim()
        recentInteraction += `. Notes: "${notePreview}..."`
    }

    // Build patterns from meaningfulness reasons
    const patterns = weave.meaningfulnessReasons.length > 0
        ? weave.meaningfulnessReasons.join(', ')
        : 'recent quality time'

    return {
        friendName: primaryFriend?.name || 'a friend',
        archetype: primaryFriend?.archetype || 'Unknown',
        tier: primaryFriend?.dunbarTier || 'Community',
        daysSince,
        recentInteraction,
        patterns,
    }
}

/**
 * Build payload from friend context
 */
function buildFriendContextPayload(ctx: FriendJournalContext): PromptContextPayload {
    // Build interaction summary from recent weaves
    let recentInteraction = 'No recent interactions'
    if (ctx.recentWeaves.length > 0) {
        const lastWeave = ctx.recentWeaves[0]
        const timeAgo = formatDistanceToNowStrict(lastWeave.date, { addSuffix: true })
        recentInteraction = `${lastWeave.category} ${timeAgo}`
        if (lastWeave.notes) {
            const notePreview = lastWeave.notes.slice(0, 40).trim()
            recentInteraction += ` — "${notePreview}..."`
        }
    }

    // Build patterns from detected themes and engagement data
    const patternParts: string[] = []

    if (ctx.detectedThemes.length > 0) {
        patternParts.push(`themes: ${ctx.detectedThemes.slice(0, 3).join(', ')}`)
    }

    if (ctx.thisMonthWeaves >= 5) {
        patternParts.push('very active this month')
    } else if (ctx.thisMonthWeaves >= 2) {
        patternParts.push('regular contact')
    }

    if (ctx.totalJournalEntries > 5) {
        patternParts.push('frequently journaled about')
    }

    if (ctx.daysSinceLastWeave > 30) {
        patternParts.push('reconnection after a gap')
    }

    // Add initiation and momentum patterns if available on friend model
    const friend = ctx.friend as { initiationRatio?: number; momentum?: string }
    if (friend.initiationRatio !== undefined) {
        if (friend.initiationRatio > 0.7) {
            patternParts.push('you usually initiate')
        } else if (friend.initiationRatio < 0.3) {
            patternParts.push('they usually reach out')
        }
    }
    if (friend.momentum === 'rising') {
        patternParts.push('relationship momentum building')
    } else if (friend.momentum === 'declining') {
        patternParts.push('been quieter lately')
    }

    const patterns = patternParts.length > 0
        ? patternParts.join('; ')
        : `${ctx.friendshipDuration} friendship`

    return {
        friendName: ctx.friend.name,
        archetype: ctx.friend.archetype || 'Unknown',
        tier: ctx.friend.dunbarTier || 'Community',
        daysSince: ctx.daysSinceLastWeave,
        recentInteraction,
        patterns,
    }
}

/**
 * Build generic payload for general reflection
 */
function buildGeneralContextPayload(): PromptContextPayload {
    return {
        friendName: 'your relationships',
        archetype: 'General',
        tier: 'All',
        daysSince: 0,
        recentInteraction: 'your social life lately',
        patterns: 'general reflection',
    }
}

// ============================================================================
// Formatting Helpers
// ============================================================================

/**
 * Format duration to human-readable string
 */
function formatDuration(duration: string | undefined | null): string {
    if (!duration) return ''

    const durationMap: Record<string, string> = {
        'Quick': 'quick meetup',
        'Short': 'short hangout',
        'Medium': 'good amount of time',
        'Long': 'extended time together',
        'Extended': 'long session',
    }

    return durationMap[duration] || ''
}

/**
 * Format vibe/moon phase to emotional descriptor
 */
function formatVibe(vibe: string | undefined | null): string {
    if (!vibe) return ''

    const vibeMap: Record<string, string> = {
        'NewMoon': 'low energy',
        'WaxingCrescent': 'building connection',
        'FirstQuarter': 'solid connection',
        'WaxingGibbous': 'really connected',
        'FullMoon': 'amazing vibe',
        'WaningGibbous': 'winding down nicely',
        'LastQuarter': 'comfortable',
        'WaningCrescent': 'mellow',
        'Neutral': '',
    }

    return vibeMap[vibe] || ''
}
