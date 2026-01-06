/**
 * GuidedReflectionSheet
 * 
 * A bottom sheet for "Help me write" flow.
 * 
 * Flow:
 * 1. Topic Selection - User picks weave/friend or starts fresh
 * 2. Oracle Questions - Oracle asks contextual questions
 * 3. Draft Review - User reviews and edits composed entry
 */

import React, { useEffect, useRef, useState } from 'react'
import {
    View,
    TextInput,
    Pressable,
    ScrollView,
    Modal,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    Alert
} from 'react-native'
import { Text } from '@/shared/ui/Text'
import { Button } from '@/shared/ui/Button'
import { Icon } from '@/shared/ui/Icon'
import { useTheme } from '@/shared/hooks/useTheme'
import { useGuidedReflection, GuidedReflectionState } from '../../hooks/useGuidedReflection'
import { ReflectionContext } from '@/modules/oracle'
import { TopicSelectionStep } from './TopicSelectionStep'
import { FreeformGatherStep, FreeformContext } from './FreeformGatherStep'
import Animated, {
    FadeIn,
    FadeInUp,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { X } from 'lucide-react-native'

interface GuidedReflectionSheetProps {
    isOpen: boolean
    onClose: () => void
    context?: ReflectionContext  // Optional - if provided, skip topic selection
    onComplete: (content: string, friendIds: string[]) => void
    onEscape: () => void  // User chose to write freely
}

export function GuidedReflectionSheet({
    isOpen,
    onClose,
    context: preSelectedContext,
    onComplete,
    onEscape
}: GuidedReflectionSheetProps) {
    const { colors } = useTheme()
    const insets = useSafeAreaInsets()
    const {
        state,
        startSession,
        submitAnswer,
        forceComposeEarly,
        goDeeper,
        editDraft,
        confirmAndSave,
        escapeToFreeform,
        reset
    } = useGuidedReflection()

    const [inputValue, setInputValue] = useState('')
    const [selectedContext, setSelectedContext] = useState<ReflectionContext | null>(preSelectedContext || null)
    const [showTopicSelection, setShowTopicSelection] = useState(!preSelectedContext)
    const [showFreeformGather, setShowFreeformGather] = useState(false)
    const [freeformDraft, setFreeformDraft] = useState<string | null>(null)
    const [isGeneratingFreeform, setIsGeneratingFreeform] = useState(false)
    const inputRef = useRef<TextInput>(null)

    // Reset state when sheet closes
    useEffect(() => {
        if (!isOpen) {
            setSelectedContext(preSelectedContext || null)
            setShowTopicSelection(!preSelectedContext)
            setShowFreeformGather(false)
            setFreeformDraft(null)
            setIsGeneratingFreeform(false)
            setInputValue('')
            reset()
        }
    }, [isOpen, preSelectedContext])

    // Start session when context is selected
    useEffect(() => {
        if (isOpen && selectedContext && state.status === 'idle') {
            startSession(selectedContext)
        }
    }, [isOpen, selectedContext, state.status, startSession])

    // Focus input when question appears
    useEffect(() => {
        if (state.status === 'in_progress') {
            setTimeout(() => inputRef.current?.focus(), 400)
        }
    }, [state.status])

    const handleTopicSelect = (context: ReflectionContext) => {
        setSelectedContext(context)
        setShowTopicSelection(false)
    }

    const handleTopicSkip = () => {
        // Instead of skipping to freeform, show the freeform gather step
        setShowTopicSelection(false)
        setShowFreeformGather(true)
    }

    const handleFreeformComplete = async (freeformContext: FreeformContext) => {
        setIsGeneratingFreeform(true)
        try {
            const { oracleService } = await import('@/modules/oracle')
            const draft = await oracleService.generateFreeformDraft({
                topic: freeformContext.topic,
                subjectType: freeformContext.subjectType,
                friendName: freeformContext.friendName,
                abstractSubject: freeformContext.abstractSubject,
                seed: freeformContext.seed
            })
            setFreeformDraft(draft)
            setShowFreeformGather(false)
        } catch (error) {
            console.error('Failed to generate freeform draft:', error)
            // Fallback: use the seed as the draft
            setFreeformDraft(freeformContext.seed)
            setShowFreeformGather(false)
        } finally {
            setIsGeneratingFreeform(false)
        }
    }

    const handleFreeformBack = () => {
        setShowFreeformGather(false)
        setShowTopicSelection(true)
    }

    const handleFreeformConfirm = () => {
        if (freeformDraft) {
            onComplete(freeformDraft, [])
            onClose()
        }
    }

    const handleSubmit = () => {
        if (inputValue.trim()) {
            submitAnswer(inputValue.trim())
            setInputValue('')
        }
    }

    const handleConfirmSave = async () => {
        try {
            const result = await confirmAndSave()
            onComplete(result.content, result.friendIds)
            onClose()
        } catch (error) {
            // Error is handled in the hook
        }
    }

    const handleEscape = () => {
        escapeToFreeform()
        onEscape()
        onClose()
    }

    const handleClose = () => {
        // If in progress, warn about losing progress
        if (state.status === 'in_progress' || state.status === 'draft_ready') {
            Alert.alert(
                'Discard progress?',
                'Your reflection will be lost.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Discard',
                        style: 'destructive',
                        onPress: () => {
                            reset()
                            onClose()
                        }
                    }
                ]
            )
        } else {
            reset()
            onClose()
        }
    }

    const handleBack = () => {
        if (freeformDraft) {
            // Go back from freeform draft to gather step
            setFreeformDraft(null)
            setShowFreeformGather(true)
        } else {
            // Go back to topic selection
            reset()
            setSelectedContext(null)
            setShowTopicSelection(true)
        }
    }

    // Get title based on current state
    const getTitle = () => {
        if (showTopicSelection) return 'Help me write'
        if (showFreeformGather) return 'Reflect'
        if (freeformDraft) return 'Review'
        if (state.status === 'draft_ready') return 'Review'
        return 'Reflect'
    }

    return (
        <Modal
            visible={isOpen}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={handleClose}
        >
            <View style={{ flex: 1, backgroundColor: colors.background }}>
                {/* Header */}
                <View
                    className="flex-row items-center justify-between px-5 py-4"
                    style={{
                        paddingTop: insets.top > 0 ? insets.top : 16,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                        backgroundColor: colors.card
                    }}
                >
                    <View style={{ width: 24 }} />

                    <Text
                        className="text-lg"
                        style={{ color: colors.foreground, fontFamily: 'Lora_600SemiBold' }}
                    >
                        {getTitle()}
                    </Text>

                    <TouchableOpacity onPress={handleClose} className="-mr-2 p-2">
                        <X size={24} color={colors.foreground} />
                    </TouchableOpacity>
                </View>

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ flex: 1 }}
                >
                    <ScrollView
                        className="flex-1 px-5 py-4"
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="interactive"
                        contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
                    >
                        {/* Topic Selection Step */}
                        {showTopicSelection && (
                            <TopicSelectionStep
                                onSelect={handleTopicSelect}
                                onSkip={handleTopicSkip}
                            />
                        )}

                        {/* Freeform Gather Step */}
                        {showFreeformGather && !isGeneratingFreeform && (
                            <FreeformGatherStep
                                onComplete={handleFreeformComplete}
                                onBack={handleFreeformBack}
                                preSelectedFriend={
                                    preSelectedContext?.friendIds?.[0] && preSelectedContext?.friendNames?.[0]
                                        ? { id: preSelectedContext.friendIds[0], name: preSelectedContext.friendNames[0] }
                                        : undefined
                                }
                            />
                        )}

                        {/* Generating Freeform Draft */}
                        {isGeneratingFreeform && (
                            <View className="flex-1 items-center justify-center">
                                <OracleThinking colors={colors} />
                                <Text
                                    variant="body"
                                    className="mt-4 text-center"
                                    style={{ color: colors['muted-foreground'] }}
                                >
                                    Writing your draft...
                                </Text>
                            </View>
                        )}

                        {/* Freeform Draft Ready */}
                        {freeformDraft && !showFreeformGather && (
                            <DraftView
                                composedEntry={freeformDraft}
                                onEdit={setFreeformDraft}
                                onConfirm={handleFreeformConfirm}
                                onGoDeeper={() => { }}  // Freeform drafts don't support deepening
                                canDeepen={false}
                                onEscape={handleEscape}
                                colors={colors}
                            />
                        )}

                        {/* Loading State (oracle flow only) */}
                        {!showTopicSelection && !showFreeformGather && !freeformDraft && !isGeneratingFreeform && state.status === 'loading' && (
                            <View className="flex-1 items-center justify-center">
                                <OracleThinking colors={colors} />
                            </View>
                        )}

                        {/* Conversation State (oracle flow only) */}
                        {!showTopicSelection && !showFreeformGather && !freeformDraft && !isGeneratingFreeform && state.status === 'in_progress' && (
                            <ConversationView
                                state={state}
                                inputValue={inputValue}
                                onChangeInput={setInputValue}
                                onSubmit={handleSubmit}
                                onForceCompose={forceComposeEarly}
                                onEscape={handleEscape}
                                onBack={handleBack}
                                inputRef={inputRef}
                                colors={colors}
                                isDeepening={false}
                            />
                        )}

                        {/* Deepening State (follow-up questions after draft) */}
                        {!showTopicSelection && !showFreeformGather && !freeformDraft && !isGeneratingFreeform && state.status === 'deepening' && (
                            <ConversationView
                                state={state}
                                inputValue={inputValue}
                                onChangeInput={setInputValue}
                                onSubmit={handleSubmit}
                                onForceCompose={forceComposeEarly}
                                onEscape={handleEscape}
                                onBack={handleBack}
                                inputRef={inputRef}
                                colors={colors}
                                isDeepening={true}
                            />
                        )}

                        {/* Draft Ready State (oracle flow only) */}
                        {!showTopicSelection && !showFreeformGather && !freeformDraft && !isGeneratingFreeform && state.status === 'draft_ready' && (
                            <DraftView
                                composedEntry={state.composedEntry}
                                onEdit={editDraft}
                                onConfirm={handleConfirmSave}
                                onGoDeeper={goDeeper}
                                canDeepen={state.canDeepen}
                                onEscape={handleEscape}
                                colors={colors}
                            />
                        )}

                        {/* Error State (oracle flow only) */}
                        {!showTopicSelection && !showFreeformGather && !freeformDraft && !isGeneratingFreeform && state.status === 'error' && (
                            <ErrorView
                                error={state.error}
                                partialAnswers={state.partialAnswers}
                                onRetry={() => selectedContext && startSession(selectedContext)}
                                onEscape={handleEscape}
                                colors={colors}
                            />
                        )}
                    </ScrollView>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    )
}

// ============================================================================
// Sub-components
// ============================================================================

function OracleThinking({ colors }: { colors: any }) {
    const pulse = useSharedValue(1)

    useEffect(() => {
        pulse.value = withRepeat(
            withSequence(
                withTiming(1.1, { duration: 600 }),
                withTiming(1, { duration: 600 })
            ),
            -1,
            true
        )
    }, [])

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulse.value }]
    }))

    return (
        <Animated.View style={animatedStyle} className="items-center">
            <Icon name="Sparkles" size={40} color={colors.primary} />
            <Text variant="body" className="mt-3" style={{ color: colors['muted-foreground'] }}>
                Oracle is thinking...
            </Text>
        </Animated.View>
    )
}

interface ConversationViewProps {
    state: Extract<GuidedReflectionState, { status: 'in_progress' }> | Extract<GuidedReflectionState, { status: 'deepening' }>
    inputValue: string
    onChangeInput: (value: string) => void
    onSubmit: () => void
    onForceCompose: () => void  // "That's enough" button
    onEscape: () => void
    onBack: () => void
    inputRef: React.RefObject<TextInput>
    colors: any
    isDeepening?: boolean
}

function ConversationView({
    state,
    inputValue,
    onChangeInput,
    onSubmit,
    onForceCompose,
    onEscape,
    onBack,
    inputRef,
    colors,
    isDeepening = false
}: ConversationViewProps) {
    const turnCount = isDeepening
        ? (state.session.deepeningTurns?.length || 0)
        : state.session.turns.length
    const MAX_QUESTIONS = 3

    return (
        <View className="flex-1 w-full">
            {/* Previous turns (scrollable) */}
            {turnCount > 0 && (
                <View className="mb-6 opacity-60">
                    {(isDeepening ? state.session.deepeningTurns || [] : state.session.turns).map((turn, i) => (
                        <View key={i} className="mb-4 pl-4 border-l-2" style={{ borderColor: colors.border }}>
                            <Text variant="caption" className="mb-1" style={{ color: colors['muted-foreground'] }}>
                                {turn.oracleQuestion}
                            </Text>
                            <Text variant="body" style={{ color: colors.foreground }}>
                                "{turn.userAnswer}"
                            </Text>
                        </View>
                    ))}
                </View>
            )}

            {/* Current question */}
            <Animated.View
                entering={FadeInUp.duration(400)}
                className="mb-6"
            >
                <View className="flex-row items-start">
                    <View
                        className="w-8 h-8 rounded-full items-center justify-center mr-3 mt-1"
                        style={{ backgroundColor: colors.primary + '20' }}
                    >
                        <Icon name="Sparkles" size={16} color={colors.primary} />
                    </View>
                    <View className="flex-1">
                        <Text variant="h4" style={{ color: colors.foreground, lineHeight: 28 }}>
                            {state.currentQuestion}
                        </Text>
                    </View>
                </View>
            </Animated.View>

            {/* Input area */}
            <View className="flex-1" />
            <View
                className="rounded-xl p-4 mb-4"
                style={{ backgroundColor: colors.muted }}
            >
                <TextInput
                    ref={inputRef}
                    value={inputValue}
                    onChangeText={onChangeInput}
                    placeholder="Type your answer..."
                    placeholderTextColor={colors['muted-foreground']}
                    multiline
                    className="min-h-[120px] text-base leading-6"
                    style={{ color: colors.foreground, fontFamily: 'Inter_400Regular' }}
                    returnKeyType="done"
                    blurOnSubmit={false}
                    textAlignVertical="top"
                />
            </View>

            {/* Actions */}
            <View className="flex-row items-center justify-between mt-auto">
                {turnCount === 0 ? (
                    <Pressable
                        onPress={onBack}
                        className="py-3 px-4 rounded-full"
                        style={{ backgroundColor: colors.muted }}
                    >
                        <Text variant="caption" style={{ color: colors.foreground, fontWeight: '600' }}>
                            ← Back
                        </Text>
                    </Pressable>
                ) : (
                    <Pressable
                        onPress={onForceCompose}
                        className="py-3 px-4 rounded-full"
                        style={{ backgroundColor: colors.muted }}
                    >
                        <Text variant="caption" style={{ color: colors.foreground, fontWeight: '600' }}>
                            That's enough
                        </Text>
                    </Pressable>
                )}

                <Button
                    variant="primary"
                    onPress={onSubmit}
                    disabled={!inputValue.trim()}
                    label="Continue"
                />
            </View>

            {/* Turn indicator */}
            <View className="mt-4 items-center">
                <Text variant="caption" style={{ color: colors['muted-foreground'] }}>
                    {isDeepening ? 'Deepening' : 'Question'} {turnCount + 1} of {MAX_QUESTIONS}
                </Text>
            </View>
        </View>
    )
}


interface DraftViewProps {
    composedEntry: string
    onEdit: (content: string) => void
    onConfirm: () => void
    onGoDeeper: () => void
    canDeepen: boolean
    onEscape: () => void
    colors: any
}

function DraftView({ composedEntry, onEdit, onConfirm, onGoDeeper, canDeepen, onEscape, colors }: DraftViewProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [editedContent, setEditedContent] = useState(composedEntry)

    const handleSaveEdit = () => {
        onEdit(editedContent)
        setIsEditing(false)
    }

    return (
        <View className="flex-1 w-full">
            <Animated.View entering={FadeIn.duration(400)} className="flex-1">
                {/* Header */}
                <View className="flex-row items-center mb-6">
                    <View
                        className="w-10 h-10 rounded-full items-center justify-center mr-3"
                        style={{ backgroundColor: colors.primary + '15' }}
                    >
                        <Icon name="Sparkles" size={20} color={colors.primary} />
                    </View>
                    <Text variant="h4" style={{ color: colors.foreground }}>
                        Here's what I heard
                    </Text>
                </View>

                {/* Composed entry */}
                <ScrollView
                    className="flex-1 rounded-2xl p-5 mb-6"
                    style={{ backgroundColor: colors.muted }}
                    showsVerticalScrollIndicator={false}
                >
                    {isEditing ? (
                        <TextInput
                            value={editedContent}
                            onChangeText={setEditedContent}
                            multiline
                            className="min-h-[200px] text-base leading-7"
                            style={{ color: colors.foreground, fontFamily: 'Inter_400Regular' }}
                            autoFocus
                            textAlignVertical="top"
                        />
                    ) : (
                        <Text variant="body" style={{ color: colors.foreground, lineHeight: 28, fontSize: 16 }}>
                            {composedEntry}
                        </Text>
                    )}
                </ScrollView>

                {/* Actions */}
                <View className="flex-row items-center justify-between mt-auto">
                    <Pressable
                        onPress={onEscape}
                        className="py-3 px-4"
                    >
                        <Text variant="caption" style={{ color: colors['muted-foreground'] }}>
                            Start over
                        </Text>
                    </Pressable>

                    <View className="flex-row gap-2">
                        {isEditing ? (
                            <Button variant="outline" onPress={handleSaveEdit} label="Done" />
                        ) : (
                            <Button variant="outline" onPress={() => setIsEditing(true)} label="Edit" />
                        )}
                        {canDeepen && !isEditing && (
                            <Button variant="outline" onPress={onGoDeeper} label="Go Deeper" />
                        )}
                        <Button variant="primary" onPress={onConfirm} label="Save Entry" />
                    </View>
                </View>
            </Animated.View>
        </View>
    )
}

interface ErrorViewProps {
    error: string
    partialAnswers?: string[]
    onRetry: () => void
    onEscape: () => void
    colors: any
}

function ErrorView({ error, partialAnswers, onRetry, onEscape, colors }: ErrorViewProps) {
    return (
        <View className="flex-1 items-center justify-center px-4 pt-20">
            <View className="w-16 h-16 rounded-full items-center justify-center mb-6 bg-red-100 dark:bg-red-900/20">
                <Icon name="CircleAlert" size={32} color={colors.destructive} />
            </View>

            <Text variant="h4" className="text-center mb-2" style={{ color: colors.foreground }}>
                Something went wrong
            </Text>

            <Text variant="body" className="text-center mb-8" style={{ color: colors['muted-foreground'] }}>
                {error}
            </Text>

            {partialAnswers && partialAnswers.length > 0 && (
                <View
                    className="mt-4 p-4 rounded-xl w-full mb-8"
                    style={{ backgroundColor: colors.muted }}
                >
                    <Text variant="caption" className="mb-3 font-semibold" style={{ color: colors['muted-foreground'] }}>
                        SAVED ANSWERS:
                    </Text>
                    {partialAnswers.map((answer, i) => (
                        <Text key={i} variant="body" className="mb-2" style={{ color: colors.foreground }}>
                            • {answer}
                        </Text>
                    ))}
                </View>
            )}

            <View className="flex-row gap-4 w-full">
                <View className="flex-1">
                    <Button variant="outline" onPress={onRetry} label="Try again" />
                </View>
                <View className="flex-1">
                    <Button variant="primary" onPress={onEscape} label="Write myself" />
                </View>
            </View>
        </View>
    )
}

export default GuidedReflectionSheet

