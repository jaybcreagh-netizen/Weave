import React, { useMemo, useEffect } from 'react';
import { View, Text, Dimensions } from 'react-native';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import { FlashList } from '@shopify/flash-list';
import withObservables from '@nozbe/with-observables';
import { Q } from '@nozbe/watermelondb';

import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import { FriendListRow } from './FriendListRow';
import { useCardGesture } from '@/shared/context/CardGestureContext';
import { resolveFriendPhotoUrl } from '../utils/photo-path.utils';
import { useTheme } from '@/shared/hooks/useTheme';
import { WeaveIcon } from '@/shared/components/WeaveIcon';
import { calculateCurrentScore } from '@/modules/intelligence/services/orchestrator.service';
import { SearchFilters, SortOption } from './FriendSearchBar';
import { Archetype, Tier } from '../types';
import {
  buildFriendPrioritySnapshot,
  compareFriendPrioritySnapshots,
  getTierAwareHealthStatus,
} from '../services/friend-priority.service';

const { width: screenWidth } = Dimensions.get('window');
const AnimatedFlashList = Animated.createAnimatedComponent(FlashList);

// Sort label mapping for display
const SORT_LABELS: Record<SortOption, string> = {
  'default': 'Default',
  'needs-attention': 'Needs attention first',
  'thriving-first': 'Thriving first',
  'recently-connected': 'Recently connected',
  'longest-since': 'Longest since contact',
  'alphabetical': 'A-Z',
};

// ...

// Animated item wrapper with gesture registration
const AnimatedSearchResultItem = React.memo(({
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
  const { registerRef, unregisterRef } = useCardGesture();
  const animatedRef = useAnimatedRef<Animated.View>();

  const resolvedAvatar = useMemo(() => resolveFriendPhotoUrl(item.photoUrl), [item.photoUrl]);

  useEffect(() => {
    // Register refs on JS thread (not UI thread) to preserve animated ref identity
    registerRef(item.id, animatedRef, {
      initial: item.name ? item.name.charAt(0).toUpperCase() : '•',
      avatar: resolvedAvatar
    });
    return () => {
      unregisterRef(item.id);
    };
  }, [item.id, item.name, resolvedAvatar, animatedRef, registerRef, unregisterRef]);

  return (
    <Animated.View className="mb-3">
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

interface FriendSearchResultsProps {
  friends: FriendModel[];
  searchQuery: string;
  filters: SearchFilters;
  sortOption: SortOption;
  scrollHandler?: any;
  isQuickWeaveOpen?: boolean;
  onOpenArchetypePicker?: (friend: FriendModel) => void;
  onOpenDetail?: (friend: FriendModel) => void;
}

const FriendSearchResultsContent = ({
  friends,
  searchQuery,
  filters,
  sortOption,
  scrollHandler,
  isQuickWeaveOpen,
  onOpenArchetypePicker,
  onOpenDetail,
}: FriendSearchResultsProps) => {
  const { colors } = useTheme();

  // Filter and sort friends based on search query, filters, and sort option
  const filteredFriends = useMemo(() => {
    let results = [...friends];
    const scoreCache = new Map<string, number>();

    const getCachedCurrentScore = (friend: FriendModel): number => {
      if (scoreCache.has(friend.id)) {
        return scoreCache.get(friend.id)!;
      }
      const score = calculateCurrentScore(friend);
      scoreCache.set(friend.id, score);
      return score;
    };

    const buildPrioritySnapshots = (items: FriendModel[]) =>
      items.map(friend =>
        buildFriendPrioritySnapshot(friend, null, getCachedCurrentScore(friend))
      );

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
        const currentScore = getCachedCurrentScore(friend);
        const status = getTierAwareHealthStatus(currentScore, friend.dunbarTier);
        return filters.healthStatus.includes(status);
      });
    }

    // Archetype filter
    if (filters.archetypes.length > 0) {
      results = results.filter(friend =>
        filters.archetypes.includes(friend.archetype as Archetype)
      );
    }

    // Tier filter
    if (filters.tiers.length > 0) {
      results = results.filter(friend =>
        filters.tiers.includes(friend.dunbarTier as Tier)
      );
    }

    // Apply sorting
    switch (sortOption) {
      case 'needs-attention':
        return buildPrioritySnapshots(results)
          .sort(compareFriendPrioritySnapshots)
          .map(snapshot => snapshot.friend);

      case 'thriving-first':
        return buildPrioritySnapshots(results)
          .sort((a, b) => {
            // Best health first
            if (a.healthSeverity !== b.healthSeverity) {
              return a.healthSeverity - b.healthSeverity;
            }
            // Then highest score first
            if (a.currentScore !== b.currentScore) {
              return b.currentScore - a.currentScore;
            }
            // Then most recently connected first
            return b.lastUpdatedMs - a.lastUpdatedMs;
          })
          .map(snapshot => snapshot.friend);

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
        // Default: needs attention first (tier-aware)
        return buildPrioritySnapshots(results)
          .sort(compareFriendPrioritySnapshots)
          .map(snapshot => snapshot.friend);
    }
  }, [friends, searchQuery, filters, sortOption]);

  const hasActiveSearch = searchQuery.trim().length > 0 ||
    filters.healthStatus.length > 0 ||
    filters.archetypes.length > 0 ||
    filters.tiers.length > 0;

  // Empty state
  if (filteredFriends.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-8 pt-[60px]" style={{ width: screenWidth }}>
        <WeaveIcon size={80} color={colors['muted-foreground']} />
        <Text className="text-lg font-semibold mt-5 mb-2 text-center" style={{ color: colors.foreground }}>
          {hasActiveSearch ? 'No friends match this search' : 'No friends yet'}
        </Text>
        {hasActiveSearch && (
          <Text className="text-sm text-center" style={{ color: colors['muted-foreground'] }}>
            Try adjusting your search or filters
          </Text>
        )}
      </View>
    );
  }

  const renderSearchResultItem = ({ item, index }: { item: FriendModel; index: number }) => (
    <AnimatedSearchResultItem
      item={item}
      index={index}
      onOpenDetail={onOpenDetail}
      onOpenArchetypePicker={onOpenArchetypePicker}
    />
  );

  // Build results header text
  const sortLabel = SORT_LABELS[sortOption] || '';
  const countText = `${filteredFriends.length} friend${filteredFriends.length !== 1 ? 's' : ''}`;
  const headerText = sortOption !== 'default' && !hasActiveSearch
    ? `${countText} · ${sortLabel}`
    : countText;

  return (
    <View className="flex-1" style={{ width: screenWidth }}>
      {/* Results count header */}
      <View className="px-5 py-2">
        <Text
          className="font-inter-medium text-sm"
          style={{ color: colors['muted-foreground'] }}
        >
          {headerText}
        </Text>
      </View>

      {/* @ts-ignore - AnimatedFlashList types are tricky with estimatedItemSize */}
      <AnimatedFlashList
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 8 }}
        data={filteredFriends}
        keyExtractor={(item: any) => item.id}
        scrollEnabled={!isQuickWeaveOpen}
        onScroll={scrollHandler}
        scrollEventThrottle={8}
        renderItem={renderSearchResultItem as any}
        disableIntervalMomentum={true}
        keyboardShouldPersistTaps="handled"
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
