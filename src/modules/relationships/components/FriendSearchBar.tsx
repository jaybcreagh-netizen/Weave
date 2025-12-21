import React, { useState, useCallback, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, ScrollView, Text } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Search, X, ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/shared/hooks/useTheme';
import { ArchetypeIcon } from '@/modules/intelligence';
import { Archetype, Tier } from '../types';

// Health status based on weave score thresholds
export type HealthStatus = 'thriving' | 'stable' | 'attention' | 'drifting';

// Sort options for friend list
export type SortOption =
  | 'default'           // Tier view (no sorting applied)
  | 'needs-attention'   // Weave score ascending (lowest first)
  | 'thriving-first'    // Weave score descending (highest first)
  | 'recently-connected' // Last updated descending (most recent first)
  | 'longest-since'     // Last updated ascending (oldest first)
  | 'alphabetical';     // A-Z by name

export interface SearchFilters {
  healthStatus: HealthStatus[];
  archetypes: Archetype[];
  tiers: Tier[];
}

interface FriendSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;
  isActive: boolean;
  onFocus?: () => void;
  onClear?: () => void;
}

const HEALTH_STATUSES: { key: HealthStatus; label: string; color: string }[] = [
  { key: 'thriving', label: 'Thriving', color: '#10B981' },
  { key: 'stable', label: 'Stable', color: '#F59E0B' },
  { key: 'attention', label: 'Needs Care', color: '#F97316' },
  { key: 'drifting', label: 'Drifting', color: '#EF4444' },
];

const ARCHETYPES: { key: Archetype; label: string }[] = [
  { key: 'Emperor', label: 'Emperor' },
  { key: 'Empress', label: 'Empress' },
  { key: 'HighPriestess', label: 'High Priestess' },
  { key: 'Fool', label: 'Fool' },
  { key: 'Sun', label: 'Sun' },
  { key: 'Hermit', label: 'Hermit' },
  { key: 'Magician', label: 'Magician' },
  { key: 'Lovers', label: 'Lovers' },
];

const TIERS: { key: Tier; label: string; color: string }[] = [
  { key: 'InnerCircle', label: 'Inner Circle', color: '#8B5CF6' },
  { key: 'CloseFriends', label: 'Close Friends', color: '#3B82F6' },
  { key: 'Community', label: 'Community', color: '#6B7280' },
];

const SORT_OPTIONS: { key: SortOption; label: string; shortLabel: string }[] = [
  { key: 'default', label: 'Default (Tier View)', shortLabel: 'Default' },
  { key: 'needs-attention', label: 'Needs Attention First', shortLabel: 'Needs Attention' },
  { key: 'thriving-first', label: 'Thriving First', shortLabel: 'Thriving' },
  { key: 'recently-connected', label: 'Recently Connected', shortLabel: 'Recent' },
  { key: 'longest-since', label: 'Longest Since Contact', shortLabel: 'Longest Since' },
  { key: 'alphabetical', label: 'Alphabetical (A-Z)', shortLabel: 'A-Z' },
];

export function FriendSearchBar({
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
  sortOption,
  onSortChange,
  isActive,
  onFocus,
  onClear,
}: FriendSearchBarProps) {
  const { colors, isDarkMode } = useTheme();
  const [showFilters, setShowFilters] = useState(false);
  const [showSortOptions, setShowSortOptions] = useState(false);
  const [localQuery, setLocalQuery] = useState(searchQuery);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(localQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [localQuery, onSearchChange]);

  // Sync external changes
  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  const hasActiveFilters = filters.healthStatus.length > 0 || filters.archetypes.length > 0 || filters.tiers.length > 0;
  const activeFilterCount = filters.healthStatus.length + filters.archetypes.length + filters.tiers.length;
  const hasNonDefaultSort = sortOption !== 'default';

  const toggleHealthStatus = useCallback((status: HealthStatus) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newStatuses = filters.healthStatus.includes(status)
      ? filters.healthStatus.filter(s => s !== status)
      : [...filters.healthStatus, status];
    onFiltersChange({ ...filters, healthStatus: newStatuses });
  }, [filters, onFiltersChange]);

  const toggleArchetype = useCallback((archetype: Archetype) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newArchetypes = filters.archetypes.includes(archetype)
      ? filters.archetypes.filter(a => a !== archetype)
      : [...filters.archetypes, archetype];
    onFiltersChange({ ...filters, archetypes: newArchetypes });
  }, [filters, onFiltersChange]);

  const toggleTier = useCallback((tier: Tier) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newTiers = filters.tiers.includes(tier)
      ? filters.tiers.filter(t => t !== tier)
      : [...filters.tiers, tier];
    onFiltersChange({ ...filters, tiers: newTiers });
  }, [filters, onFiltersChange]);

  const handleSortChange = useCallback((sort: SortOption) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSortChange(sort);
    setShowSortOptions(false);
  }, [onSortChange]);

  const clearAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLocalQuery('');
    onSearchChange('');
    onFiltersChange({ healthStatus: [], archetypes: [], tiers: [] });
    onSortChange('default');
    setShowFilters(false);
    setShowSortOptions(false);
    onClear?.();
  }, [onSearchChange, onFiltersChange, onSortChange, onClear]);

  const toggleFilters = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowFilters(!showFilters);
    if (!showFilters) setShowSortOptions(false);
  }, [showFilters]);

  const toggleSortOptions = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowSortOptions(!showSortOptions);
    if (!showSortOptions) setShowFilters(false);
  }, [showSortOptions]);

  const currentSortLabel = SORT_OPTIONS.find(s => s.key === sortOption)?.shortLabel || 'Default';

  const hasAnyActive = localQuery.length > 0 || hasActiveFilters || hasNonDefaultSort;

  return (
    <View className="px-5 pt-3 pb-2">
      {/* Search Input Row */}
      <View
        className="flex-row items-center px-4 py-3 rounded-xl"
        style={{ backgroundColor: colors.muted }}
      >
        <Search size={18} color={colors['muted-foreground']} />
        <TextInput
          className="flex-1 ml-3 font-inter-regular text-base"
          style={{ color: colors.foreground }}
          placeholder="Search friends..."
          placeholderTextColor={colors['muted-foreground']}
          value={localQuery}
          onChangeText={setLocalQuery}
          onFocus={onFocus}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />

        {/* Sort Toggle Button */}
        <TouchableOpacity
          onPress={toggleSortOptions}
          className="flex-row items-center ml-2 px-2 py-1 rounded-lg"
          style={{
            backgroundColor: hasNonDefaultSort ? colors.primary + '20' : 'transparent',
          }}
        >
          <ArrowUpDown size={14} color={hasNonDefaultSort ? colors.primary : colors['muted-foreground']} />
          {hasNonDefaultSort && (
            <Text
              className="font-inter-medium text-xs ml-1"
              style={{ color: colors.primary }}
              numberOfLines={1}
            >
              {currentSortLabel}
            </Text>
          )}
        </TouchableOpacity>

        {/* Filter Toggle Button */}
        <TouchableOpacity
          onPress={toggleFilters}
          className="flex-row items-center ml-2 px-2 py-1 rounded-lg"
          style={{
            backgroundColor: hasActiveFilters ? colors.primary + '20' : 'transparent',
          }}
        >
          <Text
            className="font-inter-medium text-sm mr-1"
            style={{
              color: hasActiveFilters ? colors.primary : colors['muted-foreground']
            }}
          >
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Text>
          {showFilters ? (
            <ChevronUp size={14} color={hasActiveFilters ? colors.primary : colors['muted-foreground']} />
          ) : (
            <ChevronDown size={14} color={hasActiveFilters ? colors.primary : colors['muted-foreground']} />
          )}
        </TouchableOpacity>

        {/* Clear Button */}
        {hasAnyActive && (
          <TouchableOpacity onPress={clearAll} className="ml-2 p-1">
            <X size={18} color={colors['muted-foreground']} />
          </TouchableOpacity>
        )}
      </View>

      {/* Sort Options Panel */}
      {showSortOptions && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          className="mt-3"
        >
          <Text
            className="font-inter-medium text-xs mb-2 ml-1"
            style={{ color: colors['muted-foreground'] }}
          >
            Sort By
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            <View className="flex-row gap-2">
              {SORT_OPTIONS.map((option) => {
                const isSelected = sortOption === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    onPress={() => handleSortChange(option.key)}
                    className="px-3 py-2 rounded-full"
                    style={{
                      backgroundColor: isSelected
                        ? colors.primary + '20'
                        : isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                      borderWidth: isSelected ? 1 : 0,
                      borderColor: colors.primary,
                    }}
                  >
                    <Text
                      className="font-inter-medium text-sm"
                      style={{
                        color: isSelected ? colors.primary : colors.foreground
                      }}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </Animated.View>
      )}

      {/* Filter Panels */}
      {showFilters && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          className="mt-3"
        >
          {/* Health Status Filters */}
          <Text
            className="font-inter-medium text-xs mb-2 ml-1"
            style={{ color: colors['muted-foreground'] }}
          >
            Connection Health
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-3"
          >
            <View className="flex-row gap-2">
              {HEALTH_STATUSES.map((status) => {
                const isSelected = filters.healthStatus.includes(status.key);
                return (
                  <TouchableOpacity
                    key={status.key}
                    onPress={() => toggleHealthStatus(status.key)}
                    className="px-3 py-2 rounded-full flex-row items-center"
                    style={{
                      backgroundColor: isSelected
                        ? status.color + '20'
                        : isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                      borderWidth: isSelected ? 1 : 0,
                      borderColor: status.color,
                    }}
                  >
                    <View
                      className="w-2 h-2 rounded-full mr-2"
                      style={{ backgroundColor: status.color }}
                    />
                    <Text
                      className="font-inter-medium text-sm"
                      style={{
                        color: isSelected ? status.color : colors.foreground
                      }}
                    >
                      {status.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Tier Filters */}
          <Text
            className="font-inter-medium text-xs mb-2 ml-1"
            style={{ color: colors['muted-foreground'] }}
          >
            Dunbar Tier
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-3"
          >
            <View className="flex-row gap-2">
              {TIERS.map((tier) => {
                const isSelected = filters.tiers.includes(tier.key);
                return (
                  <TouchableOpacity
                    key={tier.key}
                    onPress={() => toggleTier(tier.key)}
                    className="px-3 py-2 rounded-full flex-row items-center"
                    style={{
                      backgroundColor: isSelected
                        ? tier.color + '20'
                        : isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                      borderWidth: isSelected ? 1 : 0,
                      borderColor: tier.color,
                    }}
                  >
                    <View
                      className="w-2 h-2 rounded-full mr-2"
                      style={{ backgroundColor: tier.color }}
                    />
                    <Text
                      className="font-inter-medium text-sm"
                      style={{
                        color: isSelected ? tier.color : colors.foreground
                      }}
                    >
                      {tier.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Archetype Filters */}
          <Text
            className="font-inter-medium text-xs mb-2 ml-1"
            style={{ color: colors['muted-foreground'] }}
          >
            Archetype
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            <View className="flex-row gap-2">
              {ARCHETYPES.map((arch) => {
                const isSelected = filters.archetypes.includes(arch.key);
                return (
                  <TouchableOpacity
                    key={arch.key}
                    onPress={() => toggleArchetype(arch.key)}
                    className="px-3 py-2 rounded-full flex-row items-center"
                    style={{
                      backgroundColor: isSelected
                        ? colors.primary + '20'
                        : isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                      borderWidth: isSelected ? 1 : 0,
                      borderColor: colors.primary,
                    }}
                  >
                    <ArchetypeIcon
                      archetype={arch.key}
                      size={14}
                      color={isSelected ? colors.primary : colors['muted-foreground']}
                    />
                    <Text
                      className="font-inter-medium text-sm ml-1.5"
                      style={{
                        color: isSelected ? colors.primary : colors.foreground
                      }}
                    >
                      {arch.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
}
