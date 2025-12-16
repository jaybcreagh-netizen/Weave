import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Dimensions, ScrollView } from 'react-native';
import Animated, { FadeIn, FadeOut, useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { useRouter, useFocusEffect } from 'expo-router';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Q } from '@nozbe/watermelondb';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { FAB } from '@/shared/components/fab';
import { InsightsFAB, InsightsSheet } from '@/modules/insights';
import { useGlobalUI } from '@/shared/context/GlobalUIContext';
import { usePlans, PlanService, getSuggestionCooldownDays } from '@/modules/interactions';
import { useSuggestions } from '@/modules/interactions';
import { Suggestion } from '@/shared/types/common';
import { useTheme } from '@/shared/hooks/useTheme';
import { useCardGesture } from '@/shared/context/CardGestureContext';
import { SuggestionTrackerService } from '@/modules/interactions';
import Intention from '@/db/models/Intention';
import { SimpleTutorialTooltip } from '@/shared/components/SimpleTutorialTooltip';
import { useTutorial } from '@/shared/context/TutorialContext';
import { database } from '@/db';
import FriendModel from '@/db/models/Friend';

// Internal Module Imports (Relative to avoid circular dependencies)
import { checkAndApplyDormancy } from '../services/lifecycle.service';
import { FriendSearchBar, SearchFilters, SortOption } from '../components/FriendSearchBar';
import { FriendSearchResults } from '../components/FriendSearchResults';
import { FriendTierList } from '../components/FriendTierList';
import { FriendManagementModal } from '../components/FriendManagementModal';
import { TierInfo } from '../components/TierInfo';
import { TierSegmentedControl } from '../components/TierSegmentedControl';
import { AddFriendMenu } from '../components/AddFriendMenu';
import { IntentionActionSheet } from '../components/IntentionActionSheet';
import FriendBadgePopup from '../components/FriendBadgePopup';
import { Tier } from '../types';

const { width: screenWidth } = Dimensions.get('window');

export function FriendsDashboardScreen() {
    const router = useRouter();
    const { colors } = useTheme();
    const { isQuickWeaveOpen, showMicroReflectionSheet } = useGlobalUI();
    const { gesture, animatedScrollHandler, activeCardId } = useCardGesture();
    const { suggestions, dismissSuggestion } = useSuggestions();

    const suggestionCount = suggestions.length;
    const hasCritical = suggestions.some(s => s.priority === 'high');
    const { dismissIntention, intentions } = usePlans();
    const [insightsSheetVisible, setInsightsSheetVisible] = useState(false);
    const [selectedIntention, setSelectedIntention] = useState<Intention | null>(null);
    const [addFriendMenuVisible, setAddFriendMenuVisible] = useState(false);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchFilters, setSearchFilters] = useState<SearchFilters>({
        healthStatus: [],
        archetypes: [],
    });
    const [sortOption, setSortOption] = useState<SortOption>('default');

    // Load persisted sort preference
    useEffect(() => {
        AsyncStorage.getItem('friendSortPreference').then(stored => {
            if (stored && ['default', 'needs-attention', 'thriving-first', 'recently-connected', 'longest-since', 'alphabetical'].includes(stored)) {
                setSortOption(stored as SortOption);
            }
        });
    }, []);

    // Persist sort preference when it changes
    const handleSortChange = useCallback((newSort: SortOption) => {
        setSortOption(newSort);
        AsyncStorage.setItem('friendSortPreference', newSort);
    }, []);

    // Determine if search/sort view is active (any non-default state)
    const isSearchActive = useMemo(() => {
        return searchQuery.trim().length > 0 ||
            searchFilters.healthStatus.length > 0 ||
            searchFilters.archetypes.length > 0 ||
            sortOption !== 'default';
    }, [searchQuery, searchFilters, sortOption]);

    // Manual friend count for segmented control (simplified fetch)
    const [friendCounts, setFriendCounts] = useState({ inner: 0, close: 0, community: 0 });

    // Circle dashboard tutorial state
    const {
        hasAddedFirstFriend,
        hasSeenQuickWeaveIntro,
        hasPerformedQuickWeave,
        markQuickWeaveIntroSeen,
        markQuickWeavePerformed,
    } = useTutorial();

    const [showCircleTutorial, setShowCircleTutorial] = useState(false);
    const [circleTutorialStep, setCircleTutorialStep] = useState(0);

    // Use a simple observable for total friend count to trigger tutorials
    const [totalFriendsCount, setTotalFriendsCount] = useState(0);

    useEffect(() => {
        // Quick and dirty way to get counts for the segment control and tutorial check
        // In a future refactor, TierSegmentedControl should observe these counts itself
        const subscription = database.get<FriendModel>('friends').query().observe().subscribe(friends => {
            const counts = { inner: 0, close: 0, community: 0 };
            friends.forEach(f => {
                if (f.dunbarTier === 'InnerCircle') counts.inner++;
                else if (f.dunbarTier === 'CloseFriends') counts.close++;
                else counts.community++;
            });
            setFriendCounts(counts);
            setTotalFriendsCount(friends.length);

            // Check for dormancy whenever friend list updates
            if (friends.length > 0) {
                checkAndApplyDormancy();
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            activeCardId.value = null;
            let isFocused = true;
            return () => {
                isFocused = false;
                if (activeCardId.value !== null) {
                    activeCardId.value = null;
                }
            };
        }, [activeCardId])
    );

    // Show Circle dashboard tutorial when user has added first friend but hasn't seen intro
    useEffect(() => {
        if (hasAddedFirstFriend && !hasSeenQuickWeaveIntro && !hasPerformedQuickWeave && totalFriendsCount > 0) {
            const timer = setTimeout(() => {
                setShowCircleTutorial(true);
                setCircleTutorialStep(0);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [hasAddedFirstFriend, hasSeenQuickWeaveIntro, hasPerformedQuickWeave, totalFriendsCount]);

    // Watch for QuickWeave being opened
    useEffect(() => {
        if (showCircleTutorial && circleTutorialStep === 1 && isQuickWeaveOpen) {
            handleCircleTutorialComplete();
        }
    }, [isQuickWeaveOpen, showCircleTutorial, circleTutorialStep]);

    const [activeTier, setActiveTier] = React.useState<'inner' | 'close' | 'community'>('inner');
    const scrollViewRef = React.useRef<ScrollView>(null);
    const tiers = ['inner', 'close', 'community'] as const;

    const handleTierChange = (tier: 'inner' | 'close' | 'community') => {
        setActiveTier(tier);
        scrollViewRef.current?.scrollTo({ x: tiers.indexOf(tier) * screenWidth, animated: true });
    };

    const handleCircleTutorialNext = useCallback(() => {
        if (circleTutorialStep === 0) setCircleTutorialStep(1);
        else setShowCircleTutorial(false);
    }, [circleTutorialStep]);

    const handleCircleTutorialComplete = useCallback(async () => {
        await markQuickWeaveIntroSeen();
        await markQuickWeavePerformed();
        setShowCircleTutorial(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, [markQuickWeaveIntroSeen, markQuickWeavePerformed]);

    const handleCircleTutorialSkip = useCallback(async () => {
        await markQuickWeaveIntroSeen();
        setShowCircleTutorial(false);
    }, [markQuickWeaveIntroSeen]);

    const onAddFriend = () => setAddFriendMenuVisible(true);

    const handleAddSingle = () => {
        router.push(`/add-friend?tier=${activeTier}`);
    };

    const handleAddBatch = () => {
        router.push(`/batch-add-friends?tier=${activeTier}`);
    };

    const onScroll = (event: any) => {
        const slide = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
        if (slide !== tiers.indexOf(activeTier)) {
            setActiveTier(tiers[slide]);
        }
    };

    const handleActOnSuggestion = async (suggestion: Suggestion) => {
        setInsightsSheetVisible(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await SuggestionTrackerService.trackSuggestionActed(suggestion.id);

        if (suggestion.category === 'portfolio') return;

        if (suggestion.action.type === 'reflect') {
            const friend = await database.get<FriendModel>('friends').find(suggestion.friendId);
            if (friend && suggestion.action.interactionId) {
                const activityLabel = suggestion.subtitle.match(/your (.*?) with/)?.[1] || 'time together';
                showMicroReflectionSheet({
                    friendId: suggestion.friendId,
                    friendName: suggestion.friendName || '',
                    activityId: '',
                    activityLabel,
                    interactionId: suggestion.action.interactionId,
                    friendArchetype: friend.archetype,
                });
            }
        } else if (suggestion.action.type === 'log') {
            router.push(`/weave-logger?friendId=${suggestion.friendId}`);
        } else if (suggestion.action.type === 'plan') {
            router.push(`/friend-profile?friendId=${suggestion.friendId}`);
        }
    };

    const handleDismissSuggestion = async (suggestionId: string) => {
        const cooldownDays = getSuggestionCooldownDays(suggestionId);
        await dismissSuggestion(suggestionId, cooldownDays);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    // Safe mapping from internal view state to database enum
    const getDbTier = (viewTier: 'inner' | 'close' | 'community'): Tier => {
        switch (viewTier) {
            case 'inner': return 'InnerCircle';
            case 'close': return 'CloseFriends';
            default: return 'Community';
        }
    };

    const renderTier = (viewTier: 'inner' | 'close' | 'community') => {
        return (
            <FriendTierList
                tier={getDbTier(viewTier)}
                scrollHandler={animatedScrollHandler}
                isQuickWeaveOpen={isQuickWeaveOpen}
            />
        );
    };

    const handleClearSearch = useCallback(() => {
        setSearchQuery('');
        setSearchFilters({ healthStatus: [], archetypes: [] });
        handleSortChange('default');
    }, [handleSortChange]);

    return (
        <View className="flex-1" style={{ backgroundColor: colors.background }}>
            {/* Search Bar - Always visible */}
            <FriendSearchBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                filters={searchFilters}
                onFiltersChange={setSearchFilters}
                sortOption={sortOption}
                onSortChange={handleSortChange}
                isActive={isSearchActive}
                onClear={handleClearSearch}
            />

            {/* Conditional Rendering: Search Results or Tier View */}
            {isSearchActive ? (
                /* Search Results View */
                <Animated.View
                    key="search-results"
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(150)}
                    style={{ flex: 1 }}
                >
                    <GestureDetector gesture={gesture}>
                        <FriendSearchResults
                            searchQuery={searchQuery}
                            filters={searchFilters}
                            sortOption={sortOption}
                            scrollHandler={animatedScrollHandler}
                            isQuickWeaveOpen={isQuickWeaveOpen}
                        />
                    </GestureDetector>
                </Animated.View>
            ) : (
                /* Normal Tier View */
                <Animated.View
                    key="tier-view"
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(150)}
                    style={{ flex: 1 }}
                >
                    <TierSegmentedControl
                        activeTier={activeTier}
                        onTierChange={handleTierChange}
                        counts={friendCounts}
                    />
                    <TierInfo activeTier={activeTier} />

                    <GestureDetector gesture={gesture}>
                        <Animated.ScrollView
                            ref={scrollViewRef as any}
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            onMomentumScrollEnd={onScroll}
                            scrollEventThrottle={16}
                            scrollEnabled={!isQuickWeaveOpen}
                            directionalLockEnabled={true}
                        >
                            {renderTier('inner')}
                            {renderTier('close')}
                            {renderTier('community')}
                        </Animated.ScrollView>
                    </GestureDetector>
                </Animated.View>
            )}

            <FAB onClick={onAddFriend} />

            <InsightsFAB
                isVisible={suggestionCount > 0 || intentions.length > 0}
                hasSuggestions={suggestionCount > 0}
                hasCritical={hasCritical}
                onClick={() => setInsightsSheetVisible(true)}
            />

            {/* MicroReflectionSheet is handled globally by QuickWeaveProvider in _layout.tsx */}

            <InsightsSheet
                isVisible={insightsSheetVisible}
                suggestions={suggestions}
                intentions={intentions}
                onClose={() => setInsightsSheetVisible(false)}
                onAct={handleActOnSuggestion}
                onLater={handleDismissSuggestion}
                onIntentionPress={(intention) => {
                    setSelectedIntention(intention);
                    setInsightsSheetVisible(false);
                }}
            />

            <IntentionActionSheet
                intention={selectedIntention}
                isOpen={selectedIntention !== null}
                onClose={() => setSelectedIntention(null)}
                onSchedule={async (intention, intentionFriend) => {
                    await PlanService.convertIntentionToPlan(intention.id);
                    setSelectedIntention(null);
                    router.push({ pathname: '/friend-profile', params: { friendId: intentionFriend.id } });
                }}
                onDismiss={async (intention) => {
                    await dismissIntention(intention.id);
                    setSelectedIntention(null);
                }}
            />

            <AddFriendMenu
                isOpen={addFriendMenuVisible}
                onClose={() => setAddFriendMenuVisible(false)}
                onAddSingle={handleAddSingle}
                onAddBatch={handleAddBatch}
            />

            {showCircleTutorial && circleTutorialStep === 0 && (
                <SimpleTutorialTooltip
                    visible={true}
                    title="Your Circle dashboard"
                    description="Tap any friend card to open their profile, where you can set intentions, plan future weaves, or log past moments in detail."
                    onNext={handleCircleTutorialNext}
                    onSkip={handleCircleTutorialSkip}
                    currentStep={0}
                    totalSteps={2}
                />
            )}

            {showCircleTutorial && circleTutorialStep === 1 && (
                <SimpleTutorialTooltip
                    visible={true}
                    title="QuickWeave: The fast way"
                    description="For quick logging, press and hold any friend card. A radial menu will appear with interaction options."
                    onSkip={handleCircleTutorialSkip}
                    currentStep={1}
                    totalSteps={2}
                />
            )}
        </View>
    );
}


