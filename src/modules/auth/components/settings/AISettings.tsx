/**
 * AI Settings Component
 * Privacy controls and disclosure for AI-powered features.
 */

import React, { useState, useCallback } from 'react'
import { View, ScrollView, Alert, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { Text } from '@/shared/ui/Text'
import { Card } from '@/shared/ui/Card'
import { Button } from '@/shared/ui/Button'
import { Icon } from '@/shared/ui/Icon'
import { ModernSwitch } from '@/shared/ui/ModernSwitch'
import { useTheme } from '@/shared/hooks/useTheme'
import { useUserProfile } from '@/modules/auth/hooks/useUserProfile'
import { database, initializeUserProfile } from '@/db'
import UserProfile from '@/db/models/UserProfile'

const DISCLOSURE_FEATURES = [
    'Journal analysis can extract themes and sentiment from entries to surface relationship signals.',
    'Social Oracle can answer questions using the relationship data and journal context you choose to share.',
]

const DISCLOSURE_PRIVACY = [
    "Remote AI requests are processed by Google's Gemini models when you opt in.",
    'Your data is not used to train consumer AI models.',
    "Processing is on-demand. We only keep content you explicitly save inside Weave.",
    'You can disable remote AI at any time without losing your core local data.',
]

function DisclosureBullet({
    text,
    color,
}: {
    text: string
    color: string
}) {
    return (
        <View className="flex-row items-start mb-3">
            <View
                className="w-2 h-2 rounded-full mt-2 mr-3"
                style={{ backgroundColor: color }}
            />
            <Text
                variant="body"
                style={{ color, flex: 1, lineHeight: 30 }}
            >
                {text}
            </Text>
        </View>
    )
}

export function AISettings() {
    const { colors } = useTheme()
    const { profile, intelligenceCapabilities, isLoading } = useUserProfile()
    const [isUpdating, setIsUpdating] = useState(false)
    const [showDisclosure, setShowDisclosure] = useState(false)

    const hasAcknowledgedDisclosure = !!profile?.aiDisclosureAcknowledgedAt
    const aiFeaturesEnabled = profile?.aiFeaturesEnabled ?? false
    const journalAnalysisEnabled = profile?.aiJournalAnalysisEnabled ?? true
    const oracleEnabled = profile?.aiOracleEnabled ?? true
    const controlsDisabled = !!isLoading || isUpdating

    const remoteStatusMessage = (() => {
        switch (intelligenceCapabilities.remoteUnavailableReason) {
            case 'disclosure_required':
                return 'Remote AI is waiting for you to review the privacy disclosure.'
            case 'offline':
                return 'You are offline, so remote AI is paused. Local journaling and signal extraction still work.'
            case 'provider_unavailable':
                return 'Remote AI is temporarily unavailable. Weave stays local-first in the meantime.'
            case 'disabled_by_user':
                return 'Remote AI is off. Local intelligence stays available.'
            default:
                return 'Local intelligence always stays available. Remote AI only runs when you opt in and it is reachable.'
        }
    })()

    const resolveProfile = useCallback(async (): Promise<UserProfile | null> => {
        if (profile) return profile

        await initializeUserProfile()
        const profiles = await database.get<UserProfile>('user_profile').query().fetch()
        return profiles[0] ?? null
    }, [profile])

    const updateSettings = useCallback(async (updates: Partial<{
        aiFeaturesEnabled: boolean
        aiJournalAnalysisEnabled: boolean
        aiOracleEnabled: boolean
        aiDisclosureAcknowledgedAt: number
    }>) => {
        setIsUpdating(true)
        try {
            const resolvedProfile = await resolveProfile()
            if (!resolvedProfile) {
                throw new Error('No user profile available for AI settings update')
            }

            await database.write(async () => {
                await resolvedProfile.update((p: UserProfile) => {
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
    }, [resolveProfile])

    const handleEnableAI = useCallback(() => {
        if (!hasAcknowledgedDisclosure) {
            setShowDisclosure(true)
            return
        }

        updateSettings({ aiFeaturesEnabled: true })
    }, [hasAcknowledgedDisclosure, updateSettings])

    const handleAcknowledgeAndEnable = useCallback(async () => {
        await updateSettings({
            aiFeaturesEnabled: true,
            aiDisclosureAcknowledgedAt: Date.now(),
        })
        setShowDisclosure(false)
    }, [updateSettings])

    const handleDisableAI = useCallback(() => {
        Alert.alert(
            'Disable AI features?',
            'This turns off remote Oracle chat and journal enrichment. Your existing data stays exactly where it is.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Disable',
                    style: 'destructive',
                    onPress: () => updateSettings({ aiFeaturesEnabled: false }),
                },
            ]
        )
    }, [updateSettings])

    const handleMasterToggle = useCallback((nextValue: boolean) => {
        if (nextValue) {
            handleEnableAI()
            return
        }

        handleDisableAI()
    }, [handleDisableAI, handleEnableAI])

    if (showDisclosure) {
        return (
            <ScrollView
                className="flex-1"
                contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
                style={{ backgroundColor: colors.background }}
                showsVerticalScrollIndicator={false}
            >
                <View className="gap-4">
                    <Card variant="outlined" className="p-5">
                        <View className="flex-row items-center mb-5">
                            <View
                                className="w-11 h-11 rounded-2xl items-center justify-center"
                                style={{ backgroundColor: colors.primary + '14' }}
                            >
                                <Icon name="Sparkles" size={22} color={colors.primary} />
                            </View>
                            <View className="ml-3 flex-1">
                                <Text variant="h3">AI Features Disclosure</Text>
                                <Text
                                    variant="caption"
                                    style={{ color: colors['muted-foreground'], lineHeight: 20 }}
                                >
                                    Remote AI is optional, and core Weave flows keep working without it.
                                </Text>
                            </View>
                        </View>

                        <Text
                            variant="body"
                            className="mb-5"
                            style={{ color: colors['muted-foreground'], lineHeight: 30 }}
                        >
                            Weave can use Google&apos;s Gemini AI when you opt in. Here is exactly what that means.
                        </Text>

                        <Text
                            variant="label"
                            className="mb-3"
                            style={{ color: colors['muted-foreground'] }}
                        >
                            What Remote AI Does
                        </Text>
                        {DISCLOSURE_FEATURES.map((item) => (
                            <DisclosureBullet
                                key={item}
                                text={item}
                                color={colors['muted-foreground']}
                            />
                        ))}

                        <Text
                            variant="label"
                            className="mt-3 mb-3"
                            style={{ color: colors['muted-foreground'] }}
                        >
                            Privacy
                        </Text>
                        {DISCLOSURE_PRIVACY.map((item) => (
                            <DisclosureBullet
                                key={item}
                                text={item}
                                color={colors['muted-foreground']}
                            />
                        ))}

                        <TouchableOpacity
                            onPress={() => router.push('/privacy-policy')}
                            className="mt-2 self-start"
                            activeOpacity={0.7}
                        >
                            <Text
                                variant="body"
                                weight="medium"
                                style={{ color: colors.primary }}
                            >
                                Read full privacy policy
                            </Text>
                        </TouchableOpacity>

                        <Text
                            variant="caption"
                            className="mt-5"
                            style={{ color: colors['muted-foreground'], lineHeight: 20 }}
                        >
                            By enabling AI, you confirm that you have read this disclosure.
                        </Text>
                    </Card>

                    <Button
                        variant="primary"
                        onPress={handleAcknowledgeAndEnable}
                        label={isUpdating ? 'Saving...' : 'Enable AI'}
                        disabled={isUpdating}
                        fullWidth
                    />

                    <Button
                        variant="outline"
                        onPress={() => setShowDisclosure(false)}
                        label="Not now"
                        disabled={isUpdating}
                        fullWidth
                    />
                </View>
            </ScrollView>
        )
    }

    return (
        <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
            style={{ backgroundColor: colors.background }}
            showsVerticalScrollIndicator={false}
        >
            <View className="gap-4">
                <Card variant="outlined" className="p-5">
                    <View className="flex-row items-start justify-between">
                        <View className="flex-row flex-1 items-start pr-4">
                            <View
                                className="w-11 h-11 rounded-2xl items-center justify-center"
                                style={{ backgroundColor: colors.primary + '14' }}
                            >
                                <Icon
                                    name="Sparkles"
                                    size={22}
                                    color={aiFeaturesEnabled ? colors.primary : colors['muted-foreground']}
                                />
                            </View>
                            <View className="ml-3 flex-1">
                                <Text variant="h3">Use Remote AI</Text>
                                <Text
                                    variant="body"
                                    style={{ color: colors['muted-foreground'], lineHeight: 30 }}
                                >
                                    Turn on Gemini-powered Oracle chat and remote journal enrichment. When this is off, Weave falls back to local intelligence instead.
                                </Text>
                                <TouchableOpacity
                                    onPress={() => setShowDisclosure(true)}
                                    className="mt-3 self-start"
                                    activeOpacity={0.7}
                                >
                                    <Text
                                        variant="caption"
                                        weight="medium"
                                        style={{ color: colors.primary }}
                                    >
                                        Review AI disclosure
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <ModernSwitch
                            value={aiFeaturesEnabled}
                            onValueChange={handleMasterToggle}
                            disabled={controlsDisabled}
                        />
                    </View>
                </Card>

                <Card variant="outlined" className="p-5">
                    <View className="flex-row items-start">
                        <View
                            className="w-11 h-11 rounded-2xl items-center justify-center"
                            style={{ backgroundColor: colors.muted }}
                        >
                            <Icon
                                name={intelligenceCapabilities.remoteEnrichmentEnabled ? 'Wifi' : 'Sparkles'}
                                size={20}
                                color={
                                    intelligenceCapabilities.remoteEnrichmentEnabled
                                        ? colors.primary
                                        : colors['muted-foreground']
                                }
                            />
                        </View>
                        <View className="ml-3 flex-1">
                            <Text variant="h3">Intelligence Status</Text>
                            <Text
                                variant="body"
                                style={{ color: colors['muted-foreground'], lineHeight: 30 }}
                            >
                                {remoteStatusMessage}
                            </Text>
                        </View>
                    </View>
                </Card>

                <Card variant="outlined" className="p-5">
                    <View className="flex-row items-start justify-between">
                        <View className="flex-row flex-1 items-start pr-4">
                            <View
                                className="w-11 h-11 rounded-2xl items-center justify-center"
                                style={{ backgroundColor: colors.muted }}
                            >
                                <Icon
                                    name="Sparkles"
                                    size={20}
                                    color={colors.primary}
                                />
                            </View>
                            <View className="ml-3 flex-1">
                                <Text variant="h3">Local Intelligence</Text>
                                <Text
                                    variant="body"
                                    style={{ color: colors['muted-foreground'], lineHeight: 30 }}
                                >
                                    Even with Remote AI off, Weave can still run local Today summaries, journal signal extraction, and relationship nudges right on-device.
                                </Text>
                                <TouchableOpacity
                                    onPress={() => router.push('/oracle-settings')}
                                    className="mt-3 self-start"
                                    activeOpacity={0.7}
                                >
                                    <Text
                                        variant="caption"
                                        weight="medium"
                                        style={{ color: colors.primary }}
                                    >
                                        Manage local nudges and tone
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Card>

                {aiFeaturesEnabled && (
                    <Card variant="outlined" className="p-5">
                        <Text
                            variant="label"
                            className="mb-4"
                            style={{ color: colors['muted-foreground'] }}
                        >
                            LLM Preferences
                        </Text>
                        <Text
                            variant="caption"
                            className="mb-4"
                            style={{ color: colors['muted-foreground'], lineHeight: 20 }}
                        >
                            Choose which model-powered features are allowed when Remote AI is enabled.
                        </Text>

                        <View
                            className="flex-row items-center justify-between pb-4 mb-4 border-b"
                            style={{ borderColor: colors.border }}
                        >
                            <View className="flex-row items-start flex-1 pr-4">
                                <View
                                    className="w-10 h-10 rounded-2xl items-center justify-center"
                                    style={{ backgroundColor: colors.muted }}
                                >
                                    <Icon name="BookOpen" size={18} color={colors['muted-foreground']} />
                                </View>
                                <View className="ml-3 flex-1">
                                    <Text variant="body" weight="medium">Journal Analysis</Text>
                                    <Text
                                        variant="caption"
                                        style={{ color: colors['muted-foreground'], lineHeight: 20 }}
                                    >
                                        Allow model-powered enrichment for themes, thread extraction, and smart action suggestions.
                                    </Text>
                                </View>
                            </View>
                            <ModernSwitch
                                value={journalAnalysisEnabled}
                                onValueChange={(value) => updateSettings({ aiJournalAnalysisEnabled: value })}
                                disabled={controlsDisabled}
                            />
                        </View>

                        <View className="flex-row items-center justify-between">
                            <View className="flex-row items-start flex-1 pr-4">
                                <View
                                    className="w-10 h-10 rounded-2xl items-center justify-center"
                                    style={{ backgroundColor: colors.muted }}
                                >
                                    <Icon name="MessageCircle" size={18} color={colors['muted-foreground']} />
                                </View>
                                <View className="ml-3 flex-1">
                                    <Text variant="body" weight="medium">Social Oracle</Text>
                                    <Text
                                        variant="caption"
                                        style={{ color: colors['muted-foreground'], lineHeight: 20 }}
                                    >
                                        Allow Oracle chat, guided reflection, and remote phrasing or polish on supported surfaces.
                                    </Text>
                                </View>
                            </View>
                            <ModernSwitch
                                value={oracleEnabled}
                                onValueChange={(value) => updateSettings({ aiOracleEnabled: value })}
                                disabled={controlsDisabled}
                            />
                        </View>
                    </Card>
                )}

                <Card variant="outlined" className="p-5">
                    <View className="flex-row items-start">
                        <View
                            className="w-11 h-11 rounded-2xl items-center justify-center"
                            style={{ backgroundColor: colors.muted }}
                        >
                            <Icon name="Shield" size={20} color={colors['muted-foreground']} />
                        </View>
                        <View className="ml-3 flex-1">
                            <Text variant="h3">Your Privacy</Text>
                            <Text
                                variant="body"
                                style={{ color: colors['muted-foreground'], lineHeight: 30 }}
                            >
                                Remote AI can use Weave-managed providers such as Gemini to generate responses. Your data is not used to train consumer AI models.
                                {hasAcknowledgedDisclosure && profile?.aiDisclosureAcknowledgedAt
                                    ? ` You acknowledged the disclosure on ${new Date(profile.aiDisclosureAcknowledgedAt).toLocaleDateString()}.`
                                    : ''}
                            </Text>

                            <TouchableOpacity
                                onPress={() => router.push('/privacy-policy')}
                                className="mt-3 self-start"
                                activeOpacity={0.7}
                            >
                                <Text
                                    variant="caption"
                                    weight="medium"
                                    style={{ color: colors.primary }}
                                >
                                    Open privacy policy
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Card>
            </View>
        </ScrollView>
    )
}

export default AISettings
