/**
 * GuidedReflectionSheet
 *
 * A modal for "Help me write" flow.
 *
 * Oracle flow: Topic Selection → Questions → Auto-save → Receipt
 * No draft review step — saves directly when composition finishes.
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
import { ReflectionContext, actionExtractionService } from '@/modules/oracle'
import { TopicSelectionStep } from './TopicSelectionStep'
import { FreeformGatherStep, FreeformContext } from './FreeformGatherStep'
import { PromptedReflectionFlow, SavedEntry } from './PromptedReflectionFlow'
import Animated, {
    FadeInUp,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { X } from 'lucide-react-native'
import { InsightReceipt } from '../InsightReceipt'
import { InsightReceiptExpanded } from '../InsightReceiptExpanded'
import { journalIntelligenceService, ProcessingResult } from '@/modules/journal/services/journal-intelligence.service'
import { database } from '@/db'
import JournalEntry from '@/db/models/JournalEntry'

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

    // Receipt State
    const [showReceipt, setShowReceipt] = useState(false)
    const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [showExpandedReceipt, setShowExpandedReceipt] = useState(false)

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
            setShowReceipt(false)
            setProcessingResult(null)
            setIsProcessing(false)
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

    // Auto-show receipt when oracle save completes
    useEffect(() => {
        if (state.status === 'complete' && state.entryId && !showReceipt) {
            onComplete(state.result.content, state.result.friendIds)
            processAndShowReceipt(state.entryId)
        }
    }, [state.status])

    const handleTopicSelect = (context: ReflectionContext) => {
        setSelectedContext(context)
        setShowTopicSelection(false)
    }

    const handleTopicSkip = () => {
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

    const processAndShowReceipt = async (entryId: string) => {
        setShowReceipt(true)
        setIsProcessing(true)
        setProcessingResult(null)

        try {
            actionExtractionService.queueEntry(entryId)

            const entry = await database.get<JournalEntry>('journal_entries').find(entryId)
            const result = await journalIntelligenceService.processEntry(entry)

            if (result) {
                setProcessingResult(result)
                setIsProcessing(false)
            } else {
                handleDismissReceipt()
            }
        } catch (err) {
            console.error('Receipt processing failed', err)
            handleDismissReceipt()
        }
    }

    const handleDismissReceipt = () => {
        setShowReceipt(false)
        setShowExpandedReceipt(false)
        onClose()
    }

    const handleSavePrompted = (entry: SavedEntry) => {
        onComplete(entry.content, entry.friendIds)
        processAndShowReceipt(entry.id)
    }

    const handleEscape = () => {
        escapeToFreeform()
        onEscape()
        onClose()
    }

    const handleClose = () => {
        if (showReceipt) {
            handleDismissReceipt()
            return
        }

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
        if (state.status === 'in_progress') {
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
            setFreeformDraft(null)
            setShowFreeformGather(true)
        } else {
            reset()
            setSelectedContext(null)
            setShowTopicSelection(true)
        }
    }

    const getTitle = () => {
        if (showReceipt) return 'Reflection saved'
        if (!flowMode && !preSelectedContext) return 'Help me write'
        if (flowMode === 'prompted') return 'Prompted reflection'
        if (showTopicSelection) return 'Help me write'
        if (showFreeformGather) return 'Reflect'
        if (freeformDraft) return 'Review'
        if (state.status === 'saving') return 'Saving...'
        return 'Reflect'
    }

    const handleModeSelect = (mode: 'oracle' | 'prompted') => {
        setFlowMode(mode)
        if (mode === 'oracle') {
            setShowTopicSelection(!preSelectedContext)
        }
    }

    // Determine if the oracle flow is in a "thinking/saving" state
    const isOracleWorking = flowMode === 'oracle' && !showTopicSelection && !showFreeformGather && !freeformDraft && !isGeneratingFreeform
    const showOracleThinking = isOracleWorking && (state.status === 'loading' || state.status === 'saving')

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
                        borderBottomWidth: !showReceipt ? 1 : 0,
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

                {/* Receipt Overlay */}
                {showReceipt ? (
                    <View className="flex-1 px-5 pt-8 bg-background">
                        <InsightReceipt
                            loading={isProcessing}
                            result={processingResult === void 0 ? null : processingResult}
                            onDismiss={handleDismissReceipt}
                            onExpand={() => setShowExpandedReceipt(true)}
                        />
                    </View>
                ) : (
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        style={{ flex: 1 }}
                    >
                        {flowMode === 'prompted' ? (
                            <PromptedReflectionFlow
                                prefilledText={prefilledText}
                                prefilledFriendIds={prefilledFriendIds}
                                prefilledWeaveId={prefilledWeaveId}
                                onSave={handleSavePrompted}
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

                                {/* Freeform Draft Ready — still uses review since it's a different flow */}
                                {flowMode === 'oracle' && freeformDraft && !showFreeformGather && (
                                    <FreeformDraftView
                                        draft={freeformDraft}
                                        onEdit={setFreeformDraft}
                                        onConfirm={handleFreeformConfirm}
                                        onEscape={handleEscape}
                                        colors={colors}
                                    />
                                )}

                                {/* Oracle Thinking / Saving */}
                                {showOracleThinking && (
                                    <View className="flex-1 items-center justify-center">
                                        <OracleThinking colors={colors} />
                                        {state.status === 'saving' && (
                                            <Text
                                                variant="body"
                                                className="mt-4 text-center"
                                                style={{ color: colors['muted-foreground'] }}
                                            >
                                                Saving your reflection...
                                            </Text>
                                        )}
                                    </View>
                                )}

                                {/* Conversation State */}
                                {isOracleWorking && state.status === 'in_progress' && (
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
                                    />
                                )}

                                {/* Error State */}
                                {isOracleWorking && state.status === 'error' && (
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
                )}

                {/* Expanded Receipt Modal */}
                {processingResult && (
                    <Modal
                        visible={showExpandedReceipt}
                        animationType="slide"
                        presentationStyle="pageSheet"
                        onRequestClose={() => setShowExpandedReceipt(false)}
                    >
                        <View style={{ flex: 1, backgroundColor: colors.background }}>
                            <View className="pt-4 px-4 flex-1">
                                <InsightReceiptExpanded
                                    result={processingResult}
                                    onClose={() => setShowExpandedReceipt(false)}
                                />
                            </View>
                        </View>
                    </Modal>
                )}
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
                                Answer a few questions and we'll capture it.
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
    state: Extract<GuidedReflectionState, { status: 'in_progress' }>
    inputValue: string
    onChangeInput: (value: string) => void
    onSubmit: () => void
    onForceCompose: () => void
    onEscape: () => void
    onBack: () => void
    inputRef: React.RefObject<TextInput | null>
    colors: any
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
    colors
}: ConversationViewProps) {
    const turnCount = state.session.turns.length

    return (
        <View className="flex-1 w-full">
            {/* Previous turns */}
            {turnCount > 0 && (
                <View className="mb-6">
                    {state.session.turns.map((turn, i) => (
                        <View
                            key={i}
                            className="mb-4 pl-4"
                            style={{ borderLeftWidth: 2, borderLeftColor: colors.primary + '30' }}
                        >
                            <Text
                                variant="caption"
                                className="mb-1.5"
                                style={{ color: colors['muted-foreground'], fontFamily: 'Inter_500Medium' }}
                            >
                                {turn.oracleQuestion}
                            </Text>
                            <Text
                                variant="body"
                                style={{ color: colors.foreground, fontFamily: 'Inter_400Regular', lineHeight: 22 }}
                            >
                                {turn.userAnswer}
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
                        className="w-8 h-8 rounded-full items-center justify-center mr-3 mt-0.5"
                        style={{ backgroundColor: colors.primary + '15' }}
                    >
                        <Icon name="Sparkles" size={14} color={colors.primary} />
                    </View>
                    <View className="flex-1">
                        <Text
                            variant="body"
                            weight="medium"
                            style={{ color: colors.foreground, lineHeight: 26, fontSize: 17, fontFamily: 'Lora_500Medium' }}
                        >
                            {state.currentQuestion}
                        </Text>
                    </View>
                </View>
            </Animated.View>

            {/* Input area */}
            <View className="flex-1" />
            <View
                className="rounded-2xl p-4 mb-4"
                style={{ backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border }}
            >
                <TextInput
                    ref={inputRef}
                    value={inputValue}
                    onChangeText={onChangeInput}
                    placeholder="Type your answer..."
                    placeholderTextColor={colors['muted-foreground']}
                    multiline
                    className="min-h-[100px] text-base leading-6"
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
                        className="py-2.5 px-4 rounded-full"
                        style={{ backgroundColor: colors.muted }}
                    >
                        <Text variant="caption" style={{ color: colors.foreground, fontWeight: '600' }}>
                            Back
                        </Text>
                    </Pressable>
                ) : (
                    <Pressable
                        onPress={onForceCompose}
                        className="py-2.5 px-4 rounded-full"
                        style={{ backgroundColor: colors.muted }}
                    >
                        <Text variant="caption" style={{ color: colors.foreground, fontWeight: '600' }}>
                            I'm done
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

            {/* Subtle turn indicator */}
            <View className="mt-3 items-center">
                <View className="flex-row items-center gap-1.5">
                    {Array.from({ length: Math.min(turnCount + 1, 5) }).map((_, i) => (
                        <View
                            key={i}
                            className="rounded-full"
                            style={{
                                width: i <= turnCount ? 6 : 4,
                                height: i <= turnCount ? 6 : 4,
                                backgroundColor: i < turnCount
                                    ? colors.primary
                                    : i === turnCount
                                        ? colors.primary + '50'
                                        : colors.border,
                            }}
                        />
                    ))}
                </View>
            </View>
        </View>
    )
}

/**
 * Simple draft view for the freeform flow only (not oracle).
 * Oracle flow auto-saves and skips this entirely.
 */
interface FreeformDraftViewProps {
    draft: string
    onEdit: (content: string) => void
    onConfirm: () => void
    onEscape: () => void
    colors: any
}

function FreeformDraftView({ draft, onEdit, onConfirm, onEscape, colors }: FreeformDraftViewProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [editedContent, setEditedContent] = useState(draft)

    const handleSaveEdit = () => {
        onEdit(editedContent)
        setIsEditing(false)
    }

    return (
        <View className="flex-1 w-full">
            <View className="flex-row items-center mb-5">
                <View
                    className="w-9 h-9 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: colors.primary + '12' }}
                >
                    <Icon name="Sparkles" size={18} color={colors.primary} />
                </View>
                <Text variant="body" weight="semibold" style={{ color: colors.foreground, fontSize: 16 }}>
                    Review your draft
                </Text>
            </View>

            <ScrollView
                className="flex-1 rounded-2xl p-5 mb-5"
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

            <View className="flex-row items-center gap-2 justify-end">
                {isEditing ? (
                    <Button variant="outline" onPress={handleSaveEdit} label="Done editing" />
                ) : (
                    <Button variant="outline" onPress={() => setIsEditing(true)} label="Edit" />
                )}
                <Button variant="primary" onPress={() => {
                    if (isEditing) onEdit(editedContent)
                    onConfirm()
                }} label="Save entry" />
            </View>

            <Pressable onPress={onEscape} className="py-2 px-1 mt-3">
                <Text variant="caption" style={{ color: colors['muted-foreground'] }}>
                    Start over
                </Text>
            </Pressable>
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
                            {answer}
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
