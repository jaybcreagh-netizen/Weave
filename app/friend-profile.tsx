import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, SectionList, LayoutChangeEvent, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing, useAnimatedScrollHandler, runOnJS } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Edit, Trash2, Calendar, Plus } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isFuture, isToday, isPast, format, differenceInDays } from 'date-fns';
import { Q } from '@nozbe/watermelondb';

import { FriendListRow } from '../src/components/FriendListRow';
import { TimelineItem } from '../src/components/TimelineItem';
import { useFriendStore } from '../src/stores/friendStore';
import { useInteractionStore } from '../src/stores/interactionStore';
import { calculateNextConnectionDate, getPoeticSectionTitle } from '../src/lib/timeline-utils';
import { useTheme } from '../src/hooks/useTheme';
import { type Interaction, type Tier } from '../src/components/types';
import { InteractionDetailModal } from '../src/components/interaction-detail-modal';
import { EditReflectionModal } from '../src/components/EditReflectionModal';
import { EditInteractionModal } from '../src/components/EditInteractionModal';
import { PlanChoiceModal } from '../src/components/PlanChoiceModal';
import { PlanWizard } from '../src/components/PlanWizard';
import { IntentionFormModal } from '../src/components/IntentionFormModal';
import { IntentionsDrawer } from '../src/components/IntentionsDrawer';
import { IntentionsFAB } from '../src/components/IntentionsFAB';
import { IntentionActionSheet } from '../src/components/IntentionActionSheet';
import { useIntentionStore } from '../src/stores/intentionStore';
import { useFriendIntentions } from '../src/hooks/useIntentions';
import { LifeEventModal } from '../src/components/LifeEventModal';
import { WeaveIcon } from '../src/components/WeaveIcon';
import FriendBadgePopup from '../src/components/FriendBadgePopup';
import { database } from '../src/db';
import LifeEvent from '../src/db/models/LifeEvent';
import Intention from '../src/db/models/Intention';

const AnimatedSectionList = Animated.createAnimatedComponent(SectionList);

export default function FriendProfile() {
  const router = useRouter();
  const { colors } = useTheme();
  const { friendId } = useLocalSearchParams();
  const { activeFriend: friend, activeFriendInteractions: interactions, observeFriend, unobserveFriend } = useFriendStore();
  const { deleteFriend } = useFriendStore();
  const { deleteInteraction, updateReflection, updateInteraction } = useInteractionStore();
  const { createIntention, convertToPlannedWeave, dismissIntention } = useIntentionStore();
  const friendIntentions = useFriendIntentions(typeof friendId === 'string' ? friendId : undefined);
  const [selectedInteraction, setSelectedInteraction] = useState<Interaction | null>(null);

  const [editingReflection, setEditingReflection] = useState<Interaction | null>(null);
  const [editingInteraction, setEditingInteraction] = useState<Interaction | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [showPlanChoice, setShowPlanChoice] = useState(false);
  const [showPlanWizard, setShowPlanWizard] = useState(false);
  const [showIntentionForm, setShowIntentionForm] = useState(false);
  const [showIntentionsDrawer, setShowIntentionsDrawer] = useState(false);
  const [selectedIntentionForAction, setSelectedIntentionForAction] = useState<Intention | null>(null);
  const [showLifeEventModal, setShowLifeEventModal] = useState(false);
  const [editingLifeEvent, setEditingLifeEvent] = useState<LifeEvent | null>(null);
  const [activeLifeEvents, setActiveLifeEvents] = useState<LifeEvent[]>([]);
  const [showBadgePopup, setShowBadgePopup] = useState(false);

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

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
  }));

  const buttonsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonsOpacity.value,
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
      // Reset loading state when friendId changes
      setIsDataLoaded(false);

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

      observeFriend(friendId);

      // Load active life events for this friend
      loadLifeEvents();
    }
    return () => {
      unobserveFriend();
    };
  }, [friendId, observeFriend, unobserveFriend]);

  const loadLifeEvents = async () => {
    if (!friendId || typeof friendId !== 'string') return;

    try {
      const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;
      const events = await database
        .get<LifeEvent>('life_events')
        .query(
          Q.where('friend_id', friendId),
          Q.or(
            Q.where('event_date', Q.gte(sixtyDaysAgo)),
            Q.where('event_date', Q.gt(Date.now()))
          ),
          Q.sortBy('event_date', 'asc')
        )
        .fetch();

      setActiveLifeEvents(events);
    } catch (error) {
      console.error('Error loading life events:', error);
    }
  };

  // Track when data is actually loaded - must match the friendId
  // Add small delay to ensure data is fully settled
  useEffect(() => {
    if (friend && friend.id === friendId && interactions !== undefined) {
      const timer = setTimeout(() => {
        setIsDataLoaded(true);
      }, 150); // Small delay to ensure all data is ready

      return () => clearTimeout(timer);
    }
  }, [friend, interactions, friendId]);

  const sortedInteractions = useMemo(() => 
    [...(interactions || [])].sort((a, b) => {
        const dateA = typeof a.interactionDate === 'string' ? new Date(a.interactionDate) : a.interactionDate;
        const dateB = typeof b.interactionDate === 'string' ? new Date(b.interactionDate) : b.interactionDate;
        return dateB.getTime() - dateA.getTime();
    }), [interactions]);

  const timelineSections = useMemo(() => {
    const sections: { [key: string]: Interaction[] } = {
        Seeds: [], // Future
        Today: [],
        'Woven Memories': [], // Past
    };

    sortedInteractions.forEach(interaction => {
        const date = new Date(interaction.interactionDate);
        if (isFuture(date)) sections.Seeds.push(interaction);
        else if (isToday(date)) sections.Today.push(interaction);
        else sections['Woven Memories'].push(interaction);
    });

    return Object.entries(sections)
        .map(([title, data]) => ({ title, data }))
        .filter(section => section.data.length > 0);

  }, [sortedInteractions]);

  const nextConnectionDate = useMemo(() => {
    const pastInteractions = (interactions || []).filter(i => isPast(new Date(i.interactionDate)));
    if (pastInteractions.length === 0 || !friend) return null;

    const mostRecentPastInteraction = pastInteractions.reduce((latest, current) => {
        return new Date(current.interactionDate) > new Date(latest.interactionDate) ? current : latest;
    });

    return calculateNextConnectionDate(new Date(mostRecentPastInteraction.interactionDate), friend.dunbarTier as Tier);
  }, [interactions, friend]);

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
        { text: "Delete", style: "destructive", onPress: async () => {
            await deleteFriend(friend.id);
            if (router.canGoBack()) {
              router.back();
            }
        }},
      ]);
    }
  }, [friend, deleteFriend, router]);

  const handleDeleteInteraction = useCallback(async (interactionId: string) => {
    try {
      await deleteInteraction(interactionId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error deleting interaction:', error);
      Alert.alert('Error', 'Failed to delete weave. Please try again.');
    }
  }, [deleteInteraction]);

  const handleEditInteraction = useCallback((interactionId: string) => {
    const interaction = interactions.find(i => i.id === interactionId);
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
  }, [interactions]);

  // renderTimelineItem with point-to-point line segments
  const renderTimelineItem = useCallback(({ item: interaction, section, index }: { item: Interaction; section: { title: string; data: Interaction[] }; index: number }) => {
    const isFutureInteraction = section.title === 'Seeds';
    const isFirstInSection = index === 0;
    const isLastInSection = index === section.data.length - 1;

    // Check if this is the last item in the entire timeline
    const lastSection = timelineSections[timelineSections.length - 1];
    const isLastItem = lastSection?.data[lastSection.data.length - 1]?.id === interaction.id;

    return (
      <View className="px-5">
        <TimelineItem
          interaction={interaction}
          isFuture={isFutureInteraction}
          onPress={() => setSelectedInteraction(interaction)}
          onDelete={handleDeleteInteraction}
          onEdit={handleEditInteraction}
          index={index}
          sectionLabel={section.title}
          isFirstInSection={isFirstInSection}
          isLastItem={isLastItem}
        />
      </View>
    );
  }, [handleDeleteInteraction, handleEditInteraction, timelineSections]);

  // Define ListHeader before any returns (to satisfy Rules of Hooks)
  const ListHeader = useMemo(() => {
    if (!friend) return null;

    return (
    <View>
        <View style={[styles.header, { borderColor: colors.border }]}>
            <TouchableOpacity onPress={() => {
if (router.canGoBack()) {
router.back();
}
}} style={styles.backButton}>
              <ArrowLeft size={20} color={colors['muted-foreground']} />
              <Text style={{ color: colors.foreground }}>Back</Text>
            </TouchableOpacity>
            <View style={styles.headerActions}>
                <TouchableOpacity onPress={() => router.push('/global-calendar')} style={{ padding: 8 }}>
                    <Calendar size={20} color={colors['muted-foreground']} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleEdit} style={{ padding: 8 }}>
                    <Edit size={20} color={colors['muted-foreground']} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDeleteFriend} style={{ padding: 8 }}>
                    <Trash2 size={20} color={colors.destructive} />
                </TouchableOpacity>
            </View>
        </View>
        <View style={styles.contentContainer}>
            <Animated.View style={headerAnimatedStyle}>
                <TouchableOpacity
                  activeOpacity={0.95}
                  onLongPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setShowBadgePopup(true);
                  }}
                >
                  <FriendListRow friend={friend} variant="full" />
                </TouchableOpacity>
            </Animated.View>

            <Animated.View style={[styles.actionButtonsContainer, buttonsAnimatedStyle]}>
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/weave-logger', params: { friendId: friend.id } })}
                  style={[styles.actionButton, styles.actionButtonPrimary]}
                >
                  <LinearGradient
                    colors={[colors.primary, `${colors.primary}DD`]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.buttonGradient}
                  >
                    <View style={styles.glassOverlay} />
                    <Text style={[styles.actionButtonTextPrimary, { color: colors['primary-foreground'] }]}>Log a Weave</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowPlanChoice(true)}
                  style={[styles.actionButton, styles.actionButtonSecondary]}
                >
                  <LinearGradient
                    colors={[colors.secondary, `${colors.secondary}CC`]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.buttonGradient}
                  >
                    <View style={styles.glassOverlay} />
                    <Text style={[styles.actionButtonTextSecondary, { color: colors.foreground }]}>Plan a Weave</Text>
                  </LinearGradient>
                </TouchableOpacity>
            </Animated.View>

            {/* Life Events Section - Compact */}
            {activeLifeEvents.length > 0 || true /* always show to allow adding */ ? (
              <Animated.View style={[styles.lifeEventsSection, buttonsAnimatedStyle]}>
                <View style={styles.lifeEventsSectionHeader}>
                  <Text style={[styles.lifeEventsSectionTitle, { color: colors.foreground }]}>
                    Life Events
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setEditingLifeEvent(null);
                      setShowLifeEventModal(true);
                    }}
                    style={[styles.addLifeEventButton, { backgroundColor: colors.muted }]}
                  >
                    <Plus size={14} color={colors.primary} />
                    <Text style={[styles.addLifeEventText, { color: colors.primary }]}>Add</Text>
                  </TouchableOpacity>
                </View>

                {activeLifeEvents.length > 0 ? (
                  <View style={styles.lifeEventsList}>
                    {activeLifeEvents.map((event) => {
                      const daysUntil = differenceInDays(event.eventDate, new Date());
                      const isPastEvent = daysUntil < 0;
                      const isUpcoming = daysUntil >= 0 && daysUntil <= 30;

                      const eventIcons: Record<string, string> = {
                        new_job: '💼', moving: '📦', wedding: '💒', baby: '👶',
                        loss: '🕊️', health_event: '🏥', graduation: '🎓',
                        celebration: '🎉', birthday: '🎂', anniversary: '💝', other: '✨'
                      };

                      return (
                        <TouchableOpacity
                          key={event.id}
                          onPress={() => {
                            setEditingLifeEvent(event);
                            setShowLifeEventModal(true);
                          }}
                          style={[
                            styles.lifeEventCard,
                            {
                              backgroundColor: colors.muted,
                              borderColor: isUpcoming ? colors.primary : colors.border,
                              borderWidth: isUpcoming ? 1.5 : 1,
                            }
                          ]}
                        >
                          <Text style={styles.lifeEventIcon}>{eventIcons[event.eventType]}</Text>
                          <View style={styles.lifeEventContent}>
                            <Text style={[styles.lifeEventTitle, { color: colors.foreground }]} numberOfLines={1}>
                              {event.title}
                            </Text>
                            <Text style={[styles.lifeEventDate, { color: colors['muted-foreground'] }]}>
                              {isPastEvent
                                ? `${Math.abs(daysUntil)}d ago`
                                : daysUntil === 0
                                ? 'Today'
                                : daysUntil === 1
                                ? 'Tomorrow'
                                : `${daysUntil}d`}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={[styles.noLifeEvents, { color: colors['muted-foreground'] }]}>
                    No active life events. Tap "Add" to create one.
                  </Text>
                )}
              </Animated.View>
            ) : null}
        </View>
        <View style={{ paddingHorizontal: 20 }}>
            <Text style={[styles.timelineTitle, { color: colors.foreground }]}>
                Weave Timeline
            </Text>
        </View>
    </View>
    );
  }, [friend, colors, headerAnimatedStyle, buttonsAnimatedStyle, activeLifeEvents, router, handleEdit, handleDeleteFriend, setShowPlanChoice, setShowLifeEventModal, setEditingLifeEvent]);

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
        {/* Sticky Header */}
        {ListHeader}

        {/* Timeline ScrollView */}
        <View className="flex-1 relative">
            <AnimatedSectionList
                key={friendId} // Force remount when friend changes
                sections={timelineSections}
                renderItem={renderTimelineItem}
                keyExtractor={(item) => item.id.toString()}
                ListEmptyComponent={
                    <View className="items-center py-12">
                        <View className="mb-4 opacity-50">
                            <WeaveIcon size={40} color={colors['muted-foreground']} />
                        </View>
                        <Text style={{ color: colors['muted-foreground'] }}>No weaves yet</Text>
                        <Text className="text-xs mt-1 opacity-70" style={{ color: colors['muted-foreground'] }}>Your timeline will grow as you connect</Text>
                    </View>
                }
                stickySectionHeadersEnabled={false}
                contentContainerStyle={{ paddingTop: 20, paddingBottom: 100 }}
                onScroll={animatedScrollHandler}
                scrollEventThrottle={8}
                decelerationRate="fast"
                showsVerticalScrollIndicator={false}
            />
        </View>

        <InteractionDetailModal
            interaction={selectedInteraction}
            isOpen={selectedInteraction !== null}
            onClose={() => setSelectedInteraction(null)}
            friendName={friend.name}
            onEditReflection={(interaction) => {
              setEditingReflection(interaction);
              setSelectedInteraction(null); // Close detail modal
            }}
            onEdit={handleEditInteraction}
            onDelete={handleDeleteInteraction}
        />

        <EditReflectionModal
            interaction={editingReflection}
            isOpen={editingReflection !== null}
            onClose={() => setEditingReflection(null)}
            onSave={updateReflection}
            friendArchetype={friend?.archetype}
        />

        <EditInteractionModal
            interaction={editingInteraction}
            isOpen={editingInteraction !== null && !isFuture(new Date(editingInteraction?.interactionDate || Date.now()))}
            onClose={() => setEditingInteraction(null)}
            onSave={updateInteraction}
        />

        <PlanChoiceModal
          isOpen={showPlanChoice}
          onClose={() => setShowPlanChoice(false)}
          onSetIntention={() => {
            setShowPlanChoice(false);
            setShowIntentionForm(true);
          }}
          onSchedulePlan={() => {
            setShowPlanChoice(false);
            if (friend) {
              setShowPlanWizard(true);
            }
          }}
        />

        {friend && (
          <PlanWizard
            visible={showPlanWizard}
            onClose={() => {
              setShowPlanWizard(false);
              setEditingInteraction(null); // Clear editing state
            }}
            initialFriend={friend}
            prefillData={editingInteraction && isFuture(new Date(editingInteraction.interactionDate)) ? {
              date: new Date(editingInteraction.interactionDate),
              category: editingInteraction.interactionCategory || editingInteraction.activity,
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
            await createIntention({
              friendIds: [friend.id],
              description,
              category,
            });
          }}
        />

        <IntentionsDrawer
          intentions={friendIntentions}
          isOpen={showIntentionsDrawer}
          onClose={() => setShowIntentionsDrawer(false)}
          onIntentionPress={(intention) => {
            setSelectedIntentionForAction(intention);
          }}
        />

        <IntentionActionSheet
          intention={selectedIntentionForAction}
          isOpen={selectedIntentionForAction !== null}
          onClose={() => setSelectedIntentionForAction(null)}
          onSchedule={async (intention, intentionFriend) => {
            // Mark intention as converted
            await convertToPlannedWeave(intention.id);
            setSelectedIntentionForAction(null);

            // Open Plan Wizard with the friend and prefilled category
            setSelectedFriends([intentionFriend]);
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
            loadLifeEvents(); // Refresh events after modal closes
          }}
          friendId={typeof friendId === 'string' ? friendId : ''}
          existingEvent={editingLifeEvent}
        />

        {friend && (
          <FriendBadgePopup
            visible={showBadgePopup}
            onClose={() => setShowBadgePopup(false)}
            friendId={friend.id}
            friendName={friend.name}
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

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1 },
    backButton: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    contentContainer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 12 },
    actionButtonsContainer: { flexDirection: 'row', gap: 12 },
    actionButton: {
      flex: 1,
      borderRadius: 12,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    actionButtonPrimary: {},
    actionButtonSecondary: {},
    buttonGradient: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    glassOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '50%',
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
      borderBottomLeftRadius: 100,
      borderBottomRightRadius: 100,
    },
    actionButtonTextPrimary: {
      fontSize: 14,
      fontWeight: '600',
      letterSpacing: 0.2,
    },
    actionButtonTextSecondary: {
      fontSize: 14,
      fontWeight: '600',
      letterSpacing: 0.2,
    },
    timelineTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, marginTop: 8, fontFamily: 'Lora_700Bold' },
    // Timeline item wrapper: px-5 (NativeWind)
    // Timeline container: flex-1 relative (NativeWind)
    // Thread container: absolute top-0 left-0 right-0 bottom-0 -z-10 pointer-events-none (NativeWind)
    // Empty state: items-center py-12 (NativeWind)
    // Empty emoji: text-[40px] mb-4 opacity-50 (NativeWind)
    // Empty text: muted-foreground color (dynamic)
    // Empty subtext: text-xs mt-1 opacity-70 (NativeWind)
    lifeEventsSection: {
        paddingHorizontal: 20,
        marginTop: 8,
        marginBottom: 8,
    },
    lifeEventsSectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    lifeEventsSectionTitle: {
        fontFamily: 'Lora_700Bold',
        fontSize: 15,
    },
    addLifeEventButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
    },
    addLifeEventText: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 12,
    },
    lifeEventsList: {
        gap: 6,
    },
    lifeEventCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 10,
        gap: 10,
        marginBottom: 0,
    },
    lifeEventIcon: {
        fontSize: 20,
    },
    lifeEventContent: {
        flex: 1,
    },
    lifeEventTitle: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 13,
        marginBottom: 1,
    },
    lifeEventDate: {
        fontFamily: 'Inter_400Regular',
        fontSize: 11,
    },
    noLifeEvents: {
        fontFamily: 'Inter_400Regular',
        fontSize: 12,
        textAlign: 'center',
        paddingVertical: 8,
    },
});