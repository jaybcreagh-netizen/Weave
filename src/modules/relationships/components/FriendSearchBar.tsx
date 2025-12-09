import React, { useState, useCallback, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, ScrollView, Text } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Search, X, ChevronDown, ChevronUp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/shared/hooks/useTheme';
import { ArchetypeIcon } from '@/components/ArchetypeIcon';
import { Archetype } from '@/modules/relationships/types';

// Health status based on weave score thresholds from FriendListRow
export type HealthStatus = 'thriving' | 'stable' | 'attention' | 'drifting';

export interface SearchFilters {
  healthStatus: HealthStatus[];
  archetypes: Archetype[];
}

interface FriendSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
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

export function FriendSearchBar({
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
  isActive,
  onFocus,
  onClear,
}: FriendSearchBarProps) {
  const { colors, isDarkMode } = useTheme();
  const [showFilters, setShowFilters] = useState(false);
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

  const hasActiveFilters = filters.healthStatus.length > 0 || filters.archetypes.length > 0;
  const activeFilterCount = filters.healthStatus.length + filters.archetypes.length;

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

  const clearAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLocalQuery('');
    onSearchChange('');
    onFiltersChange({ healthStatus: [], archetypes: [] });
    setShowFilters(false);
    onClear?.();
  }, [onSearchChange, onFiltersChange, onClear]);

  const toggleFilters = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowFilters(!showFilters);
  }, [showFilters]);

  const filterContainerStyle = useAnimatedStyle(() => ({
    height: withTiming(showFilters ? 'auto' : 0, { duration: 200 }),
    opacity: withTiming(showFilters ? 1 : 0, { duration: 200 }),
  }));

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
        {(localQuery.length > 0 || hasActiveFilters) && (
          <TouchableOpacity onPress={clearAll} className="ml-2 p-1">
            <X size={18} color={colors['muted-foreground']} />
          </TouchableOpacity>
        )}
      </View>

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
