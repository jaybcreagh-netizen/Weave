import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { X, Battery } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/shared/hooks/useTheme';
import { CustomBottomSheet } from '@/shared/ui/Sheet/BottomSheet';

// Components
import { SettingsItem } from './settings/SettingsItem';
import { AppearanceSettings } from './settings/AppearanceSettings';
import { GeneralSettings } from './settings/GeneralSettings';
import { CalendarSettings } from './settings/CalendarSettings';
import { TestingSettings } from './settings/TestingSettings';
import { DataSettings } from './settings/DataSettings';
import { NotificationSettings } from './settings/NotificationSettings';

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
  // CustomBottomSheet handles safe area internally or we might need bottom padding
  // But strictly speaking, CustomBottomSheet usually wraps content in a safe way.

  if (!isOpen) return null;

  return (
    <CustomBottomSheet
      visible={isOpen}
      onClose={onClose}
      snapPoints={['90%']}
      scrollable={true}
    >
      <View className="mb-6 px-6 pt-6 flex-row items-center justify-between">
        <Text style={{ color: colors.foreground }} className="font-lora text-[22px] font-bold">Settings</Text>
        <TouchableOpacity onPress={onClose} className="p-2">
          <X size={24} color={colors['muted-foreground']} />
        </TouchableOpacity>
      </View>

      <View style={{ paddingBottom: 40, paddingHorizontal: 24 }}>
        <View className="gap-4">

          {/* Appearance (Theme) */}
          <AppearanceSettings />

          <View className="border-t border-border" style={{ borderColor: colors.border }} />

          {/* Testing / Debug (Test Weekly Reflection, Test Badge) */}
          <TestingSettings onClose={onClose} />

          <View className="border-t border-border" style={{ borderColor: colors.border }} />

          {/* General (Groups, Feedback, Trophy, Archetype, Friends, Smart Defaults, Legal) */}
          <GeneralSettings onClose={onClose} />

          <View className="border-t border-border" style={{ borderColor: colors.border }} />

          {/* Social Battery Check-in (Optional Prop) */}
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

    </CustomBottomSheet>
  );
}