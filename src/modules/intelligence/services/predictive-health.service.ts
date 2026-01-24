
import Friend from '@/db/models/Friend'
import { calculateDecayAmount } from './decay.service'
import { TierDriftingThresholds } from '../constants'
import { logger } from '@/shared/services/logger.service'

export interface HealthPrediction {
    friendId: string
    currentScore: number
    dailyDecayRate: number
    daysToDrift: number // Days until hitting "Drifting" threshold
    daysToZero: number // Days until hitting 0
    driftDate: Date
    urgency: 'critical' | 'high' | 'medium' | 'low'
}

class PredictiveHealthService {

    /**
     * Predict future health of a friendship based on current trajectory
     */
    predictHealth(friend: Friend): HealthPrediction {
        const currentScore = friend.weaveScore || 0

        // 1. Calculate Daily Decay Rate
        // We simulate 1 day of decay to get the current rate
        const dailyRate = calculateDecayAmount(friend, 1)

        // Avoid division by zero if rate is 0 (grace period or bug)
        const safeRate = Math.max(0.1, dailyRate)

        // 2. Identify Thresholds
        // "Drifting" thresh varies by Tier (Inner Circle needs higher score to be safe)
        const tier = (friend.dunbarTier || 'Community') as keyof typeof TierDriftingThresholds
        const driftThreshold = TierDriftingThresholds[tier] || 20

        // 3. Calculate Days Remaining
        const pointsToDrift = Math.max(0, currentScore - driftThreshold)
        const daysToDrift = Math.floor(pointsToDrift / safeRate)
        const daysToZero = Math.floor(currentScore / safeRate)

        // 4. Determine Date
        const now = new Date()
        const driftDate = new Date(now.getTime() + (daysToDrift * 24 * 60 * 60 * 1000))

        // 5. Determine Urgency
        let urgency: HealthPrediction['urgency'] = 'low'
        if (daysToDrift <= 3) urgency = 'critical'
        else if (daysToDrift <= 7) urgency = 'high'
        else if (daysToDrift <= 14) urgency = 'medium'

        return {
            friendId: friend.id,
            currentScore,
            dailyDecayRate: safeRate,
            daysToDrift,
            daysToZero,
            driftDate,
            urgency
        }
    }

    /**
     * Generate a warning message if urgency is high
     */
    getWarningMessage(friend: Friend, prediction: HealthPrediction): string | null {
        if (prediction.urgency === 'low') return null

        const days = prediction.daysToDrift

        if (days === 0) {
            return `${friend.name} is currently drifting.`
        }

        if (days <= 3) {
            return `Needs Attention: ${friend.name} will start drifting in ${days} days.`
        }

        return `${friend.name} is on track to drift in ${days} days.`
    }
}

export const predictiveHealth = new PredictiveHealthService()
