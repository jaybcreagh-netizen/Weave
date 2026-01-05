
import { database } from '@/db'
import { Q } from '@nozbe/watermelondb'
import Friend from '@/db/models/Friend'
import Interaction from '@/db/models/Interaction'
import JournalEntry from '@/db/models/JournalEntry'
import { logger } from '@/shared/services/logger.service'

/**
 * Oracle Context Tiers
 * Defines the depth of information to include based on token budget.
 */
export enum ContextTier {
    ESSENTIAL = 'essential', // Minimal identity & stats
    PATTERN = 'pattern',     // Themes, dynamics, habits
    RICH = 'rich'            // Full history, recent logs
}

export interface OracleContext {
    userProfile: UserContext
    friends: FriendOracleContext[]
    socialHealth: SocialHealthContext
    recentJournaling: JournalSummary[]
    venueAndActivitySuggestions?: VenueSuggestions  // NEW
}

interface UserContext {
    name: string
    currentFocus?: string
}

interface FriendOracleContext {
    id: string
    name: string
    tier: string
    archetype: string

    // Tier: PATTERN +
    themes?: string[]
    dynamics?: {
        trend?: string
        reciprocity?: string
    }
    stats?: {
        interactionCount: number
        lastMet: string // "2 days ago"
    }

    // NEW: Past activities and venues with this friend
    pastActivities?: string[]  // e.g. ["coffee", "dinner", "hiking"]
    favoriteVenues?: string[]  // Locations they've been to together
}

interface SocialHealthContext {
    totalActiveFriends: number
    needingAttentionCount: number
    overallVibe: string
}

interface JournalSummary {
    date: string
    topics: string[]
    sentiment: string
}

// NEW: Archetype-based venue/activity suggestions
interface VenueSuggestions {
    byArchetype: Record<string, string[]>  // e.g. { "Hermit": ["quiet coffee shop", "bookstore"], ... }
    forGroup?: string[]  // Suggestions for group based on combined archetypes
}

class OracleContextBuilder {

    /**
     * Build context for the Oracle based on selected friends or general scope.
     * @param friendIds Optional list of friends to focus on. If empty, general context is built.
     * @param tier Depth of context to retrieve
     * @param question Optional question text to extract friend names from
     */
    async buildContext(friendIds: string[] = [], tier: ContextTier = ContextTier.PATTERN, question?: string): Promise<OracleContext> {
        logger.debug('OracleContextBuilder', `Building ${tier} context`, { friendCount: friendIds.length, hasQuestion: !!question })

        // If question is provided, try to find mentioned friends
        let mentionedFriendIds: string[] = []
        if (question) {
            mentionedFriendIds = await this.extractMentionedFriends(question)
            logger.debug('OracleContextBuilder', `Found ${mentionedFriendIds.length} mentioned friends`, { mentionedFriendIds })
        }

        // Combine explicitly requested friends with mentioned friends
        const allFriendIds = [...new Set([...friendIds, ...mentionedFriendIds])]

        const friends = await this.getFriends(allFriendIds)
        const formattedFriends = await Promise.all(friends.map(f => this.formatFriend(f, tier)))

        // Generate venue/activity suggestions based on archetypes
        const archetypes = friends.map(f => f.archetype).filter(Boolean)
        const venueSuggestions = this.getVenueSuggestions(archetypes)

        return {
            userProfile: await this.getUserContext(),
            friends: formattedFriends,
            socialHealth: await this.getSocialHealth(),
            recentJournaling: await this.getRecentJournaling(tier),
            venueAndActivitySuggestions: venueSuggestions
        }
    }

    /**
     * Extract friend names mentioned in the question and return their IDs
     */
    private async extractMentionedFriends(question: string): Promise<string[]> {
        try {
            // Get all friends
            const allFriends = await database.get<Friend>('friends').query().fetch()

            // Normalize question for matching
            const normalizedQuestion = question.toLowerCase()

            // Find friends whose names appear in the question
            const matchedFriends = allFriends.filter(friend => {
                const name = friend.name.toLowerCase()
                // Check for exact word match (not substring of another word)
                const regex = new RegExp(`\\b${this.escapeRegex(name)}\\b`, 'i')
                return regex.test(normalizedQuestion)
            })

            return matchedFriends.map(f => f.id)
        } catch (error) {
            logger.warn('OracleContextBuilder', 'Error extracting friend names', { error })
            return []
        }
    }

    /**
     * Escape special regex characters in a string
     */
    private escapeRegex(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    private async getFriends(friendIds: string[]): Promise<Friend[]> {
        const friendsCollection = database.get<Friend>('friends')
        if (friendIds.length > 0) {
            return await friendsCollection.query(Q.where('id', Q.oneOf(friendIds))).fetch()
        } else {
            // For general query, get Inner Circle + Close Friends needing attention
            return await friendsCollection.query(
                Q.where('dunbar_tier', Q.oneOf(['InnerCircle', 'CloseFriends'])),
                Q.sortBy('weave_score', Q.asc), // Lowest score = most neglected
                Q.take(10)
            ).fetch()
        }
    }

    private async formatFriend(friend: Friend, tier: ContextTier): Promise<FriendOracleContext> {
        const base: FriendOracleContext = {
            id: friend.id,
            name: friend.name,
            tier: friend.tier,
            archetype: friend.archetype || 'Not set',
        }

        if (tier === ContextTier.ESSENTIAL) return base

        // PATTERN Tier - add themes and dynamics
        base.themes = friend.detectedThemes || []
        base.dynamics = {
            trend: friend.topicTrend || 'stable',
            reciprocity: friend.initiationRatio ? (friend.initiationRatio > 0.6 ? 'you-give' : friend.initiationRatio < 0.4 ? 'they-give' : 'balanced') : 'unknown'
        }

        // Add stats
        const interactionFriends = await friend.interactionFriends.fetch()
        const interactionCount = interactionFriends.length

        // Calculate days since last interaction
        let lastMet = 'never logged'
        if (friend.lastUpdated) {
            const lastUpdatedTime = typeof friend.lastUpdated === 'number'
                ? friend.lastUpdated
                : new Date(friend.lastUpdated).getTime()
            const daysSince = Math.floor((Date.now() - lastUpdatedTime) / (1000 * 60 * 60 * 24))
            if (daysSince === 0) {
                lastMet = 'today'
            } else if (daysSince === 1) {
                lastMet = 'yesterday'
            } else if (daysSince < 7) {
                lastMet = `${daysSince} days ago`
            } else if (daysSince < 30) {
                lastMet = `${Math.floor(daysSince / 7)} weeks ago`
            } else {
                lastMet = `${Math.floor(daysSince / 30)} months ago`
            }
        }

        base.stats = {
            interactionCount,
            lastMet
        }

        // Extract past activities and venues from interactions
        if (interactionFriends.length > 0) {
            try {
                // Get the actual interactions via the pivot table
                const interactionIds = interactionFriends.map(pv => pv.interactionId)
                const interactions = await database.get<Interaction>('interactions')
                    .query(Q.where('id', Q.oneOf(interactionIds)))
                    .fetch()

                // Extract unique activities
                const activities = interactions
                    .map(i => i.activity)
                    .filter(Boolean) as string[]
                base.pastActivities = [...new Set(activities)].slice(0, 5)

                // Extract unique venues/locations
                const venues = interactions
                    .map(i => i.location)
                    .filter(Boolean) as string[]
                base.favoriteVenues = [...new Set(venues)].slice(0, 5)
            } catch (error) {
                logger.warn('OracleContextBuilder', 'Error fetching past activities', { error })
            }
        }

        return base
    }

    private async getUserContext(): Promise<UserContext> {
        return { name: 'User' } // Placeholder until UserProfile is robust
    }

    private async getSocialHealth(): Promise<SocialHealthContext> {
        // Placeholder stats
        return {
            totalActiveFriends: 0,
            needingAttentionCount: 0,
            overallVibe: 'balanced'
        }
    }

    private async getRecentJournaling(tier: ContextTier): Promise<JournalSummary[]> {
        if (tier === ContextTier.ESSENTIAL) return []

        const entries = await database.get<JournalEntry>('journal_entries')
            .query(
                Q.sortBy('created_at', Q.desc),
                Q.take(5)
            ).fetch()

        return entries.map(e => ({
            date: e.createdAt.toISOString().split('T')[0],
            topics: [], // TODO: extract from content or saved tags
            sentiment: 'neutral'
        }))
    }

    /**
     * Get venue/activity suggestions based on archetypes
     */
    private getVenueSuggestions(archetypes: string[]): VenueSuggestions {
        // Archetype to suggested activities/venues mapping
        const ARCHETYPE_SUGGESTIONS: Record<string, string[]> = {
            'Hermit': ['quiet coffee shop', 'bookstore', 'peaceful walk in nature', 'home dinner', 'one-on-one lunch'],
            'Sun': ['lively brunch spot', 'group dinner', 'party or event', 'beach day', 'festival'],
            'Empress': ['cozy cafe', 'home-cooked meal', 'spa day', 'farmers market', 'cooking together'],
            'Emperor': ['nice restaurant', 'scheduled coffee', 'business lunch', 'golf or tennis', 'consistent meetup spot'],
            'Fool': ['new restaurant to try', 'adventure activity', 'spontaneous road trip', 'escape room', 'comedy show'],
            'Magician': ['co-working space', 'workshop or class', 'creative project at home', 'museum', 'maker space'],
            'High Priestess': ['intimate dinner', 'quiet bar', 'meaningful walk', 'therapy dinner', 'sunset spot'],
            'Lovers': ['romantic dinner', 'concert together', 'travel destination', 'special occasion venue', 'couples activity']
        }

        const byArchetype: Record<string, string[]> = {}

        for (const archetype of archetypes) {
            if (archetype && ARCHETYPE_SUGGESTIONS[archetype]) {
                byArchetype[archetype] = ARCHETYPE_SUGGESTIONS[archetype]
            }
        }

        // Generate group suggestions if multiple archetypes
        let forGroup: string[] | undefined
        if (archetypes.length > 1) {
            // Find overlapping/compatible venues
            const uniqueArchetypes = [...new Set(archetypes.filter(Boolean))]

            if (uniqueArchetypes.length > 1) {
                // Suggest versatile venues that work for mixed groups
                forGroup = [
                    'casual restaurant with varied menu',
                    'outdoor picnic or park hangout',
                    'board game cafe',
                    'casual bar with good conversation space',
                    'potluck at someone\'s home'
                ]

                // Add archetype-specific overlap if possible
                const hasIntrovert = uniqueArchetypes.some(a => ['Hermit', 'High Priestess'].includes(a))
                const hasExtrovert = uniqueArchetypes.some(a => ['Sun', 'Fool'].includes(a))

                if (hasIntrovert && hasExtrovert) {
                    forGroup.unshift('brunch spot (not too loud, good for conversation)')
                }
            }
        }

        return { byArchetype, forGroup }
    }
}

export const oracleContextBuilder = new OracleContextBuilder()
