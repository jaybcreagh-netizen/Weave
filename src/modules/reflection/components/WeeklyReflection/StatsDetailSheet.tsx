/**
 * StatsDetailSheet
 * 
 * Shows detailed breakdown when tapping on stats in Your Week screen.
 * Displays: weaves list, friends list, or category breakdown.
 */

import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { format } from 'date-fns';
import { Users, Layers, Calendar, MessageCircle, Mic, UtensilsCrossed, Home, MessageSquare, PartyPopper, Dumbbell, HeartHandshake, Gift, Sparkles, LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { StandardBottomSheet } from '@/shared/ui/Sheet';
import { Text } from '@/shared/ui/Text';
import { Card } from '@/shared/ui/Card';
import { WeaveLoading } from '@/shared/components/WeaveLoading';
import {
    getWeeklyBreakdown,
    WeaveItem,
    FriendActivityItem,
    CategoryBreakdown,
} from '@/modules/reflection';

// ============================================================================
// TYPES
// ============================================================================

export type StatType = 'weaves' | 'friends' | 'activity';

interface StatsDetailSheetProps {
    isOpen: boolean;
    onClose: () => void;
    statType: StatType;
    weekStartDate?: Date;
    weekEndDate?: Date;
}

// ============================================================================
// CATEGORY CONFIG
// ============================================================================

const CATEGORY_CONFIG: Record<string, { label: string; icon: LucideIcon; color: string }> = {
    'text-call': { label: 'Texting & Calls', icon: MessageCircle, color: '#3B82F6' },
    'voice-note': { label: 'Voice Notes', icon: Mic, color: '#8B5CF6' },
    'meal-drink': { label: 'Meals & Drinks', icon: UtensilsCrossed, color: '#F59E0B' },
    'hangout': { label: 'Hangouts', icon: Home, color: '#10B981' },
    'deep-talk': { label: 'Deep Conversations', icon: MessageSquare, color: '#6366F1' },
    'event-party': { label: 'Events & Parties', icon: PartyPopper, color: '#EC4899' },
    'activity-hobby': { label: 'Activities & Hobbies', icon: Dumbbell, color: '#14B8A6' },
    'favor-support': { label: 'Support & Favors', icon: HeartHandshake, color: '#F97316' },
    'celebration': { label: 'Celebrations', icon: Gift, color: '#EF4444' },
    'Connection': { label: 'Connections', icon: Sparkles, color: '#A855F7' },
};

function getCategoryConfig(category: string) {
    return CATEGORY_CONFIG[category] || { label: category, icon: Sparkles, color: '#9CA3AF' };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function StatsDetailSheet({ isOpen, onClose, statType, weekStartDate, weekEndDate }: StatsDetailSheetProps) {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [weaves, setWeaves] = useState<WeaveItem[]>([]);
    const [friends, setFriends] = useState<FriendActivityItem[]>([]);
    const [categories, setCategories] = useState<CategoryBreakdown[]>([]);

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen]);

    const loadData = async () => {
        setLoading(true);
        try {
            const breakdown = await getWeeklyBreakdown(weekStartDate, weekEndDate);
            setWeaves(breakdown.weaves);
            setFriends(breakdown.friends);
            setCategories(breakdown.categories);
        } catch (error) {
            console.error('[StatsDetailSheet] Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getTitle = () => {
        switch (statType) {
            case 'weaves': return 'Your Weaves';
            case 'friends': return 'Friends Contacted';
            case 'activity': return 'Activity Breakdown';
        }
    };

    const getSubtitle = () => {
        switch (statType) {
            case 'weaves': return `${weaves.length} connections made`;
            case 'friends': return `${friends.length} people reached`;
            case 'activity': return `${categories.length} different activities`;
        }
    };

    const getEmptyEmoji = () => {
        switch (statType) {
            case 'weaves': return '🌙';
            case 'friends': return '👋';
            case 'activity': return '🎯';
        }
    };

    return (
        <StandardBottomSheet
            visible={isOpen}
            onClose={onClose}
            height="full"
            title={getTitle()}
            scrollable
        >
            {loading ? (
                <View className="flex-1 items-center justify-center py-12">
                    <WeaveLoading size={40} />
                </View>
            ) : (
                <>
                    {/* Summary Header */}
                    <Animated.View
                        entering={FadeInDown.duration(300)}
                        className="flex-row items-center justify-center py-4 mb-4 rounded-2xl"
                        style={{ backgroundColor: `${colors.primary}10` }}
                    >
                        <Sparkles size={16} color={colors.primary} />
                        <Text variant="body" className="font-medium ml-2" style={{ color: colors.primary }}>
                            {getSubtitle()}
                        </Text>
                    </Animated.View>

                    {/* Weaves List */}
                    {statType === 'weaves' && (
                        <>
                            {weaves.length === 0 ? (
                                <View className="py-12 items-center">
                                    <Text className="text-5xl mb-3">{getEmptyEmoji()}</Text>
                                    <Text variant="body" className="text-muted-foreground text-center">
                                        A quiet week. Rest is part of the rhythm.
                                    </Text>
                                </View>
                            ) : (
                                weaves.map((weave, index) => {
                                    const config = getCategoryConfig(weave.category);
                                    return (
                                        <Animated.View
                                            key={weave.id}
                                            entering={FadeInDown.delay(index * 50).duration(300)}
                                        >
                                            <Card className="p-4 mb-3">
                                                <View className="flex-row items-start">
                                                    {/* Category Icon */}
                                                    <View
                                                        className="w-10 h-10 rounded-full items-center justify-center mr-3"
                                                        style={{ backgroundColor: `${config.color}15` }}
                                                    >
                                                        <config.icon size={20} color={config.color} />
                                                    </View>

                                                    <View className="flex-1">
                                                        <Text variant="body" className="font-semibold" numberOfLines={1}>
                                                            {weave.friendNames.join(', ') || 'Unknown'}
                                                        </Text>
                                                        <Text variant="caption" className="text-muted-foreground mt-0.5">
                                                            {config.label}
                                                        </Text>
                                                        <Text variant="caption" className="text-muted-foreground/70 text-xs mt-1">
                                                            {format(weave.date, 'EEEE, MMM d')}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </Card>
                                        </Animated.View>
                                    );
                                })
                            )}
                        </>
                    )}

                    {/* Friends List */}
                    {statType === 'friends' && (
                        <>
                            {friends.length === 0 ? (
                                <View className="py-12 items-center">
                                    <Text className="text-5xl mb-3">{getEmptyEmoji()}</Text>
                                    <Text variant="body" className="text-muted-foreground text-center">
                                        Time to reach out to someone you care about!
                                    </Text>
                                </View>
                            ) : (
                                friends.map((friend, index) => (
                                    <Animated.View
                                        key={friend.friendId}
                                        entering={FadeInDown.delay(index * 50).duration(300)}
                                    >
                                        <Card className="p-4 mb-3">
                                            <View className="flex-row items-center">
                                                {/* Initials Avatar */}
                                                <View
                                                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                                                    style={{ backgroundColor: `${colors.primary}15` }}
                                                >
                                                    <Text className="font-semibold" style={{ color: colors.primary }}>
                                                        {friend.friendName.charAt(0).toUpperCase()}
                                                    </Text>
                                                </View>

                                                <View className="flex-1">
                                                    <Text variant="body" className="font-semibold" numberOfLines={1}>
                                                        {friend.friendName}
                                                    </Text>
                                                    <View className="flex-row items-center mt-1">
                                                        {Array.from({ length: Math.min(friend.weaveCount, 5) }).map((_, i) => (
                                                            <View
                                                                key={i}
                                                                className="w-2 h-2 rounded-full mr-1"
                                                                style={{ backgroundColor: colors.primary }}
                                                            />
                                                        ))}
                                                        {friend.weaveCount > 5 && (
                                                            <Text variant="caption" className="text-muted-foreground ml-1">
                                                                +{friend.weaveCount - 5}
                                                            </Text>
                                                        )}
                                                    </View>
                                                </View>

                                                <View className="items-end">
                                                    <Text variant="h2" className="font-lora-bold" style={{ color: colors.primary }}>
                                                        {friend.weaveCount}
                                                    </Text>
                                                    <Text variant="caption" className="text-muted-foreground text-xs">
                                                        {friend.weaveCount === 1 ? 'weave' : 'weaves'}
                                                    </Text>
                                                </View>
                                            </View>
                                        </Card>
                                    </Animated.View>
                                ))
                            )}
                        </>
                    )}

                    {/* Category Breakdown */}
                    {statType === 'activity' && (
                        <>
                            {categories.length === 0 ? (
                                <View className="py-12 items-center">
                                    <Text className="text-5xl mb-3">{getEmptyEmoji()}</Text>
                                    <Text variant="body" className="text-muted-foreground text-center">
                                        Start logging weaves to see your activity mix!
                                    </Text>
                                </View>
                            ) : (
                                categories.map((cat, index) => {
                                    const config = getCategoryConfig(cat.category);
                                    return (
                                        <Animated.View
                                            key={cat.category}
                                            entering={FadeInDown.delay(index * 50).duration(300)}
                                        >
                                            <Card className="p-4 mb-3">
                                                <View className="flex-row items-center mb-3">
                                                    {/* Category Icon */}
                                                    <View
                                                        className="w-10 h-10 rounded-full items-center justify-center mr-3"
                                                        style={{ backgroundColor: `${config.color}15` }}
                                                    >
                                                        <config.icon size={20} color={config.color} />
                                                    </View>

                                                    <View className="flex-1">
                                                        <Text variant="body" className="font-semibold">
                                                            {config.label}
                                                        </Text>
                                                    </View>

                                                    <View className="items-end">
                                                        <Text variant="h2" className="font-lora-bold" style={{ color: config.color }}>
                                                            {cat.count}
                                                        </Text>
                                                    </View>
                                                </View>

                                                {/* Colored Progress bar */}
                                                <View className="h-3 rounded-full bg-muted overflow-hidden">
                                                    <View
                                                        className="h-full rounded-full"
                                                        style={{
                                                            width: `${cat.percentage}%`,
                                                            backgroundColor: config.color,
                                                        }}
                                                    />
                                                </View>
                                                <Text variant="caption" className="text-muted-foreground mt-2 text-center">
                                                    {cat.percentage}% of your week
                                                </Text>
                                            </Card>
                                        </Animated.View>
                                    );
                                })
                            )}
                        </>
                    )}
                </>
            )}
        </StandardBottomSheet>
    );
}

