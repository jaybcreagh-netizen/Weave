/**
 * TodaysFocusWidget
 * Priority-based focus card with beautiful gradient hero cards
 * Shows the most important action for today
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, UIManager } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useRouter } from 'expo-router';
import { differenceInDays, format } from 'date-fns';
import { Cake, Heart, ChevronDown, ChevronUp, Calendar, CheckCircle2, Sparkles, Flame, X } from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';
import { HomeWidgetBase, HomeWidgetConfig } from '../HomeWidgetBase';
import { useFriendStore } from '../../../stores/friendStore';
import { useSuggestions } from '../../../hooks/useSuggestions';
import { usePendingPlans } from '../../../hooks/usePendingPlans';
import { useInteractionStore } from '../../../stores/interactionStore';
import { getCategoryMetadata } from '../../../lib/interaction-categories';
import { PlanWizard } from '../../PlanWizard';
import { type InteractionCategory } from '../../types';
import FriendModel from '../../../db/models/Friend';
import { type Suggestion } from '../../../types/suggestions';
import { useUserProfileStore } from '../../../stores/userProfileStore';
import { database } from '../../../db';
import LifeEvent from '../../../db/models/LifeEvent';
import { Q } from '@nozbe/watermelondb';
import { calculateCurrentScore } from '../../../lib/weave-engine';
import Interaction from '../../../db/models/Interaction';

const WIDGET_CONFIG: HomeWidgetConfig = {
  id: 'todays-focus',
  type: 'todays-focus',
  title: "Today's Focus",
  minHeight: 160,
  fullWidth: true,
};

interface UpcomingDate {
  friend: FriendModel;
  type: 'birthday' | 'anniversary' | 'life_event';
  daysUntil: number;
  title?: string;
}

type PriorityState = 'pressing-event' | 'todays-plan' | 'streak-risk' | 'friend-fading' | 'upcoming-plan' | 'quick-weave' | 'all-clear';

export const TodaysFocusWidget: React.FC = () => {
  const { colors, isDarkMode } = useTheme();
  const router = useRouter();
  const { friends } = useFriendStore();
  const { suggestions, dismissSuggestion } = useSuggestions();
  const { pendingPlans } = usePendingPlans();
  const { confirmPlan } = useInteractionStore();
  const { profile } = useUserProfileStore();
  const [upcomingDates, setUpcomingDates] = useState<UpcomingDate[]>([]);
  const [rescheduleWizardOpen, setRescheduleWizardOpen] = useState(false);
  const [rescheduleFriend, setRescheduleFriend] = useState<FriendModel | null>(null);
  const [reschedulePlanData, setReschedulePlanData] = useState<any>(null);
  const [rescheduleInteractionId, setRescheduleInteractionId] = useState<string | null>(null);
  const [planWizardOpen, setPlanWizardOpen] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<FriendModel | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [streakCount, setStreakCount] = useState(0);
  const [fadingFriend, setFadingFriend] = useState<{ friend: FriendModel; score: number } | null>(null);
  const [batteryMatchedFriend, setBatteryMatchedFriend] = useState<FriendModel | null>(null);

  const expansionProgress = useSharedValue(0);

  // Animate expansion with timing (smooth, predictable)
  useEffect(() => {
    expansionProgress.value = withTiming(expanded ? 1 : 0, {
      duration: 300, // Fast, smooth
    });
  }, [expanded]);

  // Helper: Get daily index for rotation (same result for same day)
  const getDailyRotation = (arrayLength: number): number => {
    if (arrayLength === 0) return 0;
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24);
    return dayOfYear % arrayLength;
  };

  // Helper: Get intelligent message for streak-risk state
  const getStreakMessage = (streakCount: number, friend: FriendModel, batteryLevel: number): string => {
    const messages = [];

    // Battery-aware messages
    if (batteryLevel <= 35) {
      messages.push(`You're on a ${streakCount}-day streak! A quiet moment with ${friend.name} could keep it going`);
      messages.push(`${streakCount} days strong! Maybe a low-key chat with ${friend.name} today?`);
    } else if (batteryLevel <= 70) {
      messages.push(`You're on a ${streakCount}-day streak! Connect with ${friend.name} to keep it up`);
      messages.push(`${streakCount} days in a row! ${friend.name} might be perfect for today`);
    } else {
      messages.push(`You're on a ${streakCount}-day streak! ${friend.name} could be great for your energy today`);
      messages.push(`${streakCount} days strong! Keep it alive with ${friend.name}`);
    }

    return messages[getDailyRotation(messages.length)];
  };

  // Helper: Get intelligent message for quick-weave state
  const getQuickWeaveMessage = (friend: FriendModel, daysSince: number): string => {
    const messages = [];

    if (daysSince <= 3) {
      messages.push(`${friend.name} has been on your mind lately`);
      messages.push(`Keep the momentum going with ${friend.name}`);
    } else if (daysSince <= 7) {
      messages.push(`It's been ${daysSince} days since you caught up with ${friend.name}`);
      messages.push(`${friend.name} might appreciate hearing from you`);
    } else if (daysSince <= 14) {
      messages.push(`It's been a while since you connected with ${friend.name}`);
      messages.push(`${friend.name} would love to hear from you`);
    } else {
      messages.push(`It's been ${daysSince} days—${friend.name} is probably wondering about you`);
      messages.push(`Time to reconnect with ${friend.name}`);
    }

    return messages[getDailyRotation(messages.length)];
  };

  // Helper: Get intelligent message for friend-fading state
  const getFadingMessage = (friend: FriendModel, score: number): string => {
    const messages = [];
    const archetype = friend.archetype;

    if (score < 20) {
      messages.push(`${friend.name}'s connection is fading—reach out soon`);
      messages.push(`Don't let ${friend.name} slip away`);
    } else if (score < 30) {
      messages.push(`${friend.name} could use some attention`);
      messages.push(`Time to reconnect with ${friend.name}`);
    } else {
      messages.push(`${friend.name}'s connection is weakening`);
      messages.push(`${friend.name} would appreciate hearing from you`);
    }

    return messages[getDailyRotation(messages.length)];
  };

  // Helper: Get intelligent "all clear" message
  const getAllClearMessage = (): { headline: string; subtext: string } => {
    const messages = [
      { headline: 'All Caught Up', subtext: 'Your relationships are thriving—enjoy the moment' },
      { headline: 'Everything\'s Flowing', subtext: 'You\'ve been nurturing your connections beautifully' },
      { headline: 'You\'re in Harmony', subtext: 'Your social garden is well-tended right now' },
      { headline: 'Nicely Balanced', subtext: 'All your important connections are healthy' },
    ];

    return messages[getDailyRotation(messages.length)];
  };

  // Helper: Get archetypes that match battery energy level
  const getArchetypesForBattery = (batteryLevel: number): string[] => {
    if (batteryLevel <= 35) {
      // Low energy: intimate, low-key connections
      return ['Hermit', 'HighPriestess'];
    } else if (batteryLevel <= 70) {
      // Medium energy: balanced connections
      return ['Empress', 'Magician', 'Lovers'];
    } else {
      // High energy: active, social connections
      return ['Sun', 'Fool', 'Emperor'];
    }
  };

  // Find friend that matches current battery level
  useEffect(() => {
    if (!friends || friends.length === 0 || !profile) return;

    const batteryLevel = profile.socialBatteryCurrent || 50; // Default to medium
    const suitableArchetypes = getArchetypesForBattery(batteryLevel);

    // Filter friends by suitable archetypes
    const matchingFriends = friends.filter(f =>
      suitableArchetypes.includes(f.archetype)
    );

    if (matchingFriends.length > 0) {
      // Rotate through matching friends daily
      const index = getDailyRotation(matchingFriends.length);
      setBatteryMatchedFriend(matchingFriends[index]);
    } else {
      // Fallback: any friend
      setBatteryMatchedFriend(friends.length > 0 ? friends[0] : null);
    }
  }, [friends, profile]);

  // Calculate streak - REACTIVE to database changes
  useEffect(() => {
    const calculateStreak = (interactions: Interaction[]) => {
      try {
        if (interactions.length === 0) {
          setStreakCount(0);
          return;
        }

        let streak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const interaction of interactions) {
          const interactionDate = new Date(interaction.interactionDate);
          interactionDate.setHours(0, 0, 0, 0);
          const daysDiff = differenceInDays(today, interactionDate);

          if (daysDiff === streak) {
            streak++;
          } else {
            break;
          }
        }

        setStreakCount(streak);
      } catch (error) {
        console.error('Error calculating streak:', error);
      }
    };

    // Subscribe to interactions changes
    const subscription = database
      .get<Interaction>('interactions')
      .query(Q.where('status', 'completed'), Q.sortBy('interaction_date', Q.desc))
      .observe()
      .subscribe(interactions => {
        calculateStreak(interactions);
      });

    return () => subscription.unsubscribe();
  }, []);

  // Find fading friend (lowest score)
  useEffect(() => {
    if (!friends || friends.length === 0) return;

    const friendsWithScores = friends.map(f => ({
      friend: f,
      score: calculateCurrentScore(f),
    }));

    // Get all friends below threshold for variety
    const fadingFriends = friendsWithScores
      .filter(f => f.score < 40)
      .sort((a, b) => a.score - b.score); // Sort by score, lowest first

    if (fadingFriends.length > 0) {
      // Rotate through fading friends daily
      const index = getDailyRotation(fadingFriends.length);
      setFadingFriend(fadingFriends[index]);
    } else {
      setFadingFriend(null);
    }
  }, [friends]);

  // Calculate upcoming special dates (30 days)
  useEffect(() => {
    if (!friends || friends.length === 0) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const events: UpcomingDate[] = [];

    const loadLifeEvents = async () => {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const lifeEvents = await database
        .get<LifeEvent>('life_events')
        .query(
          Q.where('event_date', Q.gte(today.getTime())),
          Q.where('event_date', Q.lte(thirtyDaysFromNow.getTime()))
        )
        .fetch();

      lifeEvents.forEach(event => {
        const friend = friends.find(f => f.id === event.friendId);
        if (friend) {
          events.push({
            friend,
            type: 'life_event',
            daysUntil: differenceInDays(event.eventDate, today),
            title: event.title,
          });
        }
      });

      friends.forEach(friend => {
        // Check birthday
        if (friend.birthday) {
          // Birthday is now in "MM-DD" format
          const [month, day] = friend.birthday.split('-').map(n => parseInt(n, 10));

          // Create birthday for this year
          const birthdayThisYear = new Date(today.getFullYear(), month - 1, day);
          birthdayThisYear.setHours(0, 0, 0, 0);

          if (birthdayThisYear < today) {
            birthdayThisYear.setFullYear(today.getFullYear() + 1);
          }

          const daysUntil = differenceInDays(birthdayThisYear, today);
          if (daysUntil >= 0 && daysUntil <= 30) {
            events.push({ friend, type: 'birthday', daysUntil });
          }
        }

        // Check anniversary (only show for partners/romantic relationships)
        if (friend.anniversary &&
            friend.relationshipType?.toLowerCase().includes('partner') &&
            !isNaN(friend.anniversary.getTime())) {
          const anniversaryThisYear = new Date(friend.anniversary);
          anniversaryThisYear.setFullYear(today.getFullYear());
          anniversaryThisYear.setHours(0, 0, 0, 0);

          if (anniversaryThisYear < today) {
            anniversaryThisYear.setFullYear(today.getFullYear() + 1);
          }

          const daysUntil = differenceInDays(anniversaryThisYear, today);
          if (daysUntil >= 0 && daysUntil <= 14) {
            events.push({ friend, type: 'anniversary', daysUntil });
          }
        }
      });

      // Sort by proximity and show top 3
      events.sort((a, b) => a.daysUntil - b.daysUntil);
      setUpcomingDates(events.slice(0, 3));
    };

    loadLifeEvents();
  }, [friends]);

  // Priority logic with daily rotation for variance
  const getPriority = (): { state: PriorityState; data?: any } => {
    // 1. Pressing events (birthdays within 3 days, medium+ life events within 7 days)
    const pressingEvents = upcomingDates.filter(event => {
      if (event.type === 'birthday' && event.daysUntil <= 3) return true;
      if (event.type === 'life_event' && event.daysUntil <= 7) return true;
      return false;
    });
    if (pressingEvents.length > 0) {
      // Sort by urgency (soonest first)
      pressingEvents.sort((a, b) => a.daysUntil - b.daysUntil);
      return { state: 'pressing-event', data: pressingEvents[0] };
    }

    // 2. Today's plans - show all at a glance
    const todaysPlans = pendingPlans.filter(p => p.daysUntil === 0);
    if (todaysPlans.length > 0) {
      return { state: 'todays-plan', data: { plans: todaysPlans, count: todaysPlans.length } };
    }

    // 3. Streak at risk (no weave today and streak > 0) - suggest battery-matched friend
    if (streakCount > 0 && batteryMatchedFriend) {
      const batteryLevel = profile?.socialBatteryCurrent || 50;
      return { state: 'streak-risk', data: { streakCount, friend: batteryMatchedFriend, batteryLevel } };
    }

    // 4. Friend fading (already rotated in useEffect)
    if (fadingFriend) {
      return { state: 'friend-fading', data: fadingFriend };
    }

    // 5. Upcoming plan (within next 3 days) - rotate if multiple
    const upcomingPlans = pendingPlans.filter(p => p.daysUntil > 0 && p.daysUntil <= 3);
    if (upcomingPlans.length > 0) {
      const index = getDailyRotation(upcomingPlans.length);
      return { state: 'upcoming-plan', data: upcomingPlans[index] };
    }

    // 6. Check if everything is in good shape (all clear)
    const allFriendsHealthy = friends.every(f => calculateCurrentScore(f) >= 40);
    const noUrgentItems = !fadingFriend && pendingPlans.length === 0 && streakCount === 0;

    if (allFriendsHealthy && noUrgentItems) {
      return { state: 'all-clear', data: null };
    }

    // 7. Quick weave (default) - rotate through top 5 longest since last interaction
    const friendsWithInteractions = friends
      .filter(f => f.lastUpdated)
      .map(f => ({ friend: f, daysSince: differenceInDays(new Date(), f.lastUpdated!) }))
      .sort((a, b) => b.daysSince - a.daysSince)
      .slice(0, 5); // Top 5 candidates

    if (friendsWithInteractions.length > 0) {
      const index = getDailyRotation(friendsWithInteractions.length);
      return { state: 'quick-weave', data: friendsWithInteractions[index] };
    }

    return { state: 'quick-weave', data: null };
  };

  const priority = getPriority();

  const handleConfirmPlan = async (interactionId: string) => {
    try {
      await confirmPlan(interactionId);
    } catch (error) {
      console.error('Error confirming plan:', error);
    }
  };

  const handleReschedulePlan = (plan: typeof pendingPlans[0]) => {
    if (plan.friends.length > 0) {
      setRescheduleFriend(plan.friends[0]);
      setRescheduleInteractionId(plan.interaction.id);
      setReschedulePlanData({
        date: plan.interaction.interactionDate,
        category: plan.interaction.interactionCategory as InteractionCategory,
        title: plan.interaction.title,
        location: plan.interaction.location,
      });
      setRescheduleWizardOpen(true);
    }
  };

  const getDaysText = (days: number) => {
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `${days}d`;
  };

  const handleSuggestionPress = (suggestion: Suggestion) => {
    const friend = friends.find(f => f.id === suggestion.friendId);
    if (!friend) return;

    if (suggestion.action.type === 'plan') {
      setSelectedFriend(friend);
      setPlanWizardOpen(true);
    } else if (suggestion.action.type === 'log') {
      router.push(`/weave-logger?friendId=${friend.id}`);
    } else if (suggestion.action.type === 'reflect') {
      router.push(`/friend-profile?friendId=${friend.id}`);
    } else {
      router.push(`/friend-profile?friendId=${friend.id}`);
    }
  };

  const handleCardPress = () => {
    if (priority.state === 'pressing-event') {
      // Navigate to friend profile
      const event = priority.data as UpcomingDate;
      router.push(`/friend-profile?friendId=${event.friend.id}`);
    } else if (priority.state === 'todays-plan' || priority.state === 'upcoming-plan' || priority.state === 'all-clear') {
      // Expand to show more details
      setExpanded(!expanded);
    } else if (priority.state === 'streak-risk') {
      // Route to specific battery-matched friend's weave logger
      const friend = priority.data?.friend;
      if (friend) {
        router.push(`/weave-logger?friendId=${friend.id}`);
      } else {
        router.push('/weave-logger');
      }
    } else if (priority.state === 'quick-weave') {
      // Route to specific friend if available
      const friend = priority.data?.friend;
      if (friend) {
        router.push(`/weave-logger?friendId=${friend.id}`);
      } else {
        router.push('/weave-logger');
      }
    } else if (priority.state === 'friend-fading') {
      const friend = priority.data.friend;
      setSelectedFriend(friend);
      setPlanWizardOpen(true);
    }
  };

  // Count additional items
  const additionalItemsCount = pendingPlans.length + suggestions.length + upcomingDates.length - 1;

  // Render hero card based on priority
  const renderCard = () => {
    const cardProps = {
      onPress: handleCardPress,
      colors,
      isDarkMode,
      expanded,
      expandedContent: renderExpandedContent(),
      expansionProgress,
    };

    switch (priority.state) {
      case 'pressing-event':
        return <PressingEventCard event={priority.data} {...cardProps} />;
      case 'todays-plan':
        return <TodaysPlanCard data={priority.data} {...cardProps} />;
      case 'streak-risk':
        return <StreakRiskCard
          streakCount={priority.data.streakCount}
          friend={priority.data.friend}
          batteryLevel={priority.data.batteryLevel}
          message={getStreakMessage(priority.data.streakCount, priority.data.friend, priority.data.batteryLevel)}
          {...cardProps}
        />;
      case 'friend-fading':
        return <FriendFadingCard
          friend={priority.data.friend}
          score={priority.data.score}
          message={getFadingMessage(priority.data.friend, priority.data.score)}
          {...cardProps}
        />;
      case 'upcoming-plan':
        return <UpcomingPlanCard plan={priority.data} {...cardProps} />;
      case 'quick-weave':
        const friend = priority.data?.friend;
        const daysSince = priority.data?.daysSince || 0;
        return <QuickWeaveCard
          friend={friend}
          daysSince={daysSince}
          message={friend ? getQuickWeaveMessage(friend, daysSince) : 'Reach out to a friend today'}
          {...cardProps}
        />;
      case 'all-clear':
        return <AllClearCard message={getAllClearMessage()} {...cardProps} />;
    }
  };

  // Render expanded content
  const renderExpandedContent = () => (
    <>
      {/* Pending Plans */}
      {pendingPlans.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            PENDING PLANS
          </Text>
          {pendingPlans.slice(0, 2).map((plan) => {
            const friendName = plan.friends.map(f => f.name).join(', ');
            const dateText = getDaysText(plan.daysUntil);
            const categoryData = plan.interaction.interactionCategory
              ? getCategoryMetadata(plan.interaction.interactionCategory as InteractionCategory)
              : null;
            const displayTitle = plan.interaction.title || categoryData?.label || plan.interaction.activity;

            return (
              <View
                key={plan.interaction.id}
                style={styles.planCard}
              >
                <View style={styles.planHeader}>
                  <Calendar size={18} color="rgba(255, 255, 255, 0.9)" />
                  <View style={styles.planContent}>
                    <Text style={styles.planTitle}>
                      {displayTitle}
                    </Text>
                    <Text style={styles.planSubtitle}>
                      {friendName} · {dateText}
                    </Text>
                  </View>
                </View>
                <View style={styles.planActions}>
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={() => handleConfirmPlan(plan.interaction.id)}
                  >
                    <CheckCircle2 size={14} color="#FFFFFF" />
                    <Text style={styles.confirmButtonText}>Confirm</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rescheduleButton}
                    onPress={() => handleReschedulePlan(plan)}
                  >
                    <Text style={styles.rescheduleButtonText}>
                      Reschedule
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Upcoming Events */}
      {upcomingDates.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            UPCOMING
          </Text>
          {upcomingDates.slice(0, 3).map((event) => (
            <TouchableOpacity
              key={`${event.friend.id}-${event.type}`}
              onPress={() => router.push(`/friend-profile?friendId=${event.friend.id}`)}
              style={styles.upcomingItem}
            >
              <View style={styles.upcomingIcon}>
                {event.type === 'birthday' ? (
                  <Cake size={14} color="rgba(255, 255, 255, 0.8)" />
                ) : event.type === 'anniversary' ? (
                  <Heart size={14} color="rgba(255, 255, 255, 0.8)" />
                ) : (
                  <Calendar size={14} color="rgba(255, 255, 255, 0.8)" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.upcomingName}>
                  {event.title || (event.type === 'birthday' ? 'Birthday' : 'Anniversary')}
                </Text>
                <Text style={styles.upcomingSubheading}>
                  {event.friend.name}
                </Text>
              </View>
              <View style={styles.upcomingBadge}>
                <Text style={styles.upcomingDays}>
                  {getDaysText(event.daysUntil)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            SUGGESTIONS
          </Text>
          {suggestions.slice(0, 2).map((suggestion) => (
            <View key={suggestion.id} style={styles.suggestionCard}>
              <TouchableOpacity
                onPress={() => handleSuggestionPress(suggestion)}
                style={styles.suggestionPressable}
              >
                <Text style={styles.suggestionIcon}>{suggestion.icon}</Text>
                <View style={styles.suggestionContent}>
                  <Text style={styles.suggestionTitle}>
                    {suggestion.title}
                  </Text>
                  <Text style={styles.suggestionSubtitle}>
                    {suggestion.subtitle}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => dismissSuggestion(suggestion.id, 7)}
                style={styles.dismissButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={16} color="rgba(255, 255, 255, 0.5)" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </>
  );

  return (
    <>
      <HomeWidgetBase config={WIDGET_CONFIG}>
        <View style={styles.container}>
          {/* Hero Card with Integrated Expansion */}
          <View style={{ position: 'relative' }}>
            {renderCard()}

            {/* Expand indicator - centered */}
            {additionalItemsCount > 0 && (
              <TouchableOpacity
                style={styles.expandIndicator}
                onPress={() => setExpanded(!expanded)}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {expanded ? (
                  <>
                    <Text style={styles.expandText}>Show less</Text>
                    <ChevronUp size={18} color="rgba(255, 255, 255, 0.9)" />
                  </>
                ) : (
                  <>
                    <Text style={styles.expandText}>
                      See all {additionalItemsCount + 1}
                    </Text>
                    <ChevronDown size={18} color="rgba(255, 255, 255, 0.9)" />
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </HomeWidgetBase>

      {/* Plan Wizard Modals */}
      {rescheduleFriend && (
        <PlanWizard
          visible={rescheduleWizardOpen}
          onClose={() => {
            setRescheduleWizardOpen(false);
            setRescheduleFriend(null);
            setReschedulePlanData(null);
            setRescheduleInteractionId(null);
          }}
          initialFriend={rescheduleFriend}
          prefillData={reschedulePlanData}
          replaceInteractionId={rescheduleInteractionId || undefined}
        />
      )}
      {selectedFriend && (
        <PlanWizard
          visible={planWizardOpen}
          onClose={() => {
            setPlanWizardOpen(false);
            setSelectedFriend(null);
          }}
          initialFriend={selectedFriend}
        />
      )}
    </>
  );
};

/**
 * Card Components
 */

interface CardProps {
  onPress: () => void;
  colors: any;
  isDarkMode: boolean;
  expanded: boolean;
  expandedContent: React.ReactNode;
  expansionProgress: Animated.SharedValue<number>;
}

const PressingEventCard: React.FC<CardProps & { event: UpcomingDate }> = ({ event, onPress, isDarkMode, expansionProgress, expandedContent }) => {
  const expandedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: expansionProgress.value,
      maxHeight: expansionProgress.value * 1000,
    };
  });

  const getEventTitle = () => {
    if (event.type === 'birthday') return `${event.friend.name}'s Birthday`;
    if (event.type === 'anniversary') return `${event.friend.name}'s Anniversary`;
    return event.title || 'Life Event';
  };

  const getEventSubtext = () => {
    if (event.daysUntil === 0) return 'Today!';
    if (event.daysUntil === 1) return 'Tomorrow';
    return `In ${event.daysUntil} days`;
  };

  const Icon = event.type === 'birthday' ? Cake : event.type === 'anniversary' ? Heart : Calendar;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <LinearGradient
        colors={isDarkMode ? ['#DC2626', '#EF4444'] : ['#F87171', '#FCA5A5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientCard}
      >
        <View style={styles.cardContent}>
          <Icon size={32} color="#FFFFFF" />
          <Text style={styles.headlineCompact}>Upcoming Event</Text>
          <Text style={styles.subtextCompact}>
            {getEventTitle()} · {getEventSubtext()}
          </Text>
        </View>

        <Animated.View style={[styles.expandedSection, expandedStyle]}>
          {expandedContent}
        </Animated.View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const TodaysPlanCard: React.FC<CardProps & { data: { plans: any[], count: number } }> = ({ data, onPress, isDarkMode, expansionProgress, expandedContent }) => {
  const { plans, count } = data;

  const expandedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: expansionProgress.value,
      maxHeight: expansionProgress.value * 1000, // Large enough to fit content
    };
  });

  const getCategoryMetadataLocal = (category: any) => {
    try {
      return getCategoryMetadata(category as InteractionCategory);
    } catch {
      return null;
    }
  };

  // Generate summary list
  const getSummaryText = () => {
    if (count === 1) {
      const plan = plans[0];
      const friendNames = plan.friends.map((f: FriendModel) => f.name).join(', ');
      const categoryData = plan.interaction.interactionCategory
        ? getCategoryMetadataLocal(plan.interaction.interactionCategory)
        : null;
      const title = plan.interaction.title || categoryData?.label || plan.interaction.activity;
      return `${title} - ${friendNames}`;
    }

    // Multiple plans: show list
    return plans.slice(0, 3).map((plan: any) => {
      const friendNames = plan.friends.map((f: FriendModel) => f.name).join(', ');
      const categoryData = plan.interaction.interactionCategory
        ? getCategoryMetadataLocal(plan.interaction.interactionCategory)
        : null;
      const title = plan.interaction.title || categoryData?.label || plan.interaction.activity;
      return `${title} - ${friendNames}`;
    });
  };

  const summaryText = getSummaryText();

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <LinearGradient
        colors={isDarkMode ? ['#4C1D95', '#5B21B6'] : ['#8B5CF6', '#A78BFA']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientCard}
      >
        {/* Hero Content */}
        <View style={styles.cardContent}>
          <Calendar size={32} color="#FFFFFF" />
          <Text style={styles.headlineCompact}>
            {count === 1 ? "Today's Plan" : `${count} Plans Today`}
          </Text>
          {count === 1 ? (
            <Text style={styles.subtextCompact}>{summaryText}</Text>
          ) : (
            <View style={styles.planSummaryList}>
              {(summaryText as string[]).map((text, index) => (
                <Text key={index} style={styles.planSummaryItem}>
                  • {text}
                </Text>
              ))}
              {count > 3 && (
                <Text style={styles.planSummaryItem}>
                  + {count - 3} more
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Expanded Content - Animated */}
        <Animated.View style={[styles.expandedSection, expandedStyle]}>
          {expandedContent}
        </Animated.View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const StreakRiskCard: React.FC<CardProps & { streakCount: number; friend: FriendModel; batteryLevel: number; message: string }> = ({
  streakCount,
  friend,
  batteryLevel,
  message,
  onPress,
  isDarkMode,
  expansionProgress,
  expandedContent
}) => {
  const expandedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: expansionProgress.value,
      maxHeight: expansionProgress.value * 1000,
    };
  });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <LinearGradient
        colors={isDarkMode ? ['#7C3AED', '#8B5CF6'] : ['#A78BFA', '#C4B5FD']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientCard}
      >
        <View style={styles.cardContent}>
          <Flame size={32} color="#FFFFFF" />
          <Text style={styles.headlineCompact}>Stay in the Flow</Text>
          <Text style={styles.subtextCompact}>
            {message}
          </Text>
        </View>

        <Animated.View style={[styles.expandedSection, expandedStyle]}>
          {expandedContent}
        </Animated.View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const FriendFadingCard: React.FC<CardProps & { friend: FriendModel; score: number; message: string }> = ({
  friend,
  score,
  message,
  onPress,
  isDarkMode,
  expansionProgress,
  expandedContent
}) => {
  const expandedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: expansionProgress.value,
      maxHeight: expansionProgress.value * 1000,
    };
  });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <LinearGradient
        colors={isDarkMode ? ['#EA580C', '#F97316'] : ['#FB923C', '#FDBA74']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientCard}
      >
        <View style={styles.cardContent}>
          <Heart size={32} color="#FFFFFF" />
          <Text style={styles.headlineCompact}>Friend Needs You</Text>
          <Text style={styles.subtextCompact}>
            {message}
          </Text>
        </View>

        <Animated.View style={[styles.expandedSection, expandedStyle]}>
          {expandedContent}
        </Animated.View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const UpcomingPlanCard: React.FC<CardProps & { plan: any }> = ({ plan, onPress, isDarkMode, expansionProgress, expandedContent }) => {
  const friendNames = plan.friends.map((f: FriendModel) => f.name).join(', ');
  const title = plan.interaction.title || plan.interaction.activity || 'Plan';
  const dateText = plan.daysUntil === 1 ? 'Tomorrow' : `in ${plan.daysUntil} days`;

  const expandedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: expansionProgress.value,
      maxHeight: expansionProgress.value * 1000,
    };
  });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <LinearGradient
        colors={isDarkMode ? ['#0891B2', '#06B6D4'] : ['#22D3EE', '#67E8F9']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientCard}
      >
        <View style={styles.cardContent}>
          <Calendar size={32} color="#FFFFFF" />
          <Text style={styles.headlineCompact}>Upcoming Plan</Text>
          <Text style={styles.subtextCompact}>
            {title} with {friendNames} · {dateText}
          </Text>
        </View>

        <Animated.View style={[styles.expandedSection, expandedStyle]}>
          {expandedContent}
        </Animated.View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const QuickWeaveCard: React.FC<CardProps & { friend: FriendModel | null; daysSince: number; message: string }> = ({
  friend,
  daysSince,
  message,
  onPress,
  isDarkMode,
  expansionProgress,
  expandedContent
}) => {
  const expandedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: expansionProgress.value,
      maxHeight: expansionProgress.value * 1000,
    };
  });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <LinearGradient
        colors={isDarkMode ? ['#7C3AED', '#8B5CF6'] : ['#A78BFA', '#C4B5FD']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientCard}
      >
        <View style={styles.cardContent}>
          <Sparkles size={32} color="#FFFFFF" />
          <Text style={styles.headlineCompact}>Stay Connected</Text>
          <Text style={styles.subtextCompact}>
            {message}
          </Text>
        </View>

        <Animated.View style={[styles.expandedSection, expandedStyle]}>
          {expandedContent}
        </Animated.View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const AllClearCard: React.FC<CardProps & { message: { headline: string; subtext: string } }> = ({
  message,
  onPress,
  isDarkMode,
  expansionProgress,
  expandedContent
}) => {
  const expandedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: expansionProgress.value,
      maxHeight: expansionProgress.value * 1000,
    };
  });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <LinearGradient
        colors={isDarkMode ? ['#059669', '#10B981'] : ['#34D399', '#6EE7B7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientCard}
      >
        <View style={styles.cardContent}>
          <CheckCircle2 size={32} color="#FFFFFF" />
          <Text style={styles.headlineCompact}>{message.headline}</Text>
          <Text style={styles.subtextCompact}>
            {message.subtext}
          </Text>
        </View>

        <Animated.View style={[styles.expandedSection, expandedStyle]}>
          {expandedContent}
        </Animated.View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 0,
  },
  gradientCard: {
    borderRadius: 20,
    marginHorizontal: -20,
    marginTop: -20,
    marginBottom: -20,
    minHeight: 140,
    padding: 20,
    paddingBottom: 60, // Extra space for expand button
    position: 'relative',
    overflow: 'hidden',
  },
  cardContent: {
    alignItems: 'center',
    gap: 8,
  },
  expandedSection: {
    marginTop: 0,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    gap: 16,
    overflow: 'hidden',
  },
  headlineCompact: {
    fontFamily: 'Lora_700Bold',
    fontSize: 20,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtextCompact: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 17,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    maxWidth: '85%',
  },
  planSummaryList: {
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  planSummaryItem: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  expandIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingTop: 20,
    backgroundColor: 'transparent', // No background - relies on gradient
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: '#FFFFFF',
  },
  expandText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
  planCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 14,
    gap: 10,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  planContent: {
    flex: 1,
  },
  planTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    marginBottom: 2,
    color: '#FFFFFF',
  },
  planSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.75)',
  },
  planActions: {
    flexDirection: 'row',
    gap: 8,
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  confirmButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: '#FFFFFF',
  },
  rescheduleButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  rescheduleButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  upcomingItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  upcomingIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upcomingName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: '#FFFFFF',
  },
  upcomingSubheading: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    marginTop: 2,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  upcomingBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  upcomingDays: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: '#FFFFFF',
  },
  suggestionCard: {
    position: 'relative',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  suggestionPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    paddingRight: 36, // Make room for dismiss button
  },
  dismissButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionIcon: {
    fontSize: 24,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    marginBottom: 2,
    color: '#FFFFFF',
  },
  suggestionSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.75)',
  },
});
