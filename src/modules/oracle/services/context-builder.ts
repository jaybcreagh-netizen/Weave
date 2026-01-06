
import { database } from '@/db'
import { Q } from '@nozbe/watermelondb'
import Friend from '@/db/models/Friend'
import Interaction from '@/db/models/Interaction'
import JournalEntry from '@/db/models/JournalEntry'
import LifeEvent from '@/db/models/LifeEvent'
import SocialBatteryLog from '@/db/models/SocialBatteryLog'
import UserFact from '@/db/models/UserFact'
import Intention from '@/db/models/Intention'
import { SocialSeasonService } from '@/modules/intelligence/services/social-season.service'
import { logger } from '@/shared/services/logger.service'
import { getExpectedCadence } from './insight-rules'
import UserProfile from '@/db/models/UserProfile'

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
    activeIntentions?: SimplifiedIntention[]
    activeSuggestions?: SimplifiedSuggestion[]
    venueAndActivitySuggestions?: VenueSuggestions
}

interface UserContext {
    name: string
    currentFocus?: string
    socialSeason: string
    socialBattery: {
        current: string // "3/5" or "Data unavailable"
        trend: string   // "Draining", "Recharging", "Stable"
    }
    upcomingLifeEvents: SimplifiedLifeEvent[] // Events in next 14 days (Social Load)
    userFacts: string[] // Crystalized memories/preferences
    oracleTonePreference?: string // 'grounded' | 'warm' | 'playful' | 'poetic'
}

interface SimplifiedIntention {
    friendName: string
    description: string
    createdAt: string
}

interface SimplifiedSuggestion {
    id: string
    friendName: string
    description: string
    type: string
    urgency: string
    reason?: string
}

interface SimplifiedLifeEvent {
    title: string
    date: string
    importance: string
    friendName: string
    notes?: string
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

    // NEW: Context V2
    lifeEvents?: SimplifiedLifeEvent[] // Upcoming or recent significant events

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
    seasonAdapted?: string[] // NEW: Suggestions filtered by social season
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
        const userContext = await this.getUserContext()

        // Generate venue/activity suggestions based on archetypes AND season
        const archetypes = friends.map(f => f.archetype).filter(Boolean)
        const venueSuggestions = this.getVenueSuggestions(archetypes, userContext.socialSeason)

        return {
            userProfile: userContext,
            friends: formattedFriends,
            socialHealth: await this.getSocialHealth(),
            recentJournaling: await this.getRecentJournaling(tier),
            activeIntentions: await this.getActiveIntentions(friendIds),
            activeSuggestions: await this.getActiveSuggestions(friendIds),
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

        // NEW: Fetch life events for this friend
        base.lifeEvents = await this.getFriendLifeEvents(friend.id)

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
        // 1. Social Season
        const season = await SocialSeasonService.getCurrentSeason() || 'unknown'

        // 2. Social Battery (Last 7 days)
        let batteryInfo = { current: 'Data unavailable', trend: 'Unknown' }
        try {
            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
            const logs = await database.get<SocialBatteryLog>('social_battery_logs')
                .query(
                    Q.where('timestamp', Q.gte(sevenDaysAgo)),
                    Q.sortBy('timestamp', Q.asc)
                ).fetch()

            if (logs.length > 0) {
                const latest = logs[logs.length - 1]
                const avg = logs.reduce((sum, log) => sum + log.value, 0) / logs.length

                // Simple trend detection
                const firstHalf = logs.slice(0, Math.floor(logs.length / 2))
                const secondHalf = logs.slice(Math.floor(logs.length / 2))
                const firstAvg = firstHalf.length ? firstHalf.reduce((sum, log) => sum + log.value, 0) / firstHalf.length : 0
                const secondAvg = secondHalf.length ? secondHalf.reduce((sum, log) => sum + log.value, 0) / secondHalf.length : 0

                let trend = 'Stable'
                if (secondAvg > firstAvg + 0.5) trend = 'Recharging'
                if (secondAvg < firstAvg - 0.5) trend = 'Draining'

                batteryInfo = {
                    current: `${latest.value}/5 (Avg: ${avg.toFixed(1)})`,
                    trend
                }
            }
        } catch (e) {
            logger.warn('OracleContextBuilder', 'Error fetching battery logs', e)
        }

        // 3. Upcoming Life Events (Social Load) - Next 14 days
        let upcomingEvents: SimplifiedLifeEvent[] = []
        try {
            const now = Date.now()
            const fourteenDaysFromNow = now + (14 * 24 * 60 * 60 * 1000)

            // Note: This is an expensive query if we scan all events, but LifeEvent table should be small.
            // Ideally we'd filter by date in SQL, but event_date might be just a timestamp or special format.
            // Assuming event_date is a timestamp for now based on schema.
            const events = await database.get<LifeEvent>('life_events')
                .query(
                    Q.where('event_date', Q.between(now, fourteenDaysFromNow))
                ).fetch()

            // We need friend names for these events
            upcomingEvents = await Promise.all(events.map(async e => {
                const friend = await (e.friend as any).fetch()
                return {
                    title: e.title,
                    date: new Date(e.eventDate).toLocaleDateString(),
                    importance: e.importance,
                    friendName: friend?.name || 'Unknown Friend',
                    notes: e.notes
                }
            }))
        } catch (e) {
            logger.warn('OracleContextBuilder', 'Error fetching life events', e)
        }

        return {
            name: 'User',
            socialSeason: season,
            socialBattery: batteryInfo,
            upcomingLifeEvents: upcomingEvents,
            userFacts: await this.getUserFacts(),
            oracleTonePreference: (await database.get<UserProfile>('user_profile').query().fetch())[0]?.oracleTonePreference
        }
    }

    private async getUserFacts(): Promise<string[]> {
        try {
            const facts = await database.get<UserFact>('user_facts')
                .query(
                    Q.where('confidence', Q.gte(0.7)),
                    Q.sortBy('created_at', Q.desc),
                    Q.take(10)
                ).fetch()

            return facts.map(f => f.factContent)
        } catch (e) {
            return []
        }
    }

    private async getFriendLifeEvents(friendId: string): Promise<SimplifiedLifeEvent[]> {
        try {
            const now = Date.now()
            const thirtyDaysFromNow = now + (30 * 24 * 60 * 60 * 1000)

            const events = await database.get<LifeEvent>('life_events')
                .query(
                    Q.where('friend_id', friendId),
                    Q.where('event_date', Q.between(now, thirtyDaysFromNow))
                ).fetch()

            return events.map(e => ({
                title: e.title,
                date: new Date(e.eventDate).toLocaleDateString(),
                importance: e.importance,
                friendName: 'This Friend', // Redundant but fits interface
                notes: e.notes
            }))
        } catch (e) {
            return []
        }
    }

    private async getSocialHealth(): Promise<SocialHealthContext> {
        try {
            const friends = await database.get<Friend>('friends').query(
                Q.where('is_dormant', false)
            ).fetch()

            const now = Date.now()
            const ONE_DAY = 24 * 60 * 60 * 1000

            // Count active friends (interacted in last 30 days)
            const activeFriends = friends.filter(f => {
                if (!f.lastInteractionDate) return false
                const daysSince = (now - f.lastInteractionDate.getTime()) / ONE_DAY
                return daysSince <= 30
            })

            // Count friends needing attention (past expected cadence)
            const needingAttention = friends.filter(f => {
                if (!f.lastInteractionDate) return true
                const daysSince = (now - f.lastInteractionDate.getTime()) / ONE_DAY
                const expectedCadence = getExpectedCadence(f.tier)
                return daysSince > expectedCadence * 1.5
            })

            // Calculate overall vibe from recent interactions (last 14 days)
            const recentInteractions = await database.get<Interaction>('interactions').query(
                Q.where('interaction_date', Q.gte(now - 14 * ONE_DAY)),
                Q.where('status', 'completed')
            ).fetch()

            const vibeScores = recentInteractions
                .map(i => parseInt(i.vibe || '0', 10))
                .filter(v => !isNaN(v) && v > 0)

            const avgVibe = vibeScores.length > 0
                ? vibeScores.reduce((a, b) => a + b, 0) / vibeScores.length
                : null

            const overallVibe = avgVibe === null ? 'No recent data'
                : avgVibe >= 4 ? 'Thriving'
                    : avgVibe >= 3 ? 'Good'
                        : avgVibe >= 2 ? 'Mixed'
                            : 'Low energy'

            return {
                totalActiveFriends: activeFriends.length,
                needingAttentionCount: needingAttention.length,
                overallVibe
            }
        } catch (error) {
            logger.warn('OracleContextBuilder', 'Error calculating social health', { error })
            return {
                totalActiveFriends: 0,
                needingAttentionCount: 0,
                overallVibe: 'Unknown'
            }
        }
    }

    private async getRecentJournaling(tier: ContextTier): Promise<JournalSummary[]> {
        if (tier === ContextTier.ESSENTIAL) return []

        try {
            const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000

            const entries = await database.get<JournalEntry>('journal_entries')
                .query(
                    Q.where('entry_date', Q.gte(twoWeeksAgo)),
                    Q.sortBy('entry_date', Q.desc),
                    Q.take(5)
                ).fetch()

            return entries.map(entry => ({
                date: entry.createdAt.toISOString().split('T')[0],
                topics: entry.title ? [entry.title] : [],
                sentiment: this.inferSentiment(entry)
            }))
        } catch (error) {
            logger.warn('OracleContextBuilder', 'Error fetching recent journaling', { error })
            return []
        }
    }

    private inferSentiment(entry: JournalEntry): string {
        // Simple heuristic - could be enhanced with LLM later
        const contentLength = entry.content.length
        if (contentLength > 500) return 'reflective'
        if (contentLength > 200) return 'thoughtful'
        return 'brief'
    }

    private async getActiveIntentions(friendIds: string[]): Promise<SimplifiedIntention[]> {
        try {
            // Base query for active intentions
            const intentionsQuery = database.get<Intention>('intentions').query(
                Q.where('status', 'active')
            );

            const allIntentions = await intentionsQuery.fetch();

            const simplified: SimplifiedIntention[] = [];

            for (const intention of allIntentions) {
                // Fetch associated friends
                const intentionFriends = await intention.intentionFriends.fetch();

                // If specific friends requested, filter
                if (friendIds.length > 0) {
                    const hasRequestedFriend = intentionFriends.some(f => friendIds.includes(f.friendId));
                    if (!hasRequestedFriend) continue;
                }

                // Get friend names
                const friends = await Promise.all(intentionFriends.map(f => f.friend.fetch()));
                const friendNames = friends.map(f => f.name).join(', ');

                simplified.push({
                    friendName: friendNames || 'Unknown Friend',
                    description: intention.description || 'No description',
                    createdAt: intention.createdAt.toLocaleDateString()
                });
            }

            return simplified;
        } catch (error) {
            logger.warn('OracleContextBuilder', 'Error fetching active intentions', { error });
            return [];
        }
    }

    private async getActiveSuggestions(friendIds: string[]): Promise<SimplifiedSuggestion[]> {
        try {
            // We need to fetch suggestions dynamically.
            // Ideally this should use the SuggestionService, but to avoid circular deps we might need care.
            // For now, let's assume we can import the service.
            // Note: In a real app, we might store generated suggestions in a LocalState or Cache.
            // Since I cannot easily import the full `fetchSuggestions` logic here without risk,
            // I will return an empty array for now and rely on the Prompt to ask the user or Client to pass it.
            // WAIT - the OracleSheet has access to `useSuggestions`. It pass 'context: output' ?
            // No, the context builder runs on the "server" (or service layer).

            // BETTER APPROACH:
            // The `OracleService.generateResponse` takes `context`.
            // The `useOracleSheet` hook calls `OracleChat`. `OracleChat` calls `OracleService`.
            // `OracleChat` has access to `useSuggestions`.
            // I should pass the suggestions FROM THE UI into the Oracle Service options,
            // rather than making the ContextBuilder fetch them again (which is expensive/complex).

            // So I will NOT implement complex fetching here.
            // Instead I will return empty and rely on INJECTED context from the UI.
            return [];
        } catch (error) {
            return [];
        }
    }

    /**
     * Get venue/activity suggestions based on archetypes
     */
    private getVenueSuggestions(archetypes: string[], season: string): VenueSuggestions {
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

        // NEW: Season-adapted suggestions
        let seasonAdapted: string[] = []
        if (season === 'resting') {
            seasonAdapted = ['home visit', 'quiet walk', 'low-energy hangout', 'sending a thoughtful text', 'brief coffee']
        } else if (season === 'blooming') {
            seasonAdapted = ['host a dinner', 'organize a group trip', 'attend a social event', 'try a new hobby group']
        }

        return { byArchetype, forGroup, seasonAdapted }
    }
}

export const oracleContextBuilder = new OracleContextBuilder()
