import React, { useEffect, useRef } from 'react';
import { View, Text, Dimensions, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withTiming, useAnimatedRef, runOnUI } from 'react-native-reanimated';
import { FlashList } from '@shopify/flash-list';
import withObservables from '@nozbe/with-observables';
import { Q } from '@nozbe/watermelondb';

import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import { FriendListRow } from '@/modules/relationships';
import { useCardGesture } from '@/context/CardGestureContext';
import { useTheme } from '@/shared/hooks/useTheme';
import { WeaveIcon } from '@/components/WeaveIcon';
import { tierColors } from '@/shared/constants/constants';
import { Tier } from '@/modules/relationships/types';

const { width: screenWidth } = Dimensions.get('window');
const AnimatedFlashList = Animated.createAnimatedComponent(FlashList);

// Keep this consistent with _friends.tsx for now
const getTierBackground = (tier: Tier, isDarkMode: boolean) => {
    const tierColorMap: Record<string, string> = {
        InnerCircle: tierColors.InnerCircle,
        CloseFriends: tierColors.CloseFriends,
        Community: tierColors.Community,
    };
    const color = tierColorMap[tier] || tierColors.Community;
    // Very subtle tinting - 3% opacity for light mode, 5% for dark mode
    const opacity = isDarkMode ? '0D' : '08'; // Hex opacity values
    return `${color}${opacity}`;
};

const AnimatedFriendCardItem = React.memo(({
    item,
    index,
}: {
    item: FriendModel;
    index: number;
}) => {
    const { registerRef, unregisterRef } = useCardGesture();
    const animatedRef = useAnimatedRef<Animated.View>();
    const hasAnimated = useRef(false);

    const opacity = useSharedValue(hasAnimated.current ? 1 : 0);
    const translateY = useSharedValue(hasAnimated.current ? 0 : 25);

    useEffect(() => {
        runOnUI(registerRef)(item.id, animatedRef);
        return () => {
            runOnUI(unregisterRef)(item.id);
        };
    }, [item.id, animatedRef, registerRef, unregisterRef]);

    // Only animate on initial mount
    useEffect(() => {
        if (!hasAnimated.current) {
            opacity.value = withDelay(index * 35, withTiming(1, { duration: 250 }));
            translateY.value = withDelay(index * 35, withTiming(0, { duration: 250 }));
            hasAnimated.current = true;
        }
    }, [index]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: translateY.value }],
    }));

    return (
        <Animated.View
            style={[animatedStyle, { marginBottom: 12 }]}>
            <FriendListRow friend={item} animatedRef={animatedRef} />
        </Animated.View>
    );
}, (prevProps, nextProps) => {
    return prevProps.item.id === nextProps.item.id;
});

interface FriendTierListProps {
    tier: Tier;
    friends: FriendModel[];
    scrollHandler?: any;
    isQuickWeaveOpen?: boolean;
}

const FriendTierListContent = ({ tier, friends, scrollHandler, isQuickWeaveOpen }: FriendTierListProps) => {
    const { colors, isDarkMode } = useTheme();
    const tierBgColor = getTierBackground(tier, isDarkMode);

    if (friends.length === 0) {
        return (
            <View style={[styles.emptyTierContainer, { width: screenWidth, backgroundColor: tierBgColor }]}>
                <View style={styles.emptyTierEmoji}>
                    <WeaveIcon size={120} color={colors['muted-foreground']} />
                </View>
                <Text style={[styles.emptyTierTitle, { color: colors.foreground }]}>Your weave is empty</Text>
            </View>
        );
    }

    const renderFriendItem = ({ item, index }: { item: FriendModel; index: number }) => (
        <AnimatedFriendCardItem
            item={item}
            index={index}
        />
    );

    return (
        <View style={{ width: screenWidth, height: '100%', backgroundColor: tierBgColor }}>
            <AnimatedFlashList
                contentContainerStyle={styles.tierScrollView}
                data={friends}
                estimatedItemSize={72}
                keyExtractor={(item: any) => item.id}
                scrollEnabled={!isQuickWeaveOpen}
                onScroll={scrollHandler}
                scrollEventThrottle={8}
                renderItem={renderFriendItem as any}
                disableIntervalMomentum={true}
            />
        </View>
    );
};

const enhance = withObservables(['tier'], ({ tier }: { tier: Tier }) => ({
    friends: database.get<FriendModel>('friends').query(
        Q.where('dunbar_tier', tier),
        Q.sortBy('weave_score', Q.asc)
    ).observe(),
}));

export const FriendTierList = enhance(FriendTierListContent);

const styles = StyleSheet.create({
    emptyTierContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
    emptyTierEmoji: { fontSize: 50, marginBottom: 24, opacity: 0.6 },
    emptyTierTitle: { fontSize: 18, marginBottom: 12 },
    tierScrollView: { paddingHorizontal: 20, paddingVertical: 16 },
});
