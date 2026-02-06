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
import { ReflectionContext, GuidedSession } from '@/modules/oracle'
import { TopicSelectionStep } from './TopicSelectionStep'
import { FreeformGatherStep, FreeformContext } from './FreeformGatherStep'
import { PromptedReflectionFlow, SavedEntry } from './PromptedReflectionFlow'
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
    prefilledText?: string
    prefilledFriendIds?: string[]
    prefilledWeaveId?: string
    defaultMode?: 'oracle' | 'prompted'
}

export function GuidedReflectionSheet({
    isOpen,
    onClose,
    context: preSelectedContext,
    onComplete,
    onEscape,
    prefilledText,
    prefilledFriendIds,
    prefilledWeaveId,
    defaultMode
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

    const [flowMode, setFlowMode] = useState<'oracle' | 'prompted' | null>(preSelectedContext ? 'oracle' : (defaultMode || null))
    const [promptedDirty, setPromptedDirty] = useState(false)
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
            setFlowMode(preSelectedContext ? 'oracle' : (defaultMode || null))
            setPromptedDirty(false)
            setSelectedContext(preSelectedContext || null)
            setShowTopicSelection(!preSelectedContext)
            setShowFreeformGather(false)
            setFreeformDraft(null)
            setIsGeneratingFreeform(false)
            setInputValue('')
            reset()
        }
    }, [isOpen, preSelectedContext, defaultMode])

    // Ensure oracle mode is selected when context is pre-specified
    useEffect(() => {
        if (isOpen && preSelectedContext) {
            setFlowMode('oracle')
            setSelectedContext(preSelectedContext)
            setShowTopicSelection(false)
        }
    }, [isOpen, preSelectedContext])

    // If we have prefills but no context, default to prompted flow
    useEffect(() => {
        if (!isOpen || preSelectedContext || flowMode) return
        if (prefilledText || prefilledWeaveId || (prefilledFriendIds && prefilledFriendIds.length > 0)) {
            setFlowMode('prompted')
        }
    }, [isOpen, preSelectedContext, flowMode, prefilledText, prefilledWeaveId, prefilledFriendIds])

    // Start session when context is selected
    useEffect(() => {
        if (flowMode === 'oracle' && isOpen && selectedContext && state.status === 'idle') {
            startSession(selectedContext)
        }
    }, [flowMode, isOpen, selectedContext, state.status, startSession])

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
        if (flowMode === 'prompted') {
            if (promptedDirty) {
                Alert.alert(
                    'Discard reflection?',
                    'You have unsaved changes that will be lost.',
                    [
                        { text: 'Keep Writing', style: 'cancel' },
                        {
                            text: 'Discard',
                            style: 'destructive',
                            onPress: () => {
                                setPromptedDirty(false)
                                onClose()
                            }
                        }
                    ]
                )
            } else {
                onClose()
            }
            return
        }

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
        if (!flowMode && !preSelectedContext) return 'Help me write'
        if (flowMode === 'prompted') return 'Prompted reflection'
        if (showTopicSelection) return 'Help me write'
        if (showFreeformGather) return 'Reflect'
        if (freeformDraft) return 'Review'
        if (state.status === 'draft_ready') return 'Review'
        return 'Reflect'
    }

    const handleModeSelect = (mode: 'oracle' | 'prompted') => {
        setFlowMode(mode)
        if (mode === 'oracle') {
            setShowTopicSelection(!preSelectedContext)
        }
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
                    {flowMode === 'prompted' ? (
                        <PromptedReflectionFlow
                            prefilledText={prefilledText}
                            prefilledFriendIds={prefilledFriendIds}
                            prefilledWeaveId={prefilledWeaveId}
                            onSave={(entry: SavedEntry) => {
                                onComplete(entry.content, entry.friendIds)
                            }}
                            onClose={onClose}
                            onDirtyChange={setPromptedDirty}
                        />
                    ) : (
                        <ScrollView
                            className="flex-1 px-5 py-4"
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="interactive"
                            contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
                        >
                            {!flowMode && !preSelectedContext && (
                                <ModeSelectionStep
                                    onSelectOracle={() => handleModeSelect('oracle')}
                                    onSelectPrompted={() => handleModeSelect('prompted')}
                                />
                            )}

                            {/* Topic Selection Step */}
                            {flowMode === 'oracle' && showTopicSelection && (
                                <TopicSelectionStep
                                    onSelect={handleTopicSelect}
                                    onSkip={handleTopicSkip}
                                />
                            )}

                            {/* Freeform Gather Step */}
                            {flowMode === 'oracle' && showFreeformGather && !isGeneratingFreeform && (
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
                            {flowMode === 'oracle' && isGeneratingFreeform && (
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
                            {flowMode === 'oracle' && freeformDraft && !showFreeformGather && (
                                <DraftView
                                    composedEntry={freeformDraft}
                                    onEdit={setFreeformDraft}
                                    onConfirm={handleFreeformConfirm}
                                    onGoDeeper={() => { }}
                                    canDeepen={false}
                                    onEscape={handleEscape}
                                    colors={colors}
                                />
                            )}

                            {/* Loading State (oracle flow only) */}
                            {flowMode === 'oracle' && !showTopicSelection && !showFreeformGather && !freeformDraft && !isGeneratingFreeform && state.status === 'loading' && (
                                <View className="flex-1 items-center justify-center">
                                    <OracleThinking colors={colors} />
                                </View>
                            )}

                            {/* Conversation State (oracle flow only) */}
                            {flowMode === 'oracle' && !showTopicSelection && !showFreeformGather && !freeformDraft && !isGeneratingFreeform && state.status === 'in_progress' && (
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
                            {flowMode === 'oracle' && !showTopicSelection && !showFreeformGather && !freeformDraft && !isGeneratingFreeform && state.status === 'deepening' && (
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
                            {flowMode === 'oracle' && !showTopicSelection && !showFreeformGather && !freeformDraft && !isGeneratingFreeform && state.status === 'draft_ready' && (
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
                            {flowMode === 'oracle' && !showTopicSelection && !showFreeformGather && !freeformDraft && !isGeneratingFreeform && state.status === 'error' && (
                                <ErrorView
                                    error={state.error}
                                    partialAnswers={state.partialAnswers}
                                    onRetry={() => selectedContext && startSession(selectedContext)}
                                    onEscape={handleEscape}
                                    colors={colors}
                                />
                            )}
                        </ScrollView>
                    )}
                </KeyboardAvoidingView>
            </View>
        </Modal>
    )
}

interface ModeSelectionStepProps {
    onSelectOracle: () => void
    onSelectPrompted: () => void
}

function ModeSelectionStep({ onSelectOracle, onSelectPrompted }: ModeSelectionStepProps) {
    const { colors } = useTheme()

    return (
        <View className="flex-1 pt-4">
            <Text
                variant="h3"
                className="text-center mb-2"
                style={{ color: colors.foreground }}
            >
                Choose your writing style
            </Text>
            <Text
                variant="body"
                className="text-center mb-6"
                style={{ color: colors['muted-foreground'] }}
            >
                Pick a path to start your reflection.
            </Text>

            <View className="gap-3">
                <TouchableOpacity
                    onPress={onSelectPrompted}
                    className="p-4 rounded-xl"
                    style={{ backgroundColor: colors.muted }}
                >
                    <View className="flex-row items-start gap-3">
                        <View
                            className="w-10 h-10 rounded-full items-center justify-center"
                            style={{ backgroundColor: colors.primary + '15' }}
                        >
                            <Icon name="PenLine" size={18} color={colors.primary} />
                        </View>
                        <View className="flex-1">
                            <Text
                                variant="body"
                                style={{ color: colors.foreground, fontWeight: '600' }}
                            >
                                Prompted reflection
                            </Text>
                            <Text
                                variant="caption"
                                className="mt-1"
                                style={{ color: colors['muted-foreground'] }}
                            >
                                Pick a prompt and write freely.
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={onSelectOracle}
                    className="p-4 rounded-xl"
                    style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.primary + '40' }}
                >
                    <View className="flex-row items-start gap-3">
                        <View
                            className="w-10 h-10 rounded-full items-center justify-center"
                            style={{ backgroundColor: colors.primary + '20' }}
                        >
                            <Icon name="Sparkles" size={18} color={colors.primary} />
                        </View>
                        <View className="flex-1">
                            <Text
                                variant="body"
                                style={{ color: colors.foreground, fontWeight: '600' }}
                            >
                                Oracle coach
                            </Text>
                            <Text
                                variant="caption"
                                className="mt-1"
                                style={{ color: colors['muted-foreground'] }}
                            >
                                Answer a few questions and get a draft.
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>
            </View>
        </View>
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
    inputRef: React.RefObject<TextInput | null>
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
    session?: GuidedSession
    onEdit: (content: string) => void
    onConfirm: () => void
    onGoDeeper: () => void
    canDeepen: boolean
    onEscape: () => void
    colors: any
}

function DraftView({ composedEntry, session, onEdit, onConfirm, onGoDeeper, canDeepen, onEscape, colors }: DraftViewProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [viewMode, setViewMode] = useState<'refined' | 'original'>('refined')
    const [editedContent, setEditedContent] = useState(composedEntry)

    // Build original transcript
    const originalTranscript = React.useMemo(() => {
        if (!session) return ''
        const allTurns = [...session.turns, ...(session.deepeningTurns || [])]
        return allTurns.map(t => `Q: ${t.oracleQuestion}\n\nA: ${t.userAnswer}`).join('\n\n---\n\n')
    }, [session])

    // Update edited content when switching modes
    useEffect(() => {
        if (viewMode === 'refined') {
            setEditedContent(composedEntry)
        } else {
            setEditedContent(originalTranscript)
        }
    }, [viewMode, composedEntry, originalTranscript])

    const handleSaveEdit = () => {
        onEdit(editedContent)
        setIsEditing(false)
    }

    return (
        <View className="flex-1 w-full">
            <Animated.View entering={FadeIn.duration(400)} className="flex-1">
                {/* Header */}
                <View className="flex-row items-center justify-between mb-4">
                    <View className="flex-row items-center">
                        <View
                            className="w-10 h-10 rounded-full items-center justify-center mr-3"
                            style={{ backgroundColor: colors.primary + '15' }}
                        >
                            <Icon name="Sparkles" size={20} color={colors.primary} />
                        </View>
                        <View>
                            <Text variant="h4" style={{ color: colors.foreground }}>
                                Review Entry
                            </Text>
                            <Text variant="caption" style={{ color: colors['muted-foreground'] }}>
                                {viewMode === 'refined' ? 'AI Synthesized' : 'Original Transcript'}
                            </Text>
                        </View>
                    </View>

                    {/* Toggle - Only show if session/transcript exists */}
                    {session && (
                        <View className="flex-row bg-muted rounded-lg p-1" style={{ backgroundColor: colors.muted }}>
                            <Pressable
                                onPress={() => setViewMode('refined')}
                                className={`px-3 py-1.5 rounded-md ${viewMode === 'refined' ? 'bg-background shadow-sm' : ''}`}
                                style={viewMode === 'refined' ? { backgroundColor: colors.card } : {}}
                            >
                                <Text
                                    variant="caption"
                                    style={{
                                        color: viewMode === 'refined' ? colors.foreground : colors['muted-foreground'],
                                        fontWeight: viewMode === 'refined' ? '600' : '400'
                                    }}
                                >
                                    Refined
                                </Text>
                            </Pressable>
                            <Pressable
                                onPress={() => setViewMode('original')}
                                className={`px-3 py-1.5 rounded-md ${viewMode === 'original' ? 'bg-background shadow-sm' : ''}`}
                                style={viewMode === 'original' ? { backgroundColor: colors.card } : {}}
                            >
                                <Text
                                    variant="caption"
                                    style={{
                                        color: viewMode === 'original' ? colors.foreground : colors['muted-foreground'],
                                        fontWeight: viewMode === 'original' ? '600' : '400'
                                    }}
                                >
                                    Original
                                </Text>
                            </Pressable>
                        </View>
                    )}
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
                            {editedContent}
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
                        {canDeepen && !isEditing && viewMode === 'refined' && (
                            <Button variant="outline" onPress={onGoDeeper} label="Go Deeper" />
                        )}
                        <Button variant="primary" onPress={() => {
                            // Ensure we save currently visible content
                            if (isEditing) {
                                onEdit(editedContent)
                            } else if (viewMode === 'original' && composedEntry !== editedContent) {
                                // If listening to original, we must update the main composed entry to match it so it saves correctly
                                onEdit(editedContent)
                            }
                            onConfirm()
                        }} label="Save Entry" />
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
