/**
 * NudgesChip
 * 
 * A chip that displays the count of pending friend suggestions/nudges.
 * When tapped, opens the Nudges sheet.
 * 
 * NOTE: Uses UIStore for counts to avoid triggering useSuggestions hook
 * which causes DB writes for tracking.
 */

import React from 'react'
import { TouchableOpacity } from 'react-native'
import { Bell } from 'lucide-react-native'
import { useTheme } from '@/shared/hooks/useTheme'
import { Text } from '@/shared/ui/Text'
import { useUIStore } from '@/shared/stores/uiStore'

interface NudgesChipProps {
    onPress: () => void
}

export function NudgesChip({ onPress }: NudgesChipProps) {
    const { colors, typography } = useTheme()

    // Use UIStore for count to avoid triggering useSuggestions hook
    // which causes DB writes for suggestion tracking
    const suggestionCount = useUIStore((state) => state.suggestionCount)

    if (suggestionCount === 0) return null

    return (
        <TouchableOpacity
            onPress={onPress}
            className="flex-row items-center px-3 py-1.5 rounded-full mb-3"
            style={{
                backgroundColor: colors.accent + '15',
                borderWidth: 1,
                borderColor: colors.accent + '30',
            }}
            activeOpacity={0.7}
        >
            <Bell size={12} color={colors.accent} />
            <Text
                variant="caption"
                className="ml-1.5"
                style={{
                    color: colors.accent,
                    fontFamily: typography.fonts.sansMedium,
                    fontSize: 12,
                }}
            >
                {suggestionCount} nudge{suggestionCount !== 1 ? 's' : ''} waiting
            </Text>
        </TouchableOpacity>
    )
}

