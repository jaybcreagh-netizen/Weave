import React, { useEffect } from 'react'
import { View, ScrollView } from 'react-native'
import { withObservables } from '@nozbe/watermelondb/react'
import { Q } from '@nozbe/watermelondb'
import { database } from '@/db'
import ProactiveInsight from '@/db/models/ProactiveInsight'
import { OracleInsightCard } from './OracleInsightCard'
import { writeScheduler } from '@/shared/services/write-scheduler'

interface InsightsCarouselProps {
    insights: ProactiveInsight[]
    onAction: (insight: ProactiveInsight) => void
}

function InsightsCarousel({ insights, onAction }: InsightsCarouselProps) {

    useEffect(() => {
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
        <View className="mb-2">
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
                decelerationRate="fast"
                snapToInterval={340} // Approx width of card + margin
            >
                {insights.map(insight => (
                    <View key={insight.id} style={{ width: 330, marginRight: 12 }}>
                        <OracleInsightCard
                            insight={insight}
                            onAction={onAction}
                            onDismiss={handleDismiss}
                        />
                    </View>
                ))}
            </ScrollView>
        </View>
    )
}

const enhance = withObservables([], () => ({
    insights: database.get<ProactiveInsight>('proactive_insights').query(
        Q.where('status', Q.oneOf(['unseen', 'seen'])),
        Q.sortBy('severity', Q.desc), // Show critical first
        Q.sortBy('generated_at', Q.desc), // Then newest
        Q.take(3) // Cap at 3
    )
}))

export default enhance(InsightsCarousel)
