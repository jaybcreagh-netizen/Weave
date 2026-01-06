/**
 * OracleChat
 * 
 * The main chat interface for Oracle - the AI assistant.
 * Displays messages, handles input, shows contextual chips.
 */

import React, { useState, useRef, useEffect } from 'react'
import {
    View,
    TextInput,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform
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
import { OracleAction } from '../services/types'
import { AnimatedWeaveIcon, WeaveIcon } from '@/shared/components/WeaveIcon'
import { StarterPromptChips } from './StarterPromptChips'
import { SimpleMarkdown } from './SimpleMarkdown'
import { OracleActionButton } from './OracleActionButton'
import { useRouter } from 'expo-router'
import { GuidedReflectionSheet } from '@/modules/journal/components/GuidedReflection/GuidedReflectionSheet'
import InsightsCarousel from './InsightsCarousel'
import { InsightsChip } from './InsightsChip'
import ProactiveInsight from '@/db/models/ProactiveInsight'
import { OracleEntryPoint } from '../hooks/useStarterPrompts'
import { PerfLogger } from '@/shared/utils/performance-logger';
import { trackEvent, AnalyticsEvents } from '@/shared/services/analytics.service';
import { useAuth } from '@/modules/auth/context/AuthContext';
import { CachedImage } from '@/shared/ui/CachedImage';

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
    conversationId?: string
}

export function OracleChat({ context = 'default', friendId, friendName, onClose, portalHost, initialQuestion, journalContent, lensContext, conversationId }: OracleChatProps) {
    const { colors, typography } = useTheme()
    const { messages, isLoading, error, askQuestion, startWithContext, loadConversation, remainingQuestions, saveToJournal, isSaved } = useOracle()
    const { user } = useAuth()
    const [input, setInput] = useState('')
    const listRef = useRef<FlatList>(null)
    const progress = useSharedValue(0)
    const router = useRouter()
    const hasAskedInitial = useRef(false)

    // Guided reflection state
    const [showGuidedReflection, setShowGuidedReflection] = useState(false)
    const [reflectionInsightId, setReflectionInsightId] = useState<string | null>(null)

    // Helper to build rich context
    const buildContextPayload = () => {
        let payload = ''
        if (lensContext) {
            payload += `[SELECTED LENS: ${lensContext.title} (${lensContext.archetype})]\nWhy this lens: ${lensContext.reasoning}\n\n`
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

                startWithContext(prompt, contextPayload)
            } else {
                // Standard mode: User asks the question
                askQuestion(initialQuestion, contextPayload)
            }
        }
    }, [initialQuestion, conversationId])

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
        askQuestion(input, buildContextPayload())
        setInput('')
    }

    const handleInsightAction = (insight: ProactiveInsight) => {
        trackEvent(AnalyticsEvents.ORACLE_ACTION_TAKEN, {
            insightId: insight.id,
            actionType: insight.actionType,
            friendId: insight.actionParams?.friendId
        })

        switch (insight.actionType) {
            case 'plan_weave':
                onClose?.()
                router.push({
                    pathname: '/weave-logger',
                    params: insight.actionParams.friendId ? { friendIds: insight.actionParams.friendId } : undefined
                })
                break
            case 'open_contact':
                if (insight.actionParams.friendId) {
                    onClose?.()
                    router.push({
                        pathname: '/friend-profile',
                        params: { id: insight.actionParams.friendId }
                    })
                }
                break
            case 'guided_reflection':
                // Store insight ID so we can mark it as acted_on when reflection is saved
                setReflectionInsightId(insight.id)
                setShowGuidedReflection(true)
                break
            case 'view_friend_list':
                onClose?.()
                router.replace('/(tabs)/circle')
                break
        }
    }

    const handleActionPress = (action: OracleAction) => {
        switch (action.type) {
            case 'log_weave':
                onClose?.()
                router.push({
                    pathname: '/weave-logger',
                    params: {
                        notes: action.prefill?.notes || '',
                        category: action.prefill?.activity || '',
                    }
                })
                break
            case 'plan_weave':
                onClose?.()
                // If we have a specific friend, could pass ID
                if (action.friendId) {
                    router.push({
                        pathname: '/friend-profile',
                        params: { id: action.friendId }
                    })
                } else {
                    router.push('/weave-logger')
                }
                break
            case 'create_reflection':
                saveToJournal()
                break
            case 'view_friend':
                if (action.friendId) {
                    onClose?.()
                    router.push({
                        pathname: '/friend-profile',
                        params: { id: action.friendId }
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
    }

    const handleGuidedComplete = () => {
        setShowGuidedReflection(false)
    }

    const handleGuidedEscape = () => {
        setShowGuidedReflection(false)
    }

    const handleInsightsChipPress = () => {
        listRef.current?.scrollToOffset({ offset: 0, animated: true })
    }

    const renderMessage = ({ item }: { item: OracleTurn }) => {
        const isUser = item.role === 'user'
        return (
            <View className="mb-4">
                <View className={`flex-row ${isUser ? 'justify-end' : 'justify-start'}`}>
                    {!isUser && (
                        <View
                            className="w-8 h-8 rounded-full items-center justify-center mr-2 mt-1"
                            style={{ backgroundColor: colors.primary }}
                        >
                            <WeaveIcon size={16} color={colors['primary-foreground']} />
                        </View>
                    )}

                    <View
                        className={`px-4 py-3 rounded-2xl max-w-[80%] ${isUser ? 'rounded-tr-none' : 'rounded-tl-none'}`}
                        style={{
                            backgroundColor: isUser ? colors.primary : colors.card,
                            borderWidth: isUser ? 0 : 1,
                            borderColor: colors.border
                        }}
                    >
                        {isUser ? (
                            <Text style={{ color: colors['primary-foreground'], fontFamily: typography.fonts.sans }}>
                                {item.content}
                            </Text>
                        ) : (
                            <SimpleMarkdown
                                content={item.content}
                                style={{
                                    color: colors.foreground,
                                    fontFamily: typography.fonts.sans,
                                    fontSize: 15,
                                    lineHeight: 22,
                                }}
                            />
                        )}
                    </View>

                    {isUser && (
                        <View
                            className="w-8 h-8 rounded-full items-center justify-center ml-2 mt-1 overflow-hidden"
                            style={{ backgroundColor: colors.muted }}
                        >
                            {user?.user_metadata?.avatar_url || user?.user_metadata?.picture ? (
                                <CachedImage
                                    source={{ uri: user?.user_metadata?.avatar_url || user?.user_metadata?.picture }}
                                    style={{ width: 32, height: 32 }}
                                    contentFit="cover"
                                />
                            ) : (
                                <User size={16} color={colors['muted-foreground']} />
                            )}
                        </View>
                    )}
                </View>

                {!isUser && item.action && (
                    <View className="ml-10">
                        <OracleActionButton action={item.action} onPress={handleActionPress} />
                    </View>
                )}
            </View>
        )
    }

    const renderEmptyState = () => (
        <View className="flex-1 items-center justify-center p-6">
            <View
                className="w-32 h-32 rounded-full items-center justify-center mb-6"
                style={{ backgroundColor: colors.muted }}
            >
                <AnimatedWeaveIcon size={80} color={colors.primary} animatedProps={animatedProps} />
            </View>
            <Text
                className="text-xl text-center mb-3"
                style={{ color: colors.foreground, fontFamily: typography.fonts.serifBold }}
            >
                What's on your mind?
            </Text>

            <InsightsChip onPress={handleInsightsChipPress} />
            <StarterPromptChips onSelect={setInput} context={context} />
        </View>
    )

    return (
        <>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
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
                                    <View className="flex-row justify-start mb-4">
                                        <View
                                            className="w-8 h-8 rounded-full items-center justify-center mr-2 mt-1"
                                            style={{ backgroundColor: colors.primary }}
                                        >
                                            <WeaveIcon size={16} color={colors['primary-foreground']} />
                                        </View>
                                        <View
                                            className="px-4 py-3 rounded-2xl rounded-tl-none bg-gray-100 dark:bg-gray-800"
                                            style={{
                                                backgroundColor: colors.card,
                                                borderWidth: 1,
                                                borderColor: colors.border
                                            }}
                                        >
                                            <Text style={{ color: colors.foreground, fontFamily: typography.fonts.sans, fontStyle: 'italic' }}>
                                                Thinking...
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            ) : renderEmptyState
                        }
                        ListHeaderComponent={
                            <View className="mb-4">
                                <InsightsCarousel onAction={handleInsightAction} />
                            </View>
                        }
                        showsVerticalScrollIndicator={false}
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
                            {isLoading ? (
                                <ActivityIndicator color={colors['primary-foreground']} size="small" />
                            ) : (
                                <Send size={20} color={colors['primary-foreground']} />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>

            <GuidedReflectionSheet
                isOpen={showGuidedReflection}
                onClose={() => setShowGuidedReflection(false)}
                onComplete={handleGuidedComplete}
                onEscape={handleGuidedEscape}
            />
        </>
    )
}
