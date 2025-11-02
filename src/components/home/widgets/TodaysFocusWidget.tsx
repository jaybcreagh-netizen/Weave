import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { differenceInDays, format } from 'date-fns';
import { Cake, Heart, ChevronRight, Calendar, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react-native';
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

const WIDGET_CONFIG: HomeWidgetConfig = {
  id: 'todays-focus',
  type: 'todays-focus',
  title: "Today's Focus",
  minHeight: 200,
  fullWidth: true,
};

interface UpcomingDate {
  friend: FriendModel;
  type: 'birthday' | 'anniversary';
  daysUntil: number;
}

export const TodaysFocusWidget: React.FC = () => {
  const { colors } = useTheme();
  const router = useRouter();
  const { friends } = useFriendStore();
  const { suggestions } = useSuggestions();
  const { pendingPlans } = usePendingPlans();
  const { confirmPlan } = useInteractionStore();
  const [upcomingDates, setUpcomingDates] = useState<UpcomingDate[]>([]);
  const [rescheduleWizardOpen, setRescheduleWizardOpen] = useState(false);
  const [rescheduleFriend, setRescheduleFriend] = useState<FriendModel | null>(null);
  const [reschedulePlanData, setReschedulePlanData] = useState<any>(null);
  const [rescheduleInteractionId, setRescheduleInteractionId] = useState<string | null>(null);
  const [planWizardOpen, setPlanWizardOpen] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<FriendModel | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const expandedHeight = useSharedValue(0);

  // Animate expansion/collapse
  useEffect(() => {
    expandedHeight.value = withTiming(expanded ? 1 : 0, { duration: 250 });
  }, [expanded]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: expandedHeight.value,
      maxHeight: expandedHeight.value * 2000, // Large enough to fit content
      overflow: 'hidden',
    };
  });

  // Calculate upcoming special dates (30 days)
  useEffect(() => {
    if (!friends || friends.length === 0) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const events: UpcomingDate[] = [];

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

      // Check anniversary
      if (friend.anniversary) {
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
  }, [friends]);

  // Organize suggestions by actionability
  const actionableSuggestions = suggestions.filter(s =>
    s.action.type === 'plan' || s.action.type === 'log'
  );
  const reflectionSuggestions = suggestions.filter(s => s.action.type === 'reflect');
  const informationalSuggestions = suggestions.filter(s =>
    s.category === 'life-event' || s.category === 'insight' || s.category === 'portfolio'
  );

  // Show top 3 by default, expand to show all
  const displayedSuggestions = showAllSuggestions
    ? suggestions
    : suggestions.slice(0, 3);

  const handleConfirmPlan = async (interactionId: string) => {
    try {
      await confirmPlan(interactionId);
    } catch (error) {
      console.error('Error confirming plan:', error);
    }
  };

  const handleReschedulePlan = (plan: typeof pendingPlans[0]) => {
    // Open PlanWizard with existing plan data pre-filled
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
    if (days <= 7) return `${days}d`;
    return `${days}d`;
  };

  const handleSuggestionPress = (suggestion: Suggestion) => {
    const friend = friends.find(f => f.id === suggestion.friendId);
    if (!friend) return;

    if (suggestion.action.type === 'plan') {
      // Open plan wizard
      setSelectedFriend(friend);
      setPlanWizardOpen(true);
    } else if (suggestion.action.type === 'log') {
      // Navigate to quick log
      router.push(`/weave-logger?friendId=${friend.id}`);
    } else if (suggestion.action.type === 'reflect') {
      // Navigate to friend profile
      router.push(`/friend-profile?friendId=${friend.id}`);
    } else {
      // Default to friend profile
      router.push(`/friend-profile?friendId=${friend.id}`);
    }
  };

  // Count total actionable items
  const totalItems = pendingPlans.length + suggestions.length;
  const topSuggestion = suggestions[0];

  return (
    <>
      <HomeWidgetBase config={WIDGET_CONFIG}>
        <View style={styles.container}>
          {/* Header with collapse toggle */}
          <TouchableOpacity
            style={styles.header}
            onPress={() => setExpanded(!expanded)}
            activeOpacity={0.7}
          >
            <View style={styles.headerLeft}>
              <Text style={[styles.headerTitle, { color: colors.foreground }]}>
                Smart Suggestions
              </Text>
              {!expanded && totalItems > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.badgeText}>{totalItems}</Text>
                </View>
              )}
            </View>
            {expanded ? (
              <ChevronUp size={20} color={colors['muted-foreground']} />
            ) : (
              <ChevronDown size={20} color={colors['muted-foreground']} />
            )}
          </TouchableOpacity>

          {/* Collapsed Preview */}
          {!expanded && (
            topSuggestion ? (
              <TouchableOpacity
                onPress={() => handleSuggestionPress(topSuggestion)}
                style={[styles.compactPreview, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Text style={styles.compactIcon}>{topSuggestion.icon}</Text>
                <View style={styles.compactContent}>
                  <Text style={[styles.compactTitle, { color: colors.foreground }]} numberOfLines={1}>
                    {topSuggestion.title}
                  </Text>
                  <Text style={[styles.compactSubtitle, { color: colors['muted-foreground'] }]} numberOfLines={1}>
                    {topSuggestion.subtitle}
                  </Text>
                </View>
                <ChevronRight size={18} color={colors['muted-foreground']} />
              </TouchableOpacity>
            ) : (
              <View style={styles.compactEmpty}>
                <Text style={styles.compactEmptyIcon}>✨</Text>
                <Text style={[styles.compactEmptyText, { color: colors['muted-foreground'] }]}>
                  All caught up
                </Text>
              </View>
            )
          )}

          {/* Expanded Content */}
          <Animated.View style={[animatedStyle, { gap: 16 }]}>
            {/* Pending Plan Confirmations */}
              {pendingPlans.length > 0 && (
                <View style={styles.pendingPlansSection}>
                  <Text style={[styles.pendingSectionTitle, { color: colors['muted-foreground'] }]}>
                    Confirm Plans
                  </Text>
                  {pendingPlans.slice(0, 2).map((plan) => {
              const friendName = plan.friends.map(f => f.name).join(', ');
              const dateText = plan.daysUntil === 0
                ? 'Today'
                : plan.daysUntil === 1
                  ? 'Tomorrow'
                  : format(plan.interaction.interactionDate, 'EEE, MMM d');

              // Get friendly label for category
              const categoryData = plan.interaction.interactionCategory
                ? getCategoryMetadata(plan.interaction.interactionCategory as InteractionCategory)
                : null;
              const displayTitle = plan.interaction.title
                || (categoryData?.label)
                || plan.interaction.activity;

              return (
                <View
                  key={plan.interaction.id}
                  style={[
                    styles.pendingPlanCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.pendingPlanHeader}>
                    <Calendar size={20} color={colors.primary} />
                    <View style={styles.pendingPlanContent}>
                      <Text style={[styles.pendingPlanTitle, { color: colors.foreground }]}>
                        {displayTitle}
                      </Text>
                      <Text style={[styles.pendingPlanSubtitle, { color: colors['muted-foreground'] }]}>
                        {friendName} • {dateText}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.pendingPlanBadge,
                        {
                          backgroundColor: plan.daysUntil <= 1 ? colors.primary + '20' : colors.muted,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.pendingPlanBadgeText,
                          {
                            color: plan.daysUntil <= 1 ? colors.primary : colors['muted-foreground'],
                          },
                        ]}
                      >
                        {plan.daysUntil}d
                      </Text>
                    </View>
                  </View>

                  <View style={styles.pendingPlanActions}>
                    <TouchableOpacity
                      style={[styles.pendingActionButton, { backgroundColor: colors.primary }]}
                      onPress={() => handleConfirmPlan(plan.interaction.id)}
                    >
                      <CheckCircle2 size={16} color={colors['primary-foreground']} />
                      <Text style={[styles.pendingActionText, { color: colors['primary-foreground'] }]}>
                        Confirm
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.pendingActionButtonSecondary, { borderColor: colors.border }]}
                      onPress={() => handleReschedulePlan(plan)}
                    >
                      <Text style={[styles.pendingActionTextSecondary, { color: colors['muted-foreground'] }]}>
                        Reschedule
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

              {/* All Suggestions from Engine */}
              {displayedSuggestions.length > 0 ? (
                <View style={styles.suggestionsSection}>
                  <Text style={[styles.suggestionsSectionTitle, { color: colors['muted-foreground'] }]}>
                    Recommended Actions
                  </Text>
                  {displayedSuggestions.map((suggestion) => (
                    <TouchableOpacity
                      key={suggestion.id}
                      onPress={() => handleSuggestionPress(suggestion)}
                      style={[
                        styles.suggestionCard,
                        {
                          backgroundColor: colors.card,
                          borderColor: suggestion.urgency === 'critical' ? colors.primary : colors.border,
                          borderWidth: suggestion.urgency === 'critical' ? 2 : 1,
                        },
                      ]}
                    >
                      <View style={styles.suggestionHeader}>
                        <Text style={styles.suggestionIcon}>{suggestion.icon}</Text>
                        <View style={styles.suggestionContent}>
                          <Text style={[styles.suggestionTitle, { color: colors.foreground }]}>
                            {suggestion.title}
                          </Text>
                          <Text style={[styles.suggestionSubtitle, { color: colors['muted-foreground'] }]}>
                            {suggestion.subtitle}
                          </Text>
                          <Text style={[styles.suggestionAction, { color: colors.primary }]}>
                            {suggestion.actionLabel}
                          </Text>
                        </View>
                        <ChevronRight size={20} color={colors['muted-foreground']} />
                      </View>
                    </TouchableOpacity>
                  ))}

                  {/* Show More/Less Toggle */}
                  {suggestions.length > 3 && (
                    <TouchableOpacity
                      onPress={() => setShowAllSuggestions(!showAllSuggestions)}
                      style={styles.showMoreButton}
                    >
                      <Text style={[styles.showMoreText, { color: colors.primary }]}>
                        {showAllSuggestions
                          ? 'Show Less'
                          : `Show ${suggestions.length - 3} More`}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>✨</Text>
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                    All caught up
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: colors['muted-foreground'] }]}>
                    Your connections are thriving
                  </Text>
                </View>
              )}

        {/* Upcoming Special Dates Preview */}
        {upcomingDates.length > 0 && (
          <View style={styles.upcomingSection}>
            <Text style={[styles.upcomingSectionTitle, { color: colors['muted-foreground'] }]}>
              Upcoming
            </Text>
            {upcomingDates.map((event, index) => (
              <TouchableOpacity
                key={`${event.friend.id}-${event.type}`}
                onPress={() => router.push(`/friend-profile?friendId=${event.friend.id}`)}
                style={[
                  styles.upcomingItem,
                  { borderColor: colors.border },
                ]}
              >
                <View style={styles.upcomingIcon}>
                  {event.type === 'birthday' ? (
                    <Cake size={16} color={colors['muted-foreground']} />
                  ) : (
                    <Heart size={16} color={colors['muted-foreground']} />
                  )}
                </View>
                <Text style={[styles.upcomingName, { color: colors.foreground }]}>
                  {event.friend.name}
                </Text>
                <View
                  style={[
                    styles.upcomingBadge,
                    {
                      backgroundColor: event.daysUntil <= 7 ? colors.primary + '20' : colors.card,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.upcomingDays,
                      {
                        color: event.daysUntil <= 7 ? colors.primary : colors['muted-foreground'],
                      },
                    ]}
                  >
                    {getDaysText(event.daysUntil)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
          </Animated.View>
      </View>
    </HomeWidgetBase>

    {/* Reschedule Wizard */}
    {rescheduleFriend && (
      <PlanWizard
        visible={rescheduleWizardOpen}
        onClose={() => {
          setRescheduleWizardOpen(false);
          setRescheduleFriend(null);
          setReschedulePlanData(null);
          setRescheduleInteractionId(null);
        }}
        friend={rescheduleFriend}
        prefillData={reschedulePlanData}
        replaceInteractionId={rescheduleInteractionId || undefined}
      />
    )}

    {/* Plan Wizard from Fallback Suggestion */}
    {selectedFriend && (
      <PlanWizard
        visible={planWizardOpen}
        onClose={() => {
          setPlanWizardOpen(false);
          setSelectedFriend(null);
        }}
        friend={selectedFriend}
      />
    )}
  </>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontFamily: 'Lora_700Bold',
    fontSize: 20,
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
  compactPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  compactIcon: {
    fontSize: 24,
  },
  compactContent: {
    flex: 1,
  },
  compactTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    marginBottom: 2,
  },
  compactSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  compactEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  compactEmptyIcon: {
    fontSize: 20,
  },
  compactEmptyText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  pendingPlansSection: {
    gap: 12,
  },
  pendingSectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  suggestionsSection: {
    gap: 12,
  },
  suggestionsSectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  pendingPlanCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  pendingPlanHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  pendingPlanContent: {
    flex: 1,
  },
  pendingPlanTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    marginBottom: 2,
  },
  pendingPlanSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
  },
  pendingPlanBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pendingPlanBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  pendingPlanActions: {
    flexDirection: 'row',
    gap: 8,
  },
  pendingActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  pendingActionText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  pendingActionButtonSecondary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  pendingActionTextSecondary: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  suggestionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  suggestionIcon: {
    fontSize: 32,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionTitle: {
    fontFamily: 'Lora_700Bold',
    fontSize: 16,
    marginBottom: 4,
  },
  suggestionSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  suggestionAction: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    marginTop: 4,
  },
  showMoreButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  showMoreText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: 'Lora_700Bold',
    fontSize: 18,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
  upcomingSection: {
    gap: 8,
  },
  upcomingSectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  upcomingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  upcomingIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upcomingName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    flex: 1,
  },
  upcomingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  upcomingDays: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
});
