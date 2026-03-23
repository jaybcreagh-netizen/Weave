import { database } from '@/db'
import { Q } from '@nozbe/watermelondb'
import Friend from '@/db/models/Friend'
import Interaction from '@/db/models/Interaction'
import LifeEvent from '@/db/models/LifeEvent'
import JournalSignals from '@/db/models/JournalSignals'
import JournalEntryFriend from '@/db/models/JournalEntryFriend'
import { FRIEND_RULES, PATTERN_RULES, getExpectedCadence } from './insight-rules'
import { InsightSignal } from './types'
import UserProfile from '@/db/models/UserProfile'
import SocialBatteryLog from '@/db/models/SocialBatteryLog'
import { oracleService } from './oracle-service'
import { intelligenceCapabilitiesService } from '@/modules/intelligence/services/intelligence-capabilities.service'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

export class InsightGenerator {

    // === PUBLIC API ===

    static async generateDailyInsights(): Promise<void> {
        const userProfile = await this.getCurrentProfile()
        if (!userProfile) return

        const capabilities = await intelligenceCapabilitiesService.getCapabilities({
            profile: userProfile,
        })

        if (!capabilities.proactiveInsightsEnabled) return

        const shouldGenerate = await this.shouldGenerateInsights(userProfile)
        if (!shouldGenerate) return

        const signals = await this.collectSignals()
        const filteredSignals = this.filterSuppressedSignals(signals, userProfile)

        if (filteredSignals.length > 0) {
            await oracleService.synthesizeInsights(filteredSignals, {
                useRemotePolish: capabilities.remoteInsightPolishEnabled,
                allowFallback: true,
            })
        }
    }

    /**
     * Generate an insight immediately (on-demand, skips cadence checks)
     * Used when user explicitly taps "Give me an insight"
     */
    static async generateOnDemand(): Promise<void> {
        const userProfile = await this.getCurrentProfile()
        if (!userProfile) return

        const capabilities = await intelligenceCapabilitiesService.getCapabilities({
            profile: userProfile,
        })

        if (!capabilities.localProactiveInsightsEnabled) return

        const signals = await this.collectSignals({
            includeLifeEvents: true,
            includeJournalSignals: true,
        })
        const filteredSignals = this.filterSuppressedSignals(signals, userProfile)

        if (filteredSignals.length > 0) {
            await oracleService.synthesizeInsights(filteredSignals, {
                useRemotePolish: capabilities.remoteInsightPolishEnabled,
                skipRecentCooldown: true,
                allowFallback: true,
            })
        }
    }

    private static async collectSignals(
        options: {
            includeLifeEvents?: boolean
            includeJournalSignals?: boolean
        } = {}
    ): Promise<InsightSignal[]> {
        const signals: InsightSignal[] = []

        const friendSignals = await this.generateFriendSignals()
        signals.push(...friendSignals)

        const patternSignals = await this.generatePatternSignals()
        signals.push(...patternSignals)

        const userSignals = await this.generateUserSignals()
        signals.push(...userSignals)

        if (options.includeLifeEvents) {
            const lifeEventSignals = await this.generateLifeEventSignals()
            signals.push(...lifeEventSignals)
        }

        if (options.includeJournalSignals) {
            const journalSignals = await this.generateJournalBasedSignals()
            signals.push(...journalSignals)
        }

        return signals
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

            const consistency = await this.checkConsistency(friend)
            if (consistency) signals.push(consistency)

            const qualityStreak = await this.checkHighQualityStreak(friend)
            if (qualityStreak) signals.push(qualityStreak)
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

    /**
     * Consistency Win: Friend you've been seeing regularly (3+ times in last 30 days)
     */
    private static async checkConsistency(friend: Friend): Promise<InsightSignal | null> {
        const recentCount = await this.getManualInteractionCount(friend.id, 30)

        // At least 3 interactions in the last month = consistent
        if (recentCount >= 3) {
            return {
                type: 'consistency_win',
                friendId: friend.id,
                data: {
                    recentCount,
                    timeframe: '30 days'
                },
                priority: 2
            }
        }
        return null
    }

    /**
     * High Quality Streak: Multiple high-vibe interactions recently
     */
    private static async checkHighQualityStreak(friend: Friend): Promise<InsightSignal | null> {
        // Get recent interactions for this friend
        const links = await database.get('interaction_friends').query(
            Q.where('friend_id', friend.id)
        ).fetch() as any[]

        if (links.length === 0) return null

        const interactionIds = links.map(l => l.interaction_id || l.interactionId)
        const twoWeeksAgo = new Date(Date.now() - 14 * ONE_DAY_MS).getTime()

        const recentInteractions = await database.get<Interaction>('interactions').query(
            Q.where('id', Q.oneOf(interactionIds)),
            Q.where('status', 'completed'),
            Q.where('interaction_date', Q.gte(twoWeeksAgo))
        ).fetch()

        // Count high-vibe interactions (assumes vibe contains 'full' or similar for high energy)
        const highVibeCount = recentInteractions.filter(i =>
            i.vibe && (i.vibe.toLowerCase().includes('full') || i.vibe.toLowerCase().includes('waxing'))
        ).length

        if (highVibeCount >= 2) {
            return {
                type: 'high_quality_streak',
                friendId: friend.id,
                data: {
                    highVibeCount,
                    totalRecent: recentInteractions.length
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

    private static async generateUserSignals(): Promise<InsightSignal[]> {
        const signals: InsightSignal[] = []

        // 1. Social Battery Trends
        // Fetch last 5 logs
        const logs = await database.get<SocialBatteryLog>('social_battery_logs').query(
            Q.sortBy('timestamp', Q.desc),
            Q.take(5)
        ).fetch()

        if (logs.length >= 3) {
            const recent = logs.slice(0, 3)
            const avg = recent.reduce((sum, log) => sum + log.value, 0) / recent.length

            if (avg <= 30) {
                signals.push({
                    type: 'user_battery_low',
                    data: { avg: Math.round(avg) },
                    priority: 3
                })
            } else if (avg >= 80) {
                signals.push({
                    type: 'user_battery_high',
                    data: { avg: Math.round(avg) },
                    priority: 2
                })
            }

            // Check Trend (using all 5 logs if possible)
            // Values are desc (newest first). So [0] is newest.
            // "Recharging": [4] < [3] < [2] < [1] < [0]
            // "Draining": [4] > [3] > [2] > [1] > [0]
            if (logs.length >= 4) {
                let isRising = true
                let isFalling = true
                for (let i = 0; i < logs.length - 1; i++) {
                    // Newest [i] vs Older [i+1]
                    if (logs[i].value <= logs[i + 1].value) isRising = false
                    if (logs[i].value >= logs[i + 1].value) isFalling = false
                }

                if (isRising) {
                    signals.push({
                        type: 'user_battery_recharging',
                        data: { trend: 'rising', current: logs[0].value },
                        priority: 2
                    })
                } else if (isFalling) {
                    signals.push({
                        type: 'user_battery_draining',
                        data: { trend: 'falling', current: logs[0].value },
                        priority: 3 // Higher priority if draining
                    })
                }
            }
        }

        // 2. Activity Spikes (This Week vs Last Week)
        const now = Date.now()
        const oneWeekAgo = now - 7 * ONE_DAY_MS
        const twoWeeksAgo = now - 14 * ONE_DAY_MS

        const thisWeekCount = await database.get<Interaction>('interactions').query(
            Q.where('status', 'completed'),
            Q.where('interaction_date', Q.gte(oneWeekAgo))
        ).fetchCount()

        const lastWeekCount = await database.get<Interaction>('interactions').query(
            Q.where('status', 'completed'),
            Q.where('interaction_date', Q.between(twoWeeksAgo, oneWeekAgo))
        ).fetchCount()

        // Need baseline
        if (lastWeekCount >= 3) {
            const ratio = thisWeekCount / lastWeekCount
            if (ratio >= 1.5) {
                signals.push({
                    type: 'user_activity_spike',
                    data: { thisWeek: thisWeekCount, lastWeek: lastWeekCount, percent: Math.round(ratio * 100) },
                    priority: 2
                })
            } else if (ratio <= 0.5) {
                signals.push({
                    type: 'user_activity_drop',
                    data: { thisWeek: thisWeekCount, lastWeek: lastWeekCount, percent: Math.round(ratio * 100) },
                    priority: 2
                })
            }
        }

        return signals
    }

    /**
     * Generate signals from upcoming life events (birthdays, anniversaries, etc.)
     */
    private static async generateLifeEventSignals(): Promise<InsightSignal[]> {
        const signals: InsightSignal[] = []

        // Look for events in the next 7 days
        const now = Date.now()
        const sevenDaysFromNow = now + (7 * ONE_DAY_MS)

        const upcomingEvents = await database.get<LifeEvent>('life_events').query(
            Q.where('event_date', Q.between(now, sevenDaysFromNow))
        ).fetch()

        for (const event of upcomingEvents) {
            const daysUntil = Math.ceil((event.eventDate.getTime() - now) / ONE_DAY_MS)

            if (event.eventType === 'birthday') {
                signals.push({
                    type: 'upcoming_birthday',
                    friendId: event.friendId,
                    data: {
                        daysUntil,
                        eventDate: event.eventDate.toISOString(),
                        title: event.title
                    },
                    priority: daysUntil <= 2 ? 4 : 3 // Higher priority if very soon
                })
            } else if (['anniversary', 'wedding', 'graduation', 'new_job'].includes(event.eventType)) {
                signals.push({
                    type: 'upcoming_life_event',
                    friendId: event.friendId,
                    data: {
                        eventType: event.eventType,
                        daysUntil,
                        eventDate: event.eventDate.toISOString(),
                        title: event.title,
                        importance: event.importance
                    },
                    priority: event.importance === 'high' ? 3 : 2
                })
            }
        }

        return signals
    }

    /**
     * Generate signals from journal entry sentiment analysis
     */
    private static async generateJournalBasedSignals(): Promise<InsightSignal[]> {
        const signals: InsightSignal[] = []

        // Get recent journal signals (last 30 days) with high confidence
        const thirtyDaysAgo = Date.now() - (30 * ONE_DAY_MS)
        const recentSignals = await database.get<JournalSignals>('journal_signals').query(
            Q.where('extracted_at', Q.gte(thirtyDaysAgo)),
            Q.where('confidence', Q.gte(0.7))
        ).fetch()

        if (recentSignals.length === 0) return signals

        // Get journal entry IDs to find linked friends
        const journalEntryIds = recentSignals.map(s => s.journalEntryId)

        // Fetch friend links for these entries
        const friendLinks = await database.get<JournalEntryFriend>('journal_entry_friends').query(
            Q.where('journal_entry_id', Q.oneOf(journalEntryIds))
        ).fetch()

        // Group by friend to calculate sentiment patterns
        const friendSentiments: Record<string, {
            total: number,
            count: number,
            hasTension: boolean,
            positiveCount: number
        }> = {}

        for (const signal of recentSignals) {
            const linkedFriends = friendLinks.filter(l =>
                (l as any).journalEntryId === signal.journalEntryId ||
                (l as any).journal_entry_id === signal.journalEntryId
            )

            for (const link of linkedFriends) {
                const friendId = (link as any).friendId || (link as any).friend_id
                if (!friendId) continue

                if (!friendSentiments[friendId]) {
                    friendSentiments[friendId] = { total: 0, count: 0, hasTension: false, positiveCount: 0 }
                }

                friendSentiments[friendId].total += signal.sentiment
                friendSentiments[friendId].count += 1
                if (signal.hasTensionSignal) friendSentiments[friendId].hasTension = true
                if (signal.sentiment >= 1) friendSentiments[friendId].positiveCount += 1
            }
        }

        // Generate signals based on patterns
        for (const [friendId, data] of Object.entries(friendSentiments)) {
            const avgSentiment = data.total / data.count

            // Tension detected
            if (data.hasTension || avgSentiment <= -1) {
                signals.push({
                    type: 'journal_tension',
                    friendId,
                    data: {
                        avgSentiment: Math.round(avgSentiment * 10) / 10,
                        entryCount: data.count
                    },
                    priority: 3
                })
            }
            // Positive momentum
            else if (data.positiveCount >= 2 && avgSentiment >= 1) {
                signals.push({
                    type: 'journal_positive',
                    friendId,
                    data: {
                        avgSentiment: Math.round(avgSentiment * 10) / 10,
                        positiveCount: data.positiveCount
                    },
                    priority: 2
                })
            }
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

    private static async getCurrentProfile(): Promise<UserProfile | null> {
        const profiles = await database.get<UserProfile>('user_profile').query().fetch()
        return profiles[0] ?? null
    }

    private static filterSuppressedSignals(signals: InsightSignal[], userProfile: UserProfile): InsightSignal[] {
        const suppressedRules = this.getSuppressedRules(userProfile)
        if (suppressedRules.size === 0) return signals

        return signals.filter((signal) => {
            const mappedRules = this.getRuleIdsForSignal(signal)
            if (mappedRules.length === 0) return true
            return mappedRules.every((ruleId) => !suppressedRules.has(ruleId))
        })
    }

    private static getSuppressedRules(userProfile: UserProfile): Set<string> {
        if (!userProfile.suppressedInsightRules) return new Set()

        try {
            const parsed = JSON.parse(userProfile.suppressedInsightRules)
            if (!Array.isArray(parsed)) return new Set()
            return new Set(parsed.filter((ruleId): ruleId is string => typeof ruleId === 'string'))
        } catch {
            return new Set()
        }
    }

    private static getRuleIdsForSignal(signal: InsightSignal): string[] {
        switch (signal.type) {
            case 'drifting':
                return [FRIEND_RULES.friend_drift.id]
            case 'deepening':
                return [FRIEND_RULES.friend_deepening.id]
            case 'one_sided':
                return [FRIEND_RULES.friend_one_sided.id]
            case 'reconnection_win':
                return [FRIEND_RULES.friend_reconnection.id]
            case 'user_battery_low':
            case 'user_battery_draining':
                return [PATTERN_RULES.pattern_low_energy_socializing.id]
            default:
                return []
        }
    }

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
