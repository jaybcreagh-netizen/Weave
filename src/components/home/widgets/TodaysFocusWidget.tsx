/**
 * TodaysFocusWidget
 * Priority-based focus card with beautiful gradient hero cards
 * Shows the most important action for today
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, UIManager } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useRouter } from 'expo-router';
import { differenceInDays, format } from 'date-fns';
import { Cake, Heart, ChevronDown, ChevronUp, Calendar, CheckCircle2, Sparkles, Flame } from 'lucide-react-native';
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

type PriorityState = 'todays-plan' | 'streak-risk' | 'friend-fading' | 'upcoming-plan' | 'quick-weave';

export const TodaysFocusWidget: React.FC = () => {
  const { colors, isDarkMode } = useTheme();
  const router = useRouter();
  const { friends } = useFriendStore();
  const { suggestions } = useSuggestions();
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

  const expansionProgress = useSharedValue(0);

  // Animate expansion with spring
  useEffect(() => {
    expansionProgress.value = withSpring(expanded ? 1 : 0, {
      damping: 20,
      stiffness: 200,
    });
  }, [expanded]);

  // Calculate streak
  useEffect(() => {
    const calculateStreak = async () => {
      try {
        const interactions = await database
          .get<Interaction>('interactions')
          .query(Q.where('status', 'completed'), Q.sortBy('interaction_date', Q.desc))
          .fetch();

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

    calculateStreak();
  }, []);

  // Find fading friend (lowest score)
  useEffect(() => {
    if (!friends || friends.length === 0) return;

    const friendsWithScores = friends.map(f => ({
      friend: f,
      score: calculateCurrentScore(f),
    }));

    const lowestScore = friendsWithScores.reduce((min, current) =>
      current.score < min.score ? current : min
    );

    if (lowestScore.score < 40) {
      setFadingFriend(lowestScore);
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
          const birthdayThisYear = new Date(friend.birthday);
          birthdayThisYear.setFullYear(today.getFullYear());
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

  // Priority logic
  const getPriority = (): { state: PriorityState; data?: any } => {
    // 1. Today's plan (highest priority)
    const todaysPlan = pendingPlans.find(p => p.daysUntil === 0);
    if (todaysPlan) return { state: 'todays-plan', data: todaysPlan };

    // 2. Streak at risk (no weave today and streak > 0)
    if (streakCount > 0 && !todaysPlan) {
      return { state: 'streak-risk', data: { streakCount } };
    }

    // 3. Friend fading
    if (fadingFriend) {
      return { state: 'friend-fading', data: fadingFriend };
    }

    // 4. Upcoming plan (within next 3 days)
    const upcomingPlan = pendingPlans.find(p => p.daysUntil > 0 && p.daysUntil <= 3);
    if (upcomingPlan) return { state: 'upcoming-plan', data: upcomingPlan };

    // 5. Quick weave (default)
    // Filter to only friends with interactions, then sort by longest time
    const friendsWithInteractions = friends
      .filter(f => f.lastInteraction)
      .map(f => ({ friend: f, daysSince: differenceInDays(new Date(), f.lastInteraction!) }))
      .sort((a, b) => b.daysSince - a.daysSince);

    const lastInteraction = friendsWithInteractions.length > 0
      ? friendsWithInteractions[0]
      : null;

    return { state: 'quick-weave', data: lastInteraction };
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
    if (priority.state === 'todays-plan' || priority.state === 'upcoming-plan') {
      setExpanded(!expanded);
    } else if (priority.state === 'streak-risk' || priority.state === 'quick-weave') {
      // Open quick weave
      router.push('/weave-logger');
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
      case 'todays-plan':
        return <TodaysPlanCard plan={priority.data} {...cardProps} />;
      case 'streak-risk':
        return <StreakRiskCard streakCount={priority.data.streakCount} {...cardProps} />;
      case 'friend-fading':
        return <FriendFadingCard friend={priority.data.friend} score={priority.data.score} {...cardProps} />;
      case 'upcoming-plan':
        return <UpcomingPlanCard plan={priority.data} {...cardProps} />;
      case 'quick-weave':
        return <QuickWeaveCard
          friend={priority.data?.friend || null}
          daysSince={priority.data?.daysSince || 0}
          {...cardProps}
        />;
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
          {upcomingDates.map((event) => (
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
          {suggestions.slice(0, 3).map((suggestion) => (
            <TouchableOpacity
              key={suggestion.id}
              onPress={() => handleSuggestionPress(suggestion)}
              style={styles.suggestionCard}
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

            {/* Expand indicator - separate touchable */}
            {additionalItemsCount > 0 && (
              <TouchableOpacity
                style={styles.expandIndicator}
                onPress={() => setExpanded(!expanded)}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {!expanded && (
                  <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.badgeText}>{additionalItemsCount}</Text>
                  </View>
                )}
                {expanded ? (
                  <ChevronUp size={20} color="rgba(255, 255, 255, 0.8)" />
                ) : (
                  <ChevronDown size={20} color="rgba(255, 255, 255, 0.8)" />
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

const TodaysPlanCard: React.FC<CardProps & { plan: any }> = ({ plan, onPress, isDarkMode, expansionProgress, expandedContent }) => {
  const friendNames = plan.friends.map((f: FriendModel) => f.name).join(', ');
  const title = plan.interaction.title || plan.interaction.activity || 'Plan';

  const expandedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: expansionProgress.value,
      maxHeight: expansionProgress.value * 1000, // Large enough to fit content
    };
  });

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
          <Text style={styles.headlineCompact}>Today's Plan</Text>
          <Text style={styles.subtextCompact}>
            {title} with {friendNames}
          </Text>
        </View>

        {/* Expanded Content - Animated */}
        <Animated.View style={[styles.expandedSection, expandedStyle]}>
          {expandedContent}
        </Animated.View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const StreakRiskCard: React.FC<CardProps & { streakCount: number }> = ({ streakCount, onPress, isDarkMode, expansionProgress, expandedContent }) => {
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
        colors={isDarkMode ? ['#DC2626', '#EF4444'] : ['#F87171', '#FCA5A5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientCard}
      >
        <View style={styles.cardContent}>
          <Flame size={32} color="#FFFFFF" />
          <Text style={styles.headlineCompact}>Keep Your Streak!</Text>
          <Text style={styles.subtextCompact}>
            Your {streakCount}-day streak needs attention today
          </Text>
        </View>

        <Animated.View style={[styles.expandedSection, expandedStyle]}>
          {expandedContent}
        </Animated.View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const FriendFadingCard: React.FC<CardProps & { friend: FriendModel; score: number }> = ({ friend, onPress, isDarkMode, expansionProgress, expandedContent }) => {
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
            {friend.name}'s connection is fading
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

const QuickWeaveCard: React.FC<CardProps & { friend: FriendModel | null; daysSince: number }> = ({ friend, daysSince, onPress, isDarkMode, expansionProgress, expandedContent }) => {
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
          {friend ? (
            <Text style={styles.subtextCompact}>
              It's been {daysSince} {daysSince === 1 ? 'day' : 'days'} since you caught up with {friend.name}
            </Text>
          ) : (
            <Text style={styles.subtextCompact}>
              Reach out to a friend today
            </Text>
          )}
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
    fontSize: 22,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtextCompact: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    maxWidth: '85%',
  },
  expandIndicator: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    padding: 10,
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
