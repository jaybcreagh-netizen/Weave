import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, TouchableOpacity, Image } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Q } from '@nozbe/watermelondb';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';

import { useTheme } from '@/shared/hooks/useTheme';
import { StandardBottomSheet } from '@/shared/ui/Sheet';
import { Text } from '@/shared/ui';
import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import { FriendListRow } from './FriendListRow';
import { normalizeContactImageUri } from '../utils/image.utils';
import { FriendSearchBar, SearchFilters, SortOption } from './FriendSearchBar';
import { calculateCurrentScore } from '@/modules/intelligence';
import { Archetype } from '../types';

// Reuse health status logic from FriendSearchResults
type HealthStatus = 'thriving' | 'stable' | 'attention' | 'drifting';
const THRIVING_THRESHOLD = 70;
const ATTENTION_THRESHOLD = 35;
const DRIFTING_THRESHOLD = 20;

const getHealthStatus = (score: number): HealthStatus => {
  if (score >= THRIVING_THRESHOLD) return 'thriving';
  if (score >= ATTENTION_THRESHOLD) return 'stable';
  if (score >= DRIFTING_THRESHOLD) return 'attention';
  return 'drifting';
};

interface FriendPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectFriend: (friend: FriendModel) => void;
  title?: string;
  subtitle?: string;
}

export function FriendPickerSheet({
  visible,
  onClose,
  onSelectFriend,
  title = 'Choose a Friend',
  subtitle,
}: FriendPickerSheetProps) {
  const { colors } = useTheme();
  const [friends, setFriends] = useState<FriendModel[]>([]);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({
    healthStatus: [],
    archetypes: [],
  });
  const [sortOption, setSortOption] = useState<SortOption>('default');

  useEffect(() => {
    if (!visible) {
      // Reset state on close
      setSearchQuery('');
      setFilters({ healthStatus: [], archetypes: [] });
      setSortOption('default');
      return;
    }

    const subscription = database
      .get<FriendModel>('friends')
      .query(Q.sortBy('name', Q.asc))
      .observe()
      .subscribe(setFriends);

    return () => subscription.unsubscribe();
  }, [visible]);

  // Filter and Sort Logic
  const filteredFriends = useMemo(() => {
    let results = [...friends];

    // Text search
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
        return results.sort((a, b) => calculateCurrentScore(a) - calculateCurrentScore(b));
      case 'thriving-first':
        return results.sort((a, b) => calculateCurrentScore(b) - calculateCurrentScore(a));
      case 'recently-connected':
        return results.sort((a, b) => (b.lastUpdated?.getTime() || 0) - (a.lastUpdated?.getTime() || 0));
      case 'longest-since':
        return results.sort((a, b) => (a.lastUpdated?.getTime() || 0) - (b.lastUpdated?.getTime() || 0));
      case 'alphabetical':
        return results.sort((a, b) => a.name.localeCompare(b.name));
      case 'default':
      default:
        // Default alphabetical for picker usually makes sense, but let's keep it consistent
        return results.sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [friends, searchQuery, filters, sortOption]);

  const handleSelectFriend = useCallback(
    (friend: FriendModel) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSelectFriend(friend);
      onClose();
    },
    [onSelectFriend, onClose]
  );

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setFilters({ healthStatus: [], archetypes: [] });
    setSortOption('default');
  }, []);

  const isSearchActive = searchQuery.trim().length > 0 ||
    filters.healthStatus.length > 0 ||
    filters.archetypes.length > 0 ||
    sortOption !== 'default';

  const renderFriendItem = useCallback(
    ({ item }: { item: FriendModel }) => {
      return (
        <FriendListRow
          friend={item}
          variant="compact"
          onPress={handleSelectFriend}
        />
      );
    },
    [handleSelectFriend]
  );

  const renderScrollContent = useCallback(() => {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ paddingBottom: 8 }}>
          {subtitle && (
            <Text
              className="text-sm px-5 text-center mb-2"
              style={{ color: colors['muted-foreground'] }}
            >
              {subtitle}
            </Text>
          )}
          <FriendSearchBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filters={filters}
            onFiltersChange={setFilters}
            sortOption={sortOption}
            onSortChange={setSortOption}
            isActive={isSearchActive}
            onClear={handleClearFilters}
          />
        </View>
        <BottomSheetFlatList
          data={filteredFriends}
          renderItem={renderFriendItem}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View className="items-center py-12 px-8">
              <Text
                className="text-center text-base"
                style={{ color: colors['muted-foreground'] }}
              >
                {isSearchActive
                  ? 'No friends match your search'
                  : 'No friends added yet'}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        />
      </View>
    );
  }, [
    subtitle, colors, searchQuery, filters, sortOption, isSearchActive,
    handleClearFilters, filteredFriends, renderFriendItem
  ]);

  return (
    <StandardBottomSheet
      visible={visible}
      onClose={onClose}
      height="full"
      title={title}
      disableContentPanning
      renderScrollContent={renderScrollContent}
    >
      {/* Children are ignored when renderScrollContent is used */}
      <View />
    </StandardBottomSheet>
  );
}
