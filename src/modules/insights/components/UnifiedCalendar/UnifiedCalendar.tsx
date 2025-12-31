/**
 * UnifiedCalendar Component
 * The main "Then and When" calendar view combining energy, weaves, and drift detection
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Q } from '@nozbe/watermelondb';

import { database } from '@/db';
import { useTheme } from '@/shared/hooks/useTheme';
import { getDriftAlerts, DriftAlert } from '@/modules/insights/services/drift-detection.service';
import { getYearMoonData } from '@/modules/reflection';

import { SeasonHeader } from './SeasonHeader';
import { MonthGrid, DayData } from './MonthGrid';
import { DriftAlertsSection } from './DriftAlertsSection';
import { DayDetailSheet, DayDetailData, DayWeave } from './DayDetailSheet';
import { EditInteractionModal } from '@/modules/interactions';
import { InteractionActions } from '@/modules/interactions/services/interaction.actions';

interface UnifiedCalendarProps {
    onOpenPlanWizard?: (friendId?: string, friendName?: string) => void;
    onOpenBatteryCheckin?: (date?: Date) => void;
}

export function UnifiedCalendar({
    onOpenPlanWizard,
    onOpenBatteryCheckin,
}: UnifiedCalendarProps) {
    const { tokens } = useTheme();
    const router = useRouter();

    // State
    const [isLoading, setIsLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
    const [season, setSeason] = useState<'Resting' | 'Balanced' | 'Blooming'>('Balanced');
    const [avgEnergy, setAvgEnergy] = useState<number | undefined>();
    const [driftAlerts, setDriftAlerts] = useState<DriftAlert[]>([]);
    const [dayDataMap, setDayDataMap] = useState<Map<string, DayData>>(new Map());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [dayDetailData, setDayDetailData] = useState<DayDetailData | null>(null);
    const [showDayDetail, setShowDayDetail] = useState(false);
    const [selectedWeaveId, setSelectedWeaveId] = useState<string | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedInteraction, setSelectedInteraction] = useState<any>(null);

    // Load initial data
    useEffect(() => {
        loadData();
    }, []);

    // Reload day data when month changes
    useEffect(() => {
        loadMonthData();
    }, [currentMonth]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            // Load season from user profile
            const profiles = await database
                .get('user_profile')
                .query()
                .fetch();

            if (profiles.length > 0) {
                const profile = profiles[0] as any;
                const profileSeason = profile.currentSocialSeason || 'balanced';
                // Map to proper case
                const seasonMap: Record<string, 'Resting' | 'Balanced' | 'Blooming'> = {
                    'resting': 'Resting',
                    'balanced': 'Balanced',
                    'blooming': 'Blooming',
                };
                setSeason(seasonMap[profileSeason.toLowerCase()] || 'Balanced');
            }

            // Load drift alerts
            const alerts = await getDriftAlerts();
            setDriftAlerts(alerts);

            // Load month data
            await loadMonthData();
        } catch (error) {
            console.error('[UnifiedCalendar] Error loading data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadMonthData = async () => {
        try {
            const year = currentMonth.getFullYear();
            const month = currentMonth.getMonth();

            // Get battery data from YearMoonData
            const yearData = await getYearMoonData(year);
            const monthData = yearData[month];

            // Build day data map
            const newDayDataMap = new Map<string, DayData>();
            let totalEnergy = 0;
            let energyCount = 0;

            // Fetch interactions for the month
            const monthStart = startOfMonth(currentMonth);
            const monthEnd = endOfMonth(currentMonth);

            // Adjust start/end to cover full days in UTC just in case, or just rely on timestamps
            monthStart.setHours(0, 0, 0, 0);
            monthEnd.setHours(23, 59, 59, 999);

            const interactions = await database.get('interactions').query(
                Q.where('interaction_date', Q.gte(monthStart.getTime())),
                Q.where('interaction_date', Q.lte(monthEnd.getTime())),
                Q.where('status', Q.oneOf(['completed', 'planned', 'pending_confirm']))
            ).fetch();

            const weaveMap = new Map<string, number>();
            const planMap = new Map<string, number>();

            interactions.forEach((interaction: any) => {
                const dateKey = format(interaction.interactionDate, 'yyyy-MM-dd');
                if (interaction.status === 'completed') {
                    weaveMap.set(dateKey, (weaveMap.get(dateKey) || 0) + 1);
                } else {
                    planMap.set(dateKey, (planMap.get(dateKey) || 0) + 1);
                }
            });

            if (monthData?.days) {
                for (const day of monthData.days) {
                    const dateKey = format(day.date, 'yyyy-MM-dd');
                    newDayDataMap.set(dateKey, {
                        date: day.date,
                        batteryLevel: day.batteryLevel,
                        hasCheckin: day.hasCheckin,
                        weaveCount: weaveMap.get(dateKey) || 0,
                        planCount: planMap.get(dateKey) || 0,
                    });

                    if (day.hasCheckin && day.batteryLevel) {
                        totalEnergy += day.batteryLevel;
                        energyCount++;
                    }
                }
            }

            // Fill in days that might not be in monthData (though monthData usually covers the whole month)
            // But if we have interactions on days without battery logs, we should ensure they show up?
            // MonthData comes from getYearMoonData which generates all days. So we are good.

            setDayDataMap(newDayDataMap);
            setAvgEnergy(energyCount > 0 ? totalEnergy / energyCount : undefined);
        } catch (error) {
            console.error('[UnifiedCalendar] Error loading month data:', error);
        }
    };

    const handleDayPress = useCallback(
        async (date: Date, data: DayData | null) => {
            setSelectedDate(date);

            // Build day detail data
            const detail: DayDetailData = {
                date,
                batteryLevel: data?.batteryLevel ?? null,
                batteryNote: undefined, // Could load from battery log if needed
                weaves: [], // Will load weaves for this day
            };

            // Load weaves for this day
            try {
                const dayStart = new Date(date);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(date);
                dayEnd.setHours(23, 59, 59, 999);

                const interactions = await database
                    .get('interactions')
                    .query(
                        Q.where('interaction_date', Q.gte(dayStart.getTime())),
                        Q.where('interaction_date', Q.lte(dayEnd.getTime()))
                    )
                    .fetch();

                // Get friends for each interaction
                const weaves: DayWeave[] = [];
                for (const interaction of interactions) {
                    const interactionFriends = await database
                        .get('interaction_friends')
                        .query(Q.where('interaction_id', interaction.id))
                        .fetch();

                    const friendIds = interactionFriends.map((if_: any) => if_._raw.friend_id);
                    const friends = friendIds.length > 0
                        ? await database
                            .get('friends')
                            .query(Q.where('id', Q.oneOf(friendIds)))
                            .fetch()
                        : [];

                    weaves.push({
                        id: interaction.id,
                        title: (interaction as any).title || '',
                        activity: (interaction as any).activity || (interaction as any).interactionCategory || '',
                        status: (interaction as any).status || 'completed',
                        friends: friends.map((f: any) => ({ id: f.id, name: f.name })),
                        vibeRating: (interaction as any).vibeRating,
                    });
                }

                detail.weaves = weaves;
            } catch (error) {
                console.error('[UnifiedCalendar] Error loading weaves:', error);
            }

            setDayDetailData(detail);
            setShowDayDetail(true);
        },
        []
    );

    const handlePlanWeave = useCallback(
        (friendId: string, friendName: string) => {
            if (onOpenPlanWizard) {
                onOpenPlanWizard(friendId, friendName);
            } else {
                router.push(`/weave-logger?friendId=${friendId}`);
            }
        },
        [onOpenPlanWizard, router]
    );

    const handleViewFriend = useCallback(
        (friendId: string) => {
            router.push(`/friend-profile?friendId=${friendId}`);
        },
        [router]
    );

    const handleLogWeave = useCallback(
        (date: Date) => {
            if (onOpenPlanWizard) {
                onOpenPlanWizard();
            } else {
                router.push('/weave-logger');
            }
        },
        [onOpenPlanWizard, router]
    );

    const handleCheckIn = useCallback(
        (date: Date) => {
            if (onOpenBatteryCheckin) {
                onOpenBatteryCheckin(date);
            }
        },
        [onOpenBatteryCheckin]
    );

    const handleViewWeave = useCallback(async (weaveId: string) => {
        try {
            const interaction = await database.get('interactions').find(weaveId);
            setSelectedInteraction(interaction);
            setSelectedWeaveId(weaveId);
            setShowEditModal(true);
            setShowDayDetail(false); // Close day sheet when opening weave
        } catch (error) {
            console.error('[UnifiedCalendar] Error loading weave:', error);
        }
    }, []);

    const handleSaveInteraction = useCallback(async (interactionId: string, updates: any) => {
        await InteractionActions.updateInteraction(interactionId, updates);
        setShowEditModal(false);
        setSelectedInteraction(null);
        setSelectedWeaveId(null);
        // Reload month data to reflect changes
        loadMonthData();
    }, []);

    if (isLoading) {
        return (
            <View className="flex-1 items-center justify-center py-12">
                <ActivityIndicator size="large" color={tokens.primary} />
            </View>
        );
    }

    return (
        <View className="flex-1" style={{ backgroundColor: tokens.background }}>
            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
            >
                {/* Season Header */}
                <View className="px-4 pt-4">
                    <SeasonHeader season={season} avgEnergy={avgEnergy} />
                </View>

                {/* Drift Alerts (conditional) */}
                <DriftAlertsSection
                    alerts={driftAlerts}
                    onPlanWeave={handlePlanWeave}
                    onViewFriend={handleViewFriend}
                />

                {/* Month Grid */}
                <MonthGrid
                    currentMonth={currentMonth}
                    onMonthChange={setCurrentMonth}
                    dayData={dayDataMap}
                    onDayPress={handleDayPress}
                    selectedDate={selectedDate}
                />
            </ScrollView>

            {/* Day Detail Sheet */}
            <DayDetailSheet
                isVisible={showDayDetail}
                onClose={() => setShowDayDetail(false)}
                data={dayDetailData}
                onLogWeave={handleLogWeave}
                onCheckIn={handleCheckIn}
                onViewWeave={handleViewWeave}
            />

            {/* Edit Interaction Modal */}
            <EditInteractionModal
                interaction={selectedInteraction}
                isOpen={showEditModal}
                onClose={() => {
                    setShowEditModal(false);
                    setSelectedInteraction(null);
                    setSelectedWeaveId(null);
                }}
                onSave={handleSaveInteraction}
            />
        </View>
    );
}
