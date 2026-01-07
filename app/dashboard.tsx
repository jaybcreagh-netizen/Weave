import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Sparkles, Users, Settings, Inbox } from 'lucide-react-native';
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
import { ProfileCompletionSheet } from '@/modules/auth/components/ProfileCompletionSheet';
import { WeaveIcon } from '@/shared/components/WeaveIcon';
import { ActivityInboxSheet, useActivityCounts } from '@/modules/sync'; // Added ActivityInboxSheet and useActivityCounts

export default function Dashboard() {
    const theme = useTheme();
    const colors = theme?.colors || {};
    const [activeTab, setActiveTab] = useState<'insights' | 'circle'>('circle');
    const [showActivityInbox, setShowActivityInbox] = useState(false);
    const { totalPendingCount, refreshCounts } = useActivityCounts();

    // - 'loading': Tab selected, showing loader (HomeScreen NOT mounted yet)
    // - 'mounting': HomeScreen mounted but hidden, waiting for onReady
    // - 'ready': HomeScreen has signaled ready (fade in content)
    const [insightsState, setInsightsState] = useState<'unvisited' | 'loading' | 'mounting' | 'ready'>('unvisited');
    const [hasVisitedCircle, setHasVisitedCircle] = useState(true); // Default tab starts visited
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

    // Pulse animation for loading state
    const pulseScale = useSharedValue(1);
    useEffect(() => {
        pulseScale.value = withRepeat(
            withSequence(
                withTiming(1.1, { duration: 600 }),
                withTiming(1, { duration: 600 })
            ),
            -1, // infinite repeat
            true // reverse
        );
    }, []);
    const pulseAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value }]
    }));


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

    // Transition insights through phases: unvisited -> loading -> mounting
    useEffect(() => {
        if (activeTab === 'insights' && insightsState === 'unvisited') {
            setInsightsState('loading');
        }
        // After loader is visible, mount HomeScreen in background after brief delay
        if (activeTab === 'insights' && insightsState === 'loading') {
            const timer = setTimeout(() => setInsightsState('mounting'), 100);
            return () => clearTimeout(timer);
        }
        if (activeTab === 'circle' && !hasVisitedCircle) {
            const timer = setTimeout(() => setHasVisitedCircle(true), 50);
            return () => clearTimeout(timer);
        }
    }, [activeTab, insightsState, hasVisitedCircle]);

    // Callback for when HomeScreen is ready to display
    const handleInsightsReady = () => {
        if (insightsState === 'mounting') {
            setInsightsState('ready');
        }
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



                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <TouchableOpacity
                            onPress={() => setShowActivityInbox(true)}
                            style={styles.settingsButton}
                        >
                            <View style={styles.tabIconContainer}>
                                <Inbox size={24} color={colors['muted-foreground']} />
                                {totalPendingCount > 0 && (
                                    <View style={[styles.notificationBadge, { backgroundColor: colors.destructive }]}>
                                        <Text style={styles.notificationText}>{totalPendingCount}</Text>
                                    </View>
                                )}
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.settingsButton}>
                            <Settings size={24} color={colors['muted-foreground']} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Lazy tab loading: Mount tabs only after first visit, then keep mounted */}
                <View style={styles.tabContent}>
                    {/* Show loader during 'loading' and 'mounting' phases */}
                    {activeTab === 'insights' && (insightsState === 'loading' || insightsState === 'mounting') && (
                        <Animated.View
                            style={[styles.screenContainer, styles.loadingContainer]}
                            entering={FadeIn.duration(200)}
                        >
                            <View style={{ alignItems: 'center', gap: 12 }}>
                                <Animated.View style={pulseAnimatedStyle}>
                                    <WeaveIcon size={48} color={colors.primary} />
                                </Animated.View>
                                <Text style={{
                                    fontSize: 14,
                                    color: colors['muted-foreground'],
                                    fontFamily: 'Inter_500Medium'
                                }}>
                                    Gathering insights...
                                </Text>
                            </View>
                        </Animated.View>
                    )}
                    {/* Mount HomeScreen only during 'mounting' and 'ready' phases */}
                    {(insightsState === 'mounting' || insightsState === 'ready') && (
                        <Animated.View
                            style={[
                                styles.screenContainer,
                                // Hide during mounting phase and when on another tab
                                (insightsState === 'mounting' || activeTab !== 'insights') && styles.hidden
                            ]}
                            entering={FadeIn.duration(300)}
                        >
                            <HomeScreen onReady={handleInsightsReady} />
                        </Animated.View>
                    )}
                    {hasVisitedCircle && (
                        <View style={[styles.screenContainer, activeTab !== 'circle' && styles.hidden]}>
                            <FriendsScreen />
                        </View>
                    )}
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
            <ProfileCompletionSheet />
            <ActivityInboxSheet
                visible={showActivityInbox}
                onClose={() => setShowActivityInbox(false)}
                onRequestHandled={refreshCounts}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    tabContent: { flex: 1 },
    screenContainer: { flex: 1 },
    hidden: { display: 'none' },
    loadingContainer: { alignItems: 'center', justifyContent: 'center' },
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
