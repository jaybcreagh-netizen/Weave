import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { Battery, Trophy, BookOpen, Users, Palette, Bell, Database, Wrench, Inbox } from 'lucide-react-native';
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
import { AccountSettings } from './settings/AccountSettings';
import { FeatureFlags } from '@/shared/config/feature-flags';
import { ActivityInboxSheet, usePendingWeaves, useActivityCounts } from '@/modules/sync'; // Added useActivityCounts
import { getPendingRequestCount } from '@/modules/relationships/services/friend-linking.service';

// Modals
import { TrophyCabinetModal } from '@/modules/gamification';
import { ArchetypeLibrary } from '@/modules/intelligence/components/archetypes/ArchetypeLibrary';
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

  const [showActivityInbox, setShowActivityInbox] = useState(false);

  // Use shared hook for counts
  const { totalPendingCount, refreshCounts } = useActivityCounts();

  // pendingWeaves is no longer used directly here, unless for other reasons?
  // It was only used for count.
  // Wait, I need to remove usePendingWeaves from the top if not used? 
  // Ah, the hook useActivityCounts uses usePendingWeaves internally.
  // I can remove the unused imports later or let lint catch it.
  // But wait, line 48 was `const { pendingWeaves } = usePendingWeaves();`
  // I am deleting it.

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
              ACCOUNT HEADER - Prominent profile/sign-in at top (if accounts enabled)
          ═══════════════════════════════════════════════════════════════ */}
          {FeatureFlags.ACCOUNTS_ENABLED && (
            <>
              <AccountSettings
                onClose={onClose}
                onOpenAuth={() => {
                  onClose();
                  setTimeout(() => router.push('/onboarding-auth?source=settings'), 300);
                }}
              />

              <View className="border-t border-border my-2" style={{ borderColor: colors.border }} />

              {/* Activity Inbox */}
              <SettingsItem
                icon={Inbox}
                title="Activity"
                subtitle="Link requests & shared weaves"
                onPress={() => setShowActivityInbox(true)}
                badge={totalPendingCount > 0 ? totalPendingCount : undefined}
              />

              <View className="border-t border-border my-2" style={{ borderColor: colors.border }} />
            </>
          )}

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

      <ActivityInboxSheet
        visible={showActivityInbox}
        onClose={() => setShowActivityInbox(false)}
        onRequestHandled={refreshCounts}
      />

    </StandardBottomSheet>
  );
}