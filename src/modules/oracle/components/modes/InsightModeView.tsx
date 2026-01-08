import React, { useState, useEffect } from 'react'
import { View, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native'
import { Text } from '@/shared/ui/Text'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Icon } from '@/shared/ui/Icon'
import { useTheme } from '@/shared/hooks/useTheme'
import { PatternCard } from './PatternCard'
import { oracleService } from '@/modules/oracle/services/oracle-service'
import { InsightAnalysisResult } from '@/modules/oracle/services/types'
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { trackEvent, AnalyticsEvents } from '@/shared/services/analytics.service';
import { useOracleSheet } from '@/modules/oracle/hooks/useOracleSheet';

export const InsightModeView = () => {
    const { colors } = useTheme()
    const { params } = useOracleSheet()

    // Pre-populate with journal content if available
    const hasJournalContext = Boolean(params.journalContent)

    const [step, setStep] = useState<'input' | 'analyzing' | 'result'>('input')
    const [query, setQuery] = useState('')
    const [analysis, setAnalysis] = useState<InsightAnalysisResult | null>(null)

    // Auto-populate and optionally auto-analyze when journal context is provided
    useEffect(() => {
        if (params.journalContent && !query) {
            setQuery(params.journalContent)
        }
    }, [params.journalContent])

    const handleAnalyze = async () => {
        if (!query.trim()) return

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        setStep('analyzing')

        try {
            // Pass friendId from params if available (e.g., from journal entry context)
            const result = await oracleService.analyzeInsightIntent(query, params.friendId)
            setAnalysis(result)
            setStep('result')
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

            trackEvent(AnalyticsEvents.ORACLE_INSIGHT_ANALYZED, {
                pattern_identified: result.identified_pattern,
                confidence: result.confidence,
                from_journal: hasJournalContext
            })
        } catch (error) {
            console.error(error)
            setStep('input') // Reset on error
        }
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
                    <Icon name="Sparkles" size={16} color={colors.primary} className="mr-2" />
                    <Text variant="h4" className="text-primary font-medium tracking-wide">
                        INSIGHT MODE
                    </Text>
                </View>

                {step === 'input' && (
                    <Animated.View entering={FadeInDown.duration(400)}>
                        <Text variant="h2" className="text-center mb-4 font-serif text-foreground">
                            {hasJournalContext ? "Let's go deeper" : "What's on your mind?"}
                        </Text>
                        <Text variant="body" className="text-center text-muted-foreground mb-8">
                            {hasJournalContext
                                ? "Your journal entry is loaded below. The Oracle will analyze the patterns and dynamics at play."
                                : "Share a feeling, tension, or question about a friendship. The Oracle will help you identify the underlying pattern."
                            }
                        </Text>

                        <Card className="p-4 mb-6 bg-surface">
                            <TextInput
                                multiline
                                placeholder="e.g., I feel like I'm always the one reaching out to Sarah..."
                                placeholderTextColor={colors.muted + '80'} // Add transparency
                                style={{
                                    color: colors.foreground,
                                    fontSize: 16,
                                    lineHeight: 24,
                                    minHeight: 120,
                                    textAlignVertical: 'top'
                                }}
                                value={query}
                                onChangeText={setQuery}
                            />
                        </Card>

                        <Button
                            onPress={handleAnalyze}
                            label="Analyze Pattern"
                            variant="primary"
                            icon="arrow-right"
                            disabled={!query.trim()}
                        />
                    </Animated.View>
                )}

                {step === 'analyzing' && (
                    <Animated.View
                        entering={FadeIn.duration(300)}
                        className="flex-1 items-center justify-center min-h-[300px]"
                    >
                        <ActivityIndicator size="large" color={colors.primary} className="mb-6" />
                        <Text variant="h3" className="text-foreground mb-2">consulting the stars...</Text>
                        <Text variant="body" className="text-muted-foreground">Identifying dynamics</Text>
                    </Animated.View>
                )}

                {step === 'result' && analysis && (
                    <Animated.View entering={FadeInDown.duration(500)}>
                        <PatternCard
                            patternName={analysis.identified_pattern}
                            analysis={analysis.analysis}
                            confidence={analysis.confidence}
                        />

                        <View className="mt-8 mb-6">
                            <Text variant="h4" className="text-center mb-4 text-muted-foreground uppercase tracking-widest text-xs">
                                Clarifying Question
                            </Text>
                            <Text variant="h2" className="text-center font-serif text-foreground italic leading-8 mb-6">
                                "{analysis.clarifying_question}"
                            </Text>

                            <Card className="p-4 bg-muted/50 border border-border">
                                <TextInput
                                    multiline
                                    placeholder="Your answer..."
                                    placeholderTextColor={colors.muted}
                                    style={{
                                        color: colors.foreground,
                                        fontSize: 16,
                                        minHeight: 80,
                                        textAlignVertical: 'top'
                                    }}
                                    onChangeText={setQuery} // Reusing query state for answer
                                    value={query}
                                />
                            </Card>
                        </View>

                        <Button
                            label="Discuss with Oracle"
                            variant="primary"
                            icon="arrow-right"
                            onPress={() => {
                                const { open, setMode } = require('@/modules/oracle/hooks/useOracleSheet').useOracleSheet.getState();
                                open({
                                    context: 'insights',
                                    insightContext: {
                                        analysis: analysis.analysis,
                                        pattern: analysis.identified_pattern,
                                        clarifyingQuestion: analysis.clarifying_question,
                                        userAnswer: query
                                    },
                                    initialQuestion: query
                                });
                                // Force mode to consultation to show chat
                                setMode('consultation');
                            }}
                        />
                    </Animated.View>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    )
}
