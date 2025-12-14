import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { differenceInDays, format } from 'date-fns';
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
import { Card } from '@/shared/ui/Card';
import { WidgetHeader } from '@/shared/ui/WidgetHeader';
import { ListItem } from '@/shared/ui/ListItem';
import { FocusDetailSheet } from '@/modules/home/components/FocusDetailSheet';
import { FocusPlanItem } from './components/FocusPlanItem';
import FriendModel from '@/db/models/Friend';
import { Suggestion } from '@/shared/types/common';
import { PlanWizard } from '@/modules/interactions';
import { getCategoryLabel } from '@/modules/interactions';
import { SeasonAnalyticsService } from '@/modules/intelligence';

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

    // Rescheduling state
    const [isPlanWizardOpen, setIsPlanWizardOpen] = useState(false);
    const [wizardFriend, setWizardFriend] = useState<FriendModel | null>(null);
    const [wizardPrefill, setWizardPrefill] = useState<any>(null);
    const [replaceInteractionId, setReplaceInteractionId] = useState<string | undefined>(undefined);

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

    // Load upcoming dates (ported from V1)
    useEffect(() => {
        if (!friends || friends.length === 0) return;

        const loadLifeEvents = async () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
            const events: UpcomingDate[] = [];

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
                        importance: event.importance,
                    });
                }
            });

            friends.forEach(friend => {
                try {
                    if (friend.birthday) {
                        const [month, day] = friend.birthday.split('-').map(n => parseInt(n, 10));
                        const birthdayThisYear = new Date(today.getFullYear(), month - 1, day);
                        birthdayThisYear.setHours(0, 0, 0, 0);
                        if (birthdayThisYear < today) birthdayThisYear.setFullYear(today.getFullYear() + 1);
                        const daysUntil = differenceInDays(birthdayThisYear, today);
                        if (daysUntil >= 0 && daysUntil <= 7) {
                            events.push({ friend, type: 'birthday', daysUntil });
                        }
                    }
                } catch (e) {
                    // ignore
                }
            });

            events.sort((a, b) => a.daysUntil - b.daysUntil);
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
                setWizardFriend(friend);
                setWizardPrefill({
                    date: new Date(plan.interactionDate),
                    category: plan.interactionCategory,
                    title: plan.title,
                    location: plan.location,
                    time: new Date(plan.interactionDate), // Ensure time is passed too if needed by wizard
                    notes: plan.note,
                });
                setReplaceInteractionId(plan.id);
                setIsPlanWizardOpen(true);
                setShowDetailSheet(false); // Close sheet if open
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
            differenceInDays(new Date(i.interactionDate), new Date()) === 0 &&
            i.status === 'planned'
        ).sort((a, b) => new Date(a.interactionDate).getTime() - new Date(b.interactionDate).getTime())
        , [interactions]);

    const todaysCompleted = useMemo(() =>
        interactions.filter(i =>
            differenceInDays(new Date(i.interactionDate), new Date()) === 0 &&
            i.status === 'completed'
        ).sort((a, b) => new Date(b.interactionDate).getTime() - new Date(a.interactionDate).getTime())
        , [interactions]);



    const [planFriendIds, setPlanFriendIds] = useState<Record<string, string[]>>({});

    useEffect(() => {
        let isMounted = true;
        const loadFriends = async () => {
            const newMap: Record<string, string[]> = {};
            const allItems = [...todaysUpcoming, ...todaysCompleted];
            for (const plan of allItems) {
                try {
                    const iFriends = await plan.interactionFriends.fetch();
                    newMap[plan.id] = iFriends.map((f: any) => f.friendId);
                } catch (e) {
                    console.error('Error loading plan friends:', e);
                }
            }
            if (isMounted) setPlanFriendIds(newMap);
        };
        loadFriends();
        return () => { isMounted = false; };
    }, [todaysUpcoming, todaysCompleted]);

    const hasUpcoming = todaysUpcoming.length > 0;
    const hasCompleted = todaysCompleted.length > 0;
    const hasReviews = false; // Disabled in condensed widget
    const hasSuggestions = suggestions.length > 0;
    const hasUpcomingDates = upcomingDates.length > 0;
    const isAllClear = !hasUpcoming && !hasCompleted && !hasSuggestions && !hasUpcomingDates;

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
                            <View style={styles.sectionHeader}>
                                <Text style={[styles.sectionTitle, { color: tokens.foregroundMuted }]}>Upcoming</Text>
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
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { color: tokens.foregroundMuted }]}>Completed Today</Text>
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

                {isAllClear ? (
                    <View style={styles.emptyState}>
                        <CheckCircle2 size={32} color={tokens.success} />
                        <Text style={[styles.emptyText, {
                            color: tokens.foregroundMuted,
                            fontFamily: typography.fonts.sans,
                            fontSize: typography.scale.body.fontSize,
                            lineHeight: typography.scale.body.lineHeight
                        }]}>
                            You're all caught up
                        </Text>
                    </View>
                ) : null}



                {(hasUpcoming || hasCompleted) && <View style={{ height: 16 }} />}

                {/* Visual Separator if needed, but spacing might be enough */}

                {hasSuggestions && (
                    <TouchableOpacity onPress={() => setShowDetailSheet(true)}>
                        <View style={[styles.summaryRow, (hasUpcoming || hasCompleted || hasUpcomingDates) && { borderTopWidth: 1, borderTopColor: tokens.borderSubtle }]}>
                            <View style={styles.summaryContent}>
                                <Sparkles size={16} color={tokens.primaryMuted} style={{ marginRight: 8 }} />
                                <Text style={[styles.summaryText, {
                                    color: tokens.foreground,
                                    fontFamily: typography.fonts.sans,
                                    fontSize: typography.scale.body.fontSize,
                                    lineHeight: typography.scale.body.lineHeight
                                }]}>
                                    {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
                                </Text>
                            </View>
                            <ChevronRight size={16} color={tokens.foregroundSubtle} />
                        </View>
                    </TouchableOpacity>
                )}

                {hasUpcomingDates && (
                    <TouchableOpacity onPress={() => setShowDetailSheet(true)}>
                        <View style={[styles.summaryRow, (hasUpcoming || hasCompleted || hasSuggestions) && { borderTopWidth: 1, borderTopColor: tokens.borderSubtle }]}>
                            <View style={styles.summaryContent}>
                                <Calendar size={16} color={tokens.primaryMuted} style={{ marginRight: 8 }} />
                                <Text style={[styles.summaryText, {
                                    color: tokens.foreground,
                                    fontFamily: typography.fonts.sans,
                                    fontSize: typography.scale.body.fontSize,
                                    lineHeight: typography.scale.body.lineHeight
                                }]}>
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
                completedPlans={todaysCompleted}
                suggestions={suggestions}
                upcomingDates={upcomingDates}
                friends={friends}
                onConfirmPlan={handleConfirmPlan}
                onReschedulePlan={handleReschedulePlan}
                onSuggestionAction={handleSuggestionAction}
            />

            {wizardFriend && (
                <PlanWizard
                    visible={isPlanWizardOpen}
                    onClose={() => {
                        setIsPlanWizardOpen(false);
                        setWizardFriend(null);
                        setWizardPrefill(null);
                        setReplaceInteractionId(undefined);
                    }}
                    initialFriend={wizardFriend}
                    prefillData={wizardPrefill}
                    replaceInteractionId={replaceInteractionId}
                />
            )}
        </>
    );
};

const enhance = withObservables([], () => ({
    friends: database.get<FriendModel>('friends').query().observe(),
}));

export const TodaysFocusWidgetV2 = enhance(TodaysFocusWidgetContent);

const styles = StyleSheet.create({
    actions: {
        flexDirection: 'row',
    },
    iconBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    summaryContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 8,
    },
    summaryText: {
        flex: 1,
        // Font size handled by typography.scale.body in component
    },
    emptyState: {
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    emptyText: {
        // Font size handled by typography.scale.body in component
    },
    sectionHeader: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        paddingTop: 16,
    },
    sectionTitle: {
        fontSize: 12,
        fontFamily: 'Inter_600SemiBold',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
});
