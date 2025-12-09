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
import { SearchFilters, HealthStatus, SortOption } from './FriendSearchBar';
import { Archetype } from '@/modules/relationships/types';

const { width: screenWidth } = Dimensions.get('window');
const AnimatedFlashList = Animated.createAnimatedComponent(FlashList);

// Health thresholds for search filters
const THRIVING_THRESHOLD = 70;
const ATTENTION_THRESHOLD = 35;
const DRIFTING_THRESHOLD = 20;

// Helper to determine health status from score
const getHealthStatus = (score: number): HealthStatus => {
  if (score >= THRIVING_THRESHOLD) return 'thriving';
  if (score >= ATTENTION_THRESHOLD) return 'stable';
  if (score >= DRIFTING_THRESHOLD) return 'attention';
  return 'drifting';
};

// Sort label mapping for display
const SORT_LABELS: Record<SortOption, string> = {
  'default': 'Default',
  'needs-attention': 'Needs attention first',
  'thriving-first': 'Thriving first',
  'recently-connected': 'Recently connected',
  'longest-since': 'Longest since contact',
  'alphabetical': 'A-Z',
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
  sortOption: SortOption;
  scrollHandler?: any;
  isQuickWeaveOpen?: boolean;
}

const FriendSearchResultsContent = ({
  friends,
  searchQuery,
  filters,
  sortOption,
  scrollHandler,
  isQuickWeaveOpen,
}: FriendSearchResultsProps) => {
  const { colors } = useTheme();

  // Filter and sort friends based on search query, filters, and sort option
  const filteredFriends = useMemo(() => {
    let results = [...friends];

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

    // Apply sorting
    switch (sortOption) {
      case 'needs-attention':
        // Weave score ascending (lowest/needs attention first)
        return results.sort((a, b) => {
          const scoreA = calculateCurrentScore(a);
          const scoreB = calculateCurrentScore(b);
          return scoreA - scoreB;
        });

      case 'thriving-first':
        // Weave score descending (highest/thriving first)
        return results.sort((a, b) => {
          const scoreA = calculateCurrentScore(a);
          const scoreB = calculateCurrentScore(b);
          return scoreB - scoreA;
        });

      case 'recently-connected':
        // Last updated descending (most recent first)
        return results.sort((a, b) => {
          const dateA = a.lastUpdated?.getTime() || 0;
          const dateB = b.lastUpdated?.getTime() || 0;
          return dateB - dateA;
        });

      case 'longest-since':
        // Last updated ascending (oldest first)
        return results.sort((a, b) => {
          const dateA = a.lastUpdated?.getTime() || 0;
          const dateB = b.lastUpdated?.getTime() || 0;
          return dateA - dateB;
        });

      case 'alphabetical':
        // Alphabetical A-Z
        return results.sort((a, b) =>
          a.name.localeCompare(b.name)
        );

      case 'default':
      default:
        // Default: needs attention first (same as needs-attention)
        return results.sort((a, b) => {
          const scoreA = calculateCurrentScore(a);
          const scoreB = calculateCurrentScore(b);
          return scoreA - scoreB;
        });
    }
  }, [friends, searchQuery, filters, sortOption]);

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

  // Build results header text
  const sortLabel = SORT_LABELS[sortOption] || '';
  const countText = `${filteredFriends.length} friend${filteredFriends.length !== 1 ? 's' : ''}`;
  const headerText = sortOption !== 'default' && !hasActiveSearch
    ? `${countText} · ${sortLabel}`
    : countText;

  return (
    <View style={{ flex: 1, width: screenWidth }}>
      {/* Results count header */}
      <View className="px-5 py-2">
        <Text
          className="font-inter-medium text-sm"
          style={{ color: colors['muted-foreground'] }}
        >
          {headerText}
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
