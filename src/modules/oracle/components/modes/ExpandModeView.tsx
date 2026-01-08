import React, { useState } from 'react'
import { View, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native'
import { Text } from '@/shared/ui/Text'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { Icon } from '@/shared/ui/Icon'
import { useTheme } from '@/shared/hooks/useTheme'
import { oracleService } from '@/modules/oracle/services/oracle-service'
import { useRouter } from 'expo-router'
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { trackEvent, AnalyticsEvents } from '@/shared/services/analytics.service';

export const ExpandModeView = () => {
    const { colors } = useTheme()
    const router = useRouter()

    const [step, setStep] = useState<'drafting' | 'auditing' | 'answering' | 'composing' | 'review'>('drafting')
    const [draft, setDraft] = useState('')
    const [questions, setQuestions] = useState<string[]>([])
    const [currentQIndex, setCurrentQIndex] = useState(0)
    const [currentAnswer, setCurrentAnswer] = useState('')
    const [answers, setAnswers] = useState<{ question: string, answer: string }[]>([])
    const [finalEntry, setFinalEntry] = useState('')

    const handleAssess = async () => {
        if (draft.length < 5) return

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        setStep('auditing')
        try {
            const result = await oracleService.assessDraft(draft)

            if (result.status === 'complete' || result.clarifying_questions.length === 0) {
                setFinalEntry(draft)
                setStep('review')
            } else {
                setQuestions(result.clarifying_questions)
                setCurrentQIndex(0)
                setStep('answering')
            }
        } catch (error) {
            console.error(error)
            setStep('drafting')
        }
    }

    const handleNextQuestion = () => {
        if (!currentAnswer.trim()) return

        const newAnswers = [...answers, {
            question: questions[currentQIndex],
            answer: currentAnswer
        }]
        setAnswers(newAnswers)
        setCurrentAnswer('')

        if (currentQIndex < questions.length - 1) {
            setCurrentQIndex(prev => prev + 1)
        } else {
            generateFinalEntry(newAnswers)
        }
    }

    const generateFinalEntry = async (collectedAnswers: { question: string, answer: string }[]) => {
        setStep('composing')
        try {
            const expanded = await oracleService.expandJournalEntry(draft, collectedAnswers)
            setFinalEntry(expanded)
            setStep('review')
        } catch (error) {
            console.error(error)
            Alert.alert("Error", "Could not compose entry. Please try again.")
            setStep('drafting')
        }
    }

    const handleSave = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

        trackEvent(AnalyticsEvents.ORACLE_DRAFT_EXPANDED, {
            original_length: draft.length,
            final_length: finalEntry.length,
            questions_answered: answers.length
        });

        // Navigate to Journal Entry creation with prefilled data
        router.push({
            pathname: '/(tabs)/journal',
            params: {
                autoCreate: 'true',
                content: finalEntry
            }
        })
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
                    <Icon name="Maximize2" size={16} color={colors.primary} className="mr-2" />
                    <Text variant="h4" className="text-primary font-medium tracking-wide">
                        EXPAND ENTRY
                    </Text>
                </View>

                {step === 'drafting' && (
                    <Animated.View entering={FadeInDown.delay(100)}>
                        <Text variant="h2" className="text-center mb-2">Internal thought...</Text>
                        <Text variant="body" className="text-center text-muted-foreground mb-6">
                            Jot down the basics. We'll help you fill in the gaps.
                        </Text>

                        <Card className="p-4 mb-4 min-h-[160px]">
                            <TextInput
                                className="text-foreground text-lg leading-6"
                                placeholder="e.g. Lunch with Sam today. It was nice..."
                                placeholderTextColor={colors['muted-foreground']}
                                multiline
                                value={draft}
                                onChangeText={setDraft}
                                autoFocus
                                style={{ minHeight: 120 }}
                            />
                        </Card>

                        <Button
                            label="Assess Completeness"
                            onPress={handleAssess}
                            disabled={!draft.trim()}
                            variant="primary"
                            icon={<Icon name="Sparkles" size={18} color={colors['primary-foreground']} />}
                        />
                    </Animated.View>
                )}

                {step === 'auditing' && (
                    <View className="flex-1 justify-center items-center py-20">
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text className="mt-4 text-muted-foreground">Checking for gaps...</Text>
                    </View>
                )}

                {step === 'answering' && (
                    <Animated.View entering={FadeIn.duration(400)} key={`q-${currentQIndex}`}>
                        <View className="flex-row justify-between items-center mb-4">
                            <Text variant="caption" className="text-muted-foreground uppercase">
                                Question {currentQIndex + 1} of {questions.length}
                            </Text>
                        </View>

                        <Card className="p-4 mb-6" style={{ backgroundColor: colors.primary + '10' }}>
                            <Text variant="h3" className="text-primary font-serif italic">
                                "{questions[currentQIndex]}"
                            </Text>
                        </Card>

                        <Text variant="caption" className="mb-2 ml-1 text-muted-foreground">YOUR ANSWER</Text>
                        <TextInput
                            className="bg-surface p-4 rounded-xl text-lg text-foreground border border-border mb-6 min-h-[100px]"
                            placeholder="Type your answer..."
                            placeholderTextColor={colors['muted-foreground']}
                            multiline
                            value={currentAnswer}
                            onChangeText={setCurrentAnswer}
                            autoFocus
                        />

                        <Button
                            label={currentQIndex === questions.length - 1 ? "Finish & Compose" : "Next Question"}
                            onPress={handleNextQuestion}
                            variant="primary"
                            icon={<Icon name="ArrowRight" size={18} color={colors['primary-foreground']} />}
                            disabled={!currentAnswer.trim()}
                        />

                        <TouchableOpacity
                            onPress={() => generateFinalEntry(answers)}
                            className="mt-4 py-3 items-center"
                        >
                            <Text className="text-muted-foreground font-medium">Skip remaining & compose</Text>
                        </TouchableOpacity>
                    </Animated.View>
                )}

                {step === 'composing' && (
                    <View className="flex-1 justify-center items-center py-20">
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text className="mt-4 text-muted-foreground">Weaving your entry...</Text>
                    </View>
                )}

                {step === 'review' && (
                    <Animated.View entering={FadeInDown.springify()}>
                        <Text variant="h2" className="text-center mb-6">Here is your entry</Text>

                        <Card className="p-4 mb-6">
                            <Text variant="body" className="text-foreground leading-7 text-lg">
                                {finalEntry}
                            </Text>
                        </Card>

                        <Button
                            label="Save to Journal"
                            onPress={handleSave}
                            variant="primary"
                            className="mb-3"
                            icon={<Icon name="Check" size={18} color={colors['primary-foreground']} />}
                        />
                        <Button
                            label="Edit Manually"
                            onPress={() => {
                                // Go to journal edit with this text
                                router.push({
                                    pathname: '/(tabs)/journal',
                                    params: {
                                        autoCreate: 'true',
                                        content: finalEntry
                                    }
                                })
                            }}
                            variant="outline"
                        />
                    </Animated.View>
                )}

            </ScrollView>
        </KeyboardAvoidingView>
    )
}
