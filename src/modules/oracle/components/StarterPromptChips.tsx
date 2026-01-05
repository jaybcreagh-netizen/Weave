/**
 * StarterPromptChips Component
 * Displays tappable prompt chips for the Oracle empty state.
 */

import React from 'react'
import { View, ScrollView, TouchableOpacity, Text } from 'react-native'
import { useTheme } from '@/shared/hooks/useTheme'
import { useStarterPrompts, StarterPrompt, OracleContext } from '../hooks/useStarterPrompts'

interface StarterPromptChipsProps {
    onSelect: (prompt: string) => void
    context?: OracleContext
}

export function StarterPromptChips({ onSelect, context = 'default' }: StarterPromptChipsProps) {
    const { colors, typography } = useTheme()
    const prompts = useStarterPrompts(context)

    if (prompts.length === 0) return null

    return (
        <View className="mt-8 w-full">
            <View
                style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: 6,
                    paddingHorizontal: 24,
                }}
            >
                {prompts.map((prompt) => (
                    <TouchableOpacity
                        key={prompt.id}
                        onPress={() => onSelect(prompt.text)}
                        style={{
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 16,
                            backgroundColor: 'transparent',
                            borderWidth: 1,
                            borderColor: colors.border,
                            opacity: 0.6,
                        }}
                        activeOpacity={0.4}
                    >
                        <Text
                            style={{
                                color: colors['muted-foreground'],
                                fontFamily: typography.fonts.sans,
                                fontSize: 12,
                            }}
                            numberOfLines={1}
                        >
                            {prompt.text}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    )
}
