import React, { useState, useRef, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Dimensions, StyleSheet, FlatList } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, withRepeat, Easing, interpolate } from 'react-native-reanimated';
import { Settings } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Glyph } from '../src/components/glyph';
import { TierTab } from '../src/components/tier-tab';
import { FAB } from '../src/components/fab';
import { SettingsModal } from '../src/components/settings-modal';
import { useUIStore } from '../src/stores/uiStore';
import { useFriendStore } from '../src/stores/friendStore';
import { updateAllFriendStatuses } from '../src/lib/status-updater';
import FriendModel from '../src/db/models/Friend';
import { theme } from '../src/theme';
import { type Tier, type Archetype, type Status } from '../src/components/types';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const AnimatedGlyphItem = ({ item, index, onClick }: { item: FriendModel, index: number, onClick: () => void }) => {
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(25);

    useEffect(() => {
        opacity.value = withDelay(index * 50, withTiming(1, { duration: 300 }));
        translateY.value = withDelay(index * 50, withTiming(0, { duration: 300 }));
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            opacity: opacity.value,
            transform: [{ translateY: translateY.value }],
        };
    });

    return (
        <Animated.View style={[animatedStyle, { marginBottom: 16 }]}>
            <Glyph
                name={item.name}
                statusText={item.statusText}
                tier={item.tier as Tier}
                archetype={item.archetype as Archetype}
                status={item.status as Status}
                photoUrl={item.photoUrl}
                onClick={onClick}
                variant="compact"
                needsAttention={item.status === 'Yellow' || item.status === 'Red'}
            />
        </Animated.View>
    );
};


function Dashboard() {
  const router = useRouter();
  const { setSelectedFriendId } = useUIStore();
  const { friends: allFriends, observeFriends, unobserveFriends } = useFriendStore();

  const rotation = useSharedValue(0);

  useEffect(() => {
    observeFriends();
    updateAllFriendStatuses(); // Trigger status updates on mount

    rotation.value = withRepeat(
      withTiming(360, { duration: 60000, easing: Easing.linear }),
      -1
    );

    return () => {
      unobserveFriends();
    };
  }, [observeFriends, unobserveFriends, rotation]);

  const friends = useMemo(() => {
    return (allFriends || []).reduce((acc, friend) => {
        const tier = friend.tier === "InnerCircle" ? "inner" : friend.tier === "CloseFriends" ? "close" : "community";
        acc[tier].push(friend);
        return acc;
    }, { inner: [] as FriendModel[], close: [] as FriendModel[], community: [] as FriendModel[] });
  }, [allFriends]);

  const [activeTier, setActiveTier] = useState<'inner' | 'close' | 'community'>('inner');
  const [showSettings, setShowSettings] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const tiers = ['inner', 'close', 'community'] as const;

  const handleTierChange = (tier: 'inner' | 'close' | 'community') => {
    setActiveTier(tier);
    const tierIndex = tiers.indexOf(tier);
    scrollViewRef.current?.scrollTo({ x: tierIndex * screenWidth, animated: true });
  };

  const onAddFriend = () => router.push('/add-friend');
  const onFriendClick = (id: string) => {
    setSelectedFriendId(id);
    router.push(`/friend-profile?friendId=${id}`);
  };

  const onScroll = (event: any) => {
    const slide = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
    if (slide !== tiers.indexOf(activeTier)) {
      setActiveTier(tiers[slide]);
    }
  };

  const outerRingStyle = useAnimatedStyle(() => {
    const rotate = interpolate(rotation.value, [0, 360], [0, 360]);
    return { transform: [{ rotate: `${rotate}deg` }] };
  });

  const middleRingStyle = useAnimatedStyle(() => {
    const rotate = interpolate(rotation.value, [0, 360], [360, 0]);
    return { transform: [{ rotate: `${rotate}deg` }] };
  });

  const innerRingStyle = useAnimatedStyle(() => {
    const rotate = interpolate(rotation.value, [0, 360], [0, 360]);
    return { transform: [{ rotate: `${rotate}deg` }] };
  });

  const renderTier = (tier: 'inner' | 'close' | 'community') => {
    const currentFriends = friends[tier] || [];
    const isEmpty = currentFriends.length === 0;

    if (isEmpty) {
      return (
        <View style={[styles.emptyTierContainer, { width: screenWidth }]}>
          <Text style={styles.emptyTierEmoji}>🕸️</Text>
          <Text style={styles.emptyTierTitle}>Your weave is empty</Text>
          <Text style={styles.emptyTierSubtitle}>
            Start building meaningful connections by adding your first friend to this tier.
          </Text>
          <TouchableOpacity onPress={onAddFriend} style={styles.emptyTierButton}>
            <Text style={styles.emptyTierButtonText}>Add Friend</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FlatList
        style={{ width: screenWidth }}
        contentContainerStyle={styles.tierScrollView}
        data={currentFriends}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => <AnimatedGlyphItem item={item} index={index} onClick={() => onFriendClick(item.id)} />}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.View style={[styles.outerRing, outerRingStyle]} />
      <Animated.View style={[styles.middleRing, middleRingStyle]} />
      <Animated.View style={[styles.innerRing, innerRingStyle]} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Weave</Text>
        <TouchableOpacity onPress={() => setShowSettings(true)} style={{ padding: 12 }}>
          <Settings size={24} color={theme.colors['muted-foreground']} />
        </TouchableOpacity>
      </View>

      <View style={styles.tierTabsOuterContainer}>
        <View style={styles.tierTabsInnerContainer}>
          <TierTab label="Inner Circle" shortLabel="Inner" count={friends.inner.length} maxCount={15} isActive={activeTier === 'inner'} onClick={() => handleTierChange('inner')} tier="inner" />
          <TierTab label="Close Friends" shortLabel="Close" count={friends.close.length} maxCount={50} isActive={activeTier === 'close'} onClick={() => handleTierChange('close')} tier="close" />
          <TierTab label="Community" shortLabel="Community" count={friends.community.length} maxCount={150} isActive={activeTier === 'community'} onClick={() => handleTierChange('community')} tier="community" />
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        scrollEventThrottle={16}
      >
        {renderTier('inner')}
        {renderTier('close')}
        {renderTier('community')}
      </ScrollView>

      <FAB onClick={onAddFriend} />
      
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 8,
    },
    headerTitle: {
        fontSize: 32,
        color: theme.colors.foreground,
    },
    tierTabsOuterContainer: {
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    tierTabsInnerContainer: {
        flexDirection: 'row',
        gap: 4,
        backgroundColor: theme.colors.card,
        borderRadius: 16,
        padding: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    emptyTierContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    emptyTierEmoji: {
        fontSize: 50,
        marginBottom: 24,
        opacity: 0.6,
    },
    emptyTierTitle: {
        fontSize: 18,
        color: '#3C3C3C',
        marginBottom: 12,
    },
    emptyTierSubtitle: {
        fontSize: 16,
        color: '#8A8A8A',
        marginBottom: 24,
        textAlign: 'center',
    },
    emptyTierButton: {
        backgroundColor: '#B58A6C',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    emptyTierButtonText: {
        color: 'white',
        fontSize: 18,
    },
    tierScrollView: {
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    outerRing: {
        position: 'absolute',
        width: screenWidth * 1.8,
        height: screenWidth * 1.8,
        borderRadius: screenWidth * 0.9,
        borderWidth: 1,
        borderColor: 'rgba(181, 138, 108, 0.1)',
        top: screenHeight / 2 - screenWidth * 0.9,
        left: screenWidth / 2 - screenWidth * 0.9,
        zIndex: -1,
    },
    middleRing: {
        position: 'absolute',
        width: screenWidth * 2.2,
        height: screenWidth * 2.2,
        borderRadius: screenWidth * 1.1,
        borderWidth: 1,
        borderColor: 'rgba(181, 138, 108, 0.08)',
        top: screenHeight / 2 - screenWidth * 1.1,
        left: screenWidth / 2 - screenWidth * 1.1,
        zIndex: -1,
    },
    innerRing: {
        position: 'absolute',
        width: screenWidth * 2.6,
        height: screenWidth * 2.6,
        borderRadius: screenWidth * 1.3,
        borderWidth: 1,
        borderColor: 'rgba(181, 138, 108, 0.06)',
        top: screenHeight / 2 - screenWidth * 1.3,
        left: screenWidth / 2 - screenWidth * 1.3,
        zIndex: -1,
    },
});

export default Dashboard;