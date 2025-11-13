import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, ScrollView, Dimensions, StyleSheet, FlatList } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withTiming, useAnimatedRef, runOnUI } from 'react-native-reanimated';
import { useRouter, useFocusEffect } from 'expo-router';
import { GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

import { FriendListRow } from '../src/components/FriendListRow';
import { TierSegmentedControl } from '../src/components/TierSegmentedControl';
import { TierInfo } from '../src/components/TierInfo';
import { FAB } from '../src/components/fab';
import { InsightsFAB } from '../src/components/InsightsFAB';
import { MicroReflectionSheet } from '../src/components/MicroReflectionSheet';
import { InsightsSheet } from '../src/components/InsightsSheet';
import { AddFriendMenu } from '../src/components/AddFriendMenu';
import { useUIStore } from '../src/stores/uiStore';
import { useFriends } from '../src/hooks/useFriends';
import { useInteractionStore } from '../src/stores/interactionStore';
import { useSuggestions } from '../src/hooks/useSuggestions';
import { getSuggestionCooldownDays } from '../src/lib/suggestion-engine';
import { Suggestion } from '../src/types/suggestions';
import { checkAndApplyDormancy } from '../src/lib/lifecycle-manager';
import FriendModel from '../src/db/models/Friend';
import { useTheme } from '../src/hooks/useTheme';
import { CardGestureProvider, useCardGesture } from '../src/context/CardGestureContext';
import { trackSuggestionActed } from '../src/lib/suggestion-tracker';
import { useActiveIntentions } from '../src/hooks/useIntentions';
import { useIntentionStore } from '../src/stores/intentionStore';
import { IntentionActionSheet } from '../src/components/IntentionActionSheet';
import Intention from '../src/db/models/Intention';
import { tierColors } from '../src/lib/constants';
import { SimpleTutorialTooltip } from '../src/components/SimpleTutorialTooltip';
import { useTutorialStore } from '../src/stores/tutorialStore';

const { width: screenWidth } = Dimensions.get('window');

// Helper to create subtle tier background colors
const getTierBackground = (tier: 'inner' | 'close' | 'community', isDarkMode: boolean) => {
  const tierColorMap = {
    inner: tierColors.InnerCircle,
    close: tierColors.CloseFriends,
    community: tierColors.Community,
  };
  const color = tierColorMap[tier];
  // Very subtle tinting - 3% opacity for light mode, 5% for dark mode
  const opacity = isDarkMode ? '0D' : '08'; // Hex opacity values
  return `${color}${opacity}`;
};

const AnimatedFriendCardItem = React.memo(({
  item,
  index,
  refreshKey,
}: {
  item: FriendModel;
  index: number;
  refreshKey: number;
}) => {
  const { registerRef, unregisterRef } = useCardGesture();
  const animatedRef = useAnimatedRef<Animated.View>();
  const hasAnimated = useRef(false);

  const opacity = useSharedValue(hasAnimated.current ? 1 : 0);
  const translateY = useSharedValue(hasAnimated.current ? 0 : 25);

  useEffect(() => {
    runOnUI(registerRef)(item.id, animatedRef);
    return () => {
      runOnUI(unregisterRef)(item.id);
    };
  }, [item.id, animatedRef, registerRef, unregisterRef]);

  // Only animate on initial mount, not on refreshKey changes
  useEffect(() => {
    if (!hasAnimated.current) {
      opacity.value = withDelay(index * 35, withTiming(1, { duration: 250 }));
      translateY.value = withDelay(index * 35, withTiming(0, { duration: 250 }));
      hasAnimated.current = true;
    }
  }, [index]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[animatedStyle, { marginBottom: 12 }]}>
      <FriendListRow friend={item} animatedRef={animatedRef} />
    </Animated.View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if friend data actually changed
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.weaveScore === nextProps.item.weaveScore &&
    prevProps.item.lastUpdated === nextProps.item.lastUpdated &&
    prevProps.refreshKey === nextProps.refreshKey
  );
});

function DashboardContent() {
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const { isQuickWeaveOpen, microReflectionData, hideMicroReflectionSheet, showMicroReflectionSheet } = useUIStore();
  const allFriends = useFriends(); // Direct WatermelonDB subscription
  const { updateInteractionVibeAndNotes } = useInteractionStore();
  const { gesture, animatedScrollHandler, activeCardId } = useCardGesture();
  const { suggestions, suggestionCount, hasCritical, dismissSuggestion } = useSuggestions();
  const { convertToPlannedWeave, dismissIntention } = useIntentionStore();
  const intentions = useActiveIntentions();
  const [insightsSheetVisible, setInsightsSheetVisible] = useState(false);
  const [selectedIntention, setSelectedIntention] = useState<Intention | null>(null);
  const [addFriendMenuVisible, setAddFriendMenuVisible] = useState(false);

  const [refreshKey, setRefreshKey] = React.useState(0);

  // Circle dashboard tutorial state - comprehensive approach
  const hasAddedFirstFriend = useTutorialStore((state) => state.hasAddedFirstFriend);
  const hasSeenQuickWeaveIntro = useTutorialStore((state) => state.hasSeenQuickWeaveIntro);
  const hasPerformedQuickWeave = useTutorialStore((state) => state.hasPerformedQuickWeave);
  const markQuickWeaveIntroSeen = useTutorialStore((state) => state.markQuickWeaveIntroSeen);
  const markQuickWeavePerformed = useTutorialStore((state) => state.markQuickWeavePerformed);

  const [showCircleTutorial, setShowCircleTutorial] = useState(false);
  const [circleTutorialStep, setCircleTutorialStep] = useState(0);

  useFocusEffect(
    React.useCallback(() => {
      // Reset activeCardId when screen gains focus to prevent stuck scales
      activeCardId.value = null;
      // Increment refresh key to force friend list re-render (fixes tier changes not updating)
      setRefreshKey(prev => prev + 1);
      return () => {
        // Also reset when leaving the screen
        activeCardId.value = null;
      };
    }, [activeCardId])
  );

  useEffect(() => {
    if (allFriends.length > 0) {
      checkAndApplyDormancy(allFriends);
    }
  }, [allFriends]);

  // Show Circle dashboard tutorial when user has added first friend but hasn't seen intro
  useEffect(() => {
    if (hasAddedFirstFriend && !hasSeenQuickWeaveIntro && !hasPerformedQuickWeave && allFriends.length > 0) {
      // Wait a brief moment for the UI to settle
      const timer = setTimeout(() => {
        setShowCircleTutorial(true);
        setCircleTutorialStep(0);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [hasAddedFirstFriend, hasSeenQuickWeaveIntro, hasPerformedQuickWeave, allFriends.length]);

  // Watch for QuickWeave being opened - this means user performed the gesture
  useEffect(() => {
    if (showCircleTutorial && circleTutorialStep === 1 && isQuickWeaveOpen) {
      // User successfully performed QuickWeave gesture!
      handleCircleTutorialComplete();
    }
  }, [isQuickWeaveOpen, showCircleTutorial, circleTutorialStep]);

  const friends = useMemo(() => {
    const processedFriends = [...allFriends]
      .filter(friend => friend && friend.name && !friend.isDormant)
      .sort((a, b) => a.weaveScore - b.weaveScore);
    return processedFriends.reduce((acc, friend) => {
      const tier = friend.dunbarTier === "InnerCircle" ? "inner" : friend.dunbarTier === "CloseFriends" ? "close" : "community";
      acc[tier].push(friend);
      return acc;
    }, { inner: [], close: [], community: [] } as Record<'inner' | 'close' | 'community', FriendModel[]>);
  }, [allFriends]);  // Add tier dependency

  const [activeTier, setActiveTier] = React.useState<'inner' | 'close' | 'community'>('inner');
  const scrollViewRef = React.useRef<ScrollView>(null);
  const tiers = ['inner', 'close', 'community'] as const;

  const handleTierChange = (tier: 'inner' | 'close' | 'community') => {
    setActiveTier(tier);
    scrollViewRef.current?.scrollTo({ x: tiers.indexOf(tier) * screenWidth, animated: true });
  };

  // Circle dashboard tutorial handlers
  const handleCircleTutorialNext = useCallback(() => {
    if (circleTutorialStep === 0) {
      // Move from "tap to open" to "press and hold" step
      setCircleTutorialStep(1);
    } else {
      // Tutorial complete - user will perform gesture or skip
      setShowCircleTutorial(false);
    }
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

    // Track that the user acted on this suggestion
    await trackSuggestionActed(suggestion.id);

    // Portfolio insights don't have a specific friend - just close the sheet
    if (suggestion.category === 'portfolio') {
      // Portfolio insights are informational
      // Could navigate to a portfolio view in the future
      return;
    }

    // Navigate based on action type
    if (suggestion.action.type === 'reflect') {
      // Open micro-reflection sheet for this interaction
      const friend = allFriends.find(f => f.id === suggestion.friendId);
      if (friend && suggestion.action.interactionId) {
        const activityLabel = suggestion.subtitle.match(/your (.*?) with/)?.[1] || 'time together';
        showMicroReflectionSheet({
          friendId: suggestion.friendId,
          friendName: suggestion.friendName,
          activityId: '', // Not needed for reflection
          activityLabel,
          interactionId: suggestion.action.interactionId,
          friendArchetype: friend.archetype,
        });
      }
    } else if (suggestion.action.type === 'log') {
      router.push(`/weave-logger?friendId=${suggestion.friendId}`);
    } else if (suggestion.action.type === 'plan') {
      // Navigate to friend profile where they can use PlanWizard
      router.push(`/friend-profile?friendId=${suggestion.friendId}`);
    }
  };

  const handleDismissSuggestion = async (suggestionId: string) => {
    const cooldownDays = getSuggestionCooldownDays(suggestionId);
    await dismissSuggestion(suggestionId, cooldownDays);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Determine which tiers should be rendered (current + adjacent for smooth swiping)
  const shouldRenderTier = useCallback((tier: 'inner' | 'close' | 'community') => {
    const currentIndex = tiers.indexOf(activeTier);
    const tierIndex = tiers.indexOf(tier);
    // Render current tier and adjacent tiers (one before, one after)
    return Math.abs(currentIndex - tierIndex) <= 1;
  }, [activeTier, tiers]);

  const renderTier = (tier: 'inner' | 'close' | 'community', scrollHandler: any) => {
    const currentFriends = friends[tier] || [];
    const tierBgColor = getTierBackground(tier, isDarkMode);

    // Lazy rendering: only render visible and adjacent tiers
    if (!shouldRenderTier(tier)) {
      return (
        <View style={{ width: screenWidth, backgroundColor: tierBgColor }} />
      );
    }

    if (currentFriends.length === 0) {
      return (
        <View style={[styles.emptyTierContainer, { width: screenWidth, backgroundColor: tierBgColor }]}>
          <Text style={styles.emptyTierEmoji}>🧵</Text>
          <Text style={[styles.emptyTierTitle, { color: colors.foreground }]}>Your weave is empty</Text>
        </View>
      );
    }
    return (
      <Animated.FlatList
        style={{ width: screenWidth, backgroundColor: tierBgColor }}
        contentContainerStyle={styles.tierScrollView}
        data={currentFriends}
        keyExtractor={(item) => item.id}
        scrollEnabled={!isQuickWeaveOpen}
        onScroll={scrollHandler}
        scrollEventThrottle={8} // 120fps (was 16 for 60fps)
        renderItem={({ item, index }) => (
          <AnimatedFriendCardItem
            item={item}
            index={index}
            refreshKey={refreshKey}
          />
        )}
        // Performance optimizations for 120fps scrolling
        removeClippedSubviews={true}
        maxToRenderPerBatch={5} // Smaller batches for smoother rendering
        updateCellsBatchingPeriod={30} // Faster batching (was 50ms)
        initialNumToRender={8} // Render fewer items initially
        windowSize={3} // Smaller window for better memory usage
        getItemLayout={(data, index) => ({
          length: 72, // Approximate item height (card + margin)
          offset: 72 * index,
          index,
        })}
        disableIntervalMomentum={true} // Smoother scroll feel
      />
    );
  };

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <TierSegmentedControl
        activeTier={activeTier}
        onTierChange={handleTierChange}
        counts={{
          inner: friends.inner.length,
          close: friends.close.length,
          community: friends.community.length,
        }}
      />
      <TierInfo activeTier={activeTier} />

      <GestureDetector gesture={gesture}>
        <Animated.ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScroll}
          scrollEventThrottle={16}
          scrollEnabled={!isQuickWeaveOpen}
          directionalLockEnabled={true}
        >
          {renderTier('inner', animatedScrollHandler)}
          {renderTier('close', animatedScrollHandler)}
          {renderTier('community', animatedScrollHandler)}
        </Animated.ScrollView>
      </GestureDetector>
      
      <FAB onClick={onAddFriend} />

      <InsightsFAB
        hasSuggestions={suggestionCount > 0}
        hasCritical={hasCritical}
        onClick={() => setInsightsSheetVisible(true)}
      />

      <MicroReflectionSheet
        isVisible={microReflectionData !== null}
        friendName={microReflectionData?.friendName || ''}
        activityLabel={microReflectionData?.activityLabel || ''}
        activityId={microReflectionData?.activityId || ''}
        friendArchetype={microReflectionData?.friendArchetype}
        onSave={async (data) => {
          if (microReflectionData) {
            await updateInteractionVibeAndNotes(
              microReflectionData.interactionId,
              data.vibe,
              data.notes
            );
          }
          hideMicroReflectionSheet();
        }}
        onSkip={hideMicroReflectionSheet}
      />

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
          await convertToPlannedWeave(intention.id);
          setSelectedIntention(null);
          // Navigate to friend profile where they can schedule with PlanWizard
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

      {/* Circle Dashboard Tutorial Tooltips */}
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

export default function Friends() {
  return <DashboardContent />;
}

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    emptyTierContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
    emptyTierEmoji: { fontSize: 50, marginBottom: 24, opacity: 0.6 },
    emptyTierTitle: { fontSize: 18, marginBottom: 12 },
    tierScrollView: { paddingHorizontal: 20, paddingVertical: 16 },
});