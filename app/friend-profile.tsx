import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing, useAnimatedScrollHandler, runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isFuture, isPast } from 'date-fns';

import { calculateNextConnectionDate } from '@/shared/utils/timeline-utils';
import { useTheme } from '@/shared/hooks/useTheme';
import { Interaction, Tier, InteractionCategory, LifeEvent, Intention } from '@/components/types';
import { InteractionDetailModal } from '@/components/interaction-detail-modal';
import { EditReflectionModal } from '@/components/EditReflectionModal';
import { EditInteractionModal } from '@/components/EditInteractionModal';
import { PlanChoiceModal } from '@/components/PlanChoiceModal';
import { PlanWizard, PlanService } from '@/modules/interactions';
import { IntentionFormModal } from '@/components/IntentionFormModal';
import { IntentionsDrawer } from '@/components/IntentionsDrawer';
import { IntentionsFAB } from '@/components/IntentionsFAB';
import { IntentionActionSheet } from '@/components/IntentionActionSheet';
import { LifeEventModal } from '@/components/LifeEventModal';
import FriendBadgePopup from '@/components/FriendBadgePopup';
import { TierFitBottomSheet, useTierFit, changeFriendTier, dismissTierSuggestion } from '@/modules/insights';

import { useFriendProfileData, useFriendTimeline } from '@/modules/relationships';

// New Components
import { ProfileHeader } from '@/components/friend-profile/ProfileHeader';
import { ActionButtons } from '@/components/friend-profile/ActionButtons';
import { LifeEventsSection } from '@/components/friend-profile/LifeEventsSection';
import { TimelineList } from '@/components/friend-profile/TimelineList';

export default function FriendProfile() {
  const router = useRouter();
  const { colors } = useTheme();
  const { friendId } = useLocalSearchParams();

  const {
    friend,
    interactions,
    friendIntentions,
    activeLifeEvents,
    isDataLoaded,
    hasMoreInteractions,
    isLoadingMore,
    handleLoadMore,
    deleteFriend,
    deleteWeave,
    updateReflection,
    updateInteraction,
    createIntention,
    dismissIntention,
    refreshLifeEvents
  } = useFriendProfileData(typeof friendId === 'string' ? friendId : undefined);

  const { timelineSections } = useFriendTimeline(interactions);

  const [selectedInteraction, setSelectedInteraction] = useState<Interaction | null>(null);
  const [editingReflection, setEditingReflection] = useState<Interaction | null>(null);
  const [editingInteraction, setEditingInteraction] = useState<Interaction | null>(null);
  const [showPlanChoice, setShowPlanChoice] = useState(false);
  const [showPlanWizard, setShowPlanWizard] = useState(false);
  const [showIntentionForm, setShowIntentionForm] = useState(false);
  const [showIntentionsDrawer, setShowIntentionsDrawer] = useState(false);
  const [selectedIntentionForAction, setSelectedIntentionForAction] = useState<Intention | null>(null);
  const [showLifeEventModal, setShowLifeEventModal] = useState(false);
  const [editingLifeEvent, setEditingLifeEvent] = useState<LifeEvent | null>(null);
  const [showBadgePopup, setShowBadgePopup] = useState(false);
  const [showTierFitSheet, setShowTierFitSheet] = useState(false);

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
      // Clear any open modals
      setSelectedInteraction(null);
      setEditingReflection(null);
      setEditingInteraction(null);
      setShowPlanChoice(false);
      setShowPlanWizard(false);
      setShowIntentionForm(false);
      setShowIntentionsDrawer(false);
      setSelectedIntentionForAction(null);
      setShowLifeEventModal(false);
      setEditingLifeEvent(null);
    }
  }, [friendId]);

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

  const handleEditInteraction = useCallback((interactionId: string) => {
    // Add a small delay to allow the detail modal to close first (iOS race condition)
    setTimeout(() => {
      const interaction = interactions?.find(i => i.id === interactionId);
      if (interaction) {
        // Check if this is a future planned weave
        const interactionDate = new Date(interaction.interactionDate);
        if (isFuture(interactionDate)) {
          // Open PlanWizard for future interactions
          setEditingInteraction(interaction); // Store the interaction being edited
          setShowPlanWizard(true);
        } else {
          // Open EditInteractionModal for past/completed interactions
          setEditingInteraction(interaction);
        }
      }
    }, 500);
  }, [interactions]);

  // Show loading state until data is actually loaded (AFTER all hooks)
  if (!isDataLoaded || !friend) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
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
          onInteractionPress={setSelectedInteraction}
          onDeleteInteraction={handleDeleteInteraction}
          onEditInteraction={handleEditInteraction}
          ListHeaderComponent={
            <View>
              <ProfileHeader
                friend={friend}
                headerOpacity={headerOpacity}
                onBack={() => {
                  if (router.canGoBack()) {
                    router.back();
                  }
                }}
                onEdit={handleEdit}
                onDelete={handleDeleteFriend}
                onGlobalCalendar={() => router.push('/global-calendar')}
                onShowBadgePopup={() => setShowBadgePopup(true)}
                onShowTierFit={() => setShowTierFitSheet(true)}
              />

              <ActionButtons
                buttonsOpacity={buttonsOpacity}
                onLogWeave={() => router.push({ pathname: '/weave-logger', params: { friendId: friend.id } })}
                onPlanWeave={() => setShowPlanChoice(true)}
                onJournal={() => router.push({ pathname: '/journal', params: { mode: 'friend-arc', friendId: friend.id } })}
              />

              <LifeEventsSection
                lifeEvents={activeLifeEvents}
                buttonsOpacity={buttonsOpacity}
                onAdd={() => {
                  setEditingLifeEvent(null);
                  setShowLifeEventModal(true);
                }}
                onEdit={(event) => {
                  setEditingLifeEvent(event);
                  setShowLifeEventModal(true);
                }}
              />
            </View>
          }
        />

        <InteractionDetailModal
          interaction={selectedInteraction as any} // Cast to any for now if types mismatch slightly
          isOpen={selectedInteraction !== null}
          onClose={() => setSelectedInteraction(null)}
          friendName={friend.name}
          onEditReflection={(interaction) => {
            setEditingReflection(interaction as any);
            setSelectedInteraction(null); // Close detail modal
          }}
          onEdit={handleEditInteraction}
          onDelete={handleDeleteInteraction}
        />

        <EditReflectionModal
          interaction={editingReflection as any}
          isOpen={editingReflection !== null}
          onClose={() => setEditingReflection(null)}
          onSave={updateReflection}
          friendArchetype={friend?.archetype as any}
        />

        <EditInteractionModal
          interaction={editingInteraction as any}
          isOpen={editingInteraction !== null && !isFuture(new Date(editingInteraction?.interactionDate || Date.now()))}
          onClose={() => setEditingInteraction(null)}
          onSave={updateInteraction as any}
        />

        <PlanChoiceModal
          isOpen={showPlanChoice}
          onClose={() => setShowPlanChoice(false)}
          onSetIntention={() => {
            setShowPlanChoice(false);
            setTimeout(() => {
              setShowIntentionForm(true);
            }, 500);
          }}
          onSchedulePlan={() => {
            setShowPlanChoice(false);
            setTimeout(() => {
              if (friend) {
                setShowPlanWizard(true);
              }
            }, 500);
          }}
        />

        {friend && (
          <PlanWizard
            visible={showPlanWizard}
            onClose={() => {
              setShowPlanWizard(false);
              setEditingInteraction(null); // Clear editing state
            }}
            initialFriend={friend as any} // Cast if needed
            prefillData={editingInteraction && isFuture(new Date(editingInteraction.interactionDate)) ? {
              date: new Date(editingInteraction.interactionDate),
              category: (editingInteraction.interactionCategory || editingInteraction.activity) as InteractionCategory,
              title: editingInteraction.title,
              location: editingInteraction.location,
            } : undefined}
            replaceInteractionId={editingInteraction && isFuture(new Date(editingInteraction.interactionDate)) ? editingInteraction.id : undefined}
            initialStep={editingInteraction && isFuture(new Date(editingInteraction.interactionDate)) ? 3 : 1}
          />
        )}

        <IntentionFormModal
          isOpen={showIntentionForm}
          friendName={friend.name}
          onClose={() => setShowIntentionForm(false)}
          onSave={async (description, category) => {
            await createIntention(
              [friend.id],
              description,
              category,
            );
          }}
        />

        <IntentionsDrawer
          intentions={friendIntentions as any[]} // Cast if needed
          isOpen={showIntentionsDrawer}
          onClose={() => setShowIntentionsDrawer(false)}
          onIntentionPress={(intention) => {
            setSelectedIntentionForAction(intention as any);
          }}
        />

        <IntentionActionSheet
          intention={selectedIntentionForAction as any}
          isOpen={selectedIntentionForAction !== null}
          onClose={() => setSelectedIntentionForAction(null)}
          onSchedule={async (intention) => {
            await PlanService.convertIntentionToPlan(intention.id);
            setSelectedIntentionForAction(null);

            // Open Plan Wizard with the friend and prefilled category
            if (intention.interactionCategory) {
              // TODO: Could prefill category in wizard if we add that feature
            }
            setShowPlanWizard(true);
          }}
          onDismiss={async (intention) => {
            await dismissIntention(intention.id);
            setSelectedIntentionForAction(null);
          }}
        />

        <LifeEventModal
          visible={showLifeEventModal}
          onClose={() => {
            setShowLifeEventModal(false);
            setEditingLifeEvent(null);
            refreshLifeEvents(); // Refresh events after modal closes
          }}
          friendId={typeof friendId === 'string' ? friendId : ''}
          existingEvent={editingLifeEvent as any} // Cast if needed
        />

        {friend && (
          <FriendBadgePopup
            visible={showBadgePopup}
            onClose={() => setShowBadgePopup(false)}
            friendId={friend.id}
            friendName={friend.name}
          />
        )}

        {/* Tier Fit Bottom Sheet */}
        {friend && showTierFitSheet && (
          <TierFitBottomSheetWrapper
            friendId={friend.id}
            visible={showTierFitSheet}
            onDismiss={() => setShowTierFitSheet(false)}
          />
        )}
      </Animated.View>

      <IntentionsFAB
        count={friendIntentions.length}
        onClick={() => setShowIntentionsDrawer(true)}
      />
    </SafeAreaView>
  );
}

/**
 * Wrapper component to handle tier fit analysis and tier changes
 */
function TierFitBottomSheetWrapper({
  friendId,
  visible,
  onDismiss
}: {
  friendId: string;
  visible: boolean;
  onDismiss: () => void;
}) {
  const { analysis } = useTierFit(friendId);

  if (!analysis || analysis.fitCategory === 'insufficient_data') {
    return null;
  }

  const handleChangeTier = async (newTier: Tier) => {
    try {
      await changeFriendTier(friendId, newTier, true); // true = wasFromSuggestion
      console.log(`[TierFit] Successfully changed ${friendId} to ${newTier}`);
      onDismiss();
    } catch (error) {
      console.error('[TierFit] Error changing tier:', error);
      Alert.alert('Error', 'Failed to change tier. Please try again.');
    }
  };

  const handleStayInTier = () => {
    // User chose to keep current tier - just close
    console.log(`[TierFit] User chose to stay in tier for ${friendId}`);
    onDismiss();
  };

  const handleDismissSuggestion = async () => {
    try {
      await dismissTierSuggestion(friendId);
      console.log(`[TierFit] Dismissed suggestion for ${friendId}`);
      onDismiss();
    } catch (error) {
      console.error('[TierFit] Error dismissing suggestion:', error);
      Alert.alert('Error', 'Failed to dismiss suggestion. Please try again.');
    }
  };

  return (
    <TierFitBottomSheet
      visible={visible}
      analysis={analysis}
      onDismiss={onDismiss}
      onChangeTier={handleChangeTier}
      onStayInTier={handleStayInTier}
      onDismissSuggestion={handleDismissSuggestion}
    />
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});