/**
 * OracleChat
 * 
 * The main chat interface for Oracle - the AI assistant.
 * Displays messages, handles input, shows contextual chips.
 */

import React, { useState, useRef, useEffect, useMemo } from 'react'
import {
    View,
    TextInput,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    TouchableWithoutFeedback,
    Keyboard
} from 'react-native'
import { Text } from '@/shared/ui/Text'
import { Send, Bot, User, Bookmark, Check } from 'lucide-react-native'
import Animated, {
    useSharedValue,
    useAnimatedProps,
    withRepeat,
    withTiming,
    Easing
} from 'react-native-reanimated'
import { useTheme } from '@/shared/hooks/useTheme'
import { useOracle } from '../hooks/useOracle'
import { OracleTurn } from '../services/oracle-service'
import { OracleContext } from '../services/context-builder'
import { StarterPrompt } from '../hooks/useStarterPrompts'
import { OracleAction } from '../services/types'
import { AnimatedWeaveIcon, WeaveIcon } from '@/shared/components/WeaveIcon'
import { StarterPromptChips } from './StarterPromptChips'
import { SimpleMarkdown } from './SimpleMarkdown'
import { OracleActionButton } from './OracleActionButton'
import { useRouter } from 'expo-router'
import { GuidedReflectionSheet } from '@/modules/journal/components/GuidedReflection/GuidedReflectionSheet'
import InsightsCarousel from './InsightsCarousel'
import { InsightsChip } from './InsightsChip'
import { InsightGenerator } from '../services/insight-generator'
import ProactiveInsight from '@/db/models/ProactiveInsight'
import { OracleEntryPoint } from '../hooks/useStarterPrompts'
import { PerfLogger } from '@/shared/utils/performance-logger';
import { trackEvent, AnalyticsEvents } from '@/shared/services/analytics.service';
import { useAuth } from '@/modules/auth/context/AuthContext';
import { useUserProfile } from '@/modules/auth/hooks/useUserProfile';
import { CachedImage } from '@/shared/ui/CachedImage';
import { MessageItem } from './MessageItem';
import { ThinkingBubble } from './ThinkingBubble';
import { UIEventBus } from '@/shared/services/ui-event-bus';

interface OracleChatProps {
    context?: OracleEntryPoint
    friendId?: string
    friendName?: string
    onClose?: () => void
    portalHost?: string
    initialQuestion?: string
    journalContent?: string
    lensContext?: {
        archetype: string
        title: string
        reasoning: string
    }
    insightContext?: {
        analysis: string
        pattern: string
        clarifyingQuestion: string
        userAnswer?: string
    }
    conversationId?: string
}

export function OracleChat({ context = 'default', friendId, friendName, onClose, portalHost, initialQuestion, journalContent, lensContext, insightContext, conversationId }: OracleChatProps) {
    const { colors, typography } = useTheme()
    const { messages, isLoading, error, askQuestion, startWithContext, loadConversation, remainingQuestions, saveToJournal, isSaved } = useOracle()
    const { user } = useAuth()
    const { intelligenceCapabilities } = useUserProfile()
    const [input, setInput] = useState('')
    const listRef = useRef<FlatList>(null)
    const progress = useSharedValue(0)
    const router = useRouter()
    const hasAskedInitial = useRef(false)

    // Guided reflection state
    const [showGuidedReflection, setShowGuidedReflection] = useState(false)
    const [reflectionInsightId, setReflectionInsightId] = useState<string | null>(null)
    const scopedFriendIds = useMemo(() => (friendId ? [friendId] : []), [friendId])
    const latestUserMessage = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i]
            if (msg.role === 'user') return msg.content
        }
        return undefined
    }, [messages])
    const guidedContext = useMemo(() => {
        const seed = latestUserMessage?.trim()
        if (friendId) {
            return {
                type: 'friend_reflection' as const,
                friendIds: [friendId],
                friendNames: friendName ? [friendName] : [],
                quickCaptureText: seed || undefined,
            }
        }
        return {
            type: 'journal_entry' as const,
            friendIds: [],
            friendNames: [],
            quickCaptureText: seed || undefined,
        }
    }, [friendId, friendName, latestUserMessage])

    // Helper to build rich context
    const buildContextPayload = () => {
        let payload = ''
        if (lensContext) {
            payload += `[SELECTED LENS: ${lensContext.title} (${lensContext.archetype})]\nWhy this lens: ${lensContext.reasoning}\n\n`
        }
        if (insightContext) {
            payload += `[INSIGHT ANALYSIS]\nPattern: ${insightContext.pattern}\nAnalysis: ${insightContext.analysis}\nClarifying Question Asked: "${insightContext.clarifyingQuestion}"\nUser Answer Context: The user is answering this question.\n\n`
        }
        if (journalContent) {
            payload += payload ? `[FOCUSED CONTENT]\n${journalContent}` : journalContent
        }
        return payload || undefined
    }

    useEffect(() => {
        PerfLogger.log('Oracle', 'Chat Component Mounted');
    }, []);

    useEffect(() => {
        if (conversationId) {
            loadConversation(conversationId)
        }
    }, [conversationId])

    useEffect(() => {
        if (initialQuestion && !hasAskedInitial.current && messages.length === 0 && !conversationId) {
            hasAskedInitial.current = true

            const contextPayload = buildContextPayload()

            if (lensContext) {
                // If we have a Lens, we want the AI to initiate the conversation
                const prompt = `User has selected the "${lensContext.title}" lens (${lensContext.archetype}).
Reasoning for lens: ${lensContext.reasoning}
Suggested opening question: "${initialQuestion}"

INSTRUCTIONS:
1. Introduce yourself briefly as this archetypal voice.
2. Ask the user the suggested question (or a variation that fits the context).
3. Do NOT mention you are an AI. Be the voice.`

                startWithContext(prompt, contextPayload, scopedFriendIds)
            } else {
                // Standard mode: User asks the question
                askQuestion(initialQuestion, contextPayload, undefined, scopedFriendIds)
            }
        }
    }, [initialQuestion, conversationId, lensContext, messages.length, scopedFriendIds])

    useEffect(() => {
        if (messages.length > 0) {
            PerfLogger.log('Oracle', 'Messages Rendered', { count: messages.length });
        }
    }, [messages]);

    useEffect(() => {
        progress.value = withRepeat(
            withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        )
    }, [])

    const animatedProps = useAnimatedProps(() => {
        const length = 4500
        return {
            strokeDashoffset: length * (1 - progress.value),
            strokeDasharray: [length, length],
            stroke: colors.primary,
            strokeWidth: 20,
            fillOpacity: progress.value,
        }
    })

    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
        }
    }, [messages])

    const handleSend = () => {
        if (!input.trim() || isLoading) return
        askQuestion(input, buildContextPayload(), undefined, scopedFriendIds)
        setInput('')
    }

    // Handle "Tell me more" - asks the Oracle about the insight
    const handleTellMeMore = (insight: ProactiveInsight) => {
        trackEvent(AnalyticsEvents.ORACLE_ACTION_TAKEN, {
            insightId: insight.id,
            actionType: 'tell_me_more',
            friendId: insight.actionParams?.friendId
        })

        // Ask the Oracle about this insight
        const question = `Tell me more about this insight: "${insight.headline}". ${insight.body}`
        const insightFriendId = insight.actionParams?.friendId
        askQuestion(question, undefined, undefined, insightFriendId ? [insightFriendId] : scopedFriendIds)
    }

    // Handle "Plan" action - navigate to weave logger
    const handlePlanWeave = (insight: ProactiveInsight) => {
        trackEvent(AnalyticsEvents.ORACLE_ACTION_TAKEN, {
            insightId: insight.id,
            actionType: 'plan_weave',
            friendId: insight.actionParams?.friendId
        })

        onClose?.()
        router.push({
            pathname: '/weave-logger',
            params: insight.actionParams?.friendId
                ? { friendId: insight.actionParams.friendId, mode: 'plan' }
                : { mode: 'plan' }
        })
    }

    // Memoized action handler
    const handleActionPress = React.useCallback(async (action: OracleAction) => {
        const resolvedFriendId = action.friendId || (context === 'friend' ? friendId : undefined)

        switch (action.type) {
            case 'log_weave':
                onClose?.()
                router.push({
                    pathname: '/weave-logger',
                    params: {
                        ...(resolvedFriendId ? { friendId: resolvedFriendId } : {}),
                        notes: action.prefill?.notes || '',
                        category: action.prefill?.activity || '',
                    }
                })
                break
            case 'plan_weave':
                onClose?.()
                router.push({
                    pathname: '/weave-logger',
                    params: {
                        ...(resolvedFriendId ? { friendId: resolvedFriendId } : {}),
                        mode: 'plan',
                    }
                })
                break
            case 'add_life_event':
                if (!resolvedFriendId) {
                    UIEventBus.emit({ type: 'SHOW_TOAST', message: 'Open a friend profile to add a life event' })
                    break
                }

                const lifeEventParams: Record<string, string> = {
                    action: 'add_life_event',
                    lifeEventSource: 'oracle',
                }

                if (action.prefill?.eventType) {
                    lifeEventParams.lifeEventType = action.prefill.eventType
                }
                if (action.prefill?.eventDescription) {
                    lifeEventParams.lifeEventNotes = action.prefill.eventDescription
                }
                if (action.prefill?.eventDate) {
                    lifeEventParams.lifeEventDate = action.prefill.eventDate
                }

                onClose?.()
                if (context === 'friend' && resolvedFriendId === friendId) {
                    router.setParams(lifeEventParams)
                } else {
                    router.push({
                        pathname: '/friend-profile',
                        params: {
                            friendId: resolvedFriendId,
                            ...lifeEventParams,
                        }
                    })
                }
                break
            case 'create_reflection':
                saveToJournal()
                break
            case 'add_memory':
                if (!resolvedFriendId) {
                    UIEventBus.emit({ type: 'SHOW_TOAST', message: 'Open a friend profile to save this note' })
                    break
                }

                const rawNote = action.prefill?.notes?.trim() || ''
                const suggestedTitle = action.prefill?.memoryTitle?.trim()
                    || action.prefill?.eventDescription?.trim()
                    || (action.prefill?.activity?.trim() ? `Note: ${action.prefill?.activity?.trim()}` : '')
                const fallbackTitle = rawNote
                    ? (rawNote.split(/[.!?]/)[0]?.trim() || rawNote).slice(0, 80)
                    : ''

                const memoryParams: Record<string, string> = {
                    action: 'add_memory',
                    memorySource: 'oracle',
                    memoryType: action.prefill?.memoryType || 'context',
                }

                if (rawNote) {
                    memoryParams.memoryNotes = rawNote
                }
                if (suggestedTitle || fallbackTitle) {
                    memoryParams.memoryTitle = (suggestedTitle || fallbackTitle).slice(0, 80)
                }

                onClose?.()
                if (context === 'friend' && resolvedFriendId === friendId) {
                    router.setParams(memoryParams)
                } else {
                    router.push({
                        pathname: '/friend-profile',
                        params: {
                            friendId: resolvedFriendId,
                            ...memoryParams,
                        }
                    })
                }
                break
            case 'view_friend':
                if (resolvedFriendId) {
                    onClose?.()
                    router.push({
                        pathname: '/friend-profile',
                        params: { friendId: resolvedFriendId }
                    })
                }
                break
            case 'set_reminder':
                // TODO: Integrate with reminder system when ready
                // For now, perhaps just copy to clipboard or show a toast
                break
            case 'view_insights':
                // Scroll to insights or navigate to insights tab
                listRef.current?.scrollToOffset({ offset: 0, animated: true })
                break
            case 'start_deepening':
                setShowGuidedReflection(true)
                break
            case 'share_summary':
                // Implement sharing logic
                break
        }
    }, [context, friendId, onClose, router, saveToJournal])

    const handleGuidedComplete = () => {
        // Don't close here — sheet handles its own receipt/close flow
    }

    const handleGuidedEscape = () => {
        setShowGuidedReflection(false)
    }

    const handleInsightsChipPress = () => {
        listRef.current?.scrollToOffset({ offset: 0, animated: true })
    }

    const [isGeneratingInsight, setIsGeneratingInsight] = useState(false)

    const handleRequestInsight = async () => {
        if (!intelligenceCapabilities.localProactiveInsightsEnabled) return

        setIsGeneratingInsight(true)
        try {
            await InsightGenerator.generateOnDemand()
            // Scroll to top to show the new insight in the carousel
            listRef.current?.scrollToOffset({ offset: 0, animated: true })
        } catch (e) {
            // Silently fail, insights will just not appear
        } finally {
            setIsGeneratingInsight(false)
        }
    }

    // Memoized render item to prevent list re-renders on inputs
    const renderMessage = React.useCallback(({ item }: { item: OracleTurn }) => {
        return (
            <MessageItem
                item={item}
                colors={colors}
                typography={typography}
                user={user}
                onAction={handleActionPress}
            />
        )
    }, [colors, typography, user, handleActionPress])

    const handlePromptSelect = (prompt: StarterPrompt) => {
        // Just set the text, but let user send it?
        // NO - Previous user feedback "taps it sends straight to chat".
        // SO - We should AUTO SEND, but using the prompt logic.

        const instruction = prompt.prompt || prompt.text
        const displayLabel = prompt.text

        // If they differ, we use displayOverride
        if (instruction !== displayLabel) {
            askQuestion(instruction, buildContextPayload(), displayLabel, scopedFriendIds)
        } else {
            askQuestion(instruction, buildContextPayload(), undefined, scopedFriendIds)
        }
    }

    const [hasInsights, setHasInsights] = useState(false)

    const emptyState = useMemo(() => (
        <View className={`flex-1 items-center p-6 bg-background ${hasInsights ? 'justify-start pt-2' : 'justify-center'}`}>
            <View
                className="w-32 h-32 rounded-full items-center justify-center mb-6"
            >
                <AnimatedWeaveIcon size={80} color={colors.primary} animatedProps={animatedProps} />
            </View>
            <Text
                className="text-xl text-center mb-3"
                style={{ color: colors.foreground, fontFamily: typography.fonts.serifBold }}
            >
                What's on your mind?
            </Text>

            <StarterPromptChips
                onSelect={handlePromptSelect}
                context={context}
                onRequestInsight={
                    intelligenceCapabilities.localProactiveInsightsEnabled
                        ? handleRequestInsight
                        : undefined
                }
                isGeneratingInsight={isGeneratingInsight}
            />
        </View>
    ), [
        animatedProps,
        colors,
        context,
        handlePromptSelect,
        handleRequestInsight,
        hasInsights,
        intelligenceCapabilities.localProactiveInsightsEnabled,
        isGeneratingInsight,
        typography,
    ])

    return (
        <>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View className="flex-1 px-4">
                        <FlatList
                            ref={listRef}
                            data={messages}
                            renderItem={renderMessage}
                            keyExtractor={(_, index) => index.toString()}
                            contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
                            ListEmptyComponent={
                                isLoading ? (
                                    <View className="flex-1 justify-end pb-10">
                                        <ThinkingBubble />
                                    </View>
                                ) : emptyState
                            }
                            ListHeaderComponent={
                                <View className="mb-4">
                                    <InsightsCarousel onTellMeMore={handleTellMeMore} onPlanWeave={handlePlanWeave} onHasInsights={setHasInsights} />
                                </View>
                            }
                            ListFooterComponent={
                                isLoading && messages.length > 0 ? (
                                    <ThinkingBubble />
                                ) : null
                            }
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        />

                        {messages.length > 0 && !isLoading && (
                            <TouchableOpacity
                                onPress={saveToJournal}
                                disabled={isSaved}
                                className="flex-row items-center justify-center py-2 mb-2"
                                style={{ opacity: isSaved ? 0.5 : 1 }}
                            >
                                {isSaved ? <Check size={16} color={colors.primary} /> : <Bookmark size={16} color={colors.primary} />}
                                <Text style={{ color: colors.primary, fontFamily: typography.fonts.sans, fontSize: 13, marginLeft: 6 }}>
                                    {isSaved ? 'Saved to Journal' : 'Save to Journal'}
                                </Text>
                            </TouchableOpacity>
                        )}

                        {error && (
                            <View className="p-3 mb-2 rounded-lg bg-red-500/10 border border-red-500/20">
                                <Text className="text-red-500 text-sm text-center">{error}</Text>
                            </View>
                        )}

                        <View className="flex-row items-end gap-2 py-3 border-t" style={{ borderColor: colors.border }}>
                            <TextInput
                                className="flex-1 p-3 rounded-xl min-h-[48px] max-h-[120px]"
                                style={{
                                    backgroundColor: colors.input,
                                    color: colors.foreground,
                                    fontFamily: typography.fonts.sans
                                }}
                                placeholder={remainingQuestions > 0 ? "Ask a question..." : "Daily limit reached"}
                                placeholderTextColor={colors['muted-foreground']}
                                value={input}
                                onChangeText={setInput}
                                multiline
                                editable={remainingQuestions > 0 && !isLoading}
                                returnKeyType="send"
                                onSubmitEditing={handleSend}
                            />

                            <TouchableOpacity
                                className="w-12 h-12 rounded-full items-center justify-center mb-[1px]"
                                style={{ backgroundColor: !input.trim() || isLoading ? colors.muted : colors.primary }}
                                onPress={handleSend}
                                disabled={!input.trim() || isLoading}
                            >
                                <Send size={20} color={colors['primary-foreground']} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView >

            <GuidedReflectionSheet
                isOpen={showGuidedReflection}
                onClose={() => setShowGuidedReflection(false)}
                onComplete={handleGuidedComplete}
                onEscape={handleGuidedEscape}
                defaultMode="oracle"
                context={guidedContext}
            />
        </>
    )
}
