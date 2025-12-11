import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Battery, Trophy, BookOpen, Users } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { StandardBottomSheet } from '@/shared/ui/Sheet';

// Components
import { SettingsItem } from './settings/SettingsItem';
import { AppearanceSettings } from './settings/AppearanceSettings';
import { GeneralSettings } from './settings/GeneralSettings';
import { CalendarSettings } from './settings/CalendarSettings';
import { TestingSettings } from './settings/TestingSettings';
import { DataSettings } from './settings/DataSettings';
import { NotificationSettings } from './settings/NotificationSettings';

// Modals
import TrophyCabinetModal from './TrophyCabinetModal';
import { ArchetypeLibrary } from './ArchetypeLibrary';
import { FriendManagementModal } from './FriendManagementModal';
import { GroupListModal } from './groups/GroupListModal';

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
  const [showFriendManagement, setShowFriendManagement] = useState(false);
  const [showGroupList, setShowGroupList] = useState(false);

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
        <View className="gap-4">

          {/* Appearance (Theme) */}
          <AppearanceSettings />

          <View className="border-t border-border" style={{ borderColor: colors.border }} />

          {/* Vital Features (Archetype, Friends, Trophy, Battery) */}
          <SettingsItem
            icon={BookOpen}
            title="Archetype Library"
            subtitle="Explore connection archetypes"
            onPress={() => setShowArchetypeLibrary(true)}
          />

          <View className="border-t border-border" style={{ borderColor: colors.border }} />

          <SettingsItem
            icon={Users}
            title="Manage Friends"
            subtitle="Batch remove friends"
            onPress={() => setShowFriendManagement(true)}
          />

          <View className="border-t border-border" style={{ borderColor: colors.border }} />

          <SettingsItem
            icon={Users}
            title="Manage Groups"
            subtitle="Create and edit friend groups"
            onPress={() => setShowGroupList(true)}
          />

          <View className="border-t border-border" style={{ borderColor: colors.border }} />

          <SettingsItem
            icon={Trophy}
            title="Trophy Cabinet"
            subtitle="View your achievements"
            onPress={() => setShowTrophyCabinet(true)}
          />

          <View className="border-t border-border" style={{ borderColor: colors.border }} />

          {/* Social Battery Check-in */}
          {onOpenBatteryCheckIn && (
            <>
              <SettingsItem
                icon={Battery}
                title="Social Battery Check-in"
                subtitle="Update your social energy"
                onPress={() => {
                  onClose();
                  setTimeout(() => onOpenBatteryCheckIn(), 300);
                }}
              />
              <View className="border-t border-border" style={{ borderColor: colors.border }} />
            </>
          )}

          {/* Testing / Debug Loop */}
          <TestingSettings onClose={onClose} />

          <View className="border-t border-border" style={{ borderColor: colors.border }} />

          {/* General (Groups, Feedback, Smart Defaults, Legal) */}
          <GeneralSettings
            onClose={onClose}
          />

          <View className="border-t border-border" style={{ borderColor: colors.border }} />

          {/* Calendar */}
          <CalendarSettings />

          <View className="border-t border-border" style={{ borderColor: colors.border }} />

          {/* Data (Backup, Restore, Export, Import) */}
          <DataSettings onClose={onClose} />

          <View className="border-t border-border" style={{ borderColor: colors.border }} />

          {/* Notifications (Battery, Reflection, Digest, etc) */}
          <NotificationSettings />

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

      <FriendManagementModal
        visible={showFriendManagement}
        onClose={() => setShowFriendManagement(false)}
      />

      <GroupListModal
        visible={showGroupList}
        onClose={() => setShowGroupList(false)}
      />

    </StandardBottomSheet>
  );
}