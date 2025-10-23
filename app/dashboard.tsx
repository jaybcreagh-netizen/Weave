import React, { useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Dimensions, StyleSheet, FlatList } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withTiming, useAnimatedRef, runOnUI } from 'react-native-reanimated';
import { Settings } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureDetector } from 'react-native-gesture-handler';

import { FriendCard } from '../src/components/FriendCard';
import { TierTab } from '../src/components/tier-tab';
import { FAB } from '../src/components/fab';
import { SettingsModal } from '../src/components/settings-modal';
import { useUIStore } from '../src/stores/uiStore';
import { useFriendStore } from '../src/stores/friendStore';
import { checkAndApplyDormancy } from '../src/lib/lifecycle-manager';
import FriendModel from '../src/db/models/Friend';
import { useTheme } from '../src/hooks/useTheme';
import { CardGestureProvider, useCardGesture } from '../src/context/CardGestureContext';

const { width: screenWidth } = Dimensions.get('window');

const AnimatedFriendCardItem = ({ item, index }: { item: FriendModel; index: number }) => {
  const { registerRef, unregisterRef } = useCardGesture();
  const animatedRef = useAnimatedRef<Animated.View>();

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(25);

  useEffect(() => {
    runOnUI(registerRef)(item.id, animatedRef);
    return () => {
      runOnUI(unregisterRef)(item.id);
    };
  }, [item.id, animatedRef, registerRef, unregisterRef]);

  useEffect(() => {
    opacity.value = withDelay(index * 50, withTiming(1, { duration: 300 }));
    translateY.value = withDelay(index * 50, withTiming(0, { duration: 300 }));
  }, [index]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[animatedStyle, { marginBottom: 16 }]}>
      <FriendCard friend={item} animatedRef={animatedRef} />
    </Animated.View>
  );
};

function DashboardContent() {
  const router = useRouter();
  const { colors } = useTheme();
  const { isQuickWeaveOpen } = useUIStore();
  const { friends: allFriends, observeFriends, unobserveFriends } = useFriendStore();
  const { gesture, animatedScrollHandler, activeCardId } = useCardGesture();

  useFocusEffect(
    React.useCallback(() => {
      observeFriends();
      // Reset activeCardId when screen gains focus to prevent stuck scales
      activeCardId.value = null;
      return () => {
        unobserveFriends();
        // Also reset when leaving the screen
        activeCardId.value = null;
      };
    }, [observeFriends, unobserveFriends, activeCardId])
  );

  useEffect(() => {
    if (allFriends.length > 0) {
      checkAndApplyDormancy(allFriends);
    }
  }, [allFriends]);

  const friends = useMemo(() => {
    const processedFriends = [...allFriends]
      .filter(friend => friend && friend.name && !friend.isDormant)
      .sort((a, b) => a.weaveScore - b.weaveScore);
    return processedFriends.reduce((acc, friend) => {
      const tier = friend.dunbarTier === "InnerCircle" ? "inner" : friend.dunbarTier === "CloseFriends" ? "close" : "community";
      acc[tier].push(friend);
      return acc;
    }, { inner: [], close: [], community: [] });
  }, [allFriends]);

  const [activeTier, setActiveTier] = React.useState<'inner' | 'close' | 'community'>('inner');
  const [showSettings, setShowSettings] = React.useState(false);
  const scrollViewRef = React.useRef<ScrollView>(null);
  const tiers = ['inner', 'close', 'community'] as const;

  const handleTierChange = (tier: 'inner' | 'close' | 'community') => {
    setActiveTier(tier);
    scrollViewRef.current?.scrollTo({ x: tiers.indexOf(tier) * screenWidth, animated: true });
  };

  const onAddFriend = () => router.push(`/add-friend?tier=${activeTier}`);

  const onScroll = (event: any) => {
    const slide = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
    if (slide !== tiers.indexOf(activeTier)) {
      setActiveTier(tiers[slide]);
    }
  };

  const renderTier = (tier: 'inner' | 'close' | 'community', scrollHandler: any) => {
    const currentFriends = friends[tier] || [];
    if (currentFriends.length === 0) {
      return (
        <View style={[styles.emptyTierContainer, { width: screenWidth }]}>
          <Text style={styles.emptyTierEmoji}>🕸️</Text>
          <Text style={[styles.emptyTierTitle, { color: colors.foreground }]}>Your weave is empty</Text>
        </View>
      );
    }
    return (
      <Animated.FlatList
        style={{ width: screenWidth }}
        contentContainerStyle={styles.tierScrollView}
        data={currentFriends}
        keyExtractor={(item) => item.id}
        scrollEnabled={!isQuickWeaveOpen}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => (
          <AnimatedFriendCardItem item={item} index={index} />
        )}
      />
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Weave</Text>
        <TouchableOpacity onPress={() => setShowSettings(true)} style={{ padding: 12 }}>
          <Settings size={24} color={colors['muted-foreground']} />
        </TouchableOpacity>
      </View>

      <View style={[styles.tierTabsContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TierTab label="Inner Circle" shortLabel="Inner" count={friends.inner.length} maxCount={15} isActive={activeTier === 'inner'} onClick={() => handleTierChange('inner')} tier="inner" />
        <TierTab label="Close Friends" shortLabel="Close" count={friends.close.length} maxCount={50} isActive={activeTier === 'close'} onClick={() => handleTierChange('close')} tier="close" />
        <TierTab label="Community" shortLabel="Community" count={friends.community.length} maxCount={150} isActive={activeTier === 'community'} onClick={() => handleTierChange('community')} tier="community" />
      </View>

      <GestureDetector gesture={gesture}>
        <Animated.ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScroll}
          scrollEventThrottle={16}
          scrollEnabled={!isQuickWeaveOpen}
        >
          {renderTier('inner', animatedScrollHandler)}
          {renderTier('close', animatedScrollHandler)}
          {renderTier('community', animatedScrollHandler)}
        </Animated.ScrollView>
      </GestureDetector>
      
      <FAB onClick={onAddFriend} />

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </SafeAreaView>
  );
}

export default function Dashboard() {
  return <DashboardContent />;
}

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
    headerTitle: { fontSize: 32, fontFamily: 'Lora_700Bold' },
    tierTabsContainer: { flexDirection: 'row', gap: 4, borderRadius: 16, padding: 4, marginHorizontal: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, borderWidth: 1 },
    emptyTierContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
    emptyTierEmoji: { fontSize: 50, marginBottom: 24, opacity: 0.6 },
    emptyTierTitle: { fontSize: 18, marginBottom: 12 },
    tierScrollView: { paddingHorizontal: 20, paddingVertical: 16 },
});