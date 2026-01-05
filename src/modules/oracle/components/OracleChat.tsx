/**
 * OracleChat
 * 
 * The main chat interface for Oracle - the AI assistant.
 * Displays messages, handles input, shows contextual chips.
 */

import React, { useState, useRef, useEffect } from 'react'
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    ActivityIndicator
} from 'react-native'
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
import { AnimatedWeaveIcon } from '@/shared/components/WeaveIcon'
import { StarterPromptChips } from './StarterPromptChips'
import { SimpleMarkdown } from './SimpleMarkdown'
import { OracleActionButton } from './OracleActionButton'
import { useRouter } from 'expo-router'
import { GuidedReflectionSheet } from '@/modules/journal/components/GuidedReflection/GuidedReflectionSheet'
import InsightsCarousel from './InsightsCarousel'
import { InsightsChip } from './InsightsChip'
import { NudgesChip } from './NudgesChip'
import { NudgesSheetWrapper } from './NudgesSheetWrapper'
import ProactiveInsight from '@/db/models/ProactiveInsight'
import { OracleContext } from '../hooks/useStarterPrompts'

interface OracleChatProps {
    context?: OracleContext
    friendId?: string
    friendName?: string
    onClose?: () => void
}

export function OracleChat({ context = 'default', friendId, friendName, onClose }: OracleChatProps) {
    const { colors, typography } = useTheme()
    const { messages, isLoading, error, askQuestion, remainingQuestions, saveToJournal, isSaved } = useOracle()
    const [input, setInput] = useState('')
    const listRef = useRef<FlatList>(null)
    const progress = useSharedValue(0)
    const router = useRouter()

    // Guided reflection state
    const [showGuidedReflection, setShowGuidedReflection] = useState(false)
    // Nudges sheet state
    const [showNudgesSheet, setShowNudgesSheet] = useState(false)

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
        askQuestion(input)
        setInput('')
    }

    const handleInsightAction = (insight: ProactiveInsight) => {
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
                router.push('/weave-logger')
                break
            case 'create_reflection':
                saveToJournal()
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
                            <Bot size={16} color={colors['primary-foreground']} />
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
                            className="w-8 h-8 rounded-full items-center justify-center ml-2 mt-1"
                            style={{ backgroundColor: colors.muted }}
                        >
                            <User size={16} color={colors['muted-foreground']} />
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
            <NudgesChip onPress={() => setShowNudgesSheet(true)} />
            <StarterPromptChips onSelect={setInput} context={context} />
        </View>
    )

    return (
        <>
            <View className="flex-1 px-4">
                <FlatList
                    ref={listRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={(_, index) => index.toString()}
                    contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
                    ListEmptyComponent={renderEmptyState}
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

            <GuidedReflectionSheet
                isOpen={showGuidedReflection}
                onClose={() => setShowGuidedReflection(false)}
                onComplete={handleGuidedComplete}
                onEscape={handleGuidedEscape}
            />

            <NudgesSheetWrapper
                isVisible={showNudgesSheet}
                onClose={() => setShowNudgesSheet(false)}
            />
        </>
    )
}
