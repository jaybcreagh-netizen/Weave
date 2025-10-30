import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, ScrollView, Dimensions, StyleSheet, FlatList } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withTiming, useAnimatedRef, runOnUI } from 'react-native-reanimated';
import { useRouter, useFocusEffect } from 'expo-router';
import { GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

import { FriendCard } from '../src/components/FriendCard';
import { TierTab } from '../src/components/tier-tab';
import { FAB } from '../src/components/fab';
import { InsightsFAB } from '../src/components/InsightsFAB';
import { MicroReflectionSheet } from '../src/components/MicroReflectionSheet';
import { InsightsSheet } from '../src/components/InsightsSheet';
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

const { width: screenWidth } = Dimensions.get('window');

const AnimatedFriendCardItem = ({ item, index, refreshKey }: { item: FriendModel; index: number; refreshKey: number }) => {
  const { registerRef, unregisterRef } = useCardGesture();
  const animatedRef = useAnimatedRef<Animated.View>();

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(25);

  useEffect(() => {
    runOnUI(registerRef)(item.id, animatedRef);
    return () => {
      runOnUI(unregisterRef)(item.id);
    };
  }, [item.id, animatedRef, registerRef, unregisterRef]);

  useEffect(() => {
    opacity.value = withDelay(index * 50, withTiming(1, { duration: 300 }));
    translateY.value = withDelay(index * 50, withTiming(0, { duration: 300 }));
  }, [index]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[animatedStyle, { marginBottom: 16 }]} key={`${item.id}-${refreshKey}`}>
      <FriendCard friend={item} animatedRef={animatedRef} />
    </Animated.View>
  );
};

function DashboardContent() {
  const router = useRouter();
  const { colors } = useTheme();
  const { isQuickWeaveOpen, microReflectionData, hideMicroReflectionSheet, showMicroReflectionSheet } = useUIStore();
  const allFriends = useFriends(); // Direct WatermelonDB subscription
  const { updateInteractionVibeAndNotes } = useInteractionStore();
  const { gesture, animatedScrollHandler, activeCardId } = useCardGesture();
  const { suggestions, suggestionCount, hasCritical, dismissSuggestion } = useSuggestions();
  const { convertToPlannedWeave, dismissIntention } = useIntentionStore();
  const intentions = useActiveIntentions();
  const [insightsSheetVisible, setInsightsSheetVisible] = useState(false);
  const [selectedIntention, setSelectedIntention] = useState<Intention | null>(null);

  const [refreshKey, setRefreshKey] = React.useState(0);

  useFocusEffect(
    React.useCallback(() => {
      // Reset activeCardId when screen gains focus to prevent stuck scales
      activeCardId.value = null;
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

  const friends = useMemo(() => {
    const processedFriends = [...allFriends]
      .filter(friend => friend && friend.name && !friend.isDormant)
      .sort((a, b) => a.weaveScore - b.weaveScore);
    return processedFriends.reduce((acc, friend) => {
      const tier = friend.dunbarTier === "InnerCircle" ? "inner" : friend.dunbarTier === "CloseFriends" ? "close" : "community";
      acc[tier].push(friend);
      return acc;
    }, { inner: [], close: [], community: [] });
  }, [allFriends]);

  const [activeTier, setActiveTier] = React.useState<'inner' | 'close' | 'community'>('inner');
  const scrollViewRef = React.useRef<ScrollView>(null);
  const tiers = ['inner', 'close', 'community'] as const;

  const handleTierChange = (tier: 'inner' | 'close' | 'community') => {
    setActiveTier(tier);
    scrollViewRef.current?.scrollTo({ x: tiers.indexOf(tier) * screenWidth, animated: true });
  };

  const onAddFriend = () => router.push(`/add-friend?tier=${activeTier}`);

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
      router.push(`/interaction-form?friendId=${suggestion.friendId}&category=${suggestion.action.prefilledCategory || ''}&mode=${suggestion.action.prefilledMode || 'detailed'}`);
    } else if (suggestion.action.type === 'plan') {
      router.push(`/interaction-form?friendId=${suggestion.friendId}&category=${suggestion.action.prefilledCategory || ''}&mode=plan`);
    }
  };

  const handleDismissSuggestion = async (suggestionId: string) => {
    const cooldownDays = getSuggestionCooldownDays(suggestionId);
    await dismissSuggestion(suggestionId, cooldownDays);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const renderTier = (tier: 'inner' | 'close' | 'community', scrollHandler: any) => {
    const currentFriends = friends[tier] || [];
    if (currentFriends.length === 0) {
      return (
        <View style={[styles.emptyTierContainer, { width: screenWidth }]}>
          <Text style={styles.emptyTierEmoji}>🕸️</Text>
          <Text style={[styles.emptyTierTitle, { color: colors.foreground }]}>Your weave is empty</Text>
        </View>
      );
    }
    return (
      <Animated.FlatList
        style={{ width: screenWidth }}
        contentContainerStyle={styles.tierScrollView}
        data={currentFriends}
        keyExtractor={(item) => `${item.id}-${refreshKey}`}
        scrollEnabled={!isQuickWeaveOpen}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => (
          <AnimatedFriendCardItem item={item} index={index} refreshKey={refreshKey} />
        )}
      />
    );
  };

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={[styles.tierTabsContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TierTab label="Inner Circle" shortLabel="Inner" count={friends.inner.length} maxCount={15} isActive={activeTier === 'inner'} onClick={() => handleTierChange('inner')} tier="inner" />
        <TierTab label="Close Friends" shortLabel="Close" count={friends.close.length} maxCount={50} isActive={activeTier === 'close'} onClick={() => handleTierChange('close')} tier="close" />
        <TierTab label="Community" shortLabel="Community" count={friends.community.length} maxCount={150} isActive={activeTier === 'community'} onClick={() => handleTierChange('community')} tier="community" />
      </View>

      <GestureDetector gesture={gesture}>
        <Animated.ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScroll}
          scrollEventThrottle={16}
          scrollEnabled={!isQuickWeaveOpen}
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
          router.push({ pathname: '/interaction-form', params: { friendId: intentionFriend.id, mode: 'plan', category: intention.interactionCategory || '' } });
        }}
        onDismiss={async (intention) => {
          await dismissIntention(intention.id);
          setSelectedIntention(null);
        }}
      />
    </View>
  );
}

export default function Friends() {
  return <DashboardContent />;
}

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    tierTabsContainer: { flexDirection: 'row', gap: 4, borderRadius: 16, padding: 4, marginHorizontal: 20, marginTop: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, borderWidth: 1 },
    emptyTierContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
    emptyTierEmoji: { fontSize: 50, marginBottom: 24, opacity: 0.6 },
    emptyTierTitle: { fontSize: 18, marginBottom: 12 },
    tierScrollView: { paddingHorizontal: 20, paddingVertical: 16 },
});