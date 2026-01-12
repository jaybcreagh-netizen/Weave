/**
 * FriendTierList - Displays friends filtered by tier
 * 
 * OPTIMIZATION: Migrated from withObservables to FriendsObservableContext.
 * Instead of 3 separate tier subscriptions, we now use 1 centralized context
 * and filter locally. This eliminates cascade re-renders during writes.
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, Dimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withTiming, useAnimatedRef, runOnUI } from 'react-native-reanimated';
import { FlashList } from '@shopify/flash-list';

import FriendModel from '@/db/models/Friend';
import { FriendListRow } from './FriendListRow';
import { useCardGesture } from '@/shared/context/CardGestureContext';
import { useFriendsObservable } from '@/shared/context/FriendsObservableContext';
import { useTheme } from '@/shared/hooks/useTheme';
import { WeaveIcon } from '@/shared/components/WeaveIcon';
import { tierColors } from '@/shared/constants/constants';
import { type Tier } from '../types';

const { width: screenWidth } = Dimensions.get('window');
const AnimatedFlashList = Animated.createAnimatedComponent(FlashList);

// Track which friend cards have animated this session (module-level for persistence)
const animatedCardIds = new Set<string>();

const getTierBackground = (tier: Tier, isDarkMode: boolean) => {
    const tierColorMap: Record<string, string> = {
        InnerCircle: tierColors.InnerCircle,
        CloseFriends: tierColors.CloseFriends,
        Community: tierColors.Community,
    };
    const color = tierColorMap[tier] || tierColors.Community;
    const opacity = isDarkMode ? '0D' : '08';
    return `${color}${opacity}`;
};

const AnimatedFriendCardItem = React.memo(({
    item,
    index,
    onOpenArchetypePicker,
    onOpenDetail,
}: {
    item: FriendModel;
    index: number;
    onOpenArchetypePicker?: (friend: FriendModel) => void;
    onOpenDetail?: (friend: FriendModel) => void;
}) => {
    // Debug log
    /* console.log(`[AnimatedFriendCardItem] Render ${item.name}. Has onOpenDetail: ${!!onOpenDetail}`); */

    const { registerRef, unregisterRef } = useCardGesture();
    const animatedRef = useAnimatedRef<Animated.View>();

    // Check if this card has already animated this session
    const hasAnimatedBefore = animatedCardIds.has(item.id);

    const opacity = useSharedValue(hasAnimatedBefore ? 1 : 0);
    const translateY = useSharedValue(hasAnimatedBefore ? 0 : 25);

    useEffect(() => {
        runOnUI(registerRef)(item.id, animatedRef, { initial: item.name ? item.name.charAt(0).toUpperCase() : '•' });
        return () => {
            runOnUI(unregisterRef)(item.id);
        };
    }, [item.id, item.name, animatedRef, registerRef, unregisterRef]);

    useEffect(() => {
        if (!hasAnimatedBefore) {
            opacity.value = withDelay(index * 35, withTiming(1, { duration: 250 }));
            translateY.value = withDelay(index * 35, withTiming(0, { duration: 250 }));
            animatedCardIds.add(item.id);
        }
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: translateY.value }],
    }));

    return (
        <Animated.View
            className="mb-3"
            style={animatedStyle}>
            <FriendListRow
                friend={item}
                animatedRef={animatedRef}
                onOpenArchetypePicker={onOpenArchetypePicker}
                onOpenDetail={onOpenDetail}
            />
        </Animated.View>
    );
}, (prevProps, nextProps) => {
    return prevProps.item.id === nextProps.item.id;
});

interface FriendTierListProps {
    tier: Tier;
    scrollHandler?: any;
    isQuickWeaveOpen?: boolean;
    onOpenArchetypePicker?: (friend: FriendModel) => void;
    onOpenDetail?: (friend: FriendModel) => void;
}

/**
 * FriendTierList - Now uses centralized FriendsObservableContext
 * instead of per-tier withObservables subscriptions.
 */
export const FriendTierList = React.memo(({ tier, scrollHandler, isQuickWeaveOpen, onOpenArchetypePicker, onOpenDetail }: FriendTierListProps) => {
    const { friends: allFriends } = useFriendsObservable();

    const { colors, isDarkMode } = useTheme();
    const tierBgColor = getTierBackground(tier, isDarkMode);

    // Filter friends by tier - memoized for performance
    const friends = useMemo(() => {
        return allFriends
            .filter(f => f.tier === tier)
            .sort((a, b) => (b.weaveScore ?? 0) - (a.weaveScore ?? 0));
    }, [allFriends, tier]);

    if (friends.length === 0) {
        return (
            <View className="flex-1 items-center justify-center px-4" style={{ width: screenWidth, backgroundColor: tierBgColor }}>
                <View className="mb-6 opacity-60">
                    <WeaveIcon size={120} color={colors['muted-foreground']} />
                </View>
                <Text className="text-lg mb-3" style={{ color: colors.foreground }}>Your weave is empty</Text>
            </View>
        );
    }

    const renderFriendItem = ({ item, index }: { item: FriendModel; index: number }) => (
        <AnimatedFriendCardItem
            item={item}
            index={index}
            onOpenArchetypePicker={onOpenArchetypePicker}
            onOpenDetail={onOpenDetail}
        />
    );

    return (
        <View className="h-full" style={{ width: screenWidth, backgroundColor: tierBgColor }}>
            {/* @ts-ignore - AnimatedFlashList types are tricky with estimatedItemSize */}
            <AnimatedFlashList
                contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16 }}
                data={friends}
                estimatedItemSize={72}
                keyExtractor={(item: any) => item.id}
                scrollEnabled={!isQuickWeaveOpen}
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                renderItem={renderFriendItem as any}
                disableIntervalMomentum={true}
                keyboardShouldPersistTaps="handled"
            />
        </View>
    );
});

