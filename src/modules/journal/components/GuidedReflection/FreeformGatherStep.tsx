/**
 * FreeformGatherStep
 * 
 * 3-step wizard to gather context for freeform journal entries.
 * Collects: topic type, subject (friend/me/something else), and a brief seed.
 * Then generates an LLM draft.
 */

import React, { useState, useRef } from 'react'
import {
    View,
    TouchableOpacity,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator
} from 'react-native'
import Animated, { FadeIn, FadeInRight, FadeInUp } from 'react-native-reanimated'
import { Text } from '@/shared/ui/Text'
import { Button } from '@/shared/ui/Button'
import { Icon } from '@/shared/ui/Icon'
import { useTheme } from '@/shared/hooks/useTheme'
import { database } from '@/db'
import { Q } from '@nozbe/watermelondb'
import Friend from '@/db/models/Friend'
import * as Haptics from 'expo-haptics'

// Topic types for Step 1
export type FreeformTopic = 'gratitude' | 'realization' | 'memory' | 'worry' | 'celebration'

// Subject types for Step 2
export type FreeformSubjectType = 'friend' | 'myself' | 'something_else'

export interface FreeformContext {
    topic: FreeformTopic
    subjectType: FreeformSubjectType
    friendId?: string
    friendName?: string
    abstractSubject?: string  // For "something else"
    seed: string
}

interface FreeformGatherStepProps {
    onComplete: (context: FreeformContext) => void
    onBack: () => void
    /** Pre-selected friend - skips subject selection step */
    preSelectedFriend?: { id: string; name: string }
    /** Pre-selected topic - skips topic selection step */
    preSelectedTopic?: FreeformTopic
}

const TOPIC_OPTIONS: Array<{ id: FreeformTopic; label: string; icon: string }> = [
    { id: 'gratitude', label: 'Gratitude', icon: 'Heart' },
    { id: 'realization', label: 'Realization', icon: 'Lightbulb' },
    { id: 'memory', label: 'Memory', icon: 'Clock' },
    { id: 'worry', label: 'Worry', icon: 'CloudRain' },
    { id: 'celebration', label: 'Celebration', icon: 'PartyPopper' },
]

const SUBJECT_OPTIONS: Array<{ id: FreeformSubjectType; label: string; icon: string }> = [
    { id: 'friend', label: 'A friend', icon: 'User' },
    { id: 'myself', label: 'Myself', icon: 'Smile' },
    { id: 'something_else', label: 'Something else', icon: 'Globe' },
]

export function FreeformGatherStep({
    onComplete,
    onBack,
    preSelectedFriend,
    preSelectedTopic
}: FreeformGatherStepProps) {
    const { colors } = useTheme()

    // Determine initial step based on pre-fills
    const getInitialStep = (): 1 | 2 | 3 => {
        if (preSelectedFriend && preSelectedTopic) return 3  // Both pre-filled, go to seed
        if (preSelectedFriend) return 1  // Friend pre-filled, ask topic
        if (preSelectedTopic) return 2   // Topic pre-filled, ask subject
        return 1  // Nothing pre-filled, start from beginning
    }

    const [step, setStep] = useState<1 | 2 | 3>(getInitialStep())

    // Step 1: Topic
    const [selectedTopic, setSelectedTopic] = useState<FreeformTopic | null>(preSelectedTopic || null)

    // Step 2: Subject
    const [subjectType, setSubjectType] = useState<FreeformSubjectType | null>(
        preSelectedFriend ? 'friend' : null
    )
    const [selectedFriend, setSelectedFriend] = useState<{ id: string; name: string } | null>(
        preSelectedFriend || null
    )
    const [abstractSubject, setAbstractSubject] = useState('')
    const [showFriendPicker, setShowFriendPicker] = useState(false)
    const [friends, setFriends] = useState<Friend[]>([])
    const [loadingFriends, setLoadingFriends] = useState(false)

    // Step 3: Seed
    const [seed, setSeed] = useState('')
    const seedInputRef = useRef<TextInput>(null)

    // Load friends when friend picker is shown
    const loadFriends = async () => {
        setLoadingFriends(true)
        try {
            const allFriends = await database.get<Friend>('friends')
                .query(Q.sortBy('name', Q.asc))
                .fetch()
            setFriends(allFriends)
        } catch (error) {
            console.error('Error loading friends:', error)
        } finally {
            setLoadingFriends(false)
        }
    }

    const handleTopicSelect = (topic: FreeformTopic) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        setSelectedTopic(topic)
        setTimeout(() => setStep(2), 200)
    }

    const handleSubjectSelect = (type: FreeformSubjectType) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        setSubjectType(type)

        if (type === 'friend') {
            setShowFriendPicker(true)
            loadFriends()
        } else if (type === 'myself') {
            setTimeout(() => {
                setStep(3)
                setTimeout(() => seedInputRef.current?.focus(), 300)
            }, 200)
        } else {
            // something_else - show text input for abstract subject
            setTimeout(() => setStep(3), 200)
        }
    }

    const handleFriendSelect = (friend: Friend) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        setSelectedFriend({ id: friend.id, name: friend.name })
        setShowFriendPicker(false)
        setTimeout(() => {
            setStep(3)
            setTimeout(() => seedInputRef.current?.focus(), 300)
        }, 200)
    }

    const handleComplete = () => {
        if (!selectedTopic || !subjectType) return

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

        const context: FreeformContext = {
            topic: selectedTopic,
            subjectType,
            friendId: selectedFriend?.id,
            friendName: selectedFriend?.name,
            abstractSubject: subjectType === 'something_else' ? abstractSubject : undefined,
            seed: seed.trim()
        }

        onComplete(context)
    }

    const handleBack = () => {
        if (showFriendPicker) {
            setShowFriendPicker(false)
            setSubjectType(null)
        } else if (step === 3) {
            // If friend was pre-selected, go back to topic (or exit if topic also pre-selected)
            if (preSelectedFriend && preSelectedTopic) {
                onBack()
            } else if (preSelectedFriend) {
                setStep(1)
                setSelectedTopic(null)
            } else {
                setStep(2)
                setSubjectType(null)
                setSelectedFriend(null)
                setAbstractSubject('')
            }
        } else if (step === 2) {
            // If topic was pre-selected, exit
            if (preSelectedTopic) {
                onBack()
            } else {
                setStep(1)
                setSelectedTopic(null)
            }
        } else {
            onBack()
        }
    }

    const canProceed = step === 3 && seed.trim().length > 0

    // Get prompt text for Step 3 based on subject
    const getSeedPrompt = () => {
        if (subjectType === 'friend' && selectedFriend) {
            return `What's on your mind about ${selectedFriend.name}?`
        } else if (subjectType === 'myself') {
            return "What's on your mind?"
        } else {
            return "Tell me more..."
        }
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
        >
            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <View className="pb-6">
                    {/* Step Indicator */}
                    <View className="flex-row items-center justify-center gap-2 mb-6">
                        {[1, 2, 3].map((s) => (
                            <View
                                key={s}
                                className="h-1.5 rounded-full"
                                style={{
                                    width: s === step ? 24 : 8,
                                    backgroundColor: s <= step ? colors.primary : colors.muted
                                }}
                            />
                        ))}
                    </View>

                    {/* Step 1: Topic Selection */}
                    {step === 1 && (
                        <Animated.View entering={FadeIn.duration(300)}>
                            <Text
                                variant="h3"
                                className="text-center mb-2"
                                style={{ color: colors.foreground }}
                            >
                                What are you reflecting on?
                            </Text>
                            <Text
                                variant="body"
                                className="text-center mb-6"
                                style={{ color: colors['muted-foreground'] }}
                            >
                                Pick the type of reflection
                            </Text>

                            <View className="gap-3">
                                {TOPIC_OPTIONS.map((option) => (
                                    <TouchableOpacity
                                        key={option.id}
                                        onPress={() => handleTopicSelect(option.id)}
                                        className="flex-row items-center p-4 rounded-xl"
                                        style={{
                                            backgroundColor: selectedTopic === option.id
                                                ? colors.primary + '20'
                                                : colors.muted,
                                            borderWidth: selectedTopic === option.id ? 1.5 : 0,
                                            borderColor: colors.primary
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <View
                                            className="w-10 h-10 rounded-full items-center justify-center mr-3"
                                            style={{ backgroundColor: colors.primary + '20' }}
                                        >
                                            <Icon name={option.icon as any} size={18} color={colors.primary} />
                                        </View>
                                        <Text
                                            variant="body"
                                            className="font-medium"
                                            style={{ color: colors.foreground }}
                                        >
                                            {option.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </Animated.View>
                    )}

                    {/* Step 2: Subject Selection */}
                    {step === 2 && !showFriendPicker && (
                        <Animated.View entering={FadeInRight.duration(300)}>
                            <Text
                                variant="h3"
                                className="text-center mb-2"
                                style={{ color: colors.foreground }}
                            >
                                What's this about?
                            </Text>
                            <Text
                                variant="body"
                                className="text-center mb-6"
                                style={{ color: colors['muted-foreground'] }}
                            >
                                Who or what are you thinking about?
                            </Text>

                            <View className="gap-3">
                                {SUBJECT_OPTIONS.map((option) => (
                                    <TouchableOpacity
                                        key={option.id}
                                        onPress={() => handleSubjectSelect(option.id)}
                                        className="flex-row items-center p-4 rounded-xl"
                                        style={{ backgroundColor: colors.muted }}
                                        activeOpacity={0.7}
                                    >
                                        <View
                                            className="w-10 h-10 rounded-full items-center justify-center mr-3"
                                            style={{ backgroundColor: colors.primary + '30' }}
                                        >
                                            <Icon name={option.icon as any} size={18} color={colors.primary} />
                                        </View>
                                        <Text
                                            variant="body"
                                            className="font-medium"
                                            style={{ color: colors.foreground }}
                                        >
                                            {option.label}
                                        </Text>
                                        <View className="flex-1" />
                                        <Icon name="ChevronRight" size={18} color={colors['muted-foreground']} />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </Animated.View>
                    )}

                    {/* Friend Picker */}
                    {step === 2 && showFriendPicker && (
                        <Animated.View entering={FadeInRight.duration(300)}>
                            <Text
                                variant="h3"
                                className="text-center mb-2"
                                style={{ color: colors.foreground }}
                            >
                                Which friend?
                            </Text>
                            <Text
                                variant="body"
                                className="text-center mb-6"
                                style={{ color: colors['muted-foreground'] }}
                            >
                                Pick the person you're thinking about
                            </Text>

                            {loadingFriends ? (
                                <View className="items-center py-8">
                                    <ActivityIndicator color={colors.primary} />
                                </View>
                            ) : (
                                <View className="gap-2">
                                    {friends.slice(0, 10).map((friend) => (
                                        <TouchableOpacity
                                            key={friend.id}
                                            onPress={() => handleFriendSelect(friend)}
                                            className="flex-row items-center p-3 rounded-xl"
                                            style={{ backgroundColor: colors.muted }}
                                            activeOpacity={0.7}
                                        >
                                            <View
                                                className="w-8 h-8 rounded-full items-center justify-center mr-3"
                                                style={{ backgroundColor: colors.primary + '20' }}
                                            >
                                                <Text variant="caption" style={{ color: colors.primary }}>
                                                    {friend.name.charAt(0).toUpperCase()}
                                                </Text>
                                            </View>
                                            <Text
                                                variant="body"
                                                style={{ color: colors.foreground }}
                                            >
                                                {friend.name}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </Animated.View>
                    )}

                    {/* Step 3: Seed Input */}
                    {step === 3 && (
                        <Animated.View entering={FadeInRight.duration(300)}>
                            <Text
                                variant="h3"
                                className="text-center mb-2"
                                style={{ color: colors.foreground }}
                            >
                                {getSeedPrompt()}
                            </Text>
                            <Text
                                variant="body"
                                className="text-center mb-6"
                                style={{ color: colors['muted-foreground'] }}
                            >
                                A sentence or two to guide the draft
                            </Text>

                            <TextInput
                                ref={seedInputRef}
                                value={seed}
                                onChangeText={setSeed}
                                placeholder="Share what's on your mind..."
                                placeholderTextColor={colors['muted-foreground']}
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                                className="p-4 rounded-xl text-base min-h-[120px]"
                                style={{
                                    backgroundColor: colors.muted,
                                    color: colors.foreground
                                }}
                            />

                            <Text
                                variant="caption"
                                className="mt-2 text-center"
                                style={{ color: colors['muted-foreground'] }}
                            >
                                We'll use this to write a polished draft for you
                            </Text>
                        </Animated.View>
                    )}
                </View>
            </ScrollView>

            {/* Footer Actions */}
            <View className="flex-row items-center justify-between pt-4 border-t border-border">
                <TouchableOpacity
                    onPress={handleBack}
                    className="flex-row items-center py-2 px-3"
                >
                    <Icon name="ArrowLeft" size={16} color={colors['muted-foreground']} />
                    <Text
                        variant="body"
                        className="ml-1"
                        style={{ color: colors['muted-foreground'] }}
                    >
                        Back
                    </Text>
                </TouchableOpacity>

                {step === 3 && (
                    <Button
                        label="Generate Draft"
                        onPress={handleComplete}
                        disabled={!canProceed}
                        variant="primary"
                    />
                )}
            </View>
        </KeyboardAvoidingView>
    )
}

export default FreeformGatherStep
