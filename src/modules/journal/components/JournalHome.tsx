/**
 * JournalHome
 * 
 * Redesigned journal browser with dedicated modules:
 * - Feed (All entries)
 * - Reflections (Weekly analysis)
 * - Friend List
 * - Calendar
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BookOpen,
  Users,
  Calendar as CalendarIcon,
  Sparkles,
  Search,
} from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import JournalEntry from '@/db/models/JournalEntry';
import WeeklyReflection from '@/db/models/WeeklyReflection';
import { type Memory } from '@/modules/journal';
import * as Haptics from 'expo-haptics';

// Import newly extracted components
import { JournalFeed } from './Journal/JournalFeed';
import { JournalReflections } from './Journal/JournalReflections';
import { JournalFriendList } from './Journal/JournalFriendList';
import { JournalCalendar } from './Journal/JournalCalendar';

// ============================================================================
// TYPES
// ============================================================================

type Tab = 'all' | 'reflections' | 'friend' | 'calendar';

interface JournalHomeProps {
  onNewEntry: (mode: 'quick' | 'guided') => void;
  onEntryPress: (entry: JournalEntry | WeeklyReflection) => void;
  onFriendArcPress: (friendId: string) => void;
  onMemoryAction: (memory: Memory) => void;
  onClose?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function JournalHome({
  onNewEntry,
  onEntryPress,
  onFriendArcPress,
  onMemoryAction,
  onClose,
}: JournalHomeProps) {
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();

  // State
  const [activeTab, setActiveTab] = useState<Tab>('all');

  // ============================================================================
  // RENDER TABS
  // ============================================================================

  const renderTabs = () => (
    <View className="flex-row px-5 mb-4 gap-2">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {[
          { id: 'all' as Tab, label: 'Feed', icon: BookOpen },
          { id: 'reflections' as Tab, label: 'Reflections', icon: Sparkles },
          { id: 'friend' as Tab, label: 'Friends', icon: Users },
          { id: 'calendar' as Tab, label: 'Calendar', icon: CalendarIcon },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          const IconComponent = tab.icon;

          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab(tab.id);
              }}
              className="flex-row items-center gap-1.5 px-4 py-2 rounded-full"
              style={{
                backgroundColor: isActive ? colors.primary : colors.muted,
              }}
              activeOpacity={0.7}
            >
              <IconComponent
                size={16}
                color={isActive ? colors['primary-foreground'] : colors['muted-foreground']}
              />
              <Text
                className="text-sm"
                style={{
                  color: isActive ? colors['primary-foreground'] : colors['muted-foreground'],
                  fontFamily: 'Inter_500Medium',
                }}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  const renderContent = () => {
    switch (activeTab) {
      case 'all':
        return <JournalFeed onEntryPress={onEntryPress} />;
      case 'reflections':
        return (
          <JournalReflections
            onEntryPress={onEntryPress}
            onNewReflection={() => onNewEntry('guided')}
          />
        );
      case 'friend':
        return <JournalFriendList onFriendArcPress={onFriendArcPress} />;
      case 'calendar':
        return <JournalCalendar onEntryPress={onEntryPress} />;
      default:
        return null;
    }
  };

  return (
    <View
      className="flex-1"
      style={{
        backgroundColor: colors.background,
        paddingTop: insets.top,
      }}
    >
      {/* Header */}
      <View className="px-5 py-4 flex-row items-center justify-between">
        <Text
          className="text-3xl"
          style={{ color: colors.foreground, fontFamily: typography.fonts.serifBold }}
        >
          Journal
        </Text>

        {/* Actions */}
        <View className="flex-row gap-2">
          {/* Search (Placeholder for now, implementation inside sub-components or lifted state TBD) */}
          {/* Note: Original JournalHome had search. Moving search to strictly 'Feed' or specific tabs 
                 might be better, or keeping it global. For "Streamlined" initial pass, removing global search 
                 complexity from parent. Ideally Search should be its own modal or view. */}

          {onClose && (
            <TouchableOpacity
              onPress={onClose}
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.muted }}
            >
              <Text style={{ color: colors.foreground }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      {renderTabs()}

      {/* Content */}
      <View className="flex-1">
        {renderContent()}
      </View>

      {/* FAB for New Entry */}
      <View
        className="absolute bottom-6 right-6"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 4.65,
          elevation: 8,
        }}
      >
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onNewEntry('quick');
          }}
          className="w-14 h-14 rounded-full items-center justify-center"
          style={{ backgroundColor: colors.primary }}
        >
          <BookOpen size={24} color={colors['primary-foreground']} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Helper to make the ScrollView in renderTabs work
import { ScrollView } from 'react-native';
