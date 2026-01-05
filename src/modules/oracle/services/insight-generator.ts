import { database } from '@/db'
import { Q } from '@nozbe/watermelondb'
import Friend from '@/db/models/Friend'
import Interaction from '@/db/models/Interaction'
import ProactiveInsight, { InsightType } from '@/db/models/ProactiveInsight'
import { FRIEND_RULES, PATTERN_RULES, INSIGHT_EXPIRY_HOURS, getExpectedCadence } from './insight-rules'
import { writeScheduler } from '@/shared/services/write-scheduler'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

export class InsightGenerator {

    // === PUBLIC API ===

    static async generateDailyInsights(): Promise<void> {
        // 1. Generate Friend Insights
        await this.generateFriendInsights()

        // 2. Generate Pattern Insights
        await this.generatePatternInsights()
    }

    // === GENERATION LOGIC ===

    private static async generateFriendInsights(): Promise<void> {
        const friends = await database.get<Friend>('friends').query(
            Q.where('is_dormant', false)
        ).fetch()

        for (const friend of friends) {
            await this.checkDrift(friend)
            await this.checkDeepening(friend)
            await this.checkOneSided(friend)
        }

        const dormantFriends = await database.get<Friend>('friends').query(
            Q.where('is_dormant', true)
        ).fetch()

        for (const friend of dormantFriends) {
            await this.checkReconnection(friend)
        }
    }

    private static async generatePatternInsights(): Promise<void> {
        await this.checkTierNeglect()
        await this.checkGroupHeavy()
    }

    // === RULE CHECKERS ===

    private static async checkDrift(friend: Friend): Promise<void> {
        const rule = FRIEND_RULES.friend_drift
        const lastInteraction = await this.getLastInteractionDate(friend.id)

        if (!lastInteraction) return

        const daysSince = this.getDaysSince(lastInteraction)
        const expectedCadence = getExpectedCadence(friend.tier)
        const threshold = expectedCadence * 1.5

        if (daysSince > threshold) {
            let severity = 1
            const ratio = daysSince / expectedCadence
            if (ratio >= 4) severity = 4
            else if (ratio >= 3) severity = 3
            else if (ratio >= 2) severity = 2

            await this.createInsightIfAllowed({
                ruleId: rule.id,
                type: 'friend',
                friendId: friend.id,
                headline: `Drifting from ${friend.name}`,
                body: `${daysSince} days since you connected. She's in your ${friend.tier} — your rhythm is usually every ${expectedCadence} days.`,
                groundingData: { daysSince, expectedCadence, lastInteraction: lastInteraction.getTime() },
                actionType: 'plan_weave',
                actionLabel: 'Reach out',
                actionParams: { friendId: friend.id },
                severity
            })
        }
    }

    private static async checkDeepening(friend: Friend): Promise<void> {
        const rule = FRIEND_RULES.friend_deepening

        const recentCount = await this.getInteractionCount(friend.id, 30)
        const prev90Count = await this.getInteractionCount(friend.id, 90)
        const avgMonthly = (prev90Count - recentCount) / 2

        if (avgMonthly > 1 && recentCount >= avgMonthly * 1.5) {
            await this.createInsightIfAllowed({
                ruleId: rule.id,
                type: 'friend',
                friendId: friend.id,
                headline: `Deepening with ${friend.name}`,
                body: `Something's building. You've seen them ${recentCount} times this month — more than usual.`,
                groundingData: { recentCount, avgMonthly },
                actionType: 'guided_reflection',
                actionLabel: 'Reflect on this',
                actionParams: { friendId: friend.id }
            })
        }
    }

    private static async checkOneSided(friend: Friend): Promise<void> {
        if (friend.initiationRatio > 0.85 && friend.totalUserInitiations > 5) {
            const rule = FRIEND_RULES.friend_one_sided
            await this.createInsightIfAllowed({
                ruleId: rule.id,
                type: 'friend',
                friendId: friend.id,
                headline: `One-sided with ${friend.name}`,
                body: `You've initiated most of the last plans. Are they reaching back?`,
                groundingData: { ratio: friend.initiationRatio },
                actionType: 'open_contact',
                actionLabel: 'Reach out anyway',
                actionParams: { friendId: friend.id }
            })
        }
    }

    private static async checkReconnection(friend: Friend): Promise<void> {
        if (!friend.dormantSince) return
        const daysDormant = this.getDaysSince(friend.dormantSince)

        if (daysDormant > 60) {
            const rule = FRIEND_RULES.friend_reconnection
            await this.createInsightIfAllowed({
                ruleId: rule.id,
                type: 'friend',
                friendId: friend.id,
                headline: `Reconnect with ${friend.name}`,
                body: `${friend.name} has been quiet for ${daysDormant} days. You used to see them regularly.`,
                groundingData: { daysDormant },
                actionType: 'open_contact',
                actionLabel: 'Say hello',
                actionParams: { friendId: friend.id }
            })
        }
    }

    private static async checkTierNeglect(): Promise<void> {
        const innerCircle = await database.get<Friend>('friends').query(
            Q.where('dunbar_tier', 'Inner Circle')
        ).fetch()

        if (innerCircle.length === 0) return

        let hasInteraction = false
        for (const friend of innerCircle) {
            const lastDate = await this.getLastInteractionDate(friend.id)
            if (lastDate && this.getDaysSince(lastDate) < 14) {
                hasInteraction = true
                break
            }
        }

        if (!hasInteraction) {
            const rule = PATTERN_RULES.pattern_tier_neglect
            await this.createInsightIfAllowed({
                ruleId: rule.id,
                type: 'pattern',
                headline: 'Inner Circle is quiet',
                body: 'No interactions with your closest circle in over 2 weeks.',
                groundingData: { tier: 'Inner Circle', days: 14 },
                actionType: 'view_friend_list',
                actionLabel: 'See Inner Circle',
                actionParams: { filter: 'Inner Circle' }
            })
        }
    }

    private static async checkGroupHeavy(): Promise<void> {
        // Placeholder for group logic
    }


    // === DEDUPLICATION & PERSISTENCE ===

    private static async createInsightIfAllowed(params: {
        ruleId: string
        type: InsightType
        friendId?: string
        headline: string
        body: string
        groundingData: any
        actionType: string
        actionLabel: string
        actionParams: any
        severity?: number
    }): Promise<void> {

        const allowed = await this.shouldGenerateInsight(params.ruleId, params.type, params.friendId, params.severity)
        if (!allowed) return

        await writeScheduler.important('createProactiveInsight', async () => {
            await database.get<ProactiveInsight>('proactive_insights').create(insight => {
                insight.ruleId = params.ruleId
                insight.type = params.type
                insight.friendId = params.friendId
                insight.headline = params.headline
                insight.body = params.body
                insight.groundingDataJson = JSON.stringify(params.groundingData)
                insight.actionType = params.actionType
                insight.actionLabel = params.actionLabel
                insight.actionParamsJson = JSON.stringify(params.actionParams)
                insight.severity = params.severity
                insight.generatedAt = new Date()
                insight.expiresAt = new Date(Date.now() + INSIGHT_EXPIRY_HOURS * 60 * 60 * 1000)
                insight.status = 'unseen'
            })
        })
    }

    private static async shouldGenerateInsight(
        ruleId: string,
        type: InsightType,
        friendId?: string,
        severity?: number
    ): Promise<boolean> {

        const existing = await database.get<ProactiveInsight>('proactive_insights').query(
            Q.where('rule_id', ruleId),
            friendId ? Q.where('friend_id', friendId) : Q.where('friend_id', null),
            Q.where('status', Q.oneOf(['unseen', 'seen']))
        ).fetch()

        if (existing.length > 0) return false

        const history = await database.get<ProactiveInsight>('proactive_insights').query(
            Q.where('rule_id', ruleId),
            friendId ? Q.where('friend_id', friendId) : Q.where('friend_id', null),
            Q.sortBy('status_changed_at', Q.desc),
            Q.take(1)
        ).fetch()

        if (history.length === 0) return true

        const last = history[0]
        if (!last.statusChangedAt) return true

        const daysSince = this.getDaysSince(last.statusChangedAt)

        if (last.status === 'dismissed') {
            const cooldown = last.feedback === 'not_helpful' ? 30 : 14
            return daysSince > cooldown
        }

        if (last.status === 'acted_on') {
            return daysSince > 21
        }

        return true
    }

    // === HELPERS ===

    private static async getLastInteractionDate(friendId: string): Promise<Date | null> {
        const interactions = await database.get<Interaction>('interactions').query(
            Q.on('interaction_friends', 'friend_id', friendId),
            Q.where('status', 'completed'),
            Q.sortBy('interaction_date', Q.desc),
            Q.take(1)
        ).fetch()

        return interactions.length > 0 ? interactions[0].interactionDate : null
    }

    private static async getInteractionCount(friendId: string, days: number): Promise<number> {
        const since = new Date(Date.now() - days * ONE_DAY_MS)
        const count = await database.get<Interaction>('interactions').query(
            Q.on('interaction_friends', 'friend_id', friendId),
            Q.where('status', 'completed'),
            Q.where('interaction_date', Q.gte(since.getTime()))
        ).fetchCount()
        return count
    }

    private static getDaysSince(date: Date): number {
        return Math.floor((Date.now() - date.getTime()) / ONE_DAY_MS)
    }
}
