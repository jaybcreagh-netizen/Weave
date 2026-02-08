import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Text } from '@/shared/ui/Text';
import { Icon } from '@/shared/ui/Icon';
import { useTheme } from '@/shared/hooks/useTheme';
import { getFriendsForBrowsing } from '@/modules/journal';
import FriendModel from '@/db/models/Friend';
import { resolveFriendPhotoUrl, normalizeContactImageUri } from '@/modules/relationships';
import { CachedImage } from '@/shared/ui';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { SentimentLabel } from '@/db/models/JournalSignals';

interface JournalFriendListProps {
    onFriendArcPress: (friendId: string) => void;
}

interface FriendWithEntries {
    friend: FriendModel;
    entryCount: number;
    lastEntryDate: Date | null;
    recentActivityIndicator: 'high' | 'medium' | 'low';
}

// Map numeric sentiment to label for color
function getSentimentLabel(score?: number): SentimentLabel {
    if (score === undefined || score === null) return 'neutral';
    if (score >= 2) return 'grateful';
    if (score >= 1) return 'positive';
    if (score <= -2) return 'tense';
    if (score <= -1) return 'concerned';
    return 'neutral';
}

export function JournalFriendList({ onFriendArcPress }: JournalFriendListProps) {
    const { colors, typography } = useTheme();
    const [friends, setFriends] = useState<FriendWithEntries[]>([]);
    const [loading, setLoading] = useState(true);
    const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadFriends();
    }, []);

    const loadFriends = async () => {
        try {
            const data = await getFriendsForBrowsing();
            setFriends(data);
        } catch (error) {
            console.error('Error loading friends for journal:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatLastEntry = (date: Date): string => {
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    };

    const getSentimentColor = (label: SentimentLabel) => {
        switch (label) {
            case 'tense': return colors.destructive;
            case 'concerned': return colors.warning;
            case 'positive': return colors.info;
            case 'grateful': return colors.success;
            default: return 'transparent';
        }
    };

    const handleImageError = (friendId: string) => {
        setImageErrors(prev => new Set(prev).add(friendId));
    };

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="small" color={colors.primary} />
            </View>
        );
    }

    return (
        <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
            <View className="px-5">
                {friends.length === 0 ? (
                    <View className="items-center justify-center py-16">
                        <Icon name="Users" size={40} color={colors['muted-foreground']} />
                        <Text
                            variant="h3"
                            weight="medium"
                            className="mt-4 text-center"
                            style={{ color: colors.foreground, fontFamily: typography.fonts.serif }}
                        >
                            No friendships documented yet
                        </Text>
                        <Text
                            variant="caption"
                            className="mt-2 text-center"
                            style={{ color: colors['muted-foreground'] }}
                        >
                            Tag friends in your entries to see them here
                        </Text>
                    </View>
                ) : (
                    <>
                        <Text
                            variant="caption"
                            weight="semibold"
                            style={{
                                color: colors['muted-foreground'],
                                fontSize: 11,
                                textTransform: 'uppercase',
                                letterSpacing: 1,
                                marginBottom: 12,
                            }}
                        >
                            Your Friendships
                        </Text>

                        {friends.map((item, index) => {
                            const { friend, entryCount, lastEntryDate } = item;
                            const resolvedPhoto = resolveFriendPhotoUrl(friend.photoUrl);
                            const hasPhoto = !!resolvedPhoto && !imageErrors.has(friend.id);
                            const sentimentLabel = getSentimentLabel(friend.lastJournalSentiment);
                            const sentimentColor = getSentimentColor(sentimentLabel);
                            const hasSentiment = sentimentLabel !== 'neutral';

                            // Get top 2 detected themes
                            const themes = friend.detectedThemes?.slice(0, 2) || [];

                            return (
                                <Animated.View
                                    key={friend.id}
                                    entering={FadeInDown.delay(index * 40).duration(300)}
                                >
                                    <TouchableOpacity
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            onFriendArcPress(friend.id);
                                        }}
                                        className="mb-3 p-4 rounded-2xl flex-row items-center"
                                        style={{
                                            backgroundColor: colors.card,
                                            borderWidth: 1,
                                            borderColor: colors.border,
                                            borderLeftWidth: hasSentiment ? 3 : 1,
                                            borderLeftColor: hasSentiment ? sentimentColor : colors.border,
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        {/* Avatar with profile picture */}
                                        <View
                                            className="w-12 h-12 rounded-full items-center justify-center mr-3 overflow-hidden"
                                            style={{
                                                backgroundColor: colors.muted,
                                                borderWidth: 0.5,
                                                borderColor: colors.border,
                                            }}
                                        >
                                            {hasPhoto ? (
                                                <CachedImage
                                                    source={{ uri: normalizeContactImageUri(resolvedPhoto!) }}
                                                    style={{ width: '100%', height: '100%' }}
                                                    contentFit="cover"
                                                    onError={() => handleImageError(friend.id)}
                                                />
                                            ) : (
                                                <Text
                                                    variant="body"
                                                    weight="semibold"
                                                    style={{ color: colors.foreground, fontSize: 18 }}
                                                >
                                                    {friend.name.charAt(0).toUpperCase()}
                                                </Text>
                                            )}
                                        </View>

                                        {/* Info */}
                                        <View className="flex-1">
                                            <Text
                                                variant="body"
                                                weight="medium"
                                                style={{ color: colors.foreground, fontSize: 15 }}
                                            >
                                                {friend.name}
                                            </Text>

                                            {/* Metadata row */}
                                            <View className="flex-row items-center gap-1.5 mt-1">
                                                <Text
                                                    variant="caption"
                                                    style={{ color: colors['muted-foreground'], fontSize: 12 }}
                                                >
                                                    {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
                                                </Text>
                                                {lastEntryDate && (
                                                    <>
                                                        <Text
                                                            variant="caption"
                                                            style={{ color: colors.border, fontSize: 12 }}
                                                        >
                                                            ·
                                                        </Text>
                                                        <Text
                                                            variant="caption"
                                                            style={{ color: colors['muted-foreground'], fontSize: 12 }}
                                                        >
                                                            {formatLastEntry(lastEntryDate)}
                                                        </Text>
                                                    </>
                                                )}
                                            </View>

                                            {/* Theme pills */}
                                            {themes.length > 0 && (
                                                <View className="flex-row flex-wrap gap-1.5 mt-2">
                                                    {themes.map((theme, i) => (
                                                        <View
                                                            key={`theme-${i}`}
                                                            className="px-2 py-0.5 rounded-lg"
                                                            style={{ backgroundColor: colors.muted }}
                                                        >
                                                            <Text
                                                                variant="caption"
                                                                style={{
                                                                    color: colors['muted-foreground'],
                                                                    fontSize: 10,
                                                                    textTransform: 'capitalize',
                                                                }}
                                                            >
                                                                {theme.replace('_', ' ')}
                                                            </Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            )}
                                        </View>

                                        <Icon name="ChevronRight" size={18} color={colors['muted-foreground']} />
                                    </TouchableOpacity>
                                </Animated.View>
                            );
                        })}
                    </>
                )}
            </View>

            {/* Bottom padding */}
            <View className="h-24" />
        </ScrollView>
    );
}
