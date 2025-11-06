import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, Switch, Alert, ScrollView } from 'react-native';
import { X, Moon, Sun, Palette, RefreshCw, Bug, BarChart3, Battery, Calendar as CalendarIcon, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useUIStore } from '../stores/uiStore';
import { getSuggestionAnalytics } from '../lib/suggestion-tracker';
import {
  getCalendarSettings,
  toggleCalendarIntegration,
  getAvailableCalendars,
  setPreferredCalendar,
  setReminderTime,
  requestCalendarPermissions,
  type CalendarSettings,
} from '../lib/calendar-service';
import { useTheme } from '../hooks/useTheme';
import { clearDatabase } from '../db';

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
  const insets = useSafeAreaInsets();
  const { isDarkMode, toggleDarkMode, showDebugScore, toggleShowDebugScore } = useUIStore();
  const { colors } = useTheme();
  const [shouldRender, setShouldRender] = useState(false);

  const sheetTranslateY = useSharedValue(800);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      sheetTranslateY.value = withSpring(0, { damping: 40, stiffness: 250 });
      backdropOpacity.value = withTiming(1, { duration: 300 });
    } else if (shouldRender) {
      sheetTranslateY.value = withTiming(800, { duration: 300 });
      backdropOpacity.value = withTiming(0, { duration: 250 }, (finished) => {
        if (finished) {
          runOnJS(setShouldRender)(false);
        }
      });
    }
  }, [isOpen, shouldRender]);

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  // Calendar settings state
  const [calendarSettings, setCalendarSettings] = useState<CalendarSettings>({
    enabled: false,
    calendarId: null,
    reminderMinutes: 60,
  });
  const [availableCalendars, setAvailableCalendars] = useState<any[]>([]);

  // Load calendar settings on mount
  useEffect(() => {
    if (isOpen) {
      loadCalendarSettings();
    }
  }, [isOpen]);

  const loadCalendarSettings = async () => {
    const settings = await getCalendarSettings();
    setCalendarSettings(settings);

    if (settings.enabled) {
      const calendars = await getAvailableCalendars();
      setAvailableCalendars(calendars);
    }
  };

  const handleToggleCalendar = async (enabled: boolean) => {
    if (enabled) {
      const hasPermission = await requestCalendarPermissions();
      if (!hasPermission) {
        return;
      }

      const calendars = await getAvailableCalendars();
      if (calendars.length === 0) {
        Alert.alert('No Calendars Found', 'No writable calendars were found on your device.', [{ text: 'OK' }]);
        return;
      }

      setAvailableCalendars(calendars);
    }

    await toggleCalendarIntegration(enabled);
    setCalendarSettings((prev) => ({ ...prev, enabled }));
  };

  const handleSelectCalendar = async () => {
    if (availableCalendars.length === 0) return;

    const buttons = availableCalendars.map((cal) => ({
      text: cal.title,
      onPress: async () => {
        await setPreferredCalendar(cal.id);
        setCalendarSettings((prev) => ({ ...prev, calendarId: cal.id }));
      },
    }));

    buttons.push({ text: 'Cancel', onPress: () => {}, style: 'cancel' } as any);

    Alert.alert('Select Calendar', 'Choose which calendar to use for planned weaves', buttons);
  };

  const handleResetDatabase = () => {
    Alert.alert(
      "Reset Database",
      "Are you sure? This will delete all your friends and interactions. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              await clearDatabase();
              onClose();
            } catch (error) {
              console.error('Failed to clear database:', error);
              Alert.alert('Error', 'Failed to clear database.');
            }
          },
        },
      ]
    );
  };

  const handleViewAnalytics = async () => {
    try {
      const analytics = await getSuggestionAnalytics();

      const typeBreakdown = Object.entries(analytics.byType)
        .map(([type, stats]) => `${type}: ${stats.acted}/${stats.shown} (${stats.conversionRate}%)`)
        .join('\n');

      Alert.alert(
        "📊 Suggestion Analytics",
        `Total shown: ${analytics.totalShown}\n` +
        `Total acted: ${analytics.totalActed}\n` +
        `Total dismissed: ${analytics.totalDismissed}\n` +
        `Conversion rate: ${analytics.conversionRate}%\n` +
        `Avg time to action: ${analytics.avgTimeToActionMinutes} min\n\n` +
        `By Type:\n${typeBreakdown || 'No data yet'}`,
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error('Failed to get analytics:', error);
      Alert.alert('Error', 'Failed to load analytics.');
    }
  };

  if (!shouldRender) return null;

  return (
    <Modal transparent visible={isOpen} onRequestClose={onClose} animationType="none">
      <Animated.View style={animatedBackdropStyle} className="absolute inset-0">
        <BlurView intensity={isDarkMode ? 40 : 20} className="absolute inset-0" />
        <TouchableOpacity className="absolute inset-0" activeOpacity={1} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          animatedSheetStyle,
          { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: insets.bottom + 20 },
        ]}
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl border-t p-6 shadow-2xl"
      >
        <View className="mb-6 flex-row items-center justify-between">
          <Text style={{ color: colors.foreground }} className="font-lora text-[22px] font-bold">Settings</Text>
          <TouchableOpacity onPress={onClose} className="p-2">
            <X size={24} color={colors['muted-foreground']} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <View className="gap-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-lg items-center justify-center" style={{ backgroundColor: colors.muted }}>
                  {isDarkMode ? <Moon color={colors.foreground} size={20} /> : <Sun color={colors.foreground} size={20} />}
                </View>
                <View>
                  <Text className="text-base font-inter-medium" style={{ color: colors.foreground }}>{isDarkMode ? "Dark Theme" : "Light Theme"}</Text>
                  <Text className="text-sm font-inter-regular" style={{ color: colors['muted-foreground'] }}>{isDarkMode ? "Mystic arcane theme" : "Warm cream theme"}</Text>
                </View>
              </View>
              <Switch
                value={isDarkMode}
                onValueChange={toggleDarkMode}
                trackColor={{ false: colors.muted, true: colors.primary }}
                thumbColor={colors.card}
              />
            </View>

            <View className="border-t border-border my-2" style={{ borderColor: colors.border }} />

            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-lg items-center justify-center" style={{ backgroundColor: colors.muted }}>
                  <Bug color={colors.foreground} size={20} />
                </View>
                <View>
                  <Text className="text-base font-inter-medium" style={{ color: colors.foreground }}>Show Weave Score</Text>
                  <Text className="text-sm font-inter-regular" style={{ color: colors['muted-foreground'] }}>Display score for debugging</Text>
                </View>
              </View>
              <Switch
                value={showDebugScore}
                onValueChange={toggleShowDebugScore}
                trackColor={{ false: colors.muted, true: colors.primary }}
                thumbColor={colors.card}
              />
            </View>

            {onOpenBatteryCheckIn && (
              <TouchableOpacity
                className="flex-row items-center justify-between"
                onPress={() => {
                  onClose();
                  setTimeout(() => onOpenBatteryCheckIn(), 300);
                }}
              >
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-lg items-center justify-center" style={{ backgroundColor: colors.muted }}>
                    <Battery color={colors.foreground} size={20} />
                  </View>
                  <View>
                    <Text className="text-base font-inter-medium" style={{ color: colors.foreground }}>Social Battery Check-in</Text>
                    <Text className="text-sm font-inter-regular" style={{ color: colors['muted-foreground'] }}>Update your social energy</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}

            <View className="border-t border-border my-2" style={{ borderColor: colors.border }} />

            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-lg items-center justify-center" style={{ backgroundColor: colors.muted }}>
                  <CalendarIcon color={colors.foreground} size={20} />
                </View>
                <View>
                  <Text className="text-base font-inter-medium" style={{ color: colors.foreground }}>Calendar Integration</Text>
                  <Text className="text-sm font-inter-regular" style={{ color: colors['muted-foreground'] }}>Add planned weaves to calendar</Text>
                </View>
              </View>
              <Switch
                value={calendarSettings.enabled}
                onValueChange={handleToggleCalendar}
                trackColor={{ false: colors.muted, true: colors.primary }}
                thumbColor={colors.card}
              />
            </View>

            {calendarSettings.enabled && availableCalendars.length > 0 && (
              <TouchableOpacity
                className="flex-row items-center justify-between pl-13"
                onPress={handleSelectCalendar}
              >
                <View>
                  <Text className="text-sm font-inter-medium" style={{ color: colors.foreground }}>Calendar</Text>
                  <Text className="text-xs font-inter-regular" style={{ color: colors['muted-foreground'] }}>
                    {availableCalendars.find((cal) => cal.id === calendarSettings.calendarId)?.title || 'Default'}
                  </Text>
                </View>
                <ChevronRight color={colors['muted-foreground']} size={20} />
              </TouchableOpacity>
            )}

            <View className="border-t border-border my-2" style={{ borderColor: colors.border }} />

            <TouchableOpacity
              className="flex-row items-center justify-between"
              onPress={handleViewAnalytics}
            >
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-lg items-center justify-center" style={{ backgroundColor: colors.muted }}>
                  <BarChart3 color={colors.foreground} size={20} />
                </View>
                <View>
                  <Text className="text-base font-inter-medium" style={{ color: colors.foreground }}>Suggestion Analytics</Text>
                  <Text className="text-sm font-inter-regular" style={{ color: colors['muted-foreground'] }}>View tracking data</Text>
                </View>
              </View>
            </TouchableOpacity>

            <View className="border-t border-border my-2" style={{ borderColor: colors.border }} />

            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-lg items-center justify-center" style={{ backgroundColor: colors.destructive + '1A' }}>
                  <RefreshCw color={colors.destructive} size={20} />
                </View>
                <View>
                  <Text className="text-base font-inter-medium" style={{ color: colors.foreground }}>Reset Database</Text>
                  <Text className="text-sm font-inter-regular" style={{ color: colors['muted-foreground'] }}>Clear all data and start fresh</Text>
                </View>
              </View>
              <TouchableOpacity onPress={handleResetDatabase} className="py-2 px-4 rounded-lg border" style={{ borderColor: colors.destructive + '33' }}>
                <Text className="font-inter-medium" style={{ color: colors.destructive }}>Reset</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <View className="mt-6 pt-4 border-t" style={{ borderColor: colors.border }}>
          <Text className="text-center text-xs" style={{ color: colors['muted-foreground'] }}>
            Weave • Social Relationship Management
          </Text>
        </View>
      </Animated.View>
    </Modal>
  );
}