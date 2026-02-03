import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { differenceInDays, format, isSameDay, addDays, startOfDay } from 'date-fns';
import { Check, Clock, ChevronRight, Sparkles, Calendar, CheckCircle2, Coffee, Moon, Users, Flame } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/shared/hooks/useTheme';
import { HomeWidgetBase, HomeWidgetConfig } from '../HomeWidgetBase';
import { useSuggestions, useInteractions, usePlans } from '@/modules/interactions';
import { useUIStore } from '@/shared/stores/uiStore';
import { database } from '@/db';
import LifeEvent from '@/db/models/LifeEvent';
import { Q } from '@nozbe/watermelondb';
import Interaction from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import Intention from '@/db/models/Intention';
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
import { useReachOut, ContactLinker } from '@/modules/messaging';
import { SuggestionActionSheet } from '@/modules/interactions/components/SuggestionActionSheet';
import { useFriendsObservable } from '@/shared/context/FriendsObservableContext';
import { useOracleSheet, oracleService, oracleContextBuilder, ContextTier } from '@/modules/oracle';
import { hasCompletedReflectionForCurrentWeek } from '@/modules/reflection';
import { usePendingWeaves, ActivityInboxSheet } from '@/modules/sync';
import { getPendingIncomingRequests, LinkRequest } from '@/modules/relationships';

import { UserPlus, Send } from 'lucide-react-native';
import { CachedImage } from '@/shared/ui/CachedImage';
import { StreakService } from '@/modules/gamification/services/streak.service';
import { InsightCardCompact } from '@/modules/intelligence/components/InsightCard';
import { insightOrchestratorService } from '@/modules/intelligence';
import RelationshipInsight from '@/db/models/RelationshipInsight';

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

interface TodaysFocusWidgetProps { }

interface RestDayStateProps {
    isLoading?: boolean;
    dailyReflection?: string | null;
}

const RestDayState: React.FC<RestDayStateProps> = ({ isLoading, dailyReflection }) => {
    const { tokens, typography } = useTheme();

    return (
        <View className="px-4 pb-4">
            <View
                style={{
                    backgroundColor: tokens.backgroundSubtle,
                    borderRadius: 12,
                    padding: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 16
                }}
            >
                <View style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: tokens.background,
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Coffee size={20} color={tokens.primary} />
                </View>

                <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{
                        color: tokens.foreground,
                        fontFamily: typography.fonts.serif,
                        fontSize: 16,
                        textAlign: 'left'
                    }}>
                        No commitments today
                    </Text>
                    <Text style={{
                        color: tokens.foregroundMuted,
                        fontFamily: typography.fonts.sans,
                        fontSize: 13,
                        textAlign: 'left'
                    }}>
                        It's a perfect time to recharge.
                    </Text>
                </View>
            </View>
        </View>

    );
};

interface PendingItemProps {
    id: string;
    title: string;
    subtitle: string;
    photoUrl?: string;
    type: 'request' | 'weave';
    onPress: () => void;
    showDivider: boolean;
}

const PendingItem: React.FC<PendingItemProps> = ({ id, title, subtitle, photoUrl, type, onPress, showDivider }) => {
    const { tokens, typography } = useTheme();

    return (
        <View className="px-4">
            <ListItem
                title={title}
                subtitle={subtitle}
                leading={
                    photoUrl ? (
                        <CachedImage
                            source={{ uri: photoUrl }}
                            style={{ width: 40, height: 40, borderRadius: 20 }}
                        />
                    ) : (
                        <View
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: tokens.backgroundSubtle,
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            {type === 'request' ? (
                                <UserPlus size={20} color={tokens.primary} />
                            ) : (
                                <Send size={20} color={tokens.primary} />
                            )}
                        </View>
                    )
                }
                trailing={
                    <View
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: tokens.primary
                        }}
                    />
                }
                showDivider={showDivider}
                onPress={onPress}
                compact
            />
        </View>
    );
};

const TodaysFocusWidgetContent: React.FC<TodaysFocusWidgetProps> = () => {
    const { friends } = useFriendsObservable();
    const { tokens, typography, spacing } = useTheme();
    const router = useRouter();
    const { suggestions } = useSuggestions();
    const { allInteractions: interactions } = useInteractions();
    const { completePlan } = usePlans();
    const { openPostWeaveRating, openWeeklyReflection } = useUIStore();
    const { reachOut } = useReachOut();
    const oracleSheet = useOracleSheet();

    // Pending Actions State
    const [linkRequests, setLinkRequests] = useState<LinkRequest[]>([]);
    const { pendingWeaves, isLoading: isLoadingWeaves } = usePendingWeaves();
    // Filter strictly for pending status to match widget logic
    const pendingWeaveInvites = useMemo(() => pendingWeaves.filter(w => w.status === 'pending'), [pendingWeaves]);

    const [showDetailSheet, setShowDetailSheet] = useState(false);
    const [showActivityInbox, setShowActivityInbox] = useState(false);
    const [upcomingDates, setUpcomingDates] = useState<UpcomingDate[]>([]);
    const [confirmingIds, setConfirmingIds] = useState<Set<string>>(new Set());
    const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
    const [intentions, setIntentions] = useState<Intention[]>([]);
    const [dailyReflection, setDailyReflection] = useState<string | null>(null);
    const [isLoadingReflection, setIsLoadingReflection] = useState(false);
    const [currentStreak, setCurrentStreak] = useState<number>(0);
    const [activeInsights, setActiveInsights] = useState<RelationshipInsight[]>([]);

    // Load active intentions
    useEffect(() => {
        const loadIntentions = async () => {
            try {
                const activeIntentions = await database.get<Intention>('intentions')
                    .query(Q.where('status', 'active'))
                    .fetch();
                setIntentions(activeIntentions);
            } catch (e) {
                console.error('Error loading intentions:', e);
            }
        };

        // Load initially
        loadIntentions();

        // Subscribe to changes
        const subscription = database.get<Intention>('intentions')
            .query(Q.where('status', 'active'))
            .observe()
            .subscribe(setIntentions);

        return () => subscription.unsubscribe();
    }, []);

    // Load pending link requests
    useEffect(() => {
        const loadRequests = async () => {
            try {
                const pending = await getPendingIncomingRequests();
                setLinkRequests(pending);
            } catch (e) {
                console.error('Error loading pending requests:', e);
            }
        };
        loadRequests();
    }, []);

    // Load streak data
    useEffect(() => {
        const loadStreak = async () => {
            try {
                const streak = await StreakService.getCurrentStreak();
                setCurrentStreak(streak);
            } catch (e) {
                console.error('Error loading streak:', e);
            }
        };
        loadStreak();
    }, [interactions]); // Recalculate when interactions change

    // Load active insights
    useEffect(() => {
        const loadInsights = async () => {
            try {
                const insights = await insightOrchestratorService.getActiveInsights();
                setActiveInsights(insights);
            } catch (e) {
                console.error('Error loading insights:', e);
            }
        };
        loadInsights();
    }, [interactions]); // Reload when interactions change

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
            // Close the detail sheet first to prevent stacking issues
            setShowDetailSheet(false);

            // Wait a brief moment for the sheet to begin closing before opening the next one
            setTimeout(() => {
                showMicroReflectionSheet({
                    friendId: friend.id,
                    friendName: friend.name,
                    activityId: plan.interactionCategory || 'hangout',
                    activityLabel: plan.title || 'Interaction',
                    interactionId: plan.id,
                    friendArchetype: friend.archetype,
                });
            }, 300);
        }

    };

    const handleReviewPlan = (id?: string) => {
        openPostWeaveRating(id); // Pass ID if available, otherwise opens queue
    };

    const handleIntentionPress = (intention: Intention, friend: FriendModel) => {
        // Navigate to weave logger to plan an interaction with this friend
        router.push({
            pathname: '/weave-logger',
            params: {
                friendId: friend.id,
                initialCategory: intention.interactionCategory || undefined,
                mode: 'plan',
                intentionId: intention.id,
            }
        });
    };

    const handleOpenActivityInbox = () => {
        setShowActivityInbox(true);
    };

    const handleSuggestionAction = async (suggestion: Suggestion) => {
        if (suggestion.id === 'weekly-reflection-sunday') {
            // Check if reflection already completed
            const completed = await hasCompletedReflectionForCurrentWeek();
            if (completed) {
                console.log('[TodaysFocus] Weekly reflection already completed, skipping');
                return;
            }
            setShowDetailSheet(false);
            setTimeout(() => {
                openWeeklyReflection();
            }, 500);
            return;
        }

        // Handle Oracle suggestions (no friend required)
        if (suggestion.action?.type === 'oracle') {
            setShowDetailSheet(false);
            setTimeout(() => {
                oracleSheet.open({
                    context: 'insights',
                    initialQuestion: suggestion.action?.prefillPrompt || suggestion.title,
                });
            }, 500);
            return;
        }

        const friend = friends.find(f => f.id === suggestion.friendId);
        if (!friend) {
            setShowDetailSheet(false);
            return;
        }

        // Show choice sheet for all friend-related suggestions
        // Close the detail sheet first to avoid modal stacking issues
        setShowDetailSheet(false);

        // Wait for sheet to close before showing action sheet
        setTimeout(() => {
            setSelectedSuggestion(suggestion);
        }, 500);
    };

    const handlePlanSuggestion = (suggestion: Suggestion, friend: FriendModel) => {
        // Navigate to weave logger (Plan mode)
        router.push({
            pathname: '/weave-logger',
            params: {
                friendId: friend.id,
                initialCategory: suggestion.category,
                mode: 'plan'
            }
        });

        // ANALYTICS: Track acceptance
        SeasonAnalyticsService.trackSuggestionAccepted().catch(console.error);
    };

    const handleReachOutSuccess = (suggestion: Suggestion) => {
        // ANALYTICS: Track acceptance
        SeasonAnalyticsService.trackSuggestionAccepted().catch(console.error);
    };

    const handleSuggestionDismiss = (suggestion: Suggestion) => {
        // In the future: call dismissal service
        setSelectedSuggestion(null);
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
    const hasIntentions = intentions.length > 0;
    const hasLinkRequests = linkRequests.length > 0;
    const hasPendingWeaves = pendingWeaveInvites.length > 0;
    const hasPendingActions = hasLinkRequests || hasPendingWeaves;

    const hasNoCalendarEvents = !hasUpcoming && !hasCompleted && !hasTomorrow && !hasPendingActions;
    const isAllClear = hasNoCalendarEvents && !hasSuggestions && !hasUpcomingDates && !hasIntentions;

    // Load daily reflection when there are no calendar events
    useEffect(() => {
        if (!hasNoCalendarEvents || dailyReflection || isLoadingReflection) return;

        const loadReflection = async () => {
            setIsLoadingReflection(true);
            try {
                const context = await oracleContextBuilder.buildContext([], ContextTier.ESSENTIAL);
                const reflection = await oracleService.generateDailyReflection(context);
                setDailyReflection(reflection);
            } catch (error) {
                console.error('Error loading daily reflection:', error);
                setDailyReflection(null);
            } finally {
                setIsLoadingReflection(false);
            }
        };

        loadReflection();
    }, [hasNoCalendarEvents, dailyReflection, isLoadingReflection]);

    const handleReflectSuggestion = (suggestion: Suggestion, friend: FriendModel) => {
        showMicroReflectionSheet({
            friendId: friend.id,
            friendName: friend.name,
            activityId: suggestion.category || 'hangout',
            activityLabel: suggestion.title || 'Interaction',
            interactionId: suggestion.action?.interactionId || '',
            friendArchetype: friend.archetype,
        });

        // ANALYTICS: Track acceptance
        SeasonAnalyticsService.trackSuggestionAccepted().catch(console.error);
    };

    return (
        <>
            <HomeWidgetBase config={WIDGET_CONFIG} padding="none">
                <View style={{ padding: 16, paddingBottom: 0 }}>
                    <WidgetHeader
                        title="Today's Focus"
                        icon={<Calendar size={20} color={tokens.primary} />}
                        subtitle={todaysUpcoming.length > 0
                            ? `${todaysUpcoming.length} upcoming · ${tomorrowsPlans.length} tomorrow`
                            : suggestions.length > 0
                                ? `${suggestions.length} suggestions · ${intentions.length} intentions`
                                : "No commitments today"}
                        trailing={currentStreak > 0 ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: tokens.backgroundSubtle, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                                <Flame size={14} color={tokens.primary} />
                                <Text style={{ fontFamily: typography.fonts.sansSemiBold, fontSize: 12, color: tokens.foreground }}>{currentStreak}w</Text>
                            </View>
                        ) : undefined}
                    />
                </View>

                {/* Pending Actions Section */}
                {hasPendingActions && (
                    <View className="mb-2">
                        <View className="px-4 py-2 pt-4">
                            <Text className="text-xs font-semibold uppercase tracking-wide" style={{ color: tokens.primary }}>Action Required</Text>
                        </View>
                        <Card padding="none">
                            {linkRequests.map((request, index) => (
                                <PendingItem
                                    key={`request-${request.id}`}
                                    id={request.id}
                                    title={request.displayName}
                                    subtitle="Sent you a friend link request"
                                    photoUrl={request.photoUrl}
                                    type="request"
                                    onPress={() => setShowDetailSheet(true)}
                                    showDivider={index < linkRequests.length - 1 || pendingWeaveInvites.length > 0}
                                />
                            ))}
                            {pendingWeaveInvites.map((weave, index) => (
                                <PendingItem
                                    key={`weave-${weave.id}`}
                                    id={weave.id}
                                    title={weave.title || 'Shared Weave'}
                                    subtitle={`Invited by ${weave.creatorName}`}
                                    photoUrl={weave.creatorAvatarUrl}
                                    type="weave"
                                    onPress={() => setShowDetailSheet(true)}
                                    showDivider={index < pendingWeaveInvites.length - 1}
                                />
                            ))}
                        </Card>
                    </View>
                )}

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

                {/* Active Insights moved to Journal widget */}

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

                {/* Show Oracle reflection when no calendar events, or "all caught up" if truly empty */}
                {/* Show Oracle reflection when no calendar events, regardless of suggestions */}
                {hasNoCalendarEvents ? (
                    <TouchableOpacity onPress={() => setShowDetailSheet(true)}>
                        <RestDayState
                            isLoading={isLoadingReflection}
                            dailyReflection={dailyReflection}
                        />
                    </TouchableOpacity>
                ) : null}



                {(hasUpcoming || hasCompleted || hasTomorrow) && <View style={{ height: 16 }} />}

                {/* Visual Separator if needed, but spacing might be enough */}

                {/* Simple "See more" footer when there's additional content */}
                {(hasSuggestions || hasIntentions || hasUpcomingDates) && (
                    <TouchableOpacity onPress={() => setShowDetailSheet(true)}>
                        <View
                            className="flex-row items-center justify-center p-3"
                            style={(hasUpcoming || hasCompleted || hasTomorrow) ? { borderTopWidth: 1, borderTopColor: tokens.borderSubtle } : undefined}
                        >
                            <Text style={{
                                color: tokens.primary,
                                fontFamily: typography.fonts.sansMedium,
                                fontSize: typography.scale.body.fontSize,
                            }}>
                                See more
                            </Text>
                            <ChevronRight size={16} color={tokens.primary} style={{ marginLeft: 4 }} />
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
                intentions={intentions}
                upcomingDates={upcomingDates}
                friends={friends}
                onConfirmPlan={handleConfirmPlan}
                onDeepenPlan={handleDeepenWeave}
                onReschedulePlan={handleReschedulePlan}
                onSuggestionAction={handleSuggestionAction}
                onIntentionPress={handleIntentionPress}
                onOpenActivityInbox={handleOpenActivityInbox}
                linkRequests={linkRequests}
                pendingWeaves={pendingWeaveInvites}
            />

            <ActivityInboxSheet
                visible={showActivityInbox}
                onClose={() => setShowActivityInbox(false)}
                onRequestHandled={() => {
                    // Refresh link requests after handling
                    getPendingIncomingRequests().then(setLinkRequests);
                }}
            />



            <SuggestionActionSheet
                isOpen={!!selectedSuggestion}
                onClose={() => setSelectedSuggestion(null)}
                suggestion={selectedSuggestion}
                friend={selectedSuggestion ? friends.find(f => f.id === selectedSuggestion.friendId) || null : null}
                onPlan={handlePlanSuggestion}
                onDismiss={handleSuggestionDismiss}
                onReachOutSuccess={handleReachOutSuccess}
                onReflect={handleReflectSuggestion}
            />
        </>
    );
};

export const TodaysFocusWidgetV2 = TodaysFocusWidgetContent;
