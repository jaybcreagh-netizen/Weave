import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, LayoutAnimation } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { Calendar as CalendarIcon, ChevronRight } from 'lucide-react-native';
import { ModernSwitch } from '@/shared/ui/ModernSwitch';
import { SettingsItem } from './SettingsItem';
import { CalendarService } from '@/modules/interactions';
import { useBackgroundSyncStore } from '@/modules/auth';

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

    // Background sync store
    const {
        settings: backgroundSyncSettings,
        loadSettings: loadBackgroundSyncSettings,
        toggleEnabled: toggleBackgroundSync,
    } = useBackgroundSyncStore();

    // Load settings on mount
    useEffect(() => {
        loadCalendarSettings();
        loadBackgroundSyncSettings();
    }, []);

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
                    <ModernSwitch
                        value={calendarSettings.twoWaySync}
                        onValueChange={handleToggleTwoWaySync}
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
                    <ModernSwitch
                        value={backgroundSyncSettings.enabled}
                        onValueChange={handleToggleBackgroundSync}
                    />
                </View>
            )}
        </View>
    );
};
