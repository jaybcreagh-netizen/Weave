import React, { useEffect, useCallback } from 'react';
import { View, Text, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing, useAnimatedScrollHandler, runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/shared/hooks/useTheme';
import { useFriendProfileData, useFriendTimeline } from '@/modules/relationships';
import { useFriendProfileModals } from '@/modules/relationships';

// Components
import {
  ProfileHeader,
  ActionButtons,
  LifeEventsSection,
  TimelineList,
  FriendProfileModals,
  IntentionsFAB
} from '@/modules/relationships';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';

export default function FriendProfile() {
  const router = useRouter();
  const { colors } = useTheme();
  const { friendId } = useLocalSearchParams();

  // Validate friendId early
  const validFriendId = typeof friendId === 'string' ? friendId : undefined;
  const hasInvalidId = !validFriendId || Array.isArray(friendId);

  const {
    friend,
    friendModel,
    interactions,
    friendIntentions,
    activeLifeEvents,
    isDataLoaded,
    hasMoreInteractions,
    handleLoadMore,
    deleteFriend,
    deleteWeave,
    updateReflection,
    updateInteraction,
    createIntention,
    dismissIntention,
    refreshLifeEvents
  } = useFriendProfileData(validFriendId);

  const { timelineSections } = useFriendTimeline(interactions);

  // Use the new hook for modal state
  const modals = useFriendProfileModals();

  const scrollY = useSharedValue(0);

  // Page entrance animations
  const pageOpacity = useSharedValue(0);
  const headerOpacity = useSharedValue(0);
  const buttonsOpacity = useSharedValue(0);

  useEffect(() => {
    // Only animate when data is loaded
    if (isDataLoaded) {
      // Page container fades in first
      pageOpacity.value = withTiming(1, {
        duration: 400,
        easing: Easing.out(Easing.quad),
      });

      // Friend card and header elements - sync with timeline base delay
      headerOpacity.value = withDelay(
        100,
        withTiming(1, {
          duration: 600,
          easing: Easing.out(Easing.quad),
        })
      );

      // Buttons fade in just before timeline starts (timeline starts at 200ms)
      buttonsOpacity.value = withDelay(
        150,
        withTiming(1, {
          duration: 600,
          easing: Easing.out(Easing.quad),
        })
      );
    } else {
      // Reset animations when loading new friend
      pageOpacity.value = 0;
      headerOpacity.value = 0;
      buttonsOpacity.value = 0;
    }
  }, [isDataLoaded]);

  const pageAnimatedStyle = useAnimatedStyle(() => ({
    opacity: pageOpacity.value,
  }));

  const lastHapticY = useSharedValue(0);
  const HAPTIC_SCROLL_THRESHOLD = 150; // Fire haptic every 150px of scroll

  const triggerScrollHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Scroll handler moved entirely to UI thread for 90fps performance
  const animatedScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      scrollY.value = event.contentOffset.y;

      // Subtle haptic feedback every HAPTIC_SCROLL_THRESHOLD pixels
      const scrollDistance = Math.abs(scrollY.value - lastHapticY.value);
      if (scrollDistance > HAPTIC_SCROLL_THRESHOLD) {
        lastHapticY.value = scrollY.value;
        runOnJS(triggerScrollHaptic)();
      }
    },
  });

  useEffect(() => {
    if (friendId && typeof friendId === 'string') {
      modals.resetModals();
    }
  }, [friendId, modals.resetModals]);

  // Define all handlers as useCallback BEFORE any conditional returns (Rules of Hooks)
  const handleEdit = useCallback(() => {
    if (friend) {
      router.push(`/edit-friend?friendId=${friend.id}`);
    }
  }, [friend, router]);

  const handleDeleteFriend = useCallback(() => {
    if (friend) {
      Alert.alert("Delete Friend", "Are you sure you want to remove this friend from your weave?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive", onPress: async () => {
            await deleteFriend(friend.id);
            if (router.canGoBack()) {
              router.back();
            }
          }
        },
      ]);
    }
  }, [friend, deleteFriend, router]);

  const handleDeleteInteraction = useCallback(async (interactionId: string) => {
    try {
      await deleteWeave(interactionId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error deleting interaction:', error);
      Alert.alert('Error', 'Failed to delete weave. Please try again.');
    }
  }, [deleteWeave]);

  const handleEditInteractionWrapper = useCallback((interactionId: string) => {
    const interaction = interactions?.find(i => i.id === interactionId);
    if (interaction) {
      modals.handleEditInteraction(interaction);
    }
  }, [interactions, modals]);

  // Show error if friendId is invalid
  if (hasInvalidId) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1, padding: 20 }}>
          <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: '600', marginBottom: 12 }}>
            Friend Not Found
          </Text>
          <Text style={{ color: colors['muted-foreground'], fontSize: 14, textAlign: 'center', marginBottom: 24 }}>
            This friend profile couldn't be loaded. The link may be invalid.
          </Text>
          <View
            style={{
              backgroundColor: colors.primary,
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 8,
            }}
          >
            <Text
              style={{ color: colors['primary-foreground'], fontSize: 16, fontWeight: '600' }}
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/');
                }
              }}
            >
              Go Back
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Show loading state until data is actually loaded (AFTER all hooks)
  if (!isDataLoaded || !friend || !friendModel) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaView
        key={`friend-profile-${friendId}`}
        style={[styles.safeArea, { backgroundColor: colors.background }]}
      >
        <Animated.View style={[{ flex: 1 }, pageAnimatedStyle]}>

          <TimelineList
            sections={timelineSections}
            onScroll={animatedScrollHandler}
            onLoadMore={handleLoadMore}
            hasMore={hasMoreInteractions}
            onInteractionPress={modals.setSelectedInteraction}
            onDeleteInteraction={handleDeleteInteraction}
            onEditInteraction={handleEditInteractionWrapper}
            ListHeaderComponent={
              <View>
                <ProfileHeader
                  friend={friendModel}
                  headerOpacity={headerOpacity}
                  onBack={() => {
                    if (router.canGoBack()) {
                      router.back();
                    }
                  }}
                  onEdit={handleEdit}
                  onDelete={handleDeleteFriend}
                  onGlobalCalendar={() => router.push(`/global-calendar?fromFriendId=${friend.id}`)}
                  onShowBadgePopup={() => modals.setShowBadgePopup(true)}
                  onShowTierFit={() => modals.setShowTierFitSheet(true)}
                />

                <ActionButtons
                  buttonsOpacity={buttonsOpacity}
                  onLogWeave={() => router.push({ pathname: '/weave-logger', params: { friendId: friend.id } })}
                  onPlanWeave={() => modals.setShowPlanChoice(true)}
                  onJournal={() => router.push({ pathname: '/journal', params: { mode: 'friend-arc', friendId: friend.id } })}
                />

                <LifeEventsSection
                  lifeEvents={activeLifeEvents}
                  buttonsOpacity={buttonsOpacity}
                  onAdd={() => {
                    modals.setEditingLifeEvent(null);
                    modals.setShowLifeEventModal(true);
                  }}
                  onEdit={(event) => {
                    modals.setEditingLifeEvent(event);
                    modals.setShowLifeEventModal(true);
                  }}
                />
              </View>
            }
          />

          <FriendProfileModals
            friend={friend}
            modals={modals}
            friendIntentions={friendIntentions}
            // Derive the live interaction object from the reactive list using the ID
            selectedInteraction={interactions.find(i => i.id === modals.selectedInteractionId) || null}
            updateReflection={updateReflection}
            updateInteraction={updateInteraction}
            createIntention={createIntention}
            dismissIntention={dismissIntention}
            deleteWeave={deleteWeave}
            refreshLifeEvents={refreshLifeEvents}
          />

          <IntentionsFAB
            count={friendIntentions?.length || 0}
            onClick={() => modals.setShowIntentionsDrawer(true)}
          />

        </Animated.View>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});