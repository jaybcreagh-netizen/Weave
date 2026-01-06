import React, { useState } from 'react'
import { View, Text, Switch, ScrollView, TouchableOpacity } from 'react-native'
import { Stack, router } from 'expo-router'
import { useTheme } from '@/shared/hooks/useTheme'
import { database } from '@/db'
import { withObservables } from '@nozbe/watermelondb/react'
import { FRIEND_RULES, PATTERN_RULES, MILESTONE_RULES, InsightRule } from '@/modules/oracle/services/insight-rules'
import { ChevronLeft } from 'lucide-react-native'
import { Model } from '@nozbe/watermelondb'

import UserProfile from '@/db/models/UserProfile'

interface OracleInsightSettingsProps {
    userProfiles: UserProfile[]
}

const TONE_OPTIONS = [
    { id: 'grounded', label: 'Grounded', description: 'Concise and direct. Cites specific data. Minimal metaphors.' },
    { id: 'warm', label: 'Warm', description: 'Empathetic and affirming. Supportive language.' },
    { id: 'playful', label: 'Playful', description: 'Light and witty. Casual, friendly tone.' },
    { id: 'poetic', label: 'Poetic', description: 'Evocative metaphors and imagery. Reflective.' },
]

function OracleInsightSettings({ userProfiles }: OracleInsightSettingsProps) {
    const userProfile = userProfiles[0]
    const { colors, typography } = useTheme()
    const [toggling, setToggling] = useState<string | null>(null)

    if (!userProfile) return null

    // Safely parse suppressed rules
    const suppressedRules: string[] = JSON.parse(userProfile.suppressedInsightRules || '[]')
    const isAllEnabled = userProfile.proactiveInsightsEnabled !== false // Default true

    const updateTone = async (tone: string) => {
        await database.write(async () => {
            await userProfile.update((rec: UserProfile) => {
                rec.oracleTonePreference = tone as any
            })
        })
    }

    const toggleAll = async (value: boolean) => {
        await database.write(async () => {
            await userProfile.update((rec: UserProfile) => {
                rec.proactiveInsightsEnabled = value
            })
        })
    }

    const toggleRule = async (ruleId: string) => {
        setToggling(ruleId)
        const isSuppressed = suppressedRules.includes(ruleId)
        let newSuppressed = [...suppressedRules]

        if (isSuppressed) {
            newSuppressed = newSuppressed.filter(id => id !== ruleId)
        } else {
            newSuppressed.push(ruleId)
        }

        try {
            await database.write(async () => {
                await userProfile.update((rec: UserProfile) => {
                    rec.suppressedInsightRules = JSON.stringify(newSuppressed)
                })
            })
        } finally {
            setToggling(null)
        }
    }

    const renderRuleToggle = (rule: InsightRule) => {
        const isSuppressed = suppressedRules.includes(rule.id)
        const isEnabled = !isSuppressed

        return (
            <View key={rule.id} className="flex-row items-center justify-between py-4 border-b border-gray-100 dark:border-gray-800">
                <View className="flex-1 pr-4">
                    <Text style={{ color: colors.foreground, fontFamily: typography.fonts.sansMedium }}>
                        {rule.name}
                    </Text>
                    <Text className="text-xs mt-1" style={{ color: colors['muted-foreground'] }}>
                        {rule.description}
                    </Text>
                </View>
                <Switch
                    value={isEnabled}
                    onValueChange={() => toggleRule(rule.id)}
                    trackColor={{ false: colors.muted, true: colors.primary }}
                    disabled={!isAllEnabled || toggling === rule.id}
                />
            </View>
        )
    }

    return (
        <View className="flex-1 bg-white dark:bg-black">
            <Stack.Screen options={{
                headerShown: true,
                title: 'Insight Settings',
                headerLeft: () => (
                    <TouchableOpacity onPress={() => router.back()} className="mr-2">
                        <ChevronLeft color={colors.foreground} />
                    </TouchableOpacity>
                )
            }} />

            <ScrollView contentContainerStyle={{ padding: 16 }}>

                {/* Master Toggle */}
                <View className="mb-8 p-4 rounded-xl bg-gray-50 dark:bg-gray-900">
                    <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-lg font-bold" style={{ color: colors.foreground }}>
                            Proactive Insights
                        </Text>
                        <Switch
                            value={isAllEnabled}
                            onValueChange={toggleAll}
                            trackColor={{ false: colors.muted, true: colors.primary }}
                        />
                    </View>
                    <Text style={{ color: colors['muted-foreground'] }}>
                        Allow Oracle to proactively generate insights about your friendships and patterns.
                    </Text>
                </View>

                <Text className="text-sm font-bold mb-4 uppercase tracking-wider" style={{ color: colors['muted-foreground'] }}>
                    Friendship Insights
                </Text>
                {Object.values(FRIEND_RULES).map(renderRuleToggle)}

                <Text className="text-sm font-bold mt-8 mb-4 uppercase tracking-wider" style={{ color: colors['muted-foreground'] }}>
                    Pattern Insights
                </Text>
                {Object.values(PATTERN_RULES).map(renderRuleToggle)}

                <Text className="text-sm font-bold mt-8 mb-4 uppercase tracking-wider" style={{ color: colors['muted-foreground'] }}>
                    Milestone Celebration
                </Text>
                {Object.values(MILESTONE_RULES).map(renderRuleToggle)}

                <Text className="text-sm font-bold mt-8 mb-4 uppercase tracking-wider" style={{ color: colors['muted-foreground'] }}>
                    Insight Frequency
                </Text>
                <View className="mb-8">
                    {['weekly', 'biweekly', 'monthly', 'on_demand'].map((option) => {
                        const current = userProfile.insightFrequency || 'biweekly'
                        const isSelected = current === option

                        const LABELS: Record<string, string> = {
                            weekly: 'Weekly',
                            biweekly: 'Biweekly (Recommended)',
                            monthly: 'Monthly',
                            on_demand: 'Only when I ask'
                        }

                        const DESCRIPTIONS: Record<string, string> = {
                            weekly: 'One thoughtful insight each week',
                            biweekly: 'Deep reflection every two weeks',
                            monthly: 'A monthly digest of patterns',
                            on_demand: 'No proactive insights, just when you ask'
                        }

                        return (
                            <TouchableOpacity
                                key={option}
                                onPress={async () => {
                                    await database.write(async () => {
                                        await userProfile.update(rec => {
                                            rec.insightFrequency = option as any
                                        })
                                    })
                                }}
                                className={`p-4 mb-2 rounded-xl border ${isSelected ? 'border-primary' : 'border-gray-200 dark:border-gray-800'}`}
                                style={isSelected ? { backgroundColor: colors.primary + '15' } : {}}
                            >
                                <Text style={{ color: colors.foreground, fontFamily: typography.fonts.sansMedium }}>
                                    {LABELS[option]}
                                </Text>
                                <Text className="text-xs mt-1" style={{ color: colors['muted-foreground'] }}>
                                    {DESCRIPTIONS[option]}
                                </Text>
                            </TouchableOpacity>
                        )
                    })}
                </View>

                {/* Oracle Tone Preference */}
                <Text className="text-sm font-bold mt-8 mb-4 uppercase tracking-wider" style={{ color: colors['muted-foreground'] }}>
                    Oracle Tone
                </Text>
                <Text className="text-xs mb-4" style={{ color: colors['muted-foreground'] }}>
                    Choose how the Oracle communicates with you.
                </Text>
                {TONE_OPTIONS.map(tone => {
                    const isSelected = (userProfile.oracleTonePreference || 'grounded') === tone.id
                    return (
                        <TouchableOpacity
                            key={tone.id}
                            onPress={() => updateTone(tone.id)}
                            className={`p-4 mb-2 rounded-xl border ${isSelected ? 'border-primary' : 'border-gray-200 dark:border-gray-800'}`}
                            style={isSelected ? { backgroundColor: colors.primary + '15' } : {}}
                        >
                            <Text style={{ color: colors.foreground, fontFamily: typography.fonts.sansMedium }}>
                                {tone.label}
                            </Text>
                            <Text className="text-xs mt-1" style={{ color: colors['muted-foreground'] }}>
                                {tone.description}
                            </Text>
                        </TouchableOpacity>
                    )
                })}

                <View className="h-10" />
            </ScrollView>
        </View>
    )
}

const enhance = withObservables([], () => ({
    userProfiles: database.get<UserProfile>('user_profile').query().observe()
}))

export default enhance(OracleInsightSettings)
