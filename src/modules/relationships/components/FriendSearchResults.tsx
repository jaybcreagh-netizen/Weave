import React, { useMemo, useEffect } from 'react';
import { View, Text, Dimensions, StyleSheet } from 'react-native';
import Animated, { useAnimatedRef, runOnUI } from 'react-native-reanimated';
import { FlashList } from '@shopify/flash-list';
import withObservables from '@nozbe/with-observables';
import { Q } from '@nozbe/watermelondb';

import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import { FriendListRow } from '@/modules/relationships';
import { useCardGesture } from '@/context/CardGestureContext';
import { useTheme } from '@/shared/hooks/useTheme';
import { WeaveIcon } from '@/components/WeaveIcon';
import { calculateCurrentScore } from '@/modules/intelligence';
import { SearchFilters, HealthStatus } from './FriendSearchBar';
import { Archetype } from '@/modules/relationships/types';

const { width: screenWidth } = Dimensions.get('window');
const AnimatedFlashList = Animated.createAnimatedComponent(FlashList);

// Health thresholds matching FriendListRow.tsx
const ATTENTION_THRESHOLD = 35;
const STABLE_THRESHOLD = 65;
const DRIFTING_THRESHOLD = 20;

// Helper to determine health status from score
const getHealthStatus = (score: number): HealthStatus => {
  if (score > STABLE_THRESHOLD) return 'thriving';
  if (score > ATTENTION_THRESHOLD) return 'stable';
  if (score > DRIFTING_THRESHOLD) return 'attention';
  return 'drifting';
};

// Animated item wrapper with gesture registration
const AnimatedSearchResultItem = React.memo(({
  item,
  index,
}: {
  item: FriendModel;
  index: number;
}) => {
  const { registerRef, unregisterRef } = useCardGesture();
  const animatedRef = useAnimatedRef<Animated.View>();

  useEffect(() => {
    runOnUI(registerRef)(item.id, animatedRef);
    return () => {
      runOnUI(unregisterRef)(item.id);
    };
  }, [item.id, animatedRef, registerRef, unregisterRef]);

  return (
    <Animated.View style={{ marginBottom: 12 }}>
      <FriendListRow friend={item} animatedRef={animatedRef} />
    </Animated.View>
  );
}, (prevProps, nextProps) => {
  return prevProps.item.id === nextProps.item.id;
});

interface FriendSearchResultsProps {
  friends: FriendModel[];
  searchQuery: string;
  filters: SearchFilters;
  scrollHandler?: any;
  isQuickWeaveOpen?: boolean;
}

const FriendSearchResultsContent = ({
  friends,
  searchQuery,
  filters,
  scrollHandler,
  isQuickWeaveOpen,
}: FriendSearchResultsProps) => {
  const { colors } = useTheme();

  // Filter friends based on search query and filters
  const filteredFriends = useMemo(() => {
    let results = friends;

    // Text search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      results = results.filter(friend =>
        friend.name.toLowerCase().includes(query)
      );
    }

    // Health status filter
    if (filters.healthStatus.length > 0) {
      results = results.filter(friend => {
        const currentScore = calculateCurrentScore(friend);
        const status = getHealthStatus(currentScore);
        return filters.healthStatus.includes(status);
      });
    }

    // Archetype filter
    if (filters.archetypes.length > 0) {
      results = results.filter(friend =>
        filters.archetypes.includes(friend.archetype as Archetype)
      );
    }

    // Sort by weave score (ascending - needs attention first)
    return results.sort((a, b) => {
      const scoreA = calculateCurrentScore(a);
      const scoreB = calculateCurrentScore(b);
      return scoreA - scoreB;
    });
  }, [friends, searchQuery, filters]);

  const hasActiveSearch = searchQuery.trim().length > 0 ||
    filters.healthStatus.length > 0 ||
    filters.archetypes.length > 0;

  // Empty state
  if (filteredFriends.length === 0) {
    return (
      <View style={[styles.emptyContainer, { width: screenWidth }]}>
        <WeaveIcon size={80} color={colors['muted-foreground']} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
          {hasActiveSearch ? 'No friends match this search' : 'No friends yet'}
        </Text>
        {hasActiveSearch && (
          <Text style={[styles.emptySubtitle, { color: colors['muted-foreground'] }]}>
            Try adjusting your search or filters
          </Text>
        )}
      </View>
    );
  }

  const renderSearchResultItem = ({ item, index }: { item: FriendModel; index: number }) => (
    <AnimatedSearchResultItem item={item} index={index} />
  );

  return (
    <View style={{ flex: 1, width: screenWidth }}>
      {/* Results count header */}
      <View className="px-5 py-2">
        <Text
          className="font-inter-medium text-sm"
          style={{ color: colors['muted-foreground'] }}
        >
          {filteredFriends.length} friend{filteredFriends.length !== 1 ? 's' : ''} found
        </Text>
      </View>

      <AnimatedFlashList
        contentContainerStyle={styles.listContent}
        data={filteredFriends}
        estimatedItemSize={72}
        keyExtractor={(item: any) => item.id}
        scrollEnabled={!isQuickWeaveOpen}
        onScroll={scrollHandler}
        scrollEventThrottle={8}
        renderItem={renderSearchResultItem as any}
        disableIntervalMomentum={true}
      />
    </View>
  );
};

// Observable wrapper to fetch all friends
const enhance = withObservables([], () => ({
  friends: database.get<FriendModel>('friends').query(
    Q.sortBy('weave_score', Q.asc)
  ).observe(),
}));

export const FriendSearchResults = enhance(FriendSearchResultsContent);

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
});
