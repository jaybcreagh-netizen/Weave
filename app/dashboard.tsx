import React, { useState, useRef, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Dimensions, StyleSheet } from 'react-native';
import { Settings } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Glyph } from '../src/components/glyph';
import { TierTab } from '../src/components/tier-tab';
import { FAB } from '../src/components/fab';
import { SettingsModal } from '../src/components/settings-modal';
import { useUIStore } from '../src/stores/uiStore';
import { useFriendStore } from '../src/stores/friendStore';
import FriendModel from '../src/db/models/Friend';
import { theme } from '../src/theme';

const { width: screenWidth } = Dimensions.get('window');

function Dashboard() {
  const router = useRouter();
  const { setSelectedFriendId } = useUIStore();
  const { friends: allFriends, observeFriends, unobserveFriends } = useFriendStore();

  useEffect(() => {
    observeFriends();
    return () => {
      unobserveFriends();
    };
  }, [observeFriends, unobserveFriends]);

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
      <ScrollView style={{ width: screenWidth }} contentContainerStyle={styles.tierScrollView}>
        {currentFriends.map((friend) => (
          <View key={friend.id} style={{ marginBottom: 16 }}>
            <Glyph
              name={friend.name}
              statusText={friend.statusText}
              tier={friend.tier as any}
              archetype={friend.archetype as any}
              status={friend.status as any}
              photoUrl={friend.photoUrl}
              onClick={() => onFriendClick(friend.id)}
              variant="compact"
            />
          </View>
        ))}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Weave</Text>
          <View style={styles.headerCounts}>
            <Text style={styles.headerCountText}>Inner: {friends.inner.length}/15</Text>
            <Text style={styles.headerCountText}>Close: {friends.close.length}/50</Text>
            <Text style={styles.headerCountText}>Community: {friends.community.length}/150</Text>
          </View>
        </View>
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
        darkMode={false} // Placeholder
        onToggleDarkMode={() => {}} // Placeholder
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
        alignItems: 'flex-start',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 8,
    },
    headerTitle: {
        fontSize: 32,
        color: theme.colors.foreground,
        marginBottom: 8,
    },
    headerCounts: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    headerCountText: {
        fontSize: 12,
        color: theme.colors['muted-foreground'],
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
    }
});

export default Dashboard;