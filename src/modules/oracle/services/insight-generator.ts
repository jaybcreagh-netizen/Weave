import { database } from '@/db'
import { Q } from '@nozbe/watermelondb'
import Friend from '@/db/models/Friend'
import Interaction from '@/db/models/Interaction'
import { FRIEND_RULES, PATTERN_RULES, getExpectedCadence } from './insight-rules'
import { InsightSignal } from './types'
import UserProfile from '@/db/models/UserProfile'
import { oracleService } from './oracle-service'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

export class InsightGenerator {

    // === PUBLIC API ===

    static async generateDailyInsights(): Promise<void> {
        // 0. Check Frequency & Cadence
        const profiles = await database.get<UserProfile>('user_profile').query().fetch()
        const userProfile = profiles[0]

        if (!userProfile) return

        const shouldGenerate = await this.shouldGenerateInsights(userProfile)
        if (!shouldGenerate) return

        const signals: InsightSignal[] = []

        // 1. Generate Friend Signals
        const friendSignals = await this.generateFriendSignals()
        signals.push(...friendSignals)

        // 2. Generate Pattern Signals (Emergent)
        const patternSignals = await this.generatePatternSignals()
        signals.push(...patternSignals)

        // 3. Process via Oracle (LLM Polish)
        if (signals.length > 0) {
            // New Redesign: Synthesize all signals into one narrative
            await oracleService.synthesizeInsights(signals)
        }
    }

    private static async shouldGenerateInsights(userProfile: UserProfile): Promise<boolean> {
        const frequency = userProfile.insightFrequency || 'biweekly'
        if (frequency === 'on_demand') return false

        // Get last generated insight
        const lastInsights = await database.get('proactive_insights').query(
            Q.sortBy('generated_at', Q.desc),
            Q.take(1)
        ).fetch() as any[] // weak typing for now

        if (lastInsights.length === 0) return true

        const lastDate = lastInsights[0].generatedAt
        const daysSince = this.getDaysSince(lastDate)

        switch (frequency) {
            case 'weekly': return daysSince >= 7
            case 'biweekly': return daysSince >= 14
            case 'monthly': return daysSince >= 30
            default: return daysSince >= 14
        }
    }

    // === GENERATION LOGIC ===

    private static async generateFriendSignals(): Promise<InsightSignal[]> {
        const signals: InsightSignal[] = []

        const friends = await database.get<Friend>('friends').query(
            Q.where('is_dormant', false)
        ).fetch()

        for (const friend of friends) {
            const drift = await this.checkDrift(friend)
            if (drift) signals.push(drift)

            const deepening = await this.checkDeepening(friend)
            if (deepening) signals.push(deepening)

            const oneSided = await this.checkOneSided(friend)
            if (oneSided) signals.push(oneSided)
        }

        const dormantFriends = await database.get<Friend>('friends').query(
            Q.where('is_dormant', true)
        ).fetch()

        for (const friend of dormantFriends) {
            const recon = await this.checkReconnection(friend)
            if (recon) signals.push(recon)
        }

        return signals
    }

    // === SIGNAL DETECTORS ===

    private static async checkDrift(friend: Friend): Promise<InsightSignal | null> {
        // Use the new cached field if available, fallback to manual query (avoiding Q.on if possible)
        let lastDate = friend.lastInteractionDate
        let lastActivityType: string | undefined

        if (!lastDate) {
            // Fallback to manual query if cache miss (though backfill should have fixed this)
            const lastInteraction = await this.getManualLastInteraction(friend.id)
            if (lastInteraction) {
                lastDate = lastInteraction.interactionDate
                lastActivityType = lastInteraction.activity
            }
        }

        if (!lastDate) return null

        const daysSince = this.getDaysSince(lastDate as Date)
        const expectedCadence = getExpectedCadence(friend.tier)
        const threshold = expectedCadence * 1.5

        if (daysSince > threshold) {
            let severity = 1 // 1 (low) to 4 (high)
            const ratio = daysSince / expectedCadence
            if (ratio >= 4) severity = 4
            else if (ratio >= 3) severity = 3
            else if (ratio >= 2) severity = 2

            return {
                type: 'drifting',
                friendId: friend.id,
                data: {
                    daysSince,
                    expectedCadence,
                    tier: friend.tier,
                    lastInteraction: lastDate.getTime(),
                    lastActivityType
                },
                priority: severity
            }
        }
        return null
    }

    private static async checkDeepening(friend: Friend): Promise<InsightSignal | null> {
        // "Deepening" means frequent recent contact compared to history
        const recentCount = await this.getManualInteractionCount(friend.id, 30)
        const prev90Count = await this.getManualInteractionCount(friend.id, 90)

        // Avoid division by zero or low data noise
        if (prev90Count < 3) return null

        const avgMonthly = (prev90Count - recentCount) / 2

        // Logic: Recent count is 50% higher than average
        if (avgMonthly > 1 && recentCount >= avgMonthly * 1.5) {
            return {
                type: 'deepening',
                friendId: friend.id,
                data: {
                    recentCount,
                    avgMonthly: Math.round(avgMonthly * 10) / 10,
                    velocity: 'accelerating'
                },
                priority: 2
            }
        }
        return null
    }

    private static async checkOneSided(friend: Friend): Promise<InsightSignal | null> {
        if (friend.initiationRatio > 0.85 && friend.totalUserInitiations > 5) {
            // High initiation by user, low return
            return {
                type: 'one_sided',
                friendId: friend.id,
                data: {
                    ratio: friend.initiationRatio,
                    totalInitiations: friend.totalUserInitiations
                },
                priority: 3
            }
        }
        return null
    }

    private static async checkReconnection(friend: Friend): Promise<InsightSignal | null> {
        if (!friend.dormantSince) return null
        const daysDormant = this.getDaysSince(friend.dormantSince)

        // If they've been dormant a while, suggesting a reconnection is a "Quick Win"
        if (daysDormant > 60) {
            return {
                type: 'reconnection_win',
                friendId: friend.id,
                data: {
                    daysDormant
                },
                priority: 2
            }
        }
        return null
    }

    // === PATTERN DETECTORS (EMERGENT INSIGHTS) ===

    private static async generatePatternSignals(): Promise<InsightSignal[]> {
        const signals: InsightSignal[] = []

        // Fetch last 30 days of completed interactions
        const thirtyDaysAgo = new Date(Date.now() - 30 * ONE_DAY_MS).getTime()
        const recentInteractions = await database.get<Interaction>('interactions').query(
            Q.where('status', 'completed'),
            Q.where('interaction_date', Q.gte(thirtyDaysAgo))
        ).fetch()

        if (recentInteractions.length < 5) return [] // Not enough data for patterns

        // 1. Location Patterns
        const locations = recentInteractions
            .map(i => i.location?.trim())
            .filter(l => l && l.length > 2) as string[]

        const topLocation = this.getTopEntity(locations)
        if (topLocation && topLocation.count >= 3) {
            signals.push({
                type: 'location_pattern',
                data: {
                    location: topLocation.entity,
                    count: topLocation.count,
                    timeframe: 'this month'
                },
                priority: 2
            })
        }

        // 2. Activity Habits
        const activities = recentInteractions
            .map(i => i.activity?.trim())
            .filter(a => a && a.length > 2) as string[]

        const topActivity = this.getTopEntity(activities)
        if (topActivity && topActivity.count >= 4) {
            signals.push({
                type: 'activity_habit',
                data: {
                    activity: topActivity.entity,
                    count: topActivity.count,
                    timeframe: 'lately'
                },
                priority: 2
            })
        }

        // 3. Vibe Trends (Social Battery)
        // Assuming vibe is stored as 'high', 'medium', 'low' or strictly mapped strings
        const vibes = recentInteractions
            .map(i => i.vibe?.toLowerCase().trim())
            .filter(v => v) as string[]

        const topVibe = this.getTopEntity(vibes)
        if (topVibe && topVibe.count >= 3) {
            // Humanize the vibe string (e.g. "waxinggibbous" -> "Waxing Gibbous")
            // This ensures the LLM sees clean language even if it fails to format it
            const rawVibe = topVibe.entity
            const humanVibe = rawVibe
                .replace(/([A-Z])/g, ' $1') // insert space before caps if any
                .replace(/_/g, ' ')         // replace underscores
                .replace(/([a-z])([A-Z])/g, '$1 $2') // split camelCase
                // Special handling for concatenated lowercase like "waxinggibbous"
                .replace('waxinggibbous', 'Waxing Gibbous')
                .replace('waninggibbous', 'Waning Gibbous')
                .replace('firstquarter', 'First Quarter')
                .replace('lastquarter', 'Last Quarter')
                .replace('newmoon', 'New Moon')
                .replace('fullmoon', 'Full Moon')
                .replace(/\b\w/g, c => c.toUpperCase()) // Title Case

            signals.push({
                type: 'vibe_trend',
                data: {
                    vibe: humanVibe,
                    rawVibe: rawVibe,
                    count: topVibe.count,
                    total: vibes.length
                },
                priority: 1
            })
        }

        return signals
    }

    private static getTopEntity(list: string[]): { entity: string, count: number } | null {
        if (list.length === 0) return null
        const counts: Record<string, number> = {}
        for (const item of list) {
            counts[item] = (counts[item] || 0) + 1
        }

        let topEntity = ''
        let maxCount = 0

        for (const [entity, count] of Object.entries(counts)) {
            if (count > maxCount) {
                maxCount = count
                topEntity = entity
            }
        }

        return { entity: topEntity, count: maxCount }
    }

    // === HELPERS ===

    private static getDaysSince(date: Date): number {
        return Math.floor((Date.now() - date.getTime()) / ONE_DAY_MS)
    }

    /**
     * Manual query to avoid WatermelonDB Q.on issues
     * 1. Get InteractionFriend links
     * 2. Get Interactions by ID
     */
    private static async getManualLastInteraction(friendId: string): Promise<Interaction | null> {
        // Step 1: Get interaction IDs for this friend
        const links = await database.get('interaction_friends').query(
            Q.where('friend_id', friendId)
        ).fetch() as any[]

        if (links.length === 0) return null

        const interactionIds = links.map(l => l.interaction_id || l.interactionId)

        // Step 2: Fetch interactions
        const interactions = await database.get<Interaction>('interactions').query(
            Q.where('id', Q.oneOf(interactionIds)),
            Q.where('status', 'completed'),
            Q.sortBy('interaction_date', Q.desc),
            Q.take(1)
        ).fetch()

        return interactions.length > 0 ? interactions[0] : null
    }

    private static async getManualInteractionCount(friendId: string, days: number): Promise<number> {
        const links = await database.get('interaction_friends').query(
            Q.where('friend_id', friendId)
        ).fetch() as any[]

        if (links.length === 0) return 0

        const interactionIds = links.map(l => l.interaction_id || l.interactionId)
        const since = new Date(Date.now() - days * ONE_DAY_MS).getTime()

        const count = await database.get<Interaction>('interactions').query(
            Q.where('id', Q.oneOf(interactionIds)),
            Q.where('status', 'completed'),
            Q.where('interaction_date', Q.gte(since))
        ).fetchCount()

        return count
    }
}

