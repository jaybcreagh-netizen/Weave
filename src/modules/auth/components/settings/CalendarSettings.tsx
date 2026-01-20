import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, LayoutAnimation, ActivityIndicator } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { Calendar as CalendarIcon, ChevronRight } from 'lucide-react-native';
import { ModernSwitch } from '@/shared/ui/ModernSwitch';
import { SettingsItem } from './SettingsItem';
import { CalendarService } from '@/modules/interactions';
import { useSyncSettings } from '@/modules/auth';
import { syncAllBirthdaysAndAnniversaries } from '@/modules/relationships';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BIRTHDAY_SYNC_KEY = '@weave_birthday_sync_enabled';

export const CalendarSettings = () => {
    const { colors } = useTheme();

    // Calendar settings state
    const [calendarSettings, setCalendarSettings] = useState<CalendarService.CalendarSettings>({
        enabled: false,
        calendarId: null,
        reminderMinutes: 60,
        twoWaySync: false,
    });
    const [availableCalendars, setAvailableCalendars] = useState<any[]>([]);

    // Birthday sync state
    const [birthdaySyncEnabled, setBirthdaySyncEnabled] = useState(false);
    const [isSyncingBirthdays, setIsSyncingBirthdays] = useState(false);

    // Background sync settings from hook
    const {
        settings: backgroundSyncSettings,
        toggleEnabled: toggleBackgroundSync,
    } = useSyncSettings();

    // Load settings on mount
    useEffect(() => {
        loadCalendarSettings();
        loadBirthdaySyncSetting();
    }, []);

    const loadBirthdaySyncSetting = async () => {
        try {
            const value = await AsyncStorage.getItem(BIRTHDAY_SYNC_KEY);
            setBirthdaySyncEnabled(value === 'true');
        } catch (error) {
            console.error('Error loading birthday sync setting:', error);
        }
    };

    const loadCalendarSettings = async () => {
        const settings = await CalendarService.getCalendarSettings();
        setCalendarSettings(settings);

        if (settings.enabled) {
            // Verify permissions are still granted
            const { granted } = await CalendarService.checkCalendarPermissions();
            if (!granted) {
                // Permissions were revoked - disable calendar integration
                await CalendarService.saveCalendarSettings({ ...settings, enabled: false });
                setCalendarSettings(prev => ({ ...prev, enabled: false }));
                Alert.alert(
                    'Calendar Access Revoked',
                    'Calendar permissions have been revoked. Please re-enable calendar integration to continue syncing.',
                    [{ text: 'OK' }]
                );
                return;
            }

            const calendars = await CalendarService.getAvailableCalendars();
            setAvailableCalendars(calendars);
        }
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

    const handleSelectCalendar = async () => {
        if (availableCalendars.length === 0) return;

        // Show calendar name with account/source for clarity
        const buttons = availableCalendars.map((cal) => ({
            text: `${cal.title} (${cal.source?.name || 'Local'})`,
            onPress: async () => {
                const settings = await CalendarService.getCalendarSettings();
                await CalendarService.saveCalendarSettings({ ...settings, calendarId: cal.id });
                setCalendarSettings((prev: any) => ({ ...prev, calendarId: cal.id }));
            },
        }));

        buttons.push({ text: 'Cancel', onPress: () => { }, style: 'cancel' } as any);

        Alert.alert(
            'Select Calendar',
            'Choose which calendar to use for planned weaves. Make sure to select your synced calendar (e.g., Gmail) rather than a local-only calendar.',
            buttons
        );
    };

    // Get the selected calendar with its source info
    const getSelectedCalendarInfo = () => {
        const selectedCal = availableCalendars.find((cal) => cal.id === calendarSettings.calendarId);
        if (!selectedCal) return 'Default';
        const sourceName = selectedCal.source?.name || 'Local';
        return `${selectedCal.title} (${sourceName})`;
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

    const handleToggleBirthdaySync = async (enabled: boolean) => {
        if (enabled) {
            setIsSyncingBirthdays(true);
            try {
                const result = await syncAllBirthdaysAndAnniversaries();
                await AsyncStorage.setItem(BIRTHDAY_SYNC_KEY, 'true');
                setBirthdaySyncEnabled(true);

                const totalSynced = result.synced;
                if (totalSynced > 0) {
                    Alert.alert(
                        'Birthdays Synced',
                        `${totalSynced} birthday/anniversary event${totalSynced > 1 ? 's' : ''} added to your calendar.`,
                        [{ text: 'OK' }]
                    );
                } else {
                    Alert.alert(
                        'Sync Complete',
                        'No new birthdays or anniversaries to add. Events will be created automatically when you add birthdays to friends.',
                        [{ text: 'OK' }]
                    );
                }
            } catch (error) {
                console.error('Error syncing birthdays:', error);
                Alert.alert('Sync Failed', 'Failed to sync birthdays. Please try again.', [{ text: 'OK' }]);
            } finally {
                setIsSyncingBirthdays(false);
            }
        } else {
            await AsyncStorage.setItem(BIRTHDAY_SYNC_KEY, 'false');
            setBirthdaySyncEnabled(false);
        }
    };

    return (
        <View className="gap-4">
            <SettingsItem
                icon={CalendarIcon}
                title="Calendar Integration"
                subtitle="Add planned weaves to calendar"
                rightElement={
                    <ModernSwitch
                        value={calendarSettings.enabled}
                        onValueChange={handleToggleCalendar}
                    />
                }
            />

            {calendarSettings.enabled && availableCalendars.length > 0 && (
                <TouchableOpacity
                    className="flex-row items-center justify-between pl-13"
                    onPress={handleSelectCalendar}
                >
                    <View className="flex-1 mr-2">
                        <Text className="text-sm font-inter-medium" style={{ color: colors.foreground }}>Calendar</Text>
                        <Text className="text-xs font-inter-regular" style={{ color: colors['muted-foreground'] }}>
                            {getSelectedCalendarInfo()}
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
                    <ModernSwitch
                        value={calendarSettings.twoWaySync}
                        onValueChange={handleToggleTwoWaySync}
                    />
                </View>
            )}

            {calendarSettings.enabled && (
                <View className="flex-row items-center justify-between pl-13 mt-3">
                    <View className="flex-1">
                        <Text className="text-sm font-inter-medium" style={{ color: colors.foreground }}>
                            Sync Birthdays & Anniversaries
                        </Text>
                        <Text className="text-xs font-inter-regular" style={{ color: colors['muted-foreground'] }}>
                            Add friend birthdays and partner anniversaries as recurring calendar events
                        </Text>
                    </View>
                    {isSyncingBirthdays ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                        <ModernSwitch
                            value={birthdaySyncEnabled}
                            onValueChange={handleToggleBirthdaySync}
                        />
                    )}
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
                    <ModernSwitch
                        value={backgroundSyncSettings.enabled}
                        onValueChange={handleToggleBackgroundSync}
                    />
                </View>
            )}
        </View>
    );
};
