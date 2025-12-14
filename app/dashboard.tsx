import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, ScrollView, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Sparkles, Users, Settings } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { SettingsModal } from '@/components/settings-modal';
import { SocialBatterySheet } from '@/components/home/SocialBatterySheet';
import BadgeUnlockModal from '@/components/BadgeUnlockModal';
import { useUserProfileStore } from '@/modules/auth';
import { useUIStore } from '@/shared/stores/uiStore';
import { useSuggestions } from '@/modules/interactions';
import HomeScreen from './_home';
import FriendsScreen from './_friends';

const { width: screenWidth } = Dimensions.get('window');

export default function Dashboard() {
    const theme = useTheme();
    const colors = theme?.colors || {};
    const [activeTab, setActiveTab] = useState<'insights' | 'circle'>('circle');
    const [showSettings, setShowSettings] = useState(false);
    const {
        isSocialBatterySheetOpen,
        openSocialBatterySheet,
        closeSocialBatterySheet
    } = useUIStore();
    const { submitBatteryCheckin } = useUserProfileStore();
    const { suggestions } = useSuggestions();
    const suggestionCount = suggestions.length;
    const scrollViewRef = useRef<ScrollView>(null);

    const handleTabPress = (tab: 'insights' | 'circle') => {
        setActiveTab(tab);
        const index = tab === 'insights' ? 0 : 1;
        scrollViewRef.current?.scrollTo({ x: index * screenWidth, animated: true });
    };

    const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const slide = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
        const newTab = slide === 0 ? 'insights' : 'circle';
        if (newTab !== activeTab) {
            setActiveTab(newTab);
        }
    };

    // Auto-repair specific logic for broken tiers (one-time check on mount)
    // This fixes friends that were saved with "inner"/"close" instead of "InnerCircle"/"CloseFriends"
    React.useEffect(() => {
        const repairTiers = async () => {
            const { database } = require('@/db');
            const FriendModel = require('@/db/models/Friend').default;

            const friendsToFix = await database.get('friends').query().fetch();
            const updates: any[] = [];

            for (const friend of friendsToFix) {
                let needsFix = false;
                let newTier = '';

                if (friend.dunbarTier === 'inner') {
                    needsFix = true;
                    newTier = 'InnerCircle';
                } else if (friend.dunbarTier === 'close') {
                    needsFix = true;
                    newTier = 'CloseFriends';
                } else if (friend.dunbarTier === 'community') {
                    needsFix = true;
                    newTier = 'Community'; // Ensure capitalization if needed, though Community is usually correct
                }

                if (needsFix) {
                    updates.push(friend.prepareUpdate((f: any) => {
                        f.dunbarTier = newTier;
                    }));
                }
            }

            if (updates.length > 0) {
                console.log(`Repaired ${updates.length} friends with incorrect tier values.`);
                await database.write(async () => {
                    await database.batch(...updates);
                });
            }
        };

        repairTiers();
    }, []);

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

                <ScrollView
                    ref={scrollViewRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={onScroll}
                    scrollEventThrottle={16}
                    style={styles.scrollView}
                    contentOffset={{ x: screenWidth, y: 0 }}
                >
                    <View style={{ width: screenWidth, flex: 1 }}>
                        <HomeScreen />
                    </View>
                    <View style={{ width: screenWidth, flex: 1 }}>
                        <FriendsScreen />
                    </View>
                </ScrollView>

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
    scrollView: { flex: 1 },
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
