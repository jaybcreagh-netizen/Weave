import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { differenceInDays, format, isSameDay, addDays, startOfDay } from 'date-fns';
import { Check, Clock, ChevronRight, Sparkles, Calendar, CheckCircle2 } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { HomeWidgetBase, HomeWidgetConfig } from '../HomeWidgetBase';
import { useSuggestions, useInteractions, usePlans } from '@/modules/interactions';
import { useUIStore } from '@/shared/stores/uiStore';
import { database } from '@/db';
import LifeEvent from '@/db/models/LifeEvent';
import { Q } from '@nozbe/watermelondb';
import withObservables from '@nozbe/with-observables';
import Interaction from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import { Card } from '@/shared/ui/Card';
import { WidgetHeader } from '@/shared/ui/WidgetHeader';
import { ListItem } from '@/shared/ui/ListItem';
import { FocusDetailSheet } from '@/modules/home/components/FocusDetailSheet';
import { FocusPlanItem } from './components/FocusPlanItem';
import FriendModel from '@/db/models/Friend';
import { Suggestion } from '@/shared/types/common';
import { getCategoryLabel } from '@/modules/interactions';
import { SeasonAnalyticsService } from '@/modules/intelligence';
import { parseFlexibleDate } from '@/shared/utils/date-utils';

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
    importance?: 'low' | 'medium' | 'high' | 'critical';
}

interface TodaysFocusWidgetProps {
    friends: FriendModel[];
}

const TodaysFocusWidgetContent: React.FC<TodaysFocusWidgetProps> = ({ friends }) => {
    const { tokens, typography, spacing } = useTheme();
    const router = useRouter();
    const { suggestions } = useSuggestions();
    const { allInteractions: interactions } = useInteractions();
    const { completePlan } = usePlans();
    const { openPostWeaveRating, openWeeklyReflection } = useUIStore();

    const [showDetailSheet, setShowDetailSheet] = useState(false);
    const [upcomingDates, setUpcomingDates] = useState<UpcomingDate[]>([]);
    const [confirmingIds, setConfirmingIds] = useState<Set<string>>(new Set());

    // Logic ported from V1
    const pendingConfirmations = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);

        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        return interactions
            .filter((i: Interaction) => {
                const iDate = new Date(i.interactionDate);
                iDate.setHours(0, 0, 0, 0);

                // Filter out plans further than tomorrow
                if (iDate > tomorrow) return false;

                const isToday = iDate.getTime() === today.getTime();
                if (isToday && i.status !== 'cancelled') return true;
                if (i.status === 'completed' || i.status === 'cancelled') return false;
                return iDate >= sevenDaysAgo;
            })
            .sort((a, b) => new Date(a.interactionDate).getTime() - new Date(b.interactionDate).getTime());
    }, [interactions]);

    const visiblePendingPlans = useMemo(() => {
        // We don't filter out confirmingIds anymore to prevent the visual glitch of disappearing/reappearing
        return pendingConfirmations;
    }, [pendingConfirmations]);

    // Load upcoming dates (ported from V1 and aligned with LifeEventGenerator)
    useEffect(() => {
        if (!friends || friends.length === 0) return;

        const loadLifeEvents = async () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const sevenDaysFromNow = new Date();
            sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
            const events: UpcomingDate[] = [];

            // 1. Fetch from life_events table
            try {
                const lifeEvents = await database
                    .get<LifeEvent>('life_events')
                    .query(
                        Q.where('event_date', Q.gte(today.getTime())),
                        Q.where('event_date', Q.lte(sevenDaysFromNow.getTime()))
                    )
                    .fetch();

                lifeEvents.forEach(event => {
                    const friend = friends.find(f => f.id === event.friendId);
                    if (friend) {
                        events.push({
                            friend,
                            type: 'life_event',
                            daysUntil: differenceInDays(startOfDay(event.eventDate), startOfDay(today)),
                            title: event.title,
                            importance: event.importance,
                        });
                    }
                });
            } catch (e) {
                console.error('Error fetching life_events:', e);
            }

            // 2. Check Friends for Birthdays and Anniversaries
            friends.forEach(friend => {
                try {
                    // Birthday Check
                    if (friend.birthday) {
                        const dateParts = parseFlexibleDate(friend.birthday);
                        if (dateParts) {
                            const { month, day } = dateParts;
                            const birthdayThisYear = new Date(today.getFullYear(), month - 1, day);
                            birthdayThisYear.setHours(0, 0, 0, 0);

                            if (birthdayThisYear < today) {
                                birthdayThisYear.setFullYear(today.getFullYear() + 1);
                            }

                            const daysUntil = differenceInDays(startOfDay(birthdayThisYear), startOfDay(today));
                            if (daysUntil >= 0 && daysUntil <= 7) { // check next 7 days
                                events.push({
                                    friend,
                                    type: 'birthday',
                                    daysUntil,
                                    importance: daysUntil <= 7 ? 'high' : 'medium'
                                });
                            }
                        }
                    }

                    // Anniversary Check
                    if (friend.anniversary && friend.relationshipType?.toLowerCase().includes('partner')) {
                        const dateParts = parseFlexibleDate(friend.anniversary);
                        if (dateParts) {
                            const { month, day } = dateParts;
                            const anniversaryThisYear = new Date(today.getFullYear(), month - 1, day);
                            anniversaryThisYear.setHours(0, 0, 0, 0);

                            if (anniversaryThisYear < today) {
                                anniversaryThisYear.setFullYear(today.getFullYear() + 1);
                            }

                            const daysUntil = differenceInDays(startOfDay(anniversaryThisYear), startOfDay(today));
                            if (daysUntil >= 0 && daysUntil <= 7) {
                                events.push({
                                    friend,
                                    type: 'anniversary',
                                    daysUntil,
                                    importance: daysUntil <= 7 ? 'medium' : 'low'
                                });
                            }
                        }
                    }
                } catch (e) {
                    console.warn(`Error parsing dates for friend ${friend.id}`, e);
                }
            });

            // Sort by importance, then date
            events.sort((a, b) => {
                // Sort by date first
                return a.daysUntil - b.daysUntil;
            });

            setUpcomingDates(events);
        };

        loadLifeEvents();
    }, [friends]);

    const { showMicroReflectionSheet } = useUIStore();

    const handleConfirmPlan = async (interactionId: string) => {
        // Just open the rating modal for this plan
        openPostWeaveRating(interactionId);
    };

    const handleReschedulePlan = async (plan: Interaction) => {
        try {
            // Fetch the primary friend for this plan
            const iFriends = await plan.interactionFriends.fetch();
            if (iFriends.length === 0) return;
            const friendId = iFriends[0].friendId;
            const friend = friends.find(f => f.id === friendId);

            if (friend) {
                // Navigate to friend profile with reschedule action
                router.push({
                    pathname: '/friend-profile',
                    params: {
                        friendId: friend.id,
                        action: 'reschedule',
                        interactionId: plan.id
                    }
                });
                setShowDetailSheet(false);
            }
        } catch (e) {
            console.error('Error preparing reschedule:', e);
        }
    };

    const handleDeepenWeave = async (plan: Interaction) => {
        const iFriends = await plan.interactionFriends.fetch();
        const friendId = iFriends.length > 0 ? iFriends[0].friendId : '';
        const friend = friends.find(f => f.id === friendId);

        if (friend) {
            showMicroReflectionSheet({
                friendId: friend.id,
                friendName: friend.name,
                activityId: plan.interactionCategory || 'hangout',
                activityLabel: plan.title || 'Interaction',
                interactionId: plan.id,
                friendArchetype: friend.archetype,
            });
        }
    };

    const handleReviewPlan = (id?: string) => {
        openPostWeaveRating(id); // Pass ID if available, otherwise opens queue
    };

    const handleSuggestionAction = (suggestion: Suggestion) => {
        if (suggestion.id === 'weekly-reflection-sunday') {
            setShowDetailSheet(false);
            setTimeout(() => {
                openWeeklyReflection();
            }, 500);
            return;
        }

        const friend = friends.find(f => f.id === suggestion.friendId);
        if (friend) {
            router.push(`/friend-profile?friendId=${friend.id}`);

            // ANALYTICS: Track acceptance
            SeasonAnalyticsService.trackSuggestionAccepted().catch(console.error);
        }
        setShowDetailSheet(false);
    };

    const todaysUpcoming = useMemo(() =>
        interactions.filter(i =>
            isSameDay(new Date(i.interactionDate), new Date()) &&
            i.status === 'planned'
        ).sort((a, b) => new Date(a.interactionDate).getTime() - new Date(b.interactionDate).getTime())
        , [interactions]);

    const todaysCompleted = useMemo(() =>
        interactions.filter(i =>
            isSameDay(new Date(i.interactionDate), new Date()) &&
            i.status === 'completed'
        ).sort((a, b) => new Date(b.interactionDate).getTime() - new Date(a.interactionDate).getTime())
        , [interactions]);

    const tomorrowsPlans = useMemo(() => {
        const tomorrow = addDays(new Date(), 1);
        return interactions.filter(i =>
            isSameDay(new Date(i.interactionDate), tomorrow) &&
            i.status === 'planned'
        ).sort((a, b) => new Date(a.interactionDate).getTime() - new Date(b.interactionDate).getTime());
    }, [interactions]);



    const [planFriendIds, setPlanFriendIds] = useState<Record<string, string[]>>({});

    // Batch fetch all interaction-friend links instead of N+1 pattern
    useEffect(() => {
        let isMounted = true;
        const loadFriends = async () => {
            const allItems = [...todaysUpcoming, ...todaysCompleted, ...tomorrowsPlans];
            if (allItems.length === 0) {
                setPlanFriendIds({});
                return;
            }

            const interactionIds = allItems.map(p => p.id);

            try {
                // Single batch query instead of N queries
                const links = await database.get<InteractionFriend>('interaction_friends')
                    .query(Q.where('interaction_id', Q.oneOf(interactionIds)))
                    .fetch();

                // Build map in memory
                const newMap: Record<string, string[]> = {};
                for (const link of links) {
                    if (!newMap[link.interactionId]) {
                        newMap[link.interactionId] = [];
                    }
                    newMap[link.interactionId].push(link.friendId);
                }

                if (isMounted) setPlanFriendIds(newMap);
            } catch (e) {
                console.error('Error batch loading plan friends:', e);
            }
        };
        loadFriends();
        return () => { isMounted = false; };
    }, [todaysUpcoming, todaysCompleted, tomorrowsPlans]);

    const hasUpcoming = todaysUpcoming.length > 0;
    const hasCompleted = todaysCompleted.length > 0;
    const hasTomorrow = tomorrowsPlans.length > 0;
    const hasReviews = false; // Disabled in condensed widget
    const hasSuggestions = suggestions.length > 0;
    const hasUpcomingDates = upcomingDates.length > 0;
    const isAllClear = !hasUpcoming && !hasCompleted && !hasTomorrow && !hasSuggestions && !hasUpcomingDates;

    return (
        <>
            <HomeWidgetBase config={WIDGET_CONFIG} padding="none">
                <View style={{ padding: 16, paddingBottom: 0 }}>
                    <WidgetHeader
                        title="Today's Focus"
                        action={{ label: 'See all', onPress: () => setShowDetailSheet(true) }}
                    />
                </View>

                {/* Upcoming Plans Section */}
                {hasUpcoming && (
                    <View>
                        {/* Only show header if there are other sections to differentiate from */}
                        {(hasCompleted) && (
                            <View className="px-4 py-2 pt-4">
                                <Text className="text-xs font-semibold uppercase tracking-wide" style={{ color: tokens.foregroundMuted }}>Upcoming</Text>
                            </View>
                        )}
                        {todaysUpcoming.map((plan, index) => {
                            return (
                                <FocusPlanItem
                                    key={plan.id}
                                    interaction={plan}
                                    friends={friends}
                                    onReschedule={handleReschedulePlan}
                                    isCompletedSection={false}
                                />
                            );
                        })}
                    </View>
                )}

                {/* Completed Plans Section */}
                {hasCompleted && (
                    <View style={{ marginTop: hasUpcoming ? 8 : 0 }}>
                        <View className="px-4 py-2 pt-4">
                            <Text className="text-xs font-semibold uppercase tracking-wide" style={{ color: tokens.foregroundMuted }}>Completed Today</Text>
                        </View>
                        {todaysCompleted.slice(0, 3).map((plan, index) => {
                            return (
                                <FocusPlanItem
                                    key={plan.id}
                                    interaction={plan}
                                    friends={friends}
                                    onDeepen={handleDeepenWeave}
                                    isCompletedSection={true}
                                />
                            );
                        })}
                        {todaysCompleted.length > 3 && (
                            <TouchableOpacity
                                onPress={() => setShowDetailSheet(true)}
                                style={{ paddingVertical: 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' }}
                            >
                                <Text style={{
                                    fontFamily: typography.fonts.sansMedium,
                                    fontSize: 13,
                                    color: tokens.primary
                                }}>
                                    + {todaysCompleted.length - 3} more completed
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* Tomorrow's Plans Section */}
                {hasTomorrow && (
                    <View style={{ marginTop: (hasUpcoming || hasCompleted) ? 8 : 0 }}>
                        <View className="px-4 py-2 pt-4">
                            <Text className="text-xs font-semibold uppercase tracking-wide" style={{ color: tokens.foregroundMuted }}>Tomorrow</Text>
                        </View>
                        {tomorrowsPlans.map((plan, index) => {
                            return (
                                <FocusPlanItem
                                    key={plan.id}
                                    interaction={plan}
                                    friends={friends}
                                    onReschedule={handleReschedulePlan}
                                    isCompletedSection={false}
                                />
                            );
                        })}
                    </View>
                )}

                {isAllClear ? (
                    <View className="p-6 items-center justify-center gap-3">
                        <CheckCircle2 size={32} color={tokens.success} />
                        <Text style={{
                            color: tokens.foregroundMuted,
                            fontFamily: typography.fonts.sans,
                            fontSize: typography.scale.body.fontSize,
                            lineHeight: typography.scale.body.lineHeight
                        }}>
                            You're all caught up
                        </Text>
                    </View>
                ) : null}



                {(hasUpcoming || hasCompleted || hasTomorrow) && <View style={{ height: 16 }} />}

                {/* Visual Separator if needed, but spacing might be enough */}

                {hasSuggestions && (
                    <TouchableOpacity onPress={() => setShowDetailSheet(true)}>
                        <View className="flex-row items-center justify-between p-4" style={(hasUpcoming || hasCompleted || hasTomorrow || hasUpcomingDates) ? { borderTopWidth: 1, borderTopColor: tokens.borderSubtle } : undefined}>
                            <View className="flex-1 flex-row items-center mr-2">
                                <Sparkles size={16} color={tokens.primaryMuted} style={{ marginRight: 8 }} />
                                <Text className="flex-1" style={{
                                    color: tokens.foreground,
                                    fontFamily: typography.fonts.sans,
                                    fontSize: typography.scale.body.fontSize,
                                    lineHeight: typography.scale.body.lineHeight
                                }}>
                                    {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
                                </Text>
                            </View>
                            <ChevronRight size={16} color={tokens.foregroundSubtle} />
                        </View>
                    </TouchableOpacity>
                )}

                {hasUpcomingDates && (
                    <TouchableOpacity onPress={() => setShowDetailSheet(true)}>
                        <View className="flex-row items-center justify-between p-4" style={(hasUpcoming || hasCompleted || hasTomorrow || hasSuggestions) ? { borderTopWidth: 1, borderTopColor: tokens.borderSubtle } : undefined}>
                            <View className="flex-1 flex-row items-center mr-2">
                                <Calendar size={16} color={tokens.primaryMuted} style={{ marginRight: 8 }} />
                                <Text className="flex-1" style={{
                                    color: tokens.foreground,
                                    fontFamily: typography.fonts.sans,
                                    fontSize: typography.scale.body.fontSize,
                                    lineHeight: typography.scale.body.lineHeight
                                }}>
                                    {upcomingDates[0].friend.name}'s {upcomingDates[0].type === 'birthday' ? 'birthday' : 'event'} {upcomingDates[0].daysUntil === 0 ? 'today' : upcomingDates[0].daysUntil === 1 ? 'tomorrow' : `in ${upcomingDates[0].daysUntil} days`}
                                    {upcomingDates.length > 1 && ` +${upcomingDates.length - 1} more`}
                                </Text>
                            </View>
                            <ChevronRight size={16} color={tokens.foregroundSubtle} />
                        </View>
                    </TouchableOpacity>
                )}
            </HomeWidgetBase>

            <FocusDetailSheet
                isVisible={showDetailSheet}
                onClose={() => setShowDetailSheet(false)}
                upcomingPlans={todaysUpcoming}
                tomorrowPlans={tomorrowsPlans}
                completedPlans={todaysCompleted}
                suggestions={suggestions}
                upcomingDates={upcomingDates}
                friends={friends}
                onConfirmPlan={handleConfirmPlan}
                onReschedulePlan={handleReschedulePlan}
                onSuggestionAction={handleSuggestionAction}
            />
        </>
    );
};

const enhance = withObservables([], () => ({
    friends: database.get<FriendModel>('friends').query().observe(),
}));

export const TodaysFocusWidgetV2 = enhance(TodaysFocusWidgetContent);
