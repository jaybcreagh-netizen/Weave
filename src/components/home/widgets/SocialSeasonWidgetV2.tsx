import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { HomeWidgetBase, HomeWidgetConfig } from '../HomeWidgetBase';
import { useUserProfileStore } from '@/modules/auth';
import { useInteractions } from '@/modules/interactions';
import {
    calculateSocialSeason,
    calculateSeasonContext,
    getSeasonGreeting,
    getSeasonDisplayName,
    calculateWeightedNetworkHealth,
    calculateCurrentScore,
    type SocialSeason,
    type SeasonCalculationInput,
    type SeasonExplanationData,
    logNetworkHealth
} from '@/modules/intelligence';
import { database } from '@/db';
import Interaction from '@/db/models/Interaction';
import FriendModel from '@/db/models/Friend';
import { Q } from '@nozbe/watermelondb';
import withObservables from '@nozbe/with-observables';
import { startOfDay, subDays } from 'date-fns';
import { SeasonIcon } from '@/components/SeasonIcon';
import { SocialSeasonDetailSheet } from '@/components/SocialSeasonDetailSheet';

const WIDGET_CONFIG: HomeWidgetConfig = {
    id: 'social-season',
    type: 'social-season',
    title: 'Your Season',
    minHeight: 120,
    fullWidth: true,
};

interface SocialSeasonWidgetProps {
    friends: FriendModel[];
}

const SocialSeasonWidgetContent: React.FC<SocialSeasonWidgetProps> = ({ friends }) => {
    const { tokens, typography, spacing } = useTheme();
    const { profile, updateSocialSeason, batteryStats } = useUserProfileStore();
    const { allInteractions } = useInteractions();

    const [isCalculating, setIsCalculating] = useState(false);
    const [season, setSeason] = useState<SocialSeason>('balanced');
    const [seasonData, setSeasonData] = useState<SeasonExplanationData | null>(null);
    const [showDetailSheet, setShowDetailSheet] = useState(false);
    const [weeklyWeaves, setWeeklyWeaves] = useState(0);
    const [currentStreak, setCurrentStreak] = useState(0);
    const [networkHealth, setNetworkHealth] = useState(0);

    // Logic ported from V1
    const calculateActivityStats = async () => {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const currentDayOfWeek = today.getDay();
            const daysFromMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
            const monday = new Date(today);
            monday.setDate(today.getDate() - daysFromMonday);
            monday.setHours(0, 0, 0, 0);

            let weaveCount = 0;
            const knots: boolean[] = [];

            for (let i = 0; i < 7; i++) {
                const dayDate = new Date(monday);
                dayDate.setDate(monday.getDate() + i);
                const dayStart = dayDate.getTime();
                const dayEnd = dayStart + 24 * 60 * 60 * 1000;

                const completedWeaves = await database
                    .get<Interaction>('interactions')
                    .query(
                        Q.where('status', 'completed'),
                        Q.where('interaction_date', Q.gte(dayStart)),
                        Q.where('interaction_date', Q.lt(dayEnd))
                    )
                    .fetchCount();
                weaveCount += completedWeaves;
                knots.push(completedWeaves > 0);
            }
            setWeeklyWeaves(weaveCount);

            // Simple streak calculation (consecutive days with activity backwards from today)
            let streak = 0;
            const todayIndex = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
            for (let i = todayIndex; i >= 0; i--) {
                if (knots[i]) streak++;
                else break;
            }
            setCurrentStreak(streak);
            setNetworkHealth(calculateWeightedNetworkHealth(friends));
        } catch (error) {
            console.error('Error calculating activity stats:', error);
        }
    };

    const calculateAndUpdateSeason = async () => {
        if (!profile || friends.length === 0) return;
        setIsCalculating(true);
        try {
            const now = startOfDay(new Date()).getTime();
            const sevenDaysAgo = subDays(now, 7).getTime();
            const thirtyDaysAgo = subDays(now, 30).getTime();

            const weavesLast7Days = await database.get<Interaction>('interactions').query(Q.where('status', 'completed'), Q.where('interaction_date', Q.gte(sevenDaysAgo))).fetchCount();
            const weavesLast30Days = await database.get<Interaction>('interactions').query(Q.where('status', 'completed'), Q.where('interaction_date', Q.gte(thirtyDaysAgo))).fetchCount();
            const avgScoreAllFriends = calculateWeightedNetworkHealth(friends);
            const innerCircleFriends = friends.filter(f => f.dunbarTier === 'InnerCircle');
            const innerCircleScores = innerCircleFriends.map(f => calculateCurrentScore(f));
            const avgScoreInnerCircle = innerCircleScores.reduce((sum, score) => sum + score, 0) / innerCircleScores.length || 0;
            const momentumCount = friends.filter(f => f.momentumScore > 10 && f.momentumLastUpdated.getTime() > Date.now() - 24 * 60 * 60 * 1000).length;
            const averageBattery = batteryStats.average || 50;
            const batteryTrend = batteryStats.trend || 'stable';

            const input: SeasonCalculationInput = {
                weavesLast7Days,
                weavesLast30Days,
                avgScoreAllFriends,
                avgScoreInnerCircle,
                momentumCount,
                batteryLast7DaysAvg: averageBattery,
                batteryTrend: batteryTrend,
            };

            const newSeason = calculateSocialSeason(input, profile.currentSocialSeason);
            setSeason(newSeason);
            setSeasonData({
                season: newSeason,
                weavesLast7Days,
                weavesLast30Days,
                avgScoreAllFriends,
                avgScoreInnerCircle,
                momentumCount,
                batteryLast7DaysAvg: averageBattery,
                batteryTrend: batteryTrend,
            });

            const oneHourAgo = Date.now() - 60 * 60 * 1000;
            if (newSeason !== profile.currentSocialSeason || !profile.seasonLastCalculated || profile.seasonLastCalculated < oneHourAgo) {
                await updateSocialSeason(newSeason);
            }

            // Log network health for historical tracking (throttled internally to once per 24h)
            await logNetworkHealth(avgScoreAllFriends, database);
        } catch (error) {
            console.error('Error calculating season:', error);
        } finally {
            setIsCalculating(false);
        }
    };

    useEffect(() => {
        calculateActivityStats();
        calculateAndUpdateSeason();
    }, [allInteractions, friends, profile]);

    const context = calculateSeasonContext({
        weavesLast7Days: 0,
        weavesLast30Days: 0,
        avgScoreAllFriends: calculateWeightedNetworkHealth(friends) || 50,
        avgScoreInnerCircle: friends.filter(f => f.dunbarTier === 'InnerCircle').reduce((sum, f) => sum + calculateCurrentScore(f), 0) / friends.filter(f => f.dunbarTier === 'InnerCircle').length || 50,
        momentumCount: friends.filter(f => f.momentumScore > 10).length,
        batteryLast7DaysAvg: batteryStats.average || 50,
        batteryTrend: batteryStats.trend || 'stable',
    });

    const greeting = getSeasonGreeting(season, context);

    return (
        <>
            <HomeWidgetBase config={WIDGET_CONFIG} isLoading={isCalculating}>
                <TouchableOpacity
                    onPress={() => setShowDetailSheet(true)}
                    activeOpacity={0.7}
                >
                    <View style={styles.container}>
                        <View style={styles.iconContainer}>
                            <SeasonIcon season={season} size={48} color={tokens.primary} />
                        </View>
                        <View style={styles.textContainer}>
                            <Text style={[styles.headline, {
                                color: tokens.foreground,
                                fontFamily: typography.fonts.serifBold,
                                fontSize: typography.scale.h2.fontSize,
                                lineHeight: typography.scale.h2.lineHeight
                            }]}>
                                {getSeasonDisplayName(season)}
                            </Text>
                            <Text style={[styles.subtext, {
                                color: tokens.foregroundMuted,
                                fontFamily: typography.fonts.sans,
                                fontSize: typography.scale.body.fontSize,
                                lineHeight: typography.scale.body.lineHeight
                            }]}>
                                {greeting.subtext}
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>
            </HomeWidgetBase>

            <SocialSeasonDetailSheet
                isVisible={showDetailSheet}
                onClose={() => setShowDetailSheet(false)}
                season={season}
                seasonData={seasonData}
                weeklyWeaves={weeklyWeaves}
                currentStreak={currentStreak}
                networkHealth={networkHealth}
            />
        </>
    );
};

const enhance = withObservables([], () => ({
    friends: database.get<FriendModel>('friends').query().observe(),
}));

export const SocialSeasonWidgetV2 = enhance(SocialSeasonWidgetContent);

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 215, 0, 0.1)', // Subtle gold tint
    },
    textContainer: {
        flex: 1,
    },
    headline: {
        marginBottom: 4,
    },
    subtext: {
        // Font size handled by typography.scale.body in component
    },
});

