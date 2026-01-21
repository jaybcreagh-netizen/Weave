import React, { useEffect } from 'react'
import { View } from 'react-native'
import { withObservables } from '@nozbe/watermelondb/react'
import { Q } from '@nozbe/watermelondb'
import { database } from '@/db'
import ProactiveInsight from '@/db/models/ProactiveInsight'
import { OracleInsightCard } from './OracleInsightCard'
import { writeScheduler } from '@/shared/services/write-scheduler'

interface InsightsCarouselProps {
    insights: ProactiveInsight[]
    onTellMeMore: (insight: ProactiveInsight) => void
    onPlanWeave: (insight: ProactiveInsight) => void
    onHasInsights?: (hasInsights: boolean) => void
}

function InsightsCarousel({ insights, onTellMeMore, onPlanWeave, onHasInsights }: InsightsCarouselProps) {

    useEffect(() => {
        // Notify parent about insights presence
        onHasInsights?.(insights.length > 0)

        // Mark 'unseen' insights as 'seen'
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
    }, [insights])

    const handleDismiss = async (insight: ProactiveInsight) => {
        await writeScheduler.important('dismissInsight', async () => {
            await insight.update(rec => {
                rec.status = 'dismissed'
                rec.statusChangedAt = new Date()
            })
        })
    }

    if (insights.length === 0) return null

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
    insights: database.get<ProactiveInsight>('proactive_insights').query(
        Q.where('status', Q.oneOf(['unseen', 'seen'])),
        Q.sortBy('severity', Q.desc), // Show critical first
        Q.sortBy('generated_at', Q.desc), // Then newest
        Q.take(1) // Cap at 1 (Single Synthesis Model)
    )
}))

export default enhance(InsightsCarousel)

