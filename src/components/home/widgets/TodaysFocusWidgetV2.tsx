import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { differenceInDays, format } from 'date-fns';
import { Check, Clock, ChevronRight, Sparkles, Calendar, CheckCircle2 } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { HomeWidgetBase, HomeWidgetConfig } from '../HomeWidgetBase';
import { useSuggestions, useInteractions, usePlans } from '@/modules/interactions';
import { useUIStore } from '@/stores/uiStore';
import { database } from '@/db';
import LifeEvent from '@/db/models/LifeEvent';
import { Q } from '@nozbe/watermelondb';
import withObservables from '@nozbe/with-observables';
import Interaction from '@/db/models/Interaction';
import { Card } from '@/components/ui/Card';
import { WidgetHeader } from '@/components/ui/WidgetHeader';
import { ListItem } from '@/components/ui/ListItem';
import { FocusDetailSheet } from '@/components/FocusDetailSheet';
import FriendModel from '@/db/models/Friend';
import { Suggestion } from '@/shared/types/common';

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
        setConfirmingIds(prev => new Set(prev).add(interactionId));
        try {
            const plan = interactions.find(i => i.id === interactionId);

            await completePlan(interactionId);

            if (plan) {
                // Fetch friend details for the reflection sheet
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
            }

            setConfirmingIds(prev => {
                const next = new Set(prev);
                next.delete(interactionId);
                return next;
            });
        } catch (error) {
            console.error('Error confirming plan:', error);
            setConfirmingIds(prev => {
                const next = new Set(prev);
                next.delete(interactionId);
                return next;
            });
        }
    };

    const handleReschedulePlan = (plan: Interaction) => {
        // Placeholder for reschedule logic - in V1 this opened a wizard
        // For V2, we might want to open the sheet or navigate
        console.log('Reschedule', plan.id);
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

    const handleSuggestionAction = (suggestion: Suggestion) => {
        const friend = friends.find(f => f.id === suggestion.friendId);
        if (friend) {
            router.push(`/friend-profile?friendId=${friend.id}`);
        }
        setShowDetailSheet(false);
    };

    const todaysPlans = useMemo(() => visiblePendingPlans.filter(p => differenceInDays(new Date(p.interactionDate), new Date()) === 0), [visiblePendingPlans]);
    const [planFriendIds, setPlanFriendIds] = useState<Record<string, string[]>>({});

    useEffect(() => {
        let isMounted = true;
        const loadFriends = async () => {
            const newMap: Record<string, string[]> = {};
            for (const plan of todaysPlans) {
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
    }, [todaysPlans]);

    const hasPlans = todaysPlans.length > 0;
    const hasSuggestions = suggestions.length > 0;
    const hasUpcoming = upcomingDates.length > 0;
    const isAllClear = !hasPlans && !hasSuggestions && !hasUpcoming;

    return (
        <>
            <HomeWidgetBase config={WIDGET_CONFIG} padding="none">
                <View style={{ padding: 16, paddingBottom: 0 }}>
                    <WidgetHeader
                        title="Today's Focus"
                        action={{ label: 'See all', onPress: () => setShowDetailSheet(true) }}
                    />
                </View>

                {hasPlans ? (
                    todaysPlans.map((plan, index) => {
                        const friendIds = planFriendIds[plan.id] || [];
                        const planFriends = friends.filter(f => friendIds.includes(f.id));
                        const friendName = planFriends.length > 0 ? planFriends[0].name : '';
                        const subtitle = `${friendName ? `with ${friendName} • ` : ''}${format(new Date(plan.interactionDate), 'h:mm a')}`;
                        const isCompleted = plan.status === 'completed';
                        const isConfirming = confirmingIds.has(plan.id);

                        return (
                            <View key={plan.id} style={{ paddingHorizontal: 16 }}>
                                <ListItem
                                    title={plan.title || 'Untitled Plan'}
                                    subtitle={subtitle}
                                    showDivider={index < todaysPlans.length - 1 || hasSuggestions || hasUpcoming}
                                    trailing={
                                        <View style={styles.actions}>
                                            {isCompleted ? (
                                                <TouchableOpacity
                                                    onPress={() => handleDeepenWeave(plan)}
                                                    style={[styles.iconBtn, { backgroundColor: tokens.primary + '15' }]}
                                                >
                                                    <Sparkles size={18} color={tokens.primary} />
                                                </TouchableOpacity>
                                            ) : (
                                                <>
                                                    <TouchableOpacity
                                                        onPress={() => handleConfirmPlan(plan.id)}
                                                        disabled={isConfirming}
                                                        style={[styles.iconBtn, { backgroundColor: tokens.success + '20', opacity: isConfirming ? 0.5 : 1 }]}
                                                    >
                                                        <Check size={18} color={tokens.success} />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        onPress={() => handleReschedulePlan(plan)}
                                                        disabled={isConfirming}
                                                        style={[styles.iconBtn, { backgroundColor: tokens.primary + '20', marginLeft: 8, opacity: isConfirming ? 0.5 : 1 }]}
                                                    >
                                                        <Clock size={18} color={tokens.primary} />
                                                    </TouchableOpacity>
                                                </>
                                            )}
                                        </View>
                                    }
                                />
                            </View>
                        );
                    })
                ) : isAllClear ? (
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

                {hasSuggestions && (
                    <TouchableOpacity onPress={() => setShowDetailSheet(true)}>
                        <View style={[styles.summaryRow, (hasPlans || hasUpcoming) && { borderTopWidth: 1, borderTopColor: tokens.borderSubtle }]}>
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

                {hasUpcoming && (
                    <TouchableOpacity onPress={() => setShowDetailSheet(true)}>
                        <View style={[styles.summaryRow, (hasPlans || hasSuggestions) && { borderTopWidth: 1, borderTopColor: tokens.borderSubtle }]}>
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
                plans={visiblePendingPlans}
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
});
