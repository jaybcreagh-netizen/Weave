/**
 * TopicSelectionStep
 * 
 * Initial step in Help Me Write flow where user picks what to reflect on:
 * - Recent weaves to deepen
 * - Friends to think about
 * - Or just start writing freely
 */

import React, { useEffect, useState } from 'react'
import {
    View,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator
} from 'react-native'
import { Text } from '@/shared/ui/Text'
import { Icon } from '@/shared/ui/Icon'
import { useTheme } from '@/shared/hooks/useTheme'
import { database } from '@/db'
import { Q } from '@nozbe/watermelondb'
import Interaction from '@/db/models/Interaction'
import Friend from '@/db/models/Friend'
import { OracleSuggestion, ReflectionContext } from '@/modules/oracle';
import { formatDistanceToNow } from 'date-fns'

interface TopicSelectionStepProps {
    onSelect: (context: ReflectionContext) => void
    onSkip: () => void  // Start freely without specific context
}

interface RecentWeave {
    id: string
    friendNames: string[]
    friendIds: string[]
    activity: string | undefined
    note: string | undefined
    date: Date
}

interface SuggestedFriend {
    id: string
    name: string
    photoUrl: string | undefined
    tier: string
    weaveScore: number
}

export function TopicSelectionStep({ onSelect, onSkip }: TopicSelectionStepProps) {
    const { colors } = useTheme()
    const [loading, setLoading] = useState(true)
    const [recentWeaves, setRecentWeaves] = useState<RecentWeave[]>([])
    const [suggestedFriends, setSuggestedFriends] = useState<SuggestedFriend[]>([])

    useEffect(() => {
        loadTopics()
    }, [])

    const loadTopics = async () => {
        try {
            // Fetch recent weaves (last 7 days, up to 5)
            const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
            const interactions = await database.get<Interaction>('interactions')
                .query(
                    Q.where('interaction_date', Q.gte(weekAgo)),
                    Q.where('status', 'completed'),
                    Q.sortBy('interaction_date', Q.desc),
                    Q.take(5)
                )
                .fetch()

            const weaves: RecentWeave[] = []
            for (const interaction of interactions) {
                // Get friends for this interaction
                const interactionFriends = await database.get('interaction_friends')
                    .query(Q.where('interaction_id', interaction.id))
                    .fetch()

                const friendIds = interactionFriends.map((if_: any) => if_.friendId)
                const friends = await Promise.all(
                    friendIds.map(async (id: string) => {
                        try {
                            return await database.get<Friend>('friends').find(id)
                        } catch {
                            return null
                        }
                    })
                )
                const validFriends = friends.filter(Boolean) as Friend[]

                if (validFriends.length > 0) {
                    weaves.push({
                        id: interaction.id,
                        friendNames: validFriends.map(f => f.name),
                        friendIds: validFriends.map(f => f.id),
                        activity: interaction.interactionCategory,
                        note: interaction.note,
                        date: new Date(interaction.interactionDate)
                    })
                }
            }
            setRecentWeaves(weaves)

            // Fetch friends who might need attention (high tier, low weave score)
            const friends = await database.get<Friend>('friends')
                .query(
                    Q.where('dunbar_tier', Q.oneOf(['Inner', 'Close'])),
                    Q.sortBy('weave_score', Q.asc),
                    Q.take(5)
                )
                .fetch()

            const suggested: SuggestedFriend[] = friends.map(f => ({
                id: f.id,
                name: f.name,
                photoUrl: f.photoUrl,
                tier: f.tier,
                weaveScore: f.weaveScore || 0
            }))
            // Only show friends with low weave score (need attention)
            setSuggestedFriends(suggested.filter(f => f.weaveScore < 50))

        } catch (error) {
            console.error('Error loading topics:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleWeaveSelect = (weave: RecentWeave) => {
        const context: ReflectionContext = {
            type: 'post_weave',
            friendIds: weave.friendIds,
            friendNames: weave.friendNames,
            interactionId: weave.id,
            activity: weave.activity || undefined
        }
        onSelect(context)
    }

    const handleFriendSelect = (friend: SuggestedFriend) => {
        const context: ReflectionContext = {
            type: 'friend_reflection',
            friendIds: [friend.id],
            friendNames: [friend.name]
        }
        onSelect(context)
    }

    const handleStartFresh = () => {
        // Trigger the freeform gather flow instead of the generic oracle prompt
        onSkip()
    }

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center">
                <ActivityIndicator color={colors.primary} />
            </View>
        )
    }

    const hasContent = recentWeaves.length > 0 || suggestedFriends.length > 0

    return (
        <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
        >
            <View className="pb-6">
                {/* Header */}
                <Text
                    variant="h3"
                    className="text-center mb-2"
                    style={{ color: colors.foreground }}
                >
                    What's on your mind?
                </Text>
                <Text
                    variant="body"
                    className="text-center mb-6"
                    style={{ color: colors['muted-foreground'] }}
                >
                    Pick something to explore, or just start writing.
                </Text>

                {/* Recent Weaves Section */}
                {recentWeaves.length > 0 && (
                    <View className="mb-6">
                        <Text
                            variant="caption"
                            className="mb-3 uppercase tracking-wide"
                            style={{ color: colors['muted-foreground'] }}
                        >
                            Recent moments
                        </Text>
                        {recentWeaves.map((weave) => (
                            <TouchableOpacity
                                key={weave.id}
                                onPress={() => handleWeaveSelect(weave)}
                                className="flex-row items-center p-4 rounded-xl mb-2"
                                style={{ backgroundColor: colors.muted }}
                                activeOpacity={0.7}
                            >
                                <View
                                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                                    style={{ backgroundColor: colors.primary + '20' }}
                                >
                                    <Icon name="Moon" size={18} color={colors.primary} />
                                </View>
                                <View className="flex-1">
                                    <Text
                                        variant="body"
                                        style={{ color: colors.foreground }}
                                        numberOfLines={1}
                                    >
                                        {weave.friendNames.join(' & ')}
                                    </Text>
                                    <Text
                                        variant="caption"
                                        style={{ color: colors['muted-foreground'] }}
                                        numberOfLines={1}
                                    >
                                        {weave.activity || 'Spent time'} • {formatDistanceToNow(weave.date, { addSuffix: true })}
                                    </Text>
                                </View>
                                <Icon name="ChevronRight" size={18} color={colors['muted-foreground']} />
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* Friends to think about */}
                {suggestedFriends.length > 0 && (
                    <View className="mb-6">
                        <Text
                            variant="caption"
                            className="mb-3 uppercase tracking-wide"
                            style={{ color: colors['muted-foreground'] }}
                        >
                            Someone on your mind?
                        </Text>
                        {suggestedFriends.map((friend) => (
                            <TouchableOpacity
                                key={friend.id}
                                onPress={() => handleFriendSelect(friend)}
                                className="flex-row items-center p-4 rounded-xl mb-2"
                                style={{ backgroundColor: colors.muted }}
                                activeOpacity={0.7}
                            >
                                <View
                                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                                    style={{ backgroundColor: colors.secondary }}
                                >
                                    <Icon name="User" size={18} color={colors.foreground} />
                                </View>
                                <View className="flex-1">
                                    <Text
                                        variant="body"
                                        style={{ color: colors.foreground }}
                                    >
                                        {friend.name}
                                    </Text>
                                    <Text
                                        variant="caption"
                                        style={{ color: colors['muted-foreground'] }}
                                    >
                                        {friend.weaveScore < 30
                                            ? 'Could use some attention'
                                            : 'Score: ' + Math.round(friend.weaveScore)}
                                    </Text>
                                </View>
                                <Icon name="ChevronRight" size={18} color={colors['muted-foreground']} />
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* Divider if we have content */}
                {hasContent && (
                    <View className="flex-row items-center my-4">
                        <View className="flex-1 h-[1px]" style={{ backgroundColor: colors.border }} />
                        <Text
                            variant="caption"
                            className="mx-4"
                            style={{ color: colors['muted-foreground'] }}
                        >
                            or
                        </Text>
                        <View className="flex-1 h-[1px]" style={{ backgroundColor: colors.border }} />
                    </View>
                )}

                {/* Start fresh option */}
                <TouchableOpacity
                    onPress={handleStartFresh}
                    className="flex-row items-center justify-center p-4 rounded-xl"
                    style={{
                        backgroundColor: colors.primary,
                    }}
                    activeOpacity={0.8}
                >
                    <Icon name="PenLine" size={18} color={colors['primary-foreground']} />
                    <Text
                        variant="button"
                        className="ml-2"
                        style={{ color: colors['primary-foreground'] }}
                    >
                        Just start writing
                    </Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    )
}

export default TopicSelectionStep
