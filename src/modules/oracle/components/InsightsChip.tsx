/**
 * InsightsChip
 * 
 * A chip that displays the count of pending proactive insights.
 * When tapped, opens the Nudges sheet to view insights.
 */

import React from 'react'
import { TouchableOpacity, View } from 'react-native'
import { withObservables } from '@nozbe/watermelondb/react'
import { Q } from '@nozbe/watermelondb'
import { Sparkles } from 'lucide-react-native'
import { database } from '@/db'
import ProactiveInsight from '@/db/models/ProactiveInsight'
import { useTheme } from '@/shared/hooks/useTheme'
import { Text } from '@/shared/ui/Text'

interface InsightsChipProps {
    insights: ProactiveInsight[]
    onPress: () => void
}

function InsightsChipInner({ insights, onPress }: InsightsChipProps) {
    const { colors, typography } = useTheme()
    const count = insights.length

    if (count === 0) return null

    return (
        <TouchableOpacity
            onPress={onPress}
            className="flex-row items-center px-4 py-2.5 rounded-full mb-3"
            style={{
                backgroundColor: colors.primary + '20',
                borderWidth: 1,
                borderColor: colors.primary + '40',
            }}
            activeOpacity={0.7}
        >
            <Sparkles size={16} color={colors.primary} />
            <Text
                variant="body"
                className="ml-2"
                style={{
                    color: colors.primary,
                    fontFamily: typography.fonts.sansMedium,
                }}
            >
                {count} insight{count !== 1 ? 's' : ''} waiting
            </Text>
        </TouchableOpacity>
    )
}

const enhance = withObservables([], () => ({
    insights: database.get<ProactiveInsight>('proactive_insights').query(
        Q.where('status', Q.oneOf(['unseen', 'seen'])),
    )
}))

export const InsightsChip = enhance(InsightsChipInner)
