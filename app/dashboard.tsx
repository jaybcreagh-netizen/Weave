import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Sparkles, Users, Settings } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { SettingsModal } from '@/modules/auth/components/settings-modal';
import { SocialBatterySheet } from '@/modules/home/components/widgets/SocialBatterySheet';
import { BadgeUnlockModal } from '@/modules/gamification';
import { useUserProfileStore } from '@/modules/auth';
import { useUIStore } from '@/shared/stores/uiStore';
import HomeScreen from './_home';
import FriendsScreen from './_friends';
import { useTutorialStore } from '@/shared/stores/tutorialStore';
import { shouldSendSocialBatteryNotification } from '@/modules/notifications';


export default function Dashboard() {
    const theme = useTheme();
    const colors = theme?.colors || {};
    const [activeTab, setActiveTab] = useState<'insights' | 'circle'>('circle');
    const [showSettings, setShowSettings] = useState(false);
    const {
        isSocialBatterySheetOpen,
        openSocialBatterySheet,
        closeSocialBatterySheet,
        suggestionCount, // Use shared state from UIStore (populated by useSuggestions in FriendsDashboardScreen)
    } = useUIStore();
    const { submitBatteryCheckin, profile, observeProfile } = useUserProfileStore();
    // Tutorial state - check if QuickWeave tutorial is done
    const hasPerformedQuickWeave = useTutorialStore((state) => state.hasPerformedQuickWeave);


    // Mounted state and timeout refs to prevent race conditions
    const isMountedRef = useRef(true);
    const batteryTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Cleanup timeouts on unmount
    useEffect(() => {
        return () => {
            isMountedRef.current = false;
            if (batteryTimerRef.current) clearTimeout(batteryTimerRef.current);
        };
    }, []);

    // Initialize user profile observable on mount
    useEffect(() => {
        try {
            const cleanup = observeProfile();
            return cleanup;
        } catch (error) {
            console.error('[Dashboard] Failed to observe profile:', error);
        }
    }, []);

    // Check if user should be prompted for battery check-in
    // Wait until QuickWeave tutorial is complete before showing (avoid conflicts)
    useEffect(() => {
        // Default to enabled if not explicitly set
        if (!profile) return;
        const isEnabled = profile.batteryCheckinEnabled ?? true;
        if (!isEnabled) return;

        // Skip if timer is already scheduled (prevents race condition on profile updates)
        if (batteryTimerRef.current) return;

        // Don't show battery sheet during onboarding flow
        // Wait until user has completed their first QuickWeave OR has been using the app for a while
        const checkEligibility = async () => {
            if (hasPerformedQuickWeave) return true;

            // Fallback for existing users: check interaction count via grace period service
            const { shouldSend } = await shouldSendSocialBatteryNotification();
            return shouldSend;
        };

        checkEligibility().then(isEligible => {
            if (!isEligible) return;

            const lastCheckin = profile.socialBatteryLastCheckin;
            if (!lastCheckin) {
                console.log('[Dashboard] No last check-in found, showing battery sheet');
                // Never checked in - show after brief delay
                batteryTimerRef.current = setTimeout(() => {
                    if (isMountedRef.current) {
                        openSocialBatterySheet();
                    }
                }, 3000);
                return;
            }

            // Check if last check-in was today
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const lastCheckinDate = new Date(lastCheckin);
            lastCheckinDate.setHours(0, 0, 0, 0);

            const needsCheckin = lastCheckinDate < today;
            console.log(`[Dashboard] Battery Check-in Status: Last=${lastCheckinDate.toDateString()}, Today=${today.toDateString()}, Needs=${needsCheckin}`);

            if (needsCheckin) {
                // Last check-in was before today - show after brief delay
                batteryTimerRef.current = setTimeout(() => {
                    if (isMountedRef.current) {
                        openSocialBatterySheet();
                    }
                }, 3000);
            }
        });

        // Only cleanup on unmount (not on profile changes)
        return () => {
            if (batteryTimerRef.current) {
                clearTimeout(batteryTimerRef.current);
                batteryTimerRef.current = null;
            }
        };
    }, [profile, hasPerformedQuickWeave]);

    const handleTabPress = (tab: 'insights' | 'circle') => {
        setActiveTab(tab);
    };

    // Note: repairTiers() is now called once in DataInitializer, not on every Dashboard mount

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={[styles.tabBar, { backgroundColor: 'transparent', borderBottomColor: colors.border }]}>
                    <View style={styles.tabsContainer}>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'insights' && styles.activeTab]}
                            onPress={() => handleTabPress('insights')}
                        >
                            <View style={styles.tabIconContainer}>
                                <Sparkles
                                    size={24}
                                    color={activeTab === 'insights' ? colors.primary : colors['muted-foreground']}
                                />
                                {suggestionCount > 0 && (
                                    <View style={[styles.notificationBadge, { backgroundColor: colors.primary }]}>
                                        <Text style={styles.notificationText}>{suggestionCount}</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={[styles.tabLabel, { color: activeTab === 'insights' ? colors.primary : colors['muted-foreground'] }]}>
                                Insights
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'circle' && styles.activeTab]}
                            onPress={() => handleTabPress('circle')}
                        >
                            <Users size={24} color={activeTab === 'circle' ? colors.primary : colors['muted-foreground']} />
                            <Text style={[styles.tabLabel, { color: activeTab === 'circle' ? colors.primary : colors['muted-foreground'] }]}>
                                Circle
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.settingsButton}>
                        <Settings size={24} color={colors['muted-foreground']} />
                    </TouchableOpacity>
                </View>

                {/* Lazy Tab Rendering - only mount active screen */}
                <View style={styles.tabContent}>
                    {activeTab === 'insights' ? <HomeScreen /> : <FriendsScreen />}
                </View>

                <SettingsModal
                    isOpen={showSettings}
                    onClose={() => setShowSettings(false)}
                    onOpenBatteryCheckIn={() => {
                        setShowSettings(false);
                        openSocialBatterySheet();
                    }}
                />

                <SocialBatterySheet
                    isVisible={isSocialBatterySheetOpen}
                    onSubmit={async (value, note) => {
                        // 1. Close immediately for snappy UI (optimistic)
                        closeSocialBatterySheet();

                        // 2. Perform async work in background
                        // We use a small timeout to let the sheet close animation start smoothly
                        setTimeout(async () => {
                            try {
                                await submitBatteryCheckin(value, note);
                            } catch (error) {
                                console.error('Failed to submit battery checkin:', error);
                                // Optional: Show toast error here if needed, but for now silent failure is better than stuck UI
                            }
                        }, 100);
                    }}
                    onDismiss={() => closeSocialBatterySheet()}
                />
            </SafeAreaView>
            <BadgeUnlockModal />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    tabContent: { flex: 1 },
    tabBar: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        paddingHorizontal: 20,
        justifyContent: 'space-between',
    },
    tabsContainer: { flexDirection: 'row', flex: 1 },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        gap: 8,
    },
    activeTab: { borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
    settingsButton: { padding: 12 },
    tabIconContainer: { position: 'relative' },
    notificationBadge: {
        position: 'absolute',
        top: -4,
        right: -8,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    notificationText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '600',
        fontFamily: 'Inter_600SemiBold',
    },
});
