
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, LayoutAnimation, Platform, Alert, ScrollView } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { useUserProfile } from '@/modules/auth/hooks/useUserProfile';
import { useQueryClient } from '@tanstack/react-query';
import { notificationStore } from '@/modules/notifications/services/notification-store';
import { SocialBatteryService } from '@/modules/auth/services/social-battery.service';
import {
    WeeklyReflectionChannel,
    EventReminderChannel,
    EveningDigestChannel,
    BatteryCheckinChannel, // Assuming this exists based on context
    DeepeningNudgeChannel, // Assuming this exists based on context
} from '@/modules/notifications';
import { SuggestionTrackerService } from '@/modules/interactions/services/suggestion-tracker.service';
import { SettingsItem } from './SettingsItem';
import { ModernSwitch } from '@/shared/ui/ModernSwitch';
import { Bell, Clock, BookOpen, ChevronRight, Moon, BarChart3 } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const NotificationSettings = () => {
    const { colors } = useTheme();
    const { profile, updateProfile } = useUserProfile();
    const queryClient = useQueryClient();

    // State
    const [batteryNotificationsEnabled, setBatteryNotificationsEnabled] = useState(false);
    const [batteryNotificationTime, setBatteryNotificationTime] = useState(new Date());
    const [showTimePicker, setShowTimePicker] = useState(false);

    const [weeklyReflectionEnabled, setWeeklyReflectionEnabled] = useState(false);
    const [reflectionDay, setReflectionDay] = useState(0); // 0 = Sunday
    const [reflectionAutoShow, setReflectionAutoShow] = useState(false);
    const [showDayPicker, setShowDayPicker] = useState(false);

    const [eventRemindersEnabled, setEventRemindersEnabled] = useState(false);
    const [deepeningNudgesEnabled, setDeepeningNudgesEnabled] = useState(false);

    const [smartNotificationsEnabled, setSmartNotificationsEnabled] = useState(false);
    const [notificationFrequency, setNotificationFrequency] = useState<'light' | 'moderate' | 'proactive'>('moderate');
    const [maxDailySuggestions, setMaxDailySuggestions] = useState(10);
    const [respectBattery, setRespectBattery] = useState(true);

    const [digestEnabled, setDigestEnabled] = useState(false);
    const [digestTime, setDigestTime] = useState(new Date());
    const [showDigestTimePicker, setShowDigestTimePicker] = useState(false);

    // Load detailed settings on mount
    useEffect(() => {
        loadSettings();
    }, [profile]);

    const loadSettings = async () => {
        // Load Battery Settings from profile
        if (profile) {
            setBatteryNotificationsEnabled(profile.batteryCheckinEnabled ?? false);
            if (profile.batteryCheckinTime) {
                const [hours, minutes] = profile.batteryCheckinTime.split(':').map(Number);
                const date = new Date();
                date.setHours(hours, minutes, 0);
                setBatteryNotificationTime(date);
            }

            setReflectionDay(profile.reflectionDay ?? 0);
            setReflectionAutoShow(profile.reflectionAutoShow ?? false);
        }

        // Load specific notification preferences
        const prefs = await notificationStore.getPreferences();
        setSmartNotificationsEnabled(prefs.frequency !== 'light'); // Rough mapping or separate flag? 
        // Actually, let's assume smartNotificationsEnabled maps to general master switch if we had one, 
        // but here we might need to check a specific stored key or deduce it.
        // For now, let's load what we can.
        setNotificationFrequency(prefs.frequency);
        setMaxDailySuggestions(prefs.maxDailySuggestions || 10);
        setRespectBattery(prefs.respectBattery);
        setDigestEnabled(prefs.digestEnabled);

        if (prefs.digestTime) {
            const [dHours, dMinutes] = prefs.digestTime.split(':').map(Number);
            const dDate = new Date();
            dDate.setHours(dHours, dMinutes, 0);
            setDigestTime(dDate);
        }

        // Load local toggles
        const reflectionEnabled = await AsyncStorage.getItem('@weave:weekly_reflection_enabled');
        setWeeklyReflectionEnabled(reflectionEnabled !== 'false');

        const remindersEnabled = await AsyncStorage.getItem('@weave:event_reminders_enabled');
        setEventRemindersEnabled(remindersEnabled !== 'false');

        const deepeningEnabled = await AsyncStorage.getItem('@weave:deepening_nudges_enabled');
        setDeepeningNudgesEnabled(deepeningEnabled !== 'false');

        const smartEnabled = await AsyncStorage.getItem('@weave:smart_notifications_enabled');
        setSmartNotificationsEnabled(smartEnabled !== 'false');
    };

    const updateBatteryPreferences = async (enabled: boolean, timeStr: string) => {
        if (!profile?.userId) return;
        await SocialBatteryService.updatePreferences(profile.userId, enabled, timeStr);
    };

    const handleMaxSuggestionsChange = async (count: number) => {
        setMaxDailySuggestions(count);
        await notificationStore.setPreferences({ maxDailySuggestions: count });
        // Invalidate suggestions query so it re-fetches with the new limit immediately
        queryClient.invalidateQueries({ queryKey: ['suggestions', 'all'] });
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
        await AsyncStorage.setItem('@weave:weekly_reflection_enabled', JSON.stringify(enabled));
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
        // Reschedule notification with new day preference
        if (weeklyReflectionEnabled) {
            await WeeklyReflectionChannel.schedule();
        }
    };

    const handleToggleEventReminders = async (enabled: boolean) => {
        setEventRemindersEnabled(enabled);
        await AsyncStorage.setItem('@weave:event_reminders_enabled', JSON.stringify(enabled));
        if (enabled) {
            await EventReminderChannel.scheduleAll();
        }
    };

    const handleToggleDeepeningNudges = async (enabled: boolean) => {
        setDeepeningNudgesEnabled(enabled);
        await AsyncStorage.setItem('@weave:deepening_nudges_enabled', JSON.stringify(enabled));
    };

    const handleToggleSmartNotifications = async (enabled: boolean) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setSmartNotificationsEnabled(enabled);
        await AsyncStorage.setItem('@weave:smart_notifications_enabled', JSON.stringify(enabled));
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

    return (
        <View className="gap-4">
            {/* Daily Battery Reminder */}
            <SettingsItem
                icon={Bell}
                title="Daily Battery Reminder"
                subtitle="Check in with your energy"
                rightElement={
                    <ModernSwitch
                        value={batteryNotificationsEnabled}
                        onValueChange={handleToggleBatteryNotifications}
                    />
                }
            />

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
                                <Text className="text-lg font-inter-semibold" style={{ color: colors.foreground }}>Select Time</Text>
                                <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                                    <Text className="text-base font-inter-medium" style={{ color: colors.primary }}>Done</Text>
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

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            {/* Weekly Reflection */}
            <SettingsItem
                icon={BookOpen}
                title="Weekly Reflection"
                subtitle="Notifications enabled"
                rightElement={
                    <ModernSwitch
                        value={weeklyReflectionEnabled}
                        onValueChange={handleToggleWeeklyReflection}
                    />
                }
            />

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
                        <ModernSwitch
                            value={reflectionAutoShow}
                            onValueChange={handleToggleReflectionAutoShow}
                        />
                    </View>
                </>
            )}

            {showDayPicker && (
                <Modal transparent animationType="slide">
                    <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                        <View style={{ backgroundColor: colors.card }} className="rounded-t-3xl p-4">
                            <View className="flex-row justify-between items-center mb-4">
                                <Text className="text-lg font-inter-semibold" style={{ color: colors.foreground }}>Select Reflection Day</Text>
                                <TouchableOpacity onPress={() => setShowDayPicker(false)}>
                                    <Text className="text-base font-inter-medium" style={{ color: colors.primary }}>Done</Text>
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
                                        <Text className="text-base" style={{ color: index === reflectionDay ? colors.primary : colors.foreground, fontFamily: 'Inter_500Medium' }}>{day}</Text>
                                        {index === reflectionDay && <Text style={{ color: colors.primary }}>✓</Text>}
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </Modal>
            )}

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            {/* Evening Digest */}
            <SettingsItem
                icon={Moon}
                title="Evening Digest"
                subtitle="Daily summary at 7 PM"
                rightElement={
                    <ModernSwitch
                        value={digestEnabled}
                        onValueChange={handleToggleDigest}
                    />
                }
            />

            {digestEnabled && (
                <TouchableOpacity
                    className="flex-row items-center justify-between pl-13 mt-3"
                    onPress={() => setShowDigestTimePicker(true)}
                >
                    <View>
                        <Text className="text-sm font-inter-medium" style={{ color: colors.foreground }}>Digest Time</Text>
                        <Text className="text-xs font-inter-regular" style={{ color: colors['muted-foreground'] }}>
                            {digestTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </Text>
                    </View>
                    <Clock color={colors['muted-foreground']} size={20} />
                </TouchableOpacity>
            )}

            {showDigestTimePicker && Platform.OS === 'ios' && (
                <Modal transparent animationType="slide">
                    <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                        <View style={{ backgroundColor: colors.card }} className="rounded-t-3xl p-4">
                            <View className="flex-row justify-between items-center mb-4">
                                <Text className="text-lg font-inter-semibold" style={{ color: colors.foreground }}>Select Digest Time</Text>
                                <TouchableOpacity onPress={() => setShowDigestTimePicker(false)}>
                                    <Text className="text-base font-inter-medium" style={{ color: colors.primary }}>Done</Text>
                                </TouchableOpacity>
                            </View>
                            <DateTimePicker
                                value={digestTime}
                                mode="time"
                                is24Hour={false}
                                display="spinner"
                                onChange={handleDigestTimeChange}
                                textColor={colors.foreground}
                            />
                        </View>
                    </View>
                </Modal>
            )}
            {showDigestTimePicker && Platform.OS === 'android' && (
                <DateTimePicker
                    value={digestTime}
                    mode="time"
                    is24Hour={false}
                    display="default"
                    onChange={handleDigestTimeChange}
                />
            )}

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            {/* Event Reminders */}
            <SettingsItem
                icon={Bell}
                title="Event Reminders"
                subtitle="1-hour before planned weaves"
                rightElement={
                    <ModernSwitch
                        value={eventRemindersEnabled}
                        onValueChange={handleToggleEventReminders}
                    />
                }
            />

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            {/* Deepening Nudges */}
            <SettingsItem
                icon={Bell}
                title="Deepening Nudges"
                subtitle="Post-weave reflection prompts"
                rightElement={
                    <ModernSwitch
                        value={deepeningNudgesEnabled}
                        onValueChange={handleToggleDeepeningNudges}
                    />
                }
            />

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            {/* Smart Suggestions */}
            <SettingsItem
                icon={Bell}
                title="Smart Suggestions"
                subtitle="Intelligent nudges based on your social battery"
                rightElement={
                    <ModernSwitch
                        value={smartNotificationsEnabled}
                        onValueChange={handleToggleSmartNotifications}
                    />
                }
            />

            {smartNotificationsEnabled && (
                <>
                    <View className="pl-13 mt-3">
                        <Text className="text-sm font-inter-medium mb-2" style={{ color: colors.foreground }}>Frequency</Text>
                        <View className="flex-row gap-2">
                            {(['light', 'moderate', 'proactive'] as const).map((freq) => (
                                <TouchableOpacity
                                    key={freq}
                                    onPress={() => handleChangeFrequency(freq)}
                                    className="flex-1 py-2 px-3 rounded-lg"
                                    style={{ backgroundColor: notificationFrequency === freq ? colors.primary : colors.muted }}
                                >
                                    <Text className="text-sm font-inter-medium text-center capitalize" style={{ color: notificationFrequency === freq ? colors.card : colors['muted-foreground'] }}>
                                        {freq}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <Text className="text-xs font-inter-regular mt-1" style={{ color: colors['muted-foreground'] }}>
                            {notificationFrequency === 'light' && 'Max 1 notification per day'}
                            {notificationFrequency === 'moderate' && 'Max 2 notifications per day'}
                            {notificationFrequency === 'proactive' && 'Max 4 notifications per day'}
                        </Text>
                    </View>

                    <View className="flex-row items-center justify-between pl-13 mt-4">
                        <View className="flex-1 mr-4">
                            <Text className="text-sm font-inter-medium" style={{ color: colors.foreground }}>Max Visible Suggestions</Text>
                            <Text className="text-xs font-inter-regular" style={{ color: colors['muted-foreground'] }}>
                                Limit items in focus & insights
                            </Text>
                        </View>
                        <View className="flex-row items-center gap-3">
                            <TouchableOpacity
                                onPress={() => handleMaxSuggestionsChange(Math.max(3, maxDailySuggestions - 1))}
                                className="w-8 h-8 rounded-full items-center justify-center bg-muted"
                                style={{ backgroundColor: colors.muted }}
                            >
                                <Text style={{ color: colors.foreground, fontSize: 18 }}>-</Text>
                            </TouchableOpacity>
                            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', width: 20, textAlign: 'center' }}>
                                {maxDailySuggestions}
                            </Text>
                            <TouchableOpacity
                                onPress={() => handleMaxSuggestionsChange(Math.min(20, maxDailySuggestions + 1))}
                                className="w-8 h-8 rounded-full items-center justify-center bg-muted"
                                style={{ backgroundColor: colors.muted }}
                            >
                                <Text style={{ color: colors.foreground, fontSize: 18 }}>+</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View className="flex-row items-center justify-between pl-13 mt-3">
                        <View className="flex-1">
                            <Text className="text-sm font-inter-medium" style={{ color: colors.foreground }}>Respect Social Battery</Text>
                            <Text className="text-xs font-inter-regular" style={{ color: colors['muted-foreground'] }}>
                                Reduce notifications when energy is low
                            </Text>
                        </View>
                        <ModernSwitch
                            value={respectBattery}
                            onValueChange={handleToggleRespectBattery}
                        />
                    </View>
                </>
            )}

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            {/* Suggestion Analytics */}
            <SettingsItem
                icon={BarChart3}
                title="Suggestion Analytics"
                subtitle="View tracking data"
                onPress={handleViewAnalytics}
            />
        </View>
    );
};
