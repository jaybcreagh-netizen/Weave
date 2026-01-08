import React, { useState } from 'react'
import { View, ScrollView, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native'
import { Text } from '@/shared/ui/Text'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Icon } from '@/shared/ui/Icon'
import { useTheme } from '@/shared/hooks/useTheme'
import { oracleService } from '@/modules/oracle/services/oracle-service'
import { SmartAction } from '@/modules/oracle/services/types'
import { Router, useRouter } from 'expo-router'
import { ActionCard } from './ActionCard'
import * as Haptics from 'expo-haptics'
import Animated, { FadeInDown } from 'react-native-reanimated'

import { useOracleSheet } from '@/modules/oracle/hooks/useOracleSheet'
import { useActionExecutor } from '@/modules/oracle/hooks/useActionExecutor'
import { trackEvent, AnalyticsEvents } from '@/shared/services/analytics.service';

export const PlanModeView = () => {
    const { colors } = useTheme()
    const router = useRouter()
    const { params } = useOracleSheet()
    const { executeAction } = useActionExecutor()

    const [text, setText] = useState(params.journalContent || '')
    const [isScanning, setIsScanning] = useState(false)
    const [actions, setActions] = useState<SmartAction[]>([])
    const [hasScanned, setHasScanned] = useState(false)

    const handleScan = async () => {
        if (!text.trim()) return

        setIsScanning(true)
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        setHasScanned(false)
        setActions([])

        try {
            const results = await oracleService.detectActions(text)
            setActions(results)
            setHasScanned(true)
            if (results.length > 0) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                trackEvent(AnalyticsEvents.ORACLE_ACTION_DETECTED, {
                    source: 'plan_mode',
                    action_count: results.length,
                    types: results.map(r => r.type)
                })
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
                trackEvent(AnalyticsEvents.ORACLE_ACTION_DETECTED, {
                    source: 'plan_mode',
                    action_count: 0
                })
            }
        } catch (error) {
            console.error(error)
            Alert.alert("Error", "Failed to scan actions")
        } finally {
            setIsScanning(false)
        }
    }


    const handleExecute = (action: SmartAction) => {
        executeAction(action)
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
        >
            <ScrollView
                contentContainerStyle={{ flexGrow: 1, padding: 16 }}
                keyboardShouldPersistTaps="handled"
            >
                {/* Header */}
                <View className="mb-6 flex-row items-center justify-center">
                    <Icon name="ListTodo" size={16} color={colors.primary} className="mr-2" />
                    <Text variant="h4" className="text-primary font-medium tracking-wide">
                        PLAN NEXT STEPS
                    </Text>
                </View>

                {/* Input Section */}
                <Text variant="h2" className="text-center mb-2">What's on your mind?</Text>
                <Text variant="body" className="text-center text-muted-foreground mb-6">
                    Dump your thoughts. We'll find the to-dos.
                </Text>

                <Card className="p-4 mb-4">
                    <TextInput
                        className="text-foreground text-lg leading-6"
                        placeholder="e.g. I need to call Mom this weekend and maybe grab coffee with David next week..."
                        placeholderTextColor={colors['muted-foreground']}
                        multiline
                        value={text}
                        onChangeText={setText}
                        style={{ minHeight: 100 }}
                    />
                </Card>

                <Button
                    label={isScanning ? "Scanning..." : "Scan for Actions"}
                    onPress={handleScan}
                    disabled={!text.trim() || isScanning}
                    variant="primary"
                    icon={<Icon name="Search" size={18} color={colors['primary-foreground']} />}
                    className="mb-8"
                />

                {/* Results Section */}
                {isScanning && (
                    <View className="py-8 items-center">
                        <ActivityIndicator color={colors.primary} />
                        <Text className="mt-4 text-muted-foreground">Extracting tasks...</Text>
                    </View>
                )}

                {!isScanning && hasScanned && actions.length === 0 && (
                    <Animated.View entering={FadeInDown} className="items-center py-8 opacity-50">
                        <Icon name="Check" size={48} color={colors.muted} />
                        <Text className="mt-4 text-muted-foreground">No specific actions detected.</Text>
                    </Animated.View>
                )}

                {!isScanning && actions.length > 0 && (
                    <View>
                        <View className="flex-row items-center justify-between mb-4">
                            <Text variant="h4" className="uppercase tracking-wide">Detected Actions</Text>
                            <View className="bg-primary/20 px-2 py-1 rounded-full">
                                <Text variant="caption" className="text-primary font-bold">{actions.length}</Text>
                            </View>
                        </View>

                        {actions.map((action, index) => (
                            <ActionCard
                                key={index}
                                action={action}
                                index={index}
                                onExecute={handleExecute}
                            />
                        ))}
                    </View>
                )}

            </ScrollView>
        </KeyboardAvoidingView>
    )
}
