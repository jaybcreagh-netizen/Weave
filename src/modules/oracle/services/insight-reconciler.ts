import { database } from '@/db'
import { Q } from '@nozbe/watermelondb'
import ProactiveInsight from '@/db/models/ProactiveInsight'
import Interaction from '@/db/models/Interaction'
import { writeScheduler } from '@/shared/services/write-scheduler'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

export class InsightReconciler {

    static async reconcileActiveInsights(): Promise<void> {
        // Fetch all active insights (unseen or seen)
        const activeInsights = await database.get<ProactiveInsight>('proactive_insights').query(
            Q.where('status', Q.oneOf(['unseen', 'seen']))
        ).fetch()

        for (const insight of activeInsights) {
            const isValid = await this.checkValidity(insight)

            if (!isValid) {
                // Invalidate if no longer true
                await writeScheduler.important('invalidateInsight', async () => {
                    await insight.update(rec => {
                        rec.status = 'invalidated'
                        rec.statusChangedAt = new Date()
                    })
                })
            } else if (insight.expiresAt < new Date()) {
                // Expire if past TTL
                await writeScheduler.important('expireInsight', async () => {
                    await insight.update(rec => {
                        rec.status = 'expired'
                        rec.statusChangedAt = new Date()
                    })
                })
            }
        }
    }

    private static async checkValidity(insight: ProactiveInsight): Promise<boolean> {
        switch (insight.ruleId) {
            case 'friend_drift':
            case 'friend_reconnection':
                return this.checkDriftStillValid(insight)

            case 'friend_deepening':
                // Deepening usually stays valid until expiry, essentially a "snapshot"
                return true

            case 'pattern_tier_neglect':
                return this.checkTierNeglectStillValid(insight)

            default:
                // By default, assume valid until expiry unless specific logic exists
                return true
        }
    }

    // === SPECIFIC VALIDATION LOGIC ===

    private static async checkDriftStillValid(insight: ProactiveInsight): Promise<boolean> {
        if (!insight.friendId) return false // Should have friendId

        // If ANY interaction happened AFTER generation, it's invalid
        const newInteractions = await database.get<Interaction>('interactions').query(
            Q.on('interaction_friends', 'friend_id', insight.friendId),
            Q.where('status', 'completed'),
            Q.where('interaction_date', Q.gte(insight.generatedAt.getTime()))
        ).fetchCount()

        return newInteractions === 0
    }

    private static async checkTierNeglectStillValid(insight: ProactiveInsight): Promise<boolean> {
        // If ANY interaction with Inner Circle happened AFTER generation
        // We need to query interactions joined with friends filtered by tier
        // Doing this efficiently with WatermelonDB Q functions:

        // 1. Get Inner Circle IDs
        const innerCircleIds = (await database.get('friends').query(
            Q.where('dunbar_tier', 'Inner Circle')
        ).fetch()).map(f => f.id)

        if (innerCircleIds.length === 0) return false // No inner circle? Invalid insight.

        // 2. Check for interactions with these friends since generation
        const newInteractions = await database.get<Interaction>('interactions').query(
            Q.on('interaction_friends', 'friend_id', Q.oneOf(innerCircleIds)),
            Q.where('status', 'completed'),
            Q.where('interaction_date', Q.gte(insight.generatedAt.getTime()))
        ).fetchCount()

        return newInteractions === 0
    }
}
