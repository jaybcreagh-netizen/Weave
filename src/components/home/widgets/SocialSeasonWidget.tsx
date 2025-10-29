import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../../hooks/useTheme';
import { useUserProfileStore } from '../../../stores/userProfileStore';
import { useFriends } from '../../../hooks/useFriends';
import { HomeWidgetBase, HomeWidgetConfig } from '../HomeWidgetBase';
import {
  calculateSocialSeason,
  calculateSeasonContext,
  calculateSeasonScore,
} from '../../../lib/social-season/season-calculator';
import {
  getSeasonGreeting,
  SEASON_STYLES,
} from '../../../lib/social-season/season-content';
import { SeasonCalculationInput } from '../../../lib/social-season/season-types';
import { calculateCurrentScore } from '../../../lib/weave-engine';

const WIDGET_CONFIG: HomeWidgetConfig = {
  id: 'social-season',
  type: 'social-season',
  title: 'Your Season',
  minHeight: 180,
  fullWidth: true,
};

export const SocialSeasonWidget: React.FC = () => {
  const { colors, isDarkMode } = useTheme();
  const { profile, updateSocialSeason, getRecentBatteryAverage, getBatteryTrend } =
    useUserProfileStore();
  const friends = useFriends();
  const [isCalculating, setIsCalculating] = useState(false);

  // Calculate season on mount and periodically
  useEffect(() => {
    calculateAndUpdateSeason();

    // Recalculate every hour
    const interval = setInterval(calculateAndUpdateSeason, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [friends, profile]);

  const calculateAndUpdateSeason = async () => {
    if (!profile || friends.length === 0) return;

    setIsCalculating(true);

    try {
      // Calculate metrics for season scoring
      const now = Date.now();
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

      // Count weaves in time windows
      // Note: This is a simplified version - in production, you'd query interactions
      const weavesLast7Days = 0; // TODO: Query interactions
      const weavesLast30Days = 0; // TODO: Query interactions

      // Calculate friend scores
      const friendScores = friends.map(f => calculateCurrentScore(f));
      const avgScoreAllFriends =
        friendScores.reduce((sum, score) => sum + score, 0) / friendScores.length || 0;

      const innerCircleFriends = friends.filter(f => f.dunbarTier === 'InnerCircle');
      const innerCircleScores = innerCircleFriends.map(f => calculateCurrentScore(f));
      const avgScoreInnerCircle =
        innerCircleScores.reduce((sum, score) => sum + score, 0) /
          innerCircleScores.length || 0;

      // Count friends with active momentum
      const momentumCount = friends.filter(
        f => f.momentumScore > 10 && f.momentumLastUpdated > Date.now() - 24 * 60 * 60 * 1000
      ).length;

      // Get battery metrics
      const batteryLast7DaysAvg = getRecentBatteryAverage(7);
      const batteryTrend = getBatteryTrend();

      const input: SeasonCalculationInput = {
        weavesLast7Days,
        weavesLast30Days,
        avgScoreAllFriends,
        avgScoreInnerCircle,
        momentumCount,
        batteryLast7DaysAvg,
        batteryTrend,
      };

      // Calculate new season
      const newSeason = calculateSocialSeason(input, profile.currentSocialSeason);

      // Update if season changed or hasn't been calculated in 1 hour
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      if (
        newSeason !== profile.currentSocialSeason ||
        !profile.seasonLastCalculated ||
        profile.seasonLastCalculated < oneHourAgo
      ) {
        await updateSocialSeason(newSeason);
      }
    } catch (error) {
      console.error('Error calculating season:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  // Get greeting content
  const season = profile?.currentSocialSeason || 'flowing';
  const context = calculateSeasonContext({
    weavesLast7Days: 0, // Simplified for now
    weavesLast30Days: 0,
    avgScoreAllFriends: friends.reduce((sum, f) => sum + calculateCurrentScore(f), 0) / friends.length || 50,
    avgScoreInnerCircle: friends.filter(f => f.dunbarTier === 'InnerCircle').reduce((sum, f) => sum + calculateCurrentScore(f), 0) / friends.filter(f => f.dunbarTier === 'InnerCircle').length || 50,
    momentumCount: friends.filter(f => f.momentumScore > 10).length,
    batteryLast7DaysAvg: getRecentBatteryAverage(7),
    batteryTrend: getBatteryTrend(),
  });

  const greeting = getSeasonGreeting(season, context);
  const seasonStyle = SEASON_STYLES[season];

  // Use correct gradient based on theme
  const gradientColors = isDarkMode
    ? seasonStyle.gradientColorsDark
    : seasonStyle.gradientColorsLight;

  return (
    <HomeWidgetBase config={WIDGET_CONFIG} isLoading={isCalculating}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.content}>
          {/* Emoji Icon */}
          <Text style={styles.emoji}>{greeting.emoji}</Text>

          {/* Headline */}
          <Text style={styles.headline}>{greeting.headline}</Text>

          {/* Subtext */}
          <Text style={styles.subtext}>{greeting.subtext}</Text>
        </View>
      </LinearGradient>
    </HomeWidgetBase>
  );
};

const styles = StyleSheet.create({
  gradient: {
    borderRadius: 16,
    marginHorizontal: -20,
    marginTop: -20,
    marginBottom: -20,
    padding: 24,
    minHeight: 160,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  headline: {
    fontFamily: 'Lora_700Bold',
    fontSize: 24,
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtext: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: '#FFFFFF',
    opacity: 0.9,
    textAlign: 'center',
    maxWidth: '85%',
  },
});
