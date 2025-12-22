import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Battery, Trophy, BookOpen, Users, Palette, Bell, Database, Wrench } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { StandardBottomSheet } from '@/shared/ui/Sheet';
import { CollapsibleSection } from '@/shared/ui/CollapsibleSection';

// Components
import { SettingsItem } from './settings/SettingsItem';
import { AppearanceSettings } from './settings/AppearanceSettings';
import { GeneralSettings } from './settings/GeneralSettings';
import { CalendarSettings } from './settings/CalendarSettings';
import { TestingSettings } from './settings/TestingSettings';
import { DataSettings } from './settings/DataSettings';
import { NotificationSettings } from './settings/NotificationSettings';

// Modals
import { TrophyCabinetModal } from '@/modules/gamification';
import { ArchetypeLibrary } from '@/modules/intelligence';
import { GroupListModal } from '@/modules/groups';
import { FriendManagementModal } from '@/modules/relationships';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenBatteryCheckIn?: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  onOpenBatteryCheckIn,
}: SettingsModalProps) {
  const { colors } = useTheme();
  const [showTrophyCabinet, setShowTrophyCabinet] = useState(false);
  const [showArchetypeLibrary, setShowArchetypeLibrary] = useState(false);
  const [showGroupList, setShowGroupList] = useState(false);
  const [showManageFriends, setShowManageFriends] = useState(false);

  if (!isOpen) return null;

  return (
    <StandardBottomSheet
      visible={isOpen}
      onClose={onClose}
      height="full"
      scrollable
      title="Settings"
    >
      <View style={{ paddingBottom: 40 }}>
        <View className="gap-2">

          {/* ═══════════════════════════════════════════════════════════════
              ESSENTIALS - Expanded by default
              Core features every user needs access to
          ═══════════════════════════════════════════════════════════════ */}
          <CollapsibleSection
            title="Essentials"
            icon={Palette}
            defaultExpanded={true}
          >
            {/* Theme Toggle */}
            <AppearanceSettings />

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            {/* Archetype Library */}
            <SettingsItem
              icon={BookOpen}
              title="Archetype Library"
              subtitle="Explore connection archetypes"
              onPress={() => setShowArchetypeLibrary(true)}
            />

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            {/* Manage Friends */}
            <SettingsItem
              icon={Users}
              title="Manage Friends"
              subtitle="Batch remove friends"
              onPress={() => setShowManageFriends(true)}
            />

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            {/* Manage Groups */}
            <SettingsItem
              icon={Users}
              title="Manage Groups"
              subtitle="Create and edit friend groups"
              onPress={() => setShowGroupList(true)}
            />

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            {/* Trophy Cabinet */}
            <SettingsItem
              icon={Trophy}
              title="Trophy Cabinet"
              subtitle="View your achievements"
              onPress={() => setShowTrophyCabinet(true)}
            />

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            {/* Social Battery Check-in */}
            {onOpenBatteryCheckIn && (
              <SettingsItem
                icon={Battery}
                title="Social Battery Check-in"
                subtitle="Update your social energy"
                onPress={() => {
                  onClose();
                  setTimeout(() => onOpenBatteryCheckIn(), 300);
                }}
              />
            )}

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            {/* General Settings (Smart Ordering, Feedback, Legal) */}
            <GeneralSettings onClose={onClose} />
          </CollapsibleSection>

          <View className="border-t border-border" style={{ borderColor: colors.border }} />

          {/* ═══════════════════════════════════════════════════════════════
              NOTIFICATIONS & SYNC - Collapsed by default
              Notification preferences and calendar sync
          ═══════════════════════════════════════════════════════════════ */}
          <CollapsibleSection
            title="Notifications & Sync"
            subtitle="Reminders, calendar, and alerts"
            icon={Bell}
            defaultExpanded={false}
          >
            {/* Calendar Integration */}
            <CalendarSettings />

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            {/* All Notification Settings */}
            <NotificationSettings />
          </CollapsibleSection>

          <View className="border-t border-border" style={{ borderColor: colors.border }} />

          {/* ═══════════════════════════════════════════════════════════════
              DATA & BACKUP - Collapsed by default
              Backup, restore, and data management
          ═══════════════════════════════════════════════════════════════ */}
          <CollapsibleSection
            title="Data & Backup"
            subtitle="Export, import, and sync"
            icon={Database}
            defaultExpanded={false}
          >
            <DataSettings onClose={onClose} />
          </CollapsibleSection>

          <View className="border-t border-border" style={{ borderColor: colors.border }} />

          {/* ═══════════════════════════════════════════════════════════════
              DEVELOPER TOOLS - Collapsed by default
              Debug and testing features
          ═══════════════════════════════════════════════════════════════ */}
          <CollapsibleSection
            title="Developer Tools"
            subtitle="Testing and diagnostics"
            icon={Wrench}
            defaultExpanded={false}
          >
            <TestingSettings onClose={onClose} />
          </CollapsibleSection>

        </View>
      </View>

      <View className="mt-6 pt-4 border-t pb-8" style={{ borderColor: colors.border }}>
        <Text className="text-center text-xs" style={{ color: colors['muted-foreground'] }}>
          Weave • Social Relationship Management
        </Text>
      </View>

      {/* Modals */}
      <TrophyCabinetModal
        visible={showTrophyCabinet}
        onClose={() => setShowTrophyCabinet(false)}
      />

      <ArchetypeLibrary
        isVisible={showArchetypeLibrary}
        onClose={() => setShowArchetypeLibrary(false)}
      />

      <GroupListModal
        visible={showGroupList}
        onClose={() => setShowGroupList(false)}
      />

      <FriendManagementModal
        visible={showManageFriends}
        onClose={() => setShowManageFriends(false)}
      />

    </StandardBottomSheet>
  );
}