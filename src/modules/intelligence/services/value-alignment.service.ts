import { Q } from '@nozbe/watermelondb'
import JournalSignals, { CoreTheme, CORE_THEMES } from '@/db/models/JournalSignals'
import JournalEntryFriend from '@/db/models/JournalEntryFriend'
import { logger } from '@/shared/services/logger.service'
import { getOptionalQueryCollection } from '@/shared/utils/optional-query-collection'

export interface ValueAlignment {
    friendId: string
    sharedValues: CoreTheme[]
    uniqueFriendValues: CoreTheme[]
    alignmentScore: number // 0-1 (1 = perfect match with user's top values)
    primaryMatch?: CoreTheme // The strongest shared value
}

class ValueAlignmentService {

    /**
     * Get the user's top "lived values" based on recent journal themes.
     * Looks at the last 60 days.
     */
    async getUserTopValues(limit: number = 3): Promise<CoreTheme[]> {
        const sixtyDaysAgo = Date.now() - (60 * 24 * 60 * 60 * 1000)

        try {
            const signalsCollection = getOptionalQueryCollection<JournalSignals>('journal_signals')
            if (!signalsCollection) return []

            // Get all signals from recent entries
            const signals = await signalsCollection
                .query(
                    Q.where('extracted_at', Q.gte(sixtyDaysAgo))
                ).fetch()

            return this.extractTopThemes(signals, limit)
        } catch (error) {
            logger.error('ValueAlignmentService', 'Error fetching user values', { error })
            return []
        }
    }

    /**
     * Get the themes most commonly associated with a specific friend.
     */
    async getFriendValues(friendId: string, limit: number = 3): Promise<CoreTheme[]> {
        try {
            const entryFriendsCollection = getOptionalQueryCollection<JournalEntryFriend>('journal_entry_friends')
            const signalsCollection = getOptionalQueryCollection<JournalSignals>('journal_signals')
            if (!entryFriendsCollection || !signalsCollection) return []

            // 1. Find entries linked to this friend
            const entryLinks = await entryFriendsCollection
                .query(Q.where('friend_id', friendId))
                .fetch()

            const entryIds = entryLinks.map(link => link.journalEntryId)

            if (entryIds.length === 0) return []

            // 2. Find signals for these entries
            const signals = await signalsCollection
                .query(
                    Q.where('journal_entry_id', Q.oneOf(entryIds))
                ).fetch()

            return this.extractTopThemes(signals, limit)
        } catch (error) {
            logger.error('ValueAlignmentService', 'Error fetching friend values', { error, friendId })
            return []
        }
    }

    /**
     * Calculate alignment between User's current focus and a Friend.
     */
    async calculateAlignment(friendId: string): Promise<ValueAlignment> {
        const userValues = await this.getUserTopValues(5) // Get top 5 to cast a wider net
        const friendValues = await this.getFriendValues(friendId, 5)

        const sharedValues = friendValues.filter(v => userValues.includes(v))
        const uniqueFriendValues = friendValues.filter(v => !userValues.includes(v))

        // simple score: how many of friend's top 3 are in user's top 5?
        const top3Friend = friendValues.slice(0, 3)
        const matchCount = top3Friend.filter(v => userValues.includes(v)).length
        const alignmentScore = top3Friend.length > 0 ? matchCount / top3Friend.length : 0

        return {
            friendId,
            sharedValues,
            uniqueFriendValues,
            alignmentScore,
            primaryMatch: sharedValues[0] // Assuming sorted by frequency
        }
    }

    /**
     * Helper to count and sort themes from a list of signals
     */
    private extractTopThemes(signals: JournalSignals[], limit: number): CoreTheme[] {
        const counts: Record<string, number> = {}

        for (const signal of signals) {
            const themes = signal.coreThemes
            for (const theme of themes) {
                counts[theme] = (counts[theme] || 0) + 1
            }
        }

        // Sort by count desc
        return Object.entries(counts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, limit)
            .map(([theme]) => theme as CoreTheme)
    }

    /**
     * Generate a contextual insight string for the Oracle
     */
    getAlignmentInsight(alignment: ValueAlignment): string | null {
        if (alignment.sharedValues.length === 0) return null

        const primary = alignment.primaryMatch
        const score = alignment.alignmentScore

        if (score >= 0.6) {
            return `High Value Alignment: You and this friend share a strong focus on "${primary}".`
        }

        return `Shared Value: You both connect around "${primary}".`
    }
}

export const valueAlignment = new ValueAlignmentService()
