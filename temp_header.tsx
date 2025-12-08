import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, Alert, ScrollView, Platform, LayoutAnimation } from 'react-native';
import { router } from 'expo-router';
import { format } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { X, Moon, Sun, Palette, RefreshCw, Bug, BarChart3, Battery, Calendar as CalendarIcon, ChevronRight, Bell, Clock, Trophy, Sparkles, MessageSquare, Download, Upload, Database, Trash2, BookOpen, Users, Shield, FileText, Star } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useUIStore } from '../stores/uiStore';
import { useUserProfileStore } from '@/modules/auth';
import { CalendarService } from '@/modules/interactions';
import {
  exportAndShareData,
  getExportStats,
  getImportPreview,
  importData,
  useBackgroundSyncStore,
  getBackgroundSyncSettings,
  saveBackgroundSyncSettings
} from '@/modules/auth';
import { SuggestionTrackerService } from '@/modules/interactions';
import {
  WeeklyReflectionChannel,
  EventReminderChannel,
  EveningDigestChannel,
  notificationStore,
  type NotificationPreferences,
} from '@/modules/notifications';
import { useTheme } from '@/shared/hooks/useTheme';
import { clearDatabase } from '@/db';
import TrophyCabinetModal from './TrophyCabinetModal';
import { FeedbackModal } from './FeedbackModal';
import { ArchetypeLibrary } from './ArchetypeLibrary';
import { FriendManagementModal } from './FriendManagementModal';
import * as DocumentPicker from 'expo-document-picker';
import { generateStressTestData, clearStressTestData, getDataStats } from '@/db/seeds/stress-test-seed-data';
import { CustomBottomSheet } from '@/shared/ui/Sheet/BottomSheet';
import { AutoBackupService } from '@/modules/backup/AutoBackupService';
import { DataWipeService } from '@/modules/data-management/DataWipeService';
import { DiagnosticService } from '@/services/diagnostic.service';
import { MemoryNudgeChannel } from '@/modules/notifications/services/channels/memory-nudge';
import { database } from '@/db';
import JournalEntry from '@/db/models/JournalEntry';
import JournalEntryFriend from '@/db/models/JournalEntryFriend';
import FriendModel from '@/db/models/Friend';
import { ModernSwitch } from '@/components/ui/ModernSwitch';

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
  const { isDarkMode, toggleDarkMode, openTrophyCabinet, openWeeklyReflection, openReflectionPrompt } = useUIStore();
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
  const [calendarSettings, setCalendarSettings] = useState<CalendarService.CalendarSettings>({
    enabled: false,
    calendarId: null,
    reminderMinutes: 60,
    twoWaySync: false,
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

  // Evening Digest preferences
  const [digestEnabled, setDigestEnabled] = useState(true);
  const [digestTime, setDigestTime] = useState(new Date());
  const [showDigestTimePicker, setShowDigestTimePicker] = useState(false);

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
  const [isScanning, setIsScanning] = useState(false);

  // Auto Backup state
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);



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
      loadNotificationSettings();
      loadBackgroundSyncSettings();
      loadAutoBackupSettings();
    }
  }, [isOpen, profile]);

  const loadAutoBackupSettings = async () => {
    const enabled = await AutoBackupService.isEnabled();
    const lastTime = await AutoBackupService.getLastBackupTime();
    setAutoBackupEnabled(enabled);
    setLastBackupTime(lastTime);
  };

  const loadCalendarSettings = async () => {
    const settings = await CalendarService.getCalendarSettings();
    setCalendarSettings(settings);

    if (settings.enabled) {
      const calendars = await CalendarService.getAvailableCalendars();
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
    const smartPrefs = await notificationStore.getPreferences();
    setNotificationFrequency(smartPrefs.frequency);
    setRespectBattery(smartPrefs.respectBattery);
    setDigestEnabled(smartPrefs.digestEnabled ?? true);

    const dTime = smartPrefs.digestTime || '19:00';
    const [dHours, dMinutes] = dTime.split(':').map(Number);
    const dDate = new Date();
    dDate.setHours(dHours, dMinutes, 0, 0);
    setDigestTime(dDate);

    // Load smart notifications enabled state
    const smartEnabledStr = await AsyncStorage.getItem('@weave:smart_notifications_enabled');
    setSmartNotificationsEnabled(smartEnabledStr ? JSON.parse(smartEnabledStr) : true);

    // Load smart defaults enabled state
    const smartDefaultsStr = await AsyncStorage.getItem('@weave:smart_defaults_enabled');
    setSmartDefaultsEnabled(smartDefaultsStr ? JSON.parse(smartDefaultsStr) : true);
  };

  const handleToggleCalendar = async (enabled: boolean) => {
    if (enabled) {
      const hasPermission = await CalendarService.requestCalendarPermissions();
      if (!hasPermission) {
        return;
      }

      const calendars = await CalendarService.getAvailableCalendars();
      if (calendars.length === 0) {
        Alert.alert('No Calendars Found', 'No writable calendars were found on your device.', [{ text: 'OK' }]);
        return;
      }

      setAvailableCalendars(calendars);
    }
    const settings = await CalendarService.getCalendarSettings();
    await CalendarService.saveCalendarSettings({ ...settings, enabled });
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCalendarSettings((prev: any) => ({ ...prev, enabled }));
  };

  const handleTestPostWeaveRating = async () => {
    try {
      // 1. Get a random friend to plan with
      const friends = await database.get<FriendModel>('friends').query().fetch();
      if (friends.length === 0) {
        Alert.alert('No Friends', 'You need at least one friend to test this.');
        return;
      }
      const randomFriend = friends[Math.floor(Math.random() * friends.length)];

      // 2. Create a "Planned" interaction in the past (yesterday)
      await database.write(async () => {
        const interaction = await database.get('interactions').create((i: any) => {
          i.interactionType = 'plan';
          i.status = 'planned';
          i.interactionDate = new Date(Date.now() - 24 * 60 * 60 * 1000).getTime(); // Yesterday
          i.activity = 'Test Party';
          i.mode = 'plan';
          i.note = 'This is a test plan created from settings.';
          // Necessary fields
          i._raw.id = 'test_plan_' + Date.now();
        });

        // Link friend
        await database.get('interaction_friends').create((join: any) => {
          join.interaction.set(interaction);
          join.friend.set(randomFriend);
        });
      });

      // 3. Trigger the check
      const { PlanService } = require('@/modules/interactions');
      await PlanService.checkPendingPlans();

      // 4. Close settings so user can see the modal
      onClose();

    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to trigger test rating flow.');
    }
  };

  const handleToggleTwoWaySync = async (enabled: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const settings = await CalendarService.getCalendarSettings();
    await CalendarService.saveCalendarSettings({ ...settings, twoWaySync: enabled });
    setCalendarSettings((prev: any) => ({ ...prev, twoWaySync: enabled }));
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
        const settings = await CalendarService.getCalendarSettings();
        await CalendarService.saveCalendarSettings({ ...settings, calendarId: cal.id });
        setCalendarSettings((prev: any) => ({ ...prev, calendarId: cal.id }));
      },
    }));

    buttons.push({ text: 'Cancel', onPress: () => { }, style: 'cancel' } as any);

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
      await WeeklyReflectionChannel.schedule();
    } else {
      await WeeklyReflectionChannel.cancel('weekly-reflection');
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
      await EventReminderChannel.schedule();
    }
  };

  const handleToggleDeepeningNudges = async (enabled: boolean) => {
    setDeepeningNudgesEnabled(enabled);
    // Store preference (deepening nudges will check this when scheduling)
    await AsyncStorage.setItem('@weave:deepening_nudges_enabled', JSON.stringify(enabled));
  };

  const handleToggleSmartNotifications = async (enabled: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSmartNotificationsEnabled(enabled);
    await AsyncStorage.setItem('@weave:smart_notifications_enabled', JSON.stringify(enabled));
  };

  const handleToggleSmartDefaults = async (enabled: boolean) => {
    setSmartDefaultsEnabled(enabled);
    await AsyncStorage.setItem('@weave:smart_defaults_enabled', JSON.stringify(enabled));
  };

  const handleChangeFrequency = async (frequency: 'light' | 'moderate' | 'proactive') => {
    setNotificationFrequency(frequency);
    await notificationStore.setPreferences({ frequency });
  };

  const handleToggleRespectBattery = async (enabled: boolean) => {
    setRespectBattery(enabled);
    await notificationStore.setPreferences({ respectBattery: enabled });
  };

  const handleToggleDigest = async (enabled: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDigestEnabled(enabled);
    await notificationStore.setPreferences({ digestEnabled: enabled });

    if (enabled) {
      const hours = digestTime.getHours();
      const minutes = digestTime.getMinutes();
      const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      await EveningDigestChannel.schedule(timeStr);
    } else {
      await EveningDigestChannel.cancel();
    }
  };

  const handleDigestTimeChange = async (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDigestTimePicker(false);
    }

    if (selectedDate) {
      setDigestTime(selectedDate);

      const hours = selectedDate.getHours();
      const minutes = selectedDate.getMinutes();
      const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

      await notificationStore.setPreferences({ digestTime: timeStr });

      if (digestEnabled) {
        await EveningDigestChannel.schedule(timeStr);
      }
    }
  };

  const handleToggleAutoBackup = async (enabled: boolean) => {
    if (enabled) {
      // Verify iCloud access before enabling
      const initialized = await AutoBackupService.init();
      if (!initialized) {
        Alert.alert(
          'iCloud Access Failed',
          'Could not access iCloud Drive. Please ensure you are signed in to iCloud and have iCloud Drive enabled.',
          [{ text: 'OK' }]
        );
        // Don't enable the switch
        return;
      }
    }

    setAutoBackupEnabled(enabled);
    await AutoBackupService.setEnabled(enabled);
    if (enabled) {
      // Try to backup immediately if enabling
      AutoBackupService.checkAndBackup().then(() => {
        loadAutoBackupSettings();
      });
    }
  };

  const handleResetDatabase = () => {
    Alert.alert(
      "Erase All Data",
      "Are you sure? This will delete EVERYTHING:\n\n• All friends and interactions\n• All settings and preferences\n• All cloud backups\n• Your account session\n\nThis action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Erase Everything",
          style: "destructive",
          onPress: async () => {
            try {
              // Close modal first to avoid UI glitches during reload
              onClose();
              // Small delay to allow modal to close
              setTimeout(async () => {
                await DataWipeService.wipeAllData();
              }, 500);
            } catch (error) {
              console.error('Failed to erase data:', error);
              Alert.alert('Error', 'Failed to erase data.');
            }
          },
        },
      ]
    );
  };

  const handleViewAnalytics = async () => {
    try {
      const analytics = await SuggestionTrackerService.getSuggestionAnalytics();

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
        'Backup Data',
        `Create a backup of your data to save to iCloud Drive or another safe location.\n\nFriends: ${stats.totalFriends}\nInteractions: ${stats.totalInteractions}\nEstimated size: ${stats.estimatedSizeKB}KB`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Create Backup',
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
        'Restore Data',
        `This will restore your data from a backup file (e.g. from iCloud Drive):\n\n` +
        `Backup Date: ${new Date(preview.preview!.exportDate).toLocaleDateString()}\n` +
        `Friends: ${preview.preview!.totalFriends}\n` +
        `Interactions: ${preview.preview!.totalInteractions}\n\n` +
        `⚠️ WARNING: This will DELETE all your current data and replace it with the backup.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
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

  const handleRestoreFromCloud = async () => {
    try {
      const backups = await AutoBackupService.getAvailableBackups();

      if (backups.length === 0) {
        Alert.alert('No Backups Found', 'No automatic backups were found in iCloud.');
        return;
      }

      // Take top 3 backups
      const recentBackups = backups.slice(0, 3);

      const buttons = recentBackups.map(filename => {
        // Extract date from filename: weave-backup-2023-10-27T10-00-00-000Z.json
        const datePart = filename.replace('weave-backup-', '').replace('.json', '').replace(/-/g, ':').replace('T', ' ');
        // Fix the date format slightly to be parseable or just display it raw but nicer
        // Actually the filename has - instead of : for time, so let's just format it simply
        // weave-backup-2025-12-02T11-48-57-000Z.json
        // We can just show the raw string with some cleanup
        const displayDate = filename.replace('weave-backup-', '').replace('.json', '').replace('T', ' ').substring(0, 16);

        return {
          text: displayDate,
          onPress: async () => {
            try {
              const content = await AutoBackupService.restoreBackup(filename);

              // Validate and preview
              const preview = getImportPreview(content);
              if (!preview.valid) {
                Alert.alert('Invalid Backup', 'The backup file appears to be corrupted.');
                return;
              }

              Alert.alert(
                'Confirm Restore',
                `Restore backup from ${displayDate}?\n\n` +
                `Friends: ${preview.preview!.totalFriends}\n` +
                `Interactions: ${preview.preview!.totalInteractions}\n\n` +
                `⚠️ This will overwrite all current data.`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Restore',
                    style: 'destructive',
                    onPress: async () => {
                      Alert.alert('Restoring...', 'Please wait...');
                      const result = await importData(content, true);
                      if (result.success) {
                        Alert.alert('Success', 'Data restored successfully. Please restart the app.', [{ text: 'OK', onPress: onClose }]);
                      } else {
                        Alert.alert('Error', 'Failed to restore data.');
                      }
                    }
                  }
                ]
              );

            } catch (err) {
              console.error('Failed to restore backup:', err);
              Alert.alert('Error', 'Failed to download backup.');
            }
          }
        };
      });

      buttons.push({ text: 'Cancel', style: 'cancel', onPress: () => { } } as any);

      Alert.alert('Select Backup', 'Choose a backup to restore from iCloud:', buttons);

    } catch (error) {
      console.error('Failed to list backups:', error);
      Alert.alert('Error', 'Failed to list backups.');
    }
  };

  const handleGenerateStressTest = () => {
    Alert.alert(
      'Generate Stress Test Data',
      'This will create realistic test data including friends, interactions, journal entries, and groups. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          onPress: async () => {
            try {
              await generateStressTestData(100, 10);
              const stats = await getDataStats();
              Alert.alert(
                'Stress Test Data Generated',
                `Created ${stats.stressTestFriends} test friends!\n\n` +
                `Total friends: ${stats.totalFriends}\n` +
                `Total interactions: ${stats.totalInteractions}\n` +
                `Total journal entries: ${stats.totalJournalEntries}\n` +
                `Total groups: ${stats.totalGroups}`,
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

  const handleRunDiagnostics = async () => {
    setIsScanning(true);
    // Alert.alert('Running Diagnostics', 'Scanning database for anomalies...');

    // Tiny delay to allow UI to update and user to perceive action
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      const report = await DiagnosticService.runScan();
      setIsScanning(false);

      const issueSummary = report.issues.length > 0
        ? report.issues.map(i => `• [${i.severity.toUpperCase()}] ${i.description}`).join('\n')
        : 'No issues found.';

      Alert.alert(
        'Diagnostic Report',
        `Scan complete in ${report.scanDurationMs}ms.\n\nIssues Found: ${report.totalIssues}\n\n${issueSummary}`,
        [
          { text: 'OK' },
          report.totalIssues > 0 ? {
            text: 'Attempt Fix',
            onPress: () => {
              Alert.alert('Fix Orphans', 'Attempting to remove orphaned links...', [
                {
                  text: 'Proceed',
                  style: 'destructive',
                  onPress: async () => {
                    const fixed = await DiagnosticService.fixOrphans(report.issues);
                    Alert.alert('Fix Complete', `Removed ${fixed} orphaned records.`);
                  }
                },
                { text: 'Cancel', style: 'cancel' }
              ]);
            }
          } : { text: '' } // no-op if no issues
        ].filter(b => b.text)
      );
    } catch (error) {
      setIsScanning(false);
      console.error('Diagnostic run failed:', error);
      Alert.alert('Error', 'Diagnostic scan failed.');
    }
  };

  const handleTestEveningDigest = async () => {
    try {
      await EveningDigestChannel.handleTap({ isTest: true }, router);
      onClose();
    } catch (error) {
      console.error('Failed to open digest:', error);
      Alert.alert('Error', 'Failed to open digest sheet');
    }
  };


  if (!shouldRender) return null;

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

