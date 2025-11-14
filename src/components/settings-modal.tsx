import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, Switch, Alert, ScrollView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { X, Moon, Sun, Palette, RefreshCw, Bug, BarChart3, Battery, Calendar as CalendarIcon, ChevronRight, Bell, Clock, Trophy, Sparkles, MessageSquare, Download, Upload, Database, Trash2, BookOpen, Users } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useUIStore } from '../stores/uiStore';
import { useUserProfileStore } from '../stores/userProfileStore';
import { getSuggestionAnalytics } from '../lib/suggestion-tracker';
import {
  getCalendarSettings,
  toggleCalendarIntegration,
  getAvailableCalendars,
  setPreferredCalendar,
  setReminderTime,
  requestCalendarPermissions,
  toggleTwoWaySync,
  type CalendarSettings,
} from '../lib/calendar-service';
import {
  scheduleWeeklyReflection,
  cancelWeeklyReflection,
  scheduleAllEventReminders,
  cancelAllNotifications,
} from '../lib/notification-manager-enhanced';
import {
  updateNotificationPreferences,
  getStoredNotificationPreferences,
  type NotificationPreferences,
} from '../lib/smart-notification-scheduler';
import { useTheme } from '../hooks/useTheme';
import { clearDatabase } from '../db';
import TrophyCabinetModal from './TrophyCabinetModal';
import { FeedbackModal } from './FeedbackModal';
import { ArchetypeLibrary } from './ArchetypeLibrary';
import { FriendManagementModal } from './FriendManagementModal';
import { exportAndShareData, getExportStats } from '../lib/data-export';
import { importData, getImportPreview } from '../lib/data-import';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { generateStressTestData, clearStressTestData, getDataStats } from '../lib/stress-test-seed-data';
import { useBackgroundSyncStore, getBackgroundFetchStatusLabel } from '../stores/backgroundSyncStore';
import type { BackgroundSyncSettings } from '../lib/background-event-sync';

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
  const { isDarkMode, toggleDarkMode, showDebugScore, toggleShowDebugScore, openTrophyCabinet } = useUIStore();
  const { profile, updateBatteryPreferences, updateProfile } = useUserProfileStore();
  const { colors } = useTheme();
  const [shouldRender, setShouldRender] = useState(false);

  const sheetTranslateY = useSharedValue(800);
  const backdropOpacity = useSharedValue(0);
  const gestureTranslateY = useSharedValue(0);

  // Pan gesture for swipe-to-dismiss
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      gestureTranslateY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if (event.translationY > 150) {
        runOnJS(onClose)();
      } else {
        gestureTranslateY.value = withSpring(0);
      }
    });

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      gestureTranslateY.value = 0;
      sheetTranslateY.value = withSpring(0, { damping: 40, stiffness: 250 });
      backdropOpacity.value = withTiming(1, { duration: 300 });
    } else if (shouldRender) {
      gestureTranslateY.value = 0;
      sheetTranslateY.value = withTiming(800, { duration: 300 });
      backdropOpacity.value = withTiming(0, { duration: 250 }, (finished) => {
        if (finished) {
          runOnJS(setShouldRender)(false);
        }
      });
    }
  }, [isOpen, shouldRender]);

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value + gestureTranslateY.value }],
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

  // Notification settings state
  const [batteryNotificationsEnabled, setBatteryNotificationsEnabled] = useState(false);
  const [batteryNotificationTime, setBatteryNotificationTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [weeklyReflectionEnabled, setWeeklyReflectionEnabled] = useState(true);
  const [reflectionAutoShow, setReflectionAutoShow] = useState(true);
  const [reflectionDay, setReflectionDay] = useState(0); // 0 = Sunday
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [eventRemindersEnabled, setEventRemindersEnabled] = useState(true);
  const [deepeningNudgesEnabled, setDeepeningNudgesEnabled] = useState(true);

  // Smart notification preferences
  const [smartNotificationsEnabled, setSmartNotificationsEnabled] = useState(true);
  const [notificationFrequency, setNotificationFrequency] = useState<'light' | 'moderate' | 'proactive'>('moderate');
  const [respectBattery, setRespectBattery] = useState(true);

  // Smart defaults preference
  const [smartDefaultsEnabled, setSmartDefaultsEnabled] = useState(true);

  // Trophy Cabinet state
  const [showTrophyCabinet, setShowTrophyCabinet] = useState(false);

  // Feedback modal state
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  // Archetype Library state
  const [showArchetypeLibrary, setShowArchetypeLibrary] = useState(false);

  // Friend Management state
  const [showFriendManagement, setShowFriendManagement] = useState(false);

  // Background sync store
  const {
    settings: backgroundSyncSettings,
    loadSettings: loadBackgroundSyncSettings,
    updateSettings: updateBackgroundSyncSettings,
    toggleEnabled: toggleBackgroundSync,
    backgroundFetchStatus,
  } = useBackgroundSyncStore();

  // Load settings on mount
  useEffect(() => {
    if (isOpen) {
      loadCalendarSettings();
      loadNotificationSettings();
      loadBackgroundSyncSettings();
    }
  }, [isOpen, profile]);

  const loadCalendarSettings = async () => {
    const settings = await getCalendarSettings();
    setCalendarSettings(settings);

    if (settings.enabled) {
      const calendars = await getAvailableCalendars();
      setAvailableCalendars(calendars);
    }
  };

  const loadNotificationSettings = async () => {
    if (!profile) return;

    // Load battery notification preferences
    const enabled = profile.batteryCheckinEnabled ?? true;
    setBatteryNotificationsEnabled(enabled);

    const timeStr = profile.batteryCheckinTime || '20:00';
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    setBatteryNotificationTime(date);

    // Load weekly reflection preferences
    const reflAutoShow = profile.reflectionAutoShow ?? true;
    setReflectionAutoShow(reflAutoShow);

    const reflDay = profile.reflectionDay ?? 0; // Default to Sunday
    setReflectionDay(reflDay);

    // Load event reminders preference
    const eventRemindersStr = await AsyncStorage.getItem('@weave:event_reminders_enabled');
    setEventRemindersEnabled(eventRemindersStr ? JSON.parse(eventRemindersStr) : true);

    // Load deepening nudges preference
    const deepeningNudgesStr = await AsyncStorage.getItem('@weave:deepening_nudges_enabled');
    setDeepeningNudgesEnabled(deepeningNudgesStr ? JSON.parse(deepeningNudgesStr) : true);

    // Load smart notification preferences
    const smartPrefs = await getStoredNotificationPreferences();
    setNotificationFrequency(smartPrefs.frequency);
    setRespectBattery(smartPrefs.respectBattery);

    // Load smart notifications enabled state
    const smartEnabledStr = await AsyncStorage.getItem('@weave:smart_notifications_enabled');
    setSmartNotificationsEnabled(smartEnabledStr ? JSON.parse(smartEnabledStr) : true);

    // Load smart defaults enabled state
    const smartDefaultsStr = await AsyncStorage.getItem('@weave:smart_defaults_enabled');
    setSmartDefaultsEnabled(smartDefaultsStr ? JSON.parse(smartDefaultsStr) : true);
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

  const handleToggleTwoWaySync = async (enabled: boolean) => {
    await toggleTwoWaySync(enabled);
    setCalendarSettings((prev) => ({ ...prev, twoWaySync: enabled }));
  };

  const handleToggleBackgroundSync = async (enabled: boolean) => {
    const success = await toggleBackgroundSync();
    if (!success && enabled) {
      Alert.alert(
        'Background Sync Unavailable',
        'Background sync could not be enabled. Make sure you have granted notification permissions and that Background App Refresh is enabled in your device settings.',
        [{ text: 'OK' }]
      );
    }
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

  const handleToggleBatteryNotifications = async (enabled: boolean) => {
    setBatteryNotificationsEnabled(enabled);

    const hours = batteryNotificationTime.getHours();
    const minutes = batteryNotificationTime.getMinutes();
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

    await updateBatteryPreferences(enabled, timeStr);
  };

  const handleTimeChange = async (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }

    if (selectedDate) {
      setBatteryNotificationTime(selectedDate);

      const hours = selectedDate.getHours();
      const minutes = selectedDate.getMinutes();
      const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

      if (batteryNotificationsEnabled) {
        await updateBatteryPreferences(true, timeStr);
      }
    }
  };

  const handleToggleWeeklyReflection = async (enabled: boolean) => {
    setWeeklyReflectionEnabled(enabled);

    if (enabled) {
      await scheduleWeeklyReflection();
    } else {
      await cancelWeeklyReflection();
    }
  };

  const handleToggleReflectionAutoShow = async (enabled: boolean) => {
    setReflectionAutoShow(enabled);
    await updateProfile({ reflectionAutoShow: enabled });
  };

  const handleChangeReflectionDay = async (day: number) => {
    setReflectionDay(day);
    await updateProfile({ reflectionDay: day });
    setShowDayPicker(false);
  };

  const handleToggleEventReminders = async (enabled: boolean) => {
    setEventRemindersEnabled(enabled);
    // Store preference (event reminders will check this when scheduling)
    await AsyncStorage.setItem('@weave:event_reminders_enabled', JSON.stringify(enabled));

    if (enabled) {
      await scheduleAllEventReminders();
    }
  };

  const handleToggleDeepeningNudges = async (enabled: boolean) => {
    setDeepeningNudgesEnabled(enabled);
    // Store preference (deepening nudges will check this when scheduling)
    await AsyncStorage.setItem('@weave:deepening_nudges_enabled', JSON.stringify(enabled));
  };

  const handleToggleSmartNotifications = async (enabled: boolean) => {
    setSmartNotificationsEnabled(enabled);
    await AsyncStorage.setItem('@weave:smart_notifications_enabled', JSON.stringify(enabled));
  };

  const handleToggleSmartDefaults = async (enabled: boolean) => {
    setSmartDefaultsEnabled(enabled);
    await AsyncStorage.setItem('@weave:smart_defaults_enabled', JSON.stringify(enabled));
  };

  const handleChangeFrequency = async (frequency: 'light' | 'moderate' | 'proactive') => {
    setNotificationFrequency(frequency);
    await updateNotificationPreferences({ frequency });
  };

  const handleToggleRespectBattery = async (enabled: boolean) => {
    setRespectBattery(enabled);
    await updateNotificationPreferences({ respectBattery: enabled });
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

  const handleExportData = async () => {
    try {
      const stats = await getExportStats();
      Alert.alert(
        'Export Data',
        `Export your data for backup or analysis.\n\nFriends: ${stats.totalFriends}\nInteractions: ${stats.totalInteractions}\nEstimated size: ${stats.estimatedSizeKB}KB`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Export',
            onPress: async () => {
              try {
                await exportAndShareData();
              } catch (error) {
                console.error('Export failed:', error);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Failed to prepare export:', error);
      Alert.alert('Error', 'Failed to prepare data export.');
    }
  };

  const handleImportData = async () => {
    try {
      // Pick a document
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const fileUri = result.assets[0].uri;
      console.log('[Settings] Selected file:', fileUri);

      // Read the file
      const fileContent = await FileSystem.readAsStringAsync(fileUri);

      // Get preview
      const preview = getImportPreview(fileContent);

      if (!preview.valid) {
        Alert.alert('Invalid File', preview.error || 'The selected file is not a valid Weave export.');
        return;
      }

      // Show confirmation with preview
      Alert.alert(
        'Import Data',
        `This will restore your data from the backup:\n\n` +
        `Export Date: ${new Date(preview.preview!.exportDate).toLocaleDateString()}\n` +
        `Friends: ${preview.preview!.totalFriends}\n` +
        `Interactions: ${preview.preview!.totalInteractions}\n\n` +
        `⚠️ WARNING: This will DELETE all your current data and replace it with the backup.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import',
            style: 'destructive',
            onPress: async () => {
              try {
                // Show loading
                Alert.alert('Importing...', 'Please wait while we restore your data.');

                const result = await importData(fileContent, true);

                if (result.success) {
                  Alert.alert(
                    'Import Successful!',
                    `Your data has been restored:\n\n` +
                    `${result.friendsImported} friends imported\n` +
                    `${result.interactionsImported} interactions imported\n\n` +
                    `Please restart the app to see your restored data.`,
                    [
                      {
                        text: 'OK',
                        onPress: () => {
                          onClose();
                        },
                      },
                    ]
                  );
                } else {
                  Alert.alert(
                    'Import Failed',
                    `Failed to import data:\n\n${result.errors.join('\n')}`,
                    [{ text: 'OK' }]
                  );
                }
              } catch (error) {
                console.error('Import failed:', error);
                Alert.alert('Import Failed', 'An error occurred while importing data.');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Failed to import data:', error);
      Alert.alert('Error', 'Failed to read the selected file.');
    }
  };

  const handleGenerateStressTest = () => {
    Alert.alert(
      'Generate Stress Test Data',
      'This will create 100 test friends with 5 interactions each for performance testing. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          onPress: async () => {
            try {
              await generateStressTestData(100, 5);
              const stats = await getDataStats();
              Alert.alert(
                'Stress Test Data Generated',
                `Created ${stats.stressTestFriends} test friends!\n\nTotal friends: ${stats.totalFriends}\nTotal interactions: ${stats.totalInteractions}`,
                [{ text: 'OK' }]
              );
            } catch (error) {
              console.error('Failed to generate stress test data:', error);
              Alert.alert('Error', 'Failed to generate stress test data.');
            }
          },
        },
      ]
    );
  };

  const handleClearStressTest = async () => {
    try {
      const stats = await getDataStats();
      if (stats.stressTestFriends === 0) {
        Alert.alert('No Stress Test Data', 'There is no stress test data to clear.');
        return;
      }

      Alert.alert(
        'Clear Stress Test Data',
        `This will remove ${stats.stressTestFriends} test friends and their interactions. Continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clear',
            style: 'destructive',
            onPress: async () => {
              try {
                await clearStressTestData();
                Alert.alert('Cleared', 'Stress test data has been removed.', [{ text: 'OK' }]);
              } catch (error) {
                console.error('Failed to clear stress test data:', error);
                Alert.alert('Error', 'Failed to clear stress test data.');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Failed to check stress test data:', error);
      Alert.alert('Error', 'Failed to check stress test data.');
    }
  };

  if (!shouldRender) return null;

  return (
    <Modal transparent visible={isOpen} onRequestClose={onClose} animationType="none">
      <Animated.View style={animatedBackdropStyle} className="absolute inset-0">
        <BlurView intensity={isDarkMode ? 40 : 20} className="absolute inset-0" />
        <TouchableOpacity className="absolute inset-0" activeOpacity={1} onPress={onClose} />
      </Animated.View>

      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            animatedSheetStyle,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              paddingBottom: insets.bottom + 20,
              maxHeight: '90%',
            },
          ]}
          className="absolute bottom-0 left-0 right-0 rounded-t-3xl border-t p-6 shadow-2xl"
        >
        <View className="mb-6 flex-row items-center justify-between">
          <Text style={{ color: colors.foreground }} className="font-lora text-[22px] font-bold">Settings</Text>
          <TouchableOpacity onPress={onClose} className="p-2">
            <X size={24} color={colors['muted-foreground']} />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
          bounces={true}
        >
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

            <View className="border-t border-border my-2" style={{ borderColor: colors.border }} />

            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-lg items-center justify-center" style={{ backgroundColor: colors.muted }}>
                  <Sparkles color={colors.foreground} size={20} />
                </View>
                <View>
                  <Text className="text-base font-inter-medium" style={{ color: colors.foreground }}>Smart Activity Ordering</Text>
                  <Text className="text-sm font-inter-regular" style={{ color: colors['muted-foreground'] }}>
                    Reorder activities by time of day & context
                  </Text>
                </View>
              </View>
              <Switch
                value={smartDefaultsEnabled}
                onValueChange={handleToggleSmartDefaults}
                trackColor={{ false: colors.muted, true: colors.primary }}
                thumbColor={colors.card}
              />
            </View>

            <View className="border-t border-border my-2" style={{ borderColor: colors.border }} />

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

            {calendarSettings.enabled && (
              <View className="flex-row items-center justify-between pl-13 mt-3">
                <View className="flex-1">
                  <Text className="text-sm font-inter-medium" style={{ color: colors.foreground }}>Two-Way Sync</Text>
                  <Text className="text-xs font-inter-regular" style={{ color: colors['muted-foreground'] }}>
                    Detect and sync changes made in calendar app
                  </Text>
                </View>
                <Switch
                  value={calendarSettings.twoWaySync}
                  onValueChange={handleToggleTwoWaySync}
                  trackColor={{ false: colors.muted, true: colors.primary }}
                  thumbColor={colors.card}
                />
              </View>
            )}

            {calendarSettings.enabled && calendarSettings.twoWaySync && (
              <View className="flex-row items-center justify-between pl-13 mt-3">
                <View className="flex-1">
                  <Text className="text-sm font-inter-medium" style={{ color: colors.foreground }}>
                    Ambient Event Logging
                  </Text>
                  <Text className="text-xs font-inter-regular" style={{ color: colors['muted-foreground'] }}>
                    Daily background scan for past calendar events with friends
                  </Text>
                  {backgroundSyncSettings.enabled && backgroundSyncSettings.lastSyncTimestamp && (
                    <Text className="text-xs font-inter-regular mt-1" style={{ color: colors['muted-foreground'] }}>
                      Last sync: {new Date(backgroundSyncSettings.lastSyncTimestamp).toLocaleString()}
                    </Text>
                  )}
                </View>
                <Switch
                  value={backgroundSyncSettings.enabled}
                  onValueChange={handleToggleBackgroundSync}
                  trackColor={{ false: colors.muted, true: colors.primary }}
                  thumbColor={colors.card}
                />
              </View>
            )}

            <View className="border-t border-border my-2" style={{ borderColor: colors.border }} />

            {/* Notifications Section */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-lg items-center justify-center" style={{ backgroundColor: colors.muted }}>
                  <Bell color={colors.foreground} size={20} />
                </View>
                <View>
                  <Text className="text-base font-inter-medium" style={{ color: colors.foreground }}>Daily Battery Reminder</Text>
                  <Text className="text-sm font-inter-regular" style={{ color: colors['muted-foreground'] }}>Check in with your energy</Text>
                </View>
              </View>
              <Switch
                value={batteryNotificationsEnabled}
                onValueChange={handleToggleBatteryNotifications}
                trackColor={{ false: colors.muted, true: colors.primary }}
                thumbColor={colors.card}
              />
            </View>

            {batteryNotificationsEnabled && (
              <TouchableOpacity
                className="flex-row items-center justify-between pl-13"
                onPress={() => setShowTimePicker(true)}
              >
                <View>
                  <Text className="text-sm font-inter-medium" style={{ color: colors.foreground }}>Reminder Time</Text>
                  <Text className="text-xs font-inter-regular" style={{ color: colors['muted-foreground'] }}>
                    {batteryNotificationTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                  </Text>
                </View>
                <Clock color={colors['muted-foreground']} size={20} />
              </TouchableOpacity>
            )}

            {showTimePicker && Platform.OS === 'ios' && (
              <Modal transparent animationType="slide">
                <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                  <View style={{ backgroundColor: colors.card }} className="rounded-t-3xl p-4">
                    <View className="flex-row justify-between items-center mb-4">
                      <Text className="text-lg font-inter-semibold" style={{ color: colors.foreground }}>
                        Select Time
                      </Text>
                      <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                        <Text className="text-base font-inter-medium" style={{ color: colors.primary }}>
                          Done
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <DateTimePicker
                      value={batteryNotificationTime}
                      mode="time"
                      is24Hour={false}
                      display="spinner"
                      onChange={handleTimeChange}
                      textColor={colors.foreground}
                    />
                  </View>
                </View>
              </Modal>
            )}

            {showTimePicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={batteryNotificationTime}
                mode="time"
                is24Hour={false}
                display="default"
                onChange={handleTimeChange}
              />
            )}

            <View className="border-t border-border my-2" style={{ borderColor: colors.border }} />

            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-lg items-center justify-center" style={{ backgroundColor: colors.muted }}>
                  <BookOpen color={colors.foreground} size={20} />
                </View>
                <View>
                  <Text className="text-base font-inter-medium" style={{ color: colors.foreground }}>Weekly Reflection</Text>
                  <Text className="text-sm font-inter-regular" style={{ color: colors['muted-foreground'] }}>Notifications enabled</Text>
                </View>
              </View>
              <Switch
                value={weeklyReflectionEnabled}
                onValueChange={handleToggleWeeklyReflection}
                trackColor={{ false: colors.muted, true: colors.primary }}
                thumbColor={colors.card}
              />
            </View>

            {weeklyReflectionEnabled && (
              <>
                <TouchableOpacity
                  className="flex-row items-center justify-between pl-13 mt-3"
                  onPress={() => setShowDayPicker(true)}
                >
                  <View>
                    <Text className="text-sm font-inter-medium" style={{ color: colors.foreground }}>Reflection Day</Text>
                    <Text className="text-xs font-inter-regular" style={{ color: colors['muted-foreground'] }}>
                      {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][reflectionDay]}
                    </Text>
                  </View>
                  <ChevronRight color={colors['muted-foreground']} size={20} />
                </TouchableOpacity>

                <View className="flex-row items-center justify-between pl-13 mt-3">
                  <View className="flex-1">
                    <Text className="text-sm font-inter-medium" style={{ color: colors.foreground }}>Auto-show Prompt</Text>
                    <Text className="text-xs font-inter-regular" style={{ color: colors['muted-foreground'] }}>
                      Automatically show on reflection day
                    </Text>
                  </View>
                  <Switch
                    value={reflectionAutoShow}
                    onValueChange={handleToggleReflectionAutoShow}
                    trackColor={{ false: colors.muted, true: colors.primary }}
                    thumbColor={colors.card}
                  />
                </View>
              </>
            )}

            {showDayPicker && (
              <Modal transparent animationType="slide">
                <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                  <View style={{ backgroundColor: colors.card }} className="rounded-t-3xl p-4">
                    <View className="flex-row justify-between items-center mb-4">
                      <Text className="text-lg font-inter-semibold" style={{ color: colors.foreground }}>
                        Select Reflection Day
                      </Text>
                      <TouchableOpacity onPress={() => setShowDayPicker(false)}>
                        <Text className="text-base font-inter-medium" style={{ color: colors.primary }}>
                          Done
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => (
                      <TouchableOpacity
                        key={day}
                        onPress={() => handleChangeReflectionDay(index)}
                        className="py-4 border-b"
                        style={{ borderBottomColor: colors.border }}
                      >
                        <View className="flex-row justify-between items-center">
                          <Text
                            className="text-base"
                            style={{ color: index === reflectionDay ? colors.primary : colors.foreground, fontFamily: 'Inter_500Medium' }}
                          >
                            {day}
                          </Text>
                          {index === reflectionDay && (
                            <Text style={{ color: colors.primary }}>✓</Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </Modal>
            )}

            <View className="border-t border-border my-2" style={{ borderColor: colors.border }} />

            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-lg items-center justify-center" style={{ backgroundColor: colors.muted }}>
                  <Bell color={colors.foreground} size={20} />
                </View>
                <View>
                  <Text className="text-base font-inter-medium" style={{ color: colors.foreground }}>Event Reminders</Text>
                  <Text className="text-sm font-inter-regular" style={{ color: colors['muted-foreground'] }}>1-hour before planned weaves</Text>
                </View>
              </View>
              <Switch
                value={eventRemindersEnabled}
                onValueChange={handleToggleEventReminders}
                trackColor={{ false: colors.muted, true: colors.primary }}
                thumbColor={colors.card}
              />
            </View>

            <View className="border-t border-border my-2" style={{ borderColor: colors.border }} />

            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-lg items-center justify-center" style={{ backgroundColor: colors.muted }}>
                  <Bell color={colors.foreground} size={20} />
                </View>
                <View>
                  <Text className="text-base font-inter-medium" style={{ color: colors.foreground }}>Deepening Nudges</Text>
                  <Text className="text-sm font-inter-regular" style={{ color: colors['muted-foreground'] }}>Post-weave reflection prompts</Text>
                </View>
              </View>
              <Switch
                value={deepeningNudgesEnabled}
                onValueChange={handleToggleDeepeningNudges}
                trackColor={{ false: colors.muted, true: colors.primary }}
                thumbColor={colors.card}
              />
            </View>

            <View className="border-t border-border my-2" style={{ borderColor: colors.border }} />

            {/* Smart Suggestions Section */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-lg items-center justify-center" style={{ backgroundColor: colors.muted }}>
                  <Bell color={colors.foreground} size={20} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-inter-medium" style={{ color: colors.foreground }}>Smart Suggestions</Text>
                  <Text className="text-sm font-inter-regular" style={{ color: colors['muted-foreground'] }}>
                    Intelligent nudges based on your social battery
                  </Text>
                </View>
              </View>
              <Switch
                value={smartNotificationsEnabled}
                onValueChange={handleToggleSmartNotifications}
                trackColor={{ false: colors.muted, true: colors.primary }}
                thumbColor={colors.card}
              />
            </View>

            {smartNotificationsEnabled && (
              <>
                {/* Notification Frequency */}
                <View className="pl-13 mt-3">
                  <Text className="text-sm font-inter-medium mb-2" style={{ color: colors.foreground }}>
                    Frequency
                  </Text>
                  <View className="flex-row gap-2">
                    {(['light', 'moderate', 'proactive'] as const).map((freq) => (
                      <TouchableOpacity
                        key={freq}
                        onPress={() => handleChangeFrequency(freq)}
                        className="flex-1 py-2 px-3 rounded-lg"
                        style={{
                          backgroundColor: notificationFrequency === freq ? colors.primary : colors.muted,
                        }}
                      >
                        <Text
                          className="text-sm font-inter-medium text-center capitalize"
                          style={{
                            color: notificationFrequency === freq ? colors.card : colors['muted-foreground'],
                          }}
                        >
                          {freq}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text className="text-xs font-inter-regular mt-1" style={{ color: colors['muted-foreground'] }}>
                    {notificationFrequency === 'light' && 'Max 1 suggestion per day'}
                    {notificationFrequency === 'moderate' && 'Max 2 suggestions per day'}
                    {notificationFrequency === 'proactive' && 'Max 4 suggestions per day'}
                  </Text>
                </View>

                {/* Respect Battery Level */}
                <View className="flex-row items-center justify-between pl-13 mt-3">
                  <View className="flex-1">
                    <Text className="text-sm font-inter-medium" style={{ color: colors.foreground }}>
                      Respect Social Battery
                    </Text>
                    <Text className="text-xs font-inter-regular" style={{ color: colors['muted-foreground'] }}>
                      Reduce notifications when energy is low
                    </Text>
                  </View>
                  <Switch
                    value={respectBattery}
                    onValueChange={handleToggleRespectBattery}
                    trackColor={{ false: colors.muted, true: colors.primary }}
                    thumbColor={colors.card}
                  />
                </View>
              </>
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

            <TouchableOpacity
              className="flex-row items-center justify-between"
              onPress={() => {
                onClose();
                setTimeout(() => setShowFeedbackModal(true), 300);
              }}
            >
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-lg items-center justify-center" style={{ backgroundColor: colors.muted }}>
                  <MessageSquare color={colors.foreground} size={20} />
                </View>
                <View>
                  <Text className="text-base font-inter-medium" style={{ color: colors.foreground }}>Send Feedback</Text>
                  <Text className="text-sm font-inter-regular" style={{ color: colors['muted-foreground'] }}>Report bugs or share ideas</Text>
                </View>
              </View>
            </TouchableOpacity>

            <View className="border-t border-border my-2" style={{ borderColor: colors.border }} />

            <TouchableOpacity
              className="flex-row items-center justify-between"
              onPress={() => {
                onClose();
                setTimeout(() => openTrophyCabinet(), 300);
              }}
            >
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-lg items-center justify-center" style={{ backgroundColor: colors.muted }}>
                  <Trophy color={colors.foreground} size={20} />
                </View>
                <View>
                  <Text className="text-base font-inter-medium" style={{ color: colors.foreground }}>Trophy Cabinet</Text>
                  <Text className="text-sm font-inter-regular" style={{ color: colors['muted-foreground'] }}>View your achievements</Text>
                </View>
              </View>
            </TouchableOpacity>

            <View className="border-t border-border my-2" style={{ borderColor: colors.border }} />

            <TouchableOpacity
              className="flex-row items-center justify-between"
              onPress={() => {
                onClose();
                setTimeout(() => setShowArchetypeLibrary(true), 300);
              }}
            >
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-lg items-center justify-center" style={{ backgroundColor: colors.muted }}>
                  <BookOpen color={colors.foreground} size={20} />
                </View>
                <View>
                  <Text className="text-base font-inter-medium" style={{ color: colors.foreground }}>Archetype Library</Text>
                  <Text className="text-sm font-inter-regular" style={{ color: colors['muted-foreground'] }}>Explore connection archetypes</Text>
                </View>
              </View>
            </TouchableOpacity>

            <View className="border-t border-border my-2" style={{ borderColor: colors.border }} />

            <TouchableOpacity
              className="flex-row items-center justify-between"
              onPress={() => setShowFriendManagement(true)}
            >
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-lg items-center justify-center" style={{ backgroundColor: colors.muted }}>
                  <Users color={colors.foreground} size={20} />
                </View>
                <View>
                  <Text className="text-base font-inter-medium" style={{ color: colors.foreground }}>Manage Friends</Text>
                  <Text className="text-sm font-inter-regular" style={{ color: colors['muted-foreground'] }}>Batch remove friends</Text>
                </View>
              </View>
            </TouchableOpacity>

            <View className="border-t border-border my-2" style={{ borderColor: colors.border }} />

            {/* Data Export */}
            <TouchableOpacity
              className="flex-row items-center justify-between"
              onPress={handleExportData}
            >
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-lg items-center justify-center" style={{ backgroundColor: colors.muted }}>
                  <Download color={colors.foreground} size={20} />
                </View>
                <View>
                  <Text className="text-base font-inter-medium" style={{ color: colors.foreground }}>Export Data</Text>
                  <Text className="text-sm font-inter-regular" style={{ color: colors['muted-foreground'] }}>Backup your data as JSON</Text>
                </View>
              </View>
            </TouchableOpacity>

            <View className="border-t border-border my-2" style={{ borderColor: colors.border }} />

            {/* Data Import */}
            <TouchableOpacity
              className="flex-row items-center justify-between"
              onPress={handleImportData}
            >
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-lg items-center justify-center" style={{ backgroundColor: colors.muted }}>
                  <Upload color={colors.foreground} size={20} />
                </View>
                <View>
                  <Text className="text-base font-inter-medium" style={{ color: colors.foreground }}>Import Data</Text>
                  <Text className="text-sm font-inter-regular" style={{ color: colors['muted-foreground'] }}>Restore from backup file</Text>
                </View>
              </View>
            </TouchableOpacity>

            <View className="border-t border-border my-2" style={{ borderColor: colors.border }} />

            {/* Debug Section Title */}
            <Text className="text-xs font-inter-semibold uppercase tracking-wide mb-2" style={{ color: colors['muted-foreground'] }}>
              Debug Tools
            </Text>

            {/* Stress Test - Generate */}
            <TouchableOpacity
              className="flex-row items-center justify-between"
              onPress={handleGenerateStressTest}
            >
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-lg items-center justify-center" style={{ backgroundColor: colors.muted }}>
                  <Database color={colors.foreground} size={20} />
                </View>
                <View>
                  <Text className="text-base font-inter-medium" style={{ color: colors.foreground }}>Generate Test Data</Text>
                  <Text className="text-sm font-inter-regular" style={{ color: colors['muted-foreground'] }}>Create 100 test friends</Text>
                </View>
              </View>
            </TouchableOpacity>

            <View className="border-t border-border my-2" style={{ borderColor: colors.border }} />

            {/* Stress Test - Clear */}
            <TouchableOpacity
              className="flex-row items-center justify-between"
              onPress={handleClearStressTest}
            >
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-lg items-center justify-center" style={{ backgroundColor: colors.muted }}>
                  <Trash2 color={colors.foreground} size={20} />
                </View>
                <View>
                  <Text className="text-base font-inter-medium" style={{ color: colors.foreground }}>Clear Test Data</Text>
                  <Text className="text-sm font-inter-regular" style={{ color: colors['muted-foreground'] }}>Remove stress test friends</Text>
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
      </GestureDetector>

      <TrophyCabinetModal
        visible={showTrophyCabinet}
        onClose={() => setShowTrophyCabinet(false)}
      />

      <FeedbackModal
        visible={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
      />

      <ArchetypeLibrary
        isVisible={showArchetypeLibrary}
        onClose={() => setShowArchetypeLibrary(false)}
      />

      <FriendManagementModal
        visible={showFriendManagement}
        onClose={() => setShowFriendManagement(false)}
      />
    </Modal>
  );
}