import React, { useEffect } from 'react'
import { View } from 'react-native'
import { withObservables } from '@nozbe/watermelondb/react'
import { Q } from '@nozbe/watermelondb'
import { database } from '@/db'
import ProactiveInsight from '@/db/models/ProactiveInsight'
import UserProfile from '@/db/models/UserProfile'
import { OracleInsightCard } from './OracleInsightCard'
import { writeScheduler } from '@/shared/services/write-scheduler'

interface InsightsCarouselProps {
    insights: ProactiveInsight[]
    userProfiles: UserProfile[]
    onTellMeMore: (insight: ProactiveInsight) => void
    onPlanWeave: (insight: ProactiveInsight) => void
    onHasInsights?: (hasInsights: boolean) => void
}

function InsightsCarousel({ insights, userProfiles, onTellMeMore, onPlanWeave, onHasInsights }: InsightsCarouselProps) {
    const userProfile = userProfiles[0]
    const proactiveInsightsEnabled = userProfile?.proactiveInsightsEnabled !== false

    useEffect(() => {
        // Notify parent about insights presence
        onHasInsights?.(proactiveInsightsEnabled && insights.length > 0)

        // Mark 'unseen' insights as 'seen'
        if (!proactiveInsightsEnabled) return

        const unseen = insights.filter(i => i.status === 'unseen')
        if (unseen.length > 0) {
            writeScheduler.background('markInsightsSeen', async () => {
                await database.batch(
                    ...unseen.map(insight => insight.prepareUpdate(rec => {
                        rec.status = 'seen'
                    }))
                )
            })
        }
    }, [insights, onHasInsights, proactiveInsightsEnabled])

    const handleDismiss = async (insight: ProactiveInsight) => {
        await writeScheduler.important('dismissInsight', async () => {
            await insight.update(rec => {
                rec.status = 'dismissed'
                rec.statusChangedAt = new Date()
            })
        })
    }

    if (!proactiveInsightsEnabled || insights.length === 0) return null

    return (
        <View className="mb-2 px-1">
            <OracleInsightCard
                insight={insights[0]}
                onTellMeMore={onTellMeMore}
                onPlanWeave={onPlanWeave}
                onDismiss={handleDismiss}
            />
        </View>
    )
}

const enhance = withObservables([], () => ({
    userProfiles: database.get<UserProfile>('user_profile').query(),
    insights: database.get<ProactiveInsight>('proactive_insights').query(
        Q.where('status', Q.oneOf(['unseen', 'seen'])),
        Q.sortBy('severity', Q.desc), // Show critical first
        Q.sortBy('generated_at', Q.desc), // Then newest
        Q.take(1) // Cap at 1 (Single Synthesis Model)
    )
}))

export default enhance(InsightsCarousel)
