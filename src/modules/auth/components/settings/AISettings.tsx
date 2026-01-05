/**
 * AI Settings Component
 * Privacy controls and disclosure for AI-powered features.
 */

import React, { useState, useCallback } from 'react'
import { View, ScrollView, Alert, Linking } from 'react-native'
import { Text } from '@/shared/ui/Text'
import { Card } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Icon } from '@/shared/ui/Icon'
import { ModernSwitch } from '@/shared/ui/ModernSwitch'
import { useTheme } from '@/shared/hooks/useTheme'
import { useUserProfile } from '@/modules/auth/hooks/useUserProfile'
import { database } from '@/db'
import UserProfile from '@/db/models/UserProfile'

const AI_DISCLOSURE = `Weave uses Google's Gemini AI to enhance your experience:

• Journal Analysis: Extracts themes and sentiment from your journal entries to provide insights about your relationships.

• Social Oracle: Answers questions about your relationships using your interaction history and journal entries.

Your Privacy:
• Your data is processed by Google's Gemini AI to generate responses
• Google does not use your data to train their models
• All processing is on-demand; we don't store AI-generated content beyond what you explicitly save
• You can disable these features at any time

Tap "Learn More" to read our full privacy policy.`

export function AISettings() {
    const { colors } = useTheme()
    const { profile } = useUserProfile()
    const [isUpdating, setIsUpdating] = useState(false)
    const [showDisclosure, setShowDisclosure] = useState(false)

    const hasAcknowledgedDisclosure = !!profile?.aiDisclosureAcknowledgedAt
    const aiFeaturesEnabled = profile?.aiFeaturesEnabled ?? false
    const journalAnalysisEnabled = profile?.aiJournalAnalysisEnabled ?? true
    const oracleEnabled = profile?.aiOracleEnabled ?? true

    const updateSettings = useCallback(async (updates: Partial<{
        aiFeaturesEnabled: boolean
        aiJournalAnalysisEnabled: boolean
        aiOracleEnabled: boolean
        aiDisclosureAcknowledgedAt: number
    }>) => {
        if (!profile) return

        setIsUpdating(true)
        try {
            await database.write(async () => {
                await profile.update((p: UserProfile) => {
                    if (updates.aiFeaturesEnabled !== undefined) {
                        p.aiFeaturesEnabled = updates.aiFeaturesEnabled
                    }
                    if (updates.aiJournalAnalysisEnabled !== undefined) {
                        p.aiJournalAnalysisEnabled = updates.aiJournalAnalysisEnabled
                    }
                    if (updates.aiOracleEnabled !== undefined) {
                        p.aiOracleEnabled = updates.aiOracleEnabled
                    }
                    if (updates.aiDisclosureAcknowledgedAt !== undefined) {
                        p.aiDisclosureAcknowledgedAt = updates.aiDisclosureAcknowledgedAt
                    }
                })
            })
        } catch (error) {
            console.error('Failed to update AI settings:', error)
            Alert.alert('Error', 'Failed to update settings. Please try again.')
        } finally {
            setIsUpdating(false)
        }
    }, [profile])

    const handleEnableAI = useCallback(() => {
        if (!hasAcknowledgedDisclosure) {
            setShowDisclosure(true)
        } else {
            updateSettings({ aiFeaturesEnabled: true })
        }
    }, [hasAcknowledgedDisclosure, updateSettings])

    const handleAcknowledgeAndEnable = useCallback(() => {
        updateSettings({
            aiFeaturesEnabled: true,
            aiDisclosureAcknowledgedAt: Date.now(),
        })
        setShowDisclosure(false)
    }, [updateSettings])

    const handleDisableAI = useCallback(() => {
        Alert.alert(
            'Disable AI Features?',
            'This will turn off Journal Analysis and the Social Oracle. Your existing data will be preserved.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Disable',
                    style: 'destructive',
                    onPress: () => updateSettings({ aiFeaturesEnabled: false })
                },
            ]
        )
    }, [updateSettings])

    // Disclosure modal
    if (showDisclosure) {
        return (
            <ScrollView
                className="flex-1 p-4"
                style={{ backgroundColor: colors.background }}
            >
                <Card className="p-4">
                    <View className="flex-row items-center mb-4">
                        <Icon name="Sparkles" size={24} color={colors.primary} />
                        <Text variant="h3" className="ml-2">AI Features Disclosure</Text>
                    </View>

                    <Text className="mb-4 leading-6" style={{ color: colors['muted-foreground'] }}>
                        {AI_DISCLOSURE}
                    </Text>

                    <Button
                        variant="ghost"
                        onPress={() => Linking.openURL('https://weave.app/privacy')}
                        className="mb-4"
                    >
                        <Text style={{ color: colors.primary }}>Learn More →</Text>
                    </Button>

                    <View className="flex-row gap-3">
                        <Button
                            variant="outline"
                            onPress={() => setShowDisclosure(false)}
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            onPress={handleAcknowledgeAndEnable}
                            className="flex-1"
                            disabled={isUpdating}
                        >
                            I Understand, Enable AI
                        </Button>
                    </View>
                </Card>
            </ScrollView>
        )
    }

    return (
        <ScrollView
            className="flex-1 p-4"
            style={{ backgroundColor: colors.background }}
        >
            {/* Master Toggle */}
            <Card className="p-4 mb-4">
                <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1">
                        <Icon
                            name="Sparkles"
                            size={20}
                            color={aiFeaturesEnabled ? colors.primary : colors.muted}
                        />
                        <View className="ml-3 flex-1">
                            <Text variant="body" weight="medium">Enable AI Features</Text>
                            <Text variant="caption" style={{ color: colors['muted-foreground'] }}>
                                Unlock Oracle insights and smart prompts
                            </Text>
                        </View>
                    </View>
                    <ModernSwitch
                        value={aiFeaturesEnabled}
                        onValueChange={aiFeaturesEnabled ? handleDisableAI : handleEnableAI}
                        disabled={isUpdating}
                    />
                </View>
            </Card>

            {/* Sub-toggles (only visible when master is on) */}
            {aiFeaturesEnabled && (
                <Card className="p-4 mb-4">
                    <Text variant="label" className="mb-3" style={{ color: colors['muted-foreground'] }}>
                        FEATURES
                    </Text>

                    {/* Journal Analysis */}
                    <View className="flex-row items-center justify-between py-3 border-b"
                        style={{ borderColor: colors.border }}>
                        <View className="flex-row items-center flex-1">
                            <Icon name="BookOpen" size={18} color={colors['muted-foreground']} />
                            <View className="ml-3 flex-1">
                                <Text variant="body">Journal Analysis</Text>
                                <Text variant="caption" style={{ color: colors['muted-foreground'] }}>
                                    Extract themes and sentiment from entries
                                </Text>
                            </View>
                        </View>
                        <ModernSwitch
                            value={journalAnalysisEnabled}
                            onValueChange={(value) => updateSettings({ aiJournalAnalysisEnabled: value })}
                            disabled={isUpdating}
                        />
                    </View>

                    {/* Oracle */}
                    <View className="flex-row items-center justify-between py-3">
                        <View className="flex-row items-center flex-1">
                            <Icon name="MessageCircle" size={18} color={colors['muted-foreground']} />
                            <View className="ml-3 flex-1">
                                <Text variant="body">Social Oracle</Text>
                                <Text variant="caption" style={{ color: colors['muted-foreground'] }}>
                                    Ask questions about your relationships
                                </Text>
                            </View>
                        </View>
                        <ModernSwitch
                            value={oracleEnabled}
                            onValueChange={(value) => updateSettings({ aiOracleEnabled: value })}
                            disabled={isUpdating}
                        />
                    </View>
                </Card>
            )}

            {/* Privacy info */}
            <Card className="p-4">
                <View className="flex-row items-start">
                    <Icon name="Shield" size={18} color={colors['muted-foreground']} />
                    <View className="ml-3 flex-1">
                        <Text variant="body" weight="medium" className="mb-1">Your Privacy</Text>
                        <Text variant="caption" style={{ color: colors['muted-foreground'] }}>
                            AI features use Google's Gemini. Your data is not used to train AI models.
                            {hasAcknowledgedDisclosure && profile?.aiDisclosureAcknowledgedAt && (
                                ` You acknowledged the disclosure on ${new Date(profile.aiDisclosureAcknowledgedAt).toLocaleDateString()}.`
                            )}
                        </Text>
                    </View>
                </View>
            </Card>
        </ScrollView>
    )
}

export default AISettings
