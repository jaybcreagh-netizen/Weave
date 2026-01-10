import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing, useAnimatedScrollHandler, runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isFuture, isToday } from 'date-fns';

import { useTheme } from '@/shared/hooks/useTheme';
import { useFriendProfileData, useFriendTimeline } from '@/modules/relationships';
import { useFriendProfileModals } from '@/modules/relationships';
import { InteractionShape } from '@/shared/types/derived';

import {
  ProfileHeader,
  ActionButtons,
  LifeEventsSection,
  TimelineList,
  FriendProfileModals,
  IntentionsFAB
} from '@/modules/relationships';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { LinkFriendSheet } from '@/modules/relationships/components/LinkFriendSheet';
import { syncOutgoingLinkStatus, unlinkFriend } from '@/modules/relationships/services/friend-linking.service';
import { UIEventBus } from '@/shared/services/ui-event-bus';
import { database } from '@/db';
import JournalEntry from '@/db/models/JournalEntry';
import { Q } from '@nozbe/watermelondb';
import { usePendingWeavesForFriend, PendingWeavesSection } from '@/modules/sync';
import { StandardBottomSheet } from '@/shared/ui/Sheet';

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
    shareInfoMap,
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
  const [isPendingSheetVisible, setIsPendingSheetVisible] = useState(false);

  // Track weave IDs currently being accepted to prevent duplicate display
  const [acceptingWeaveIds, setAcceptingWeaveIds] = useState<Set<string>>(new Set());

  // Get pending weaves from this friend's linked account
  const linkedUserId = friendModel?.linkedUserId || undefined;
  const {
    pendingWeaves: rawFriendPendingWeaves,
    handleAccept: baseHandleAcceptPendingWeave,
    handleDecline: handleDeclinePendingWeave,
    processingId: pendingProcessingId,
    hasPending: hasPendingFromFriend
  } = usePendingWeavesForFriend(linkedUserId);

  // Filter out weaves currently being accepted to prevent duplicate display
  const friendPendingWeaves = useMemo(() =>
    rawFriendPendingWeaves.filter(w => !acceptingWeaveIds.has(w.id)),
    [rawFriendPendingWeaves, acceptingWeaveIds]
  );

  // Wrapped accept handler that immediately filters out the accepting weave
  const handleAcceptPendingWeave = useCallback(async (weaveId: string) => {
    // Immediately add to accepting set to filter from timeline
    setAcceptingWeaveIds(prev => new Set(prev).add(weaveId));
    try {
      await baseHandleAcceptPendingWeave(weaveId);
    } finally {
      // Clear after a delay to allow WatermelonDB to update timeline
      setTimeout(() => {
        setAcceptingWeaveIds(prev => {
          const next = new Set(prev);
          next.delete(weaveId);
          return next;
        });
      }, 2000);
    }
  }, [baseHandleAcceptPendingWeave]);

  // Merge pending weaves into timeline
  const mergedTimelineSections = useMemo(() => {
    if (!friendPendingWeaves.length) return timelineSections;

    // Create fake interactions
    const pendingInteractions = friendPendingWeaves.map(weave => ({
      id: weave.id,
      interactionDate: weave.weaveDate,
      title: weave.title,
      type: 'hangout', // Default
      mode: weave.category || 'hangout',
      activity: weave.category || 'hangout',
      duration: weave.duration,
      location: weave.location || '',
      description: '',
      // Mock other required fields
      createdAt: new Date(weave.weaveDate).getTime(), // Ensure number/date match InteractionShape expectation (number usually)
      updatedAt: new Date(weave.weaveDate).getTime(),
      friendId: validFriendId,
      status: 'active',
    } as unknown as InteractionShape));

    // Create a copy of sections to modify
    const newSections = timelineSections.map(s => ({ ...s, data: [...s.data] }));

    // Distribute pending weaves
    pendingInteractions.forEach(interaction => {
      // Logic to find section (Seeds, Today, Woven Memories)
      const date = new Date(interaction.interactionDate);
      let sectionTitle = 'Woven Memories';
      if (isFuture(date)) sectionTitle = 'Seeds';
      else if (isToday(date)) sectionTitle = 'Today';

      let section = newSections.find(s => s.title === sectionTitle);
      if (!section) {
        section = { title: sectionTitle, data: [] };
        newSections.push(section);
      }
      section.data.push(interaction);
    });

    // Sort ordering of sections
    const order = ['Seeds', 'Today', 'Woven Memories'];
    newSections.sort((a, b) => order.indexOf(a.title) - order.indexOf(b.title));

    // Sort data within sections
    newSections.forEach(section => {
      section.data.sort((a, b) => new Date(b.interactionDate).getTime() - new Date(a.interactionDate).getTime());
    });

    return newSections;

  }, [timelineSections, friendPendingWeaves, validFriendId]);

  // Merge Share Info
  const mergedShareInfoMap = useMemo(() => {
    const map = new Map(shareInfoMap || []); // Clone existing
    friendPendingWeaves.forEach(w => {
      map.set(w.id, {
        isShared: true,
        status: 'pending',
        isCreator: false,
        serverWeaveId: w.id,
        sharedAt: Date.now() // Approximation
      });
    });
    return map;
  }, [shareInfoMap, friendPendingWeaves]);

  // Use the new hook for modal state
  const modals = useFriendProfileModals();

  // Link to Weave User state
  const [showLinkSheet, setShowLinkSheet] = useState(false);

  // Track which interactions have linked journal entries
  const [linkedJournalIds, setLinkedJournalIds] = useState<Set<string>>(new Set());

  // Merge pending weaves into timeline


  // Fetch journal entries linked to this friend's interactions
  useEffect(() => {
    if (!interactions || interactions.length === 0) return;

    const interactionIds = interactions.map(i => i.id);

    database.get<JournalEntry>('journal_entries')
      .query(Q.where('linked_weave_id', Q.oneOf(interactionIds)))
      .fetch()
      .then(entries => {
        const ids = new Set(entries.map(e => e.linkedWeaveId).filter(Boolean) as string[]);
        setLinkedJournalIds(ids);
      })
      .catch(() => setLinkedJournalIds(new Set()));
  }, [interactions]);

  const scrollY = useSharedValue(0);

  // Page entrance  // Animation States
  const pageOpacity = useSharedValue(0);

  // Initial load animation
  useEffect(() => {
    // Only animate when data is loaded
    if (isDataLoaded) {
      pageOpacity.value = withTiming(1, {
        duration: 400,
        easing: Easing.out(Easing.quad),
      });
    } else {
      // Reset animations
      pageOpacity.value = 0;
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

  // Sync link status from server when viewing a friend with pending_sent status
  // This updates the local status if the other user has accepted the link request
  useEffect(() => {
    if (friendModel && friendModel.linkStatus === 'pending_sent') {
      syncOutgoingLinkStatus(friendModel.id).catch(err => {
        console.warn('[FriendProfile] Failed to sync link status:', err);
      });
    }
  }, [friendModel?.id, friendModel?.linkStatus]);

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

  const handleUnlinkFriend = useCallback(() => {
    if (friendModel && friendModel.linkStatus === 'linked') {
      Alert.alert(
        "Unlink Account",
        "Are you sure you want to unlink this friend from their Weave account? You will no longer see their updates or share weaves.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Unlink",
            style: "destructive",
            onPress: async () => {
              try {
                const success = await unlinkFriend(friendModel.id);
                if (success) {
                  UIEventBus.emit({ type: 'SHOW_TOAST', message: 'Friend account unlinked' });
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } else {
                  Alert.alert("Error", "Failed to unlink friend. Please try again.");
                }
              } catch (error) {
                console.error("Error unlinking friend:", error);
                Alert.alert("Error", "An unexpected error occurred.");
              }
            }
          }
        ]
      );
    }
  }, [friendModel]);

  const handleDeleteInteraction = useCallback(async (interactionId: string) => {
    try {
      await deleteWeave(interactionId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error deleting interaction:', error);
      Alert.alert('Error', 'Failed to delete weave. Please try again.');
    }
  }, [deleteWeave]);



  // Handle reschedule deep link
  const { action, interactionId: paramInteractionId } = useLocalSearchParams();

  useEffect(() => {
    if (action === 'reschedule' && paramInteractionId && interactions && isDataLoaded) {
      const interaction = interactions.find(i => i.id === paramInteractionId);
      if (interaction) {
        // Slight delay to allow profile to load and render
        setTimeout(() => {
          modals.handleEditInteraction(interaction);
          // clear the params from the URL 
          router.setParams({ action: '', interactionId: '' });
        }, 500);
      }
    }
  }, [action, paramInteractionId, interactions, isDataLoaded, modals.handleEditInteraction]);

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
            sections={mergedTimelineSections}
            onScroll={animatedScrollHandler}
            onLoadMore={handleLoadMore}
            hasMore={hasMoreInteractions}
            onInteractionPress={modals.setSelectedInteraction}
            onDeleteInteraction={handleDeleteInteraction}
            onEditInteraction={handleEditInteractionWrapper}
            linkedJournalIds={linkedJournalIds}
            shareInfoMap={mergedShareInfoMap}
            onAccept={handleAcceptPendingWeave}
            onDecline={handleDeclinePendingWeave}
            ListHeaderComponent={
              <View>
                <ProfileHeader
                  friend={friendModel}
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
                  onLinkToWeaveUser={() => setShowLinkSheet(true)}
                  onUnlinkFriend={handleUnlinkFriend}
                  pendingWeaveCount={friendPendingWeaves?.length || 0}
                  onPressPending={() => setIsPendingSheetVisible(true)}
                />

                <ActionButtons
                  onLogWeave={() => router.push({ pathname: '/weave-logger', params: { friendId: friend.id } })}
                  onPlanWeave={() => modals.setShowPlanChoice(true)}
                  onJournal={() => router.push({ pathname: '/journal', params: { mode: 'friend-arc', friendId: friend.id } })}
                />

                <LifeEventsSection
                  lifeEvents={activeLifeEvents}
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
            archetype={friendModel?.archetype}
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

          <LinkFriendSheet
            visible={showLinkSheet}
            friendId={friend.id}
            friendName={friend.name}
            onClose={() => setShowLinkSheet(false)}
            onLinked={() => {
              // Friend model will auto-update via WatermelonDB observables
              setShowLinkSheet(false);
            }}
          />

          <StandardBottomSheet
            visible={isPendingSheetVisible}
            onClose={() => setIsPendingSheetVisible(false)}
            snapPoints={['50%', '90%']}
          >
            <PendingWeavesSection
              pendingWeaves={friendPendingWeaves}
              onAccept={async (id) => {
                await handleAcceptPendingWeave(id);
                // Close sheet if no more pending? Or keep open? User preference.
                // Keeping open allows handling multiple.
                if (friendPendingWeaves.length <= 1) setIsPendingSheetVisible(false);
              }}
              onDecline={async (id) => {
                await handleDeclinePendingWeave(id);
                if (friendPendingWeaves.length <= 1) setIsPendingSheetVisible(false);
              }}
              processingId={pendingProcessingId}
              friendName={friend.name}
            />
          </StandardBottomSheet>

        </Animated.View>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});