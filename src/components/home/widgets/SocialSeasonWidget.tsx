import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { startOfDay, subDays, differenceInDays } from 'date-fns';
import { Q } from '@nozbe/watermelondb';
import { useRouter } from 'expo-router';
import { BookOpen, X, Sparkles, BarChart3, Telescope, Lightbulb, Flame, Battery, ChevronDown } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { useUserProfileStore } from '../../../stores/userProfileStore';
import { useFriends } from '../../../hooks/useFriends';
import { useInteractions } from '@/modules/interactions';
import { HomeWidgetBase, HomeWidgetConfig } from '../HomeWidgetBase';
import {
  calculateSocialSeason,
  calculateSeasonContext,
} from '../../../lib/social-season/season-calculator';
import {
  getSeasonGreeting,
  SEASON_STYLES,
  getSeasonDisplayName,
} from '../../../lib/social-season/season-content';
import { SeasonCalculationInput, SocialSeason } from '../../../lib/social-season/season-types';
import { calculateCurrentScore, calculateWeightedNetworkHealth } from '@/modules/intelligence/services/orchestrator.service';
import { database } from '../../../db';
import Interaction from '../../../db/models/Interaction';
import WeeklyReflection from '../../../db/models/WeeklyReflection';
import { generateSeasonExplanation, type SeasonExplanationData } from '@/modules/reflection';
import { SocialSeasonModal } from '../../SocialSeason/SocialSeasonModal';
import { SeasonIcon } from '../../SeasonIcon';

const WIDGET_CONFIG: HomeWidgetConfig = {
  id: 'social-season',
  type: 'social-season',
  title: 'Your Season',
  minHeight: 120,
  fullWidth: true,
};

interface SeasonAction {
  label: string;
  icon: typeof BookOpen;
  route?: string;
  onPress?: () => void;
}

// Season explanation content
const SEASON_EXPLANATIONS: Record<SocialSeason, {
  title: string;
  description: string;
  meaning: string;
}> = {
  resting: {
    title: 'Resting Season 🌙',
    description: 'You\'re in a period of low social energy. This is natural and temporary.',
    meaning: 'Your weave holds even when you need space. Rest is productive. The app will minimize suggestions and focus on reflection tools. Your friendships understand and wait patiently.',
  },
  balanced: {
    title: 'Balanced Season 💧',
    description: 'You\'re in a sustainable rhythm of connection.',
    meaning: 'You\'re connecting mindfully while listening to your needs. This consistency is something to celebrate. The app will offer gentle, context-aware suggestions to maintain your flow.',
  },
  blooming: {
    title: 'Blooming Season 🌱',
    description: 'You\'re radiating connection and high social energy.',
    meaning: 'Your connections are thriving! Remember to check in with yourself and avoid burnout. The app will offer creative ideas while gently reminding you to maintain balance.',
  },
};

export const SocialSeasonWidget: React.FC = () => {
  const { colors, isDarkMode } = useTheme();
  const router = useRouter();
  const { profile, updateSocialSeason, getRecentBatteryAverage, getBatteryTrend } = useUserProfileStore();
  const friends = useFriends();
  const { allInteractions } = useInteractions();
  const [isCalculating, setIsCalculating] = useState(false);
  const [season, setSeason] = useState<SocialSeason>('balanced');
  const [seasonData, setSeasonData] = useState<SeasonExplanationData | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const [activityKnots, setActivityKnots] = useState<boolean[]>([false, false, false, false, false, false, false]);
  const [weeklyWeaves, setWeeklyWeaves] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [networkHealth, setNetworkHealth] = useState(0);

  // Recalculate stats when interactions change
  useEffect(() => {
    calculateActivityStats();
  }, [allInteractions]);

  useEffect(() => {
    calculateAndUpdateSeason();
    calculateActivityStats();
    const interval = setInterval(() => {
      calculateAndUpdateSeason();
      calculateActivityStats();
    }, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [friends, profile]);

  const calculateActivityStats = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Calculate current week (Monday-Sunday)
      const currentDayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      const daysFromMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1; // Convert to Monday = 0

      const monday = new Date(today);
      monday.setDate(today.getDate() - daysFromMonday);
      monday.setHours(0, 0, 0, 0);

      const knots: boolean[] = [];
      let weaveCount = 0;

      // Loop through Monday (0) to Sunday (6)
      for (let i = 0; i < 7; i++) {
        const dayDate = new Date(monday);
        dayDate.setDate(monday.getDate() + i);
        const dayStart = dayDate.getTime();
        const dayEnd = dayStart + 24 * 60 * 60 * 1000;

        // Check for any activity: weaves, battery check-ins, or journal entries
        const [weaves, batteryCheckins, journalEntries] = await Promise.all([
          database
            .get<Interaction>('interactions')
            .query(
              Q.where('created_at', Q.gte(dayStart)),
              Q.where('created_at', Q.lt(dayEnd))
            )
            .fetchCount(),
          profile?.socialBatteryHistory?.filter(
            entry => entry.timestamp >= dayStart && entry.timestamp < dayEnd
          ).length || 0,
          database
            .get<WeeklyReflection>('weekly_reflections')
            .query(
              Q.where('created_at', Q.gte(dayStart)),
              Q.where('created_at', Q.lt(dayEnd))
            )
            .fetchCount(),
        ]);

        const hasActivity = weaves > 0 || batteryCheckins > 0 || journalEntries > 0;
        knots.push(hasActivity);

        // Count completed weaves for the week
        const completedWeaves = await database
          .get<Interaction>('interactions')
          .query(
            Q.where('status', 'completed'),
            Q.where('interaction_date', Q.gte(dayStart)),
            Q.where('interaction_date', Q.lt(dayEnd))
          )
          .fetchCount();
        weaveCount += completedWeaves;
      }

      setActivityKnots(knots);
      setWeeklyWeaves(weaveCount);

      // Calculate streak - consecutive days with activity from today backwards
      const todayDayOfWeek = today.getDay();
      const todayIndex = todayDayOfWeek === 0 ? 6 : todayDayOfWeek - 1; // Convert to Monday=0

      let streak = 0;
      // Only count from today backwards (don't count future days)
      for (let i = todayIndex; i >= 0; i--) {
        if (knots[i]) {
          streak++;
        } else {
          break;
        }
      }
      setCurrentStreak(streak);

      // Calculate weighted network health (tier-weighted average)
      const weightedHealth = calculateWeightedNetworkHealth(friends);
      setNetworkHealth(weightedHealth);
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

      const weavesLast7Days = await database
        .get<Interaction>('interactions')
        .query(Q.where('status', 'completed'), Q.where('interaction_date', Q.gte(sevenDaysAgo)))
        .fetchCount();

      const weavesLast30Days = await database
        .get<Interaction>('interactions')
        .query(Q.where('status', 'completed'), Q.where('interaction_date', Q.gte(thirtyDaysAgo)))
        .fetchCount();

      // Use weighted network health for overall score
      const avgScoreAllFriends = calculateWeightedNetworkHealth(friends);

      const innerCircleFriends = friends.filter(f => f.dunbarTier === 'InnerCircle');
      const innerCircleScores = innerCircleFriends.map(f => calculateCurrentScore(f));
      const avgScoreInnerCircle = innerCircleScores.reduce((sum, score) => sum + score, 0) / innerCircleScores.length || 0;

      const momentumCount = friends.filter(
        f => f.momentumScore > 10 && f.momentumLastUpdated > Date.now() - 24 * 60 * 60 * 1000
      ).length;

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

      const newSeason = calculateSocialSeason(input, profile.currentSocialSeason);
      setSeason(newSeason);

      // Store season explanation data
      setSeasonData({
        season: newSeason,
        weavesLast7Days,
        weavesLast30Days,
        avgScoreAllFriends,
        avgScoreInnerCircle,
        momentumCount,
        batteryLast7DaysAvg,
        batteryTrend,
      });

      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      if (newSeason !== profile.currentSocialSeason || !profile.seasonLastCalculated || profile.seasonLastCalculated < oneHourAgo) {
        await updateSocialSeason(newSeason);
      }
    } catch (error) {
      console.error('Error calculating season:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  const context = calculateSeasonContext({
    weavesLast7Days: 0,
    weavesLast30Days: 0,
    avgScoreAllFriends: calculateWeightedNetworkHealth(friends) || 50,
    avgScoreInnerCircle: friends.filter(f => f.dunbarTier === 'InnerCircle').reduce((sum, f) => sum + calculateCurrentScore(f), 0) / friends.filter(f => f.dunbarTier === 'InnerCircle').length || 50,
    momentumCount: friends.filter(f => f.momentumScore > 10).length,
    batteryLast7DaysAvg: getRecentBatteryAverage(7),
    batteryTrend: getBatteryTrend(),
  });

  const greeting = getSeasonGreeting(season, context);
  const seasonStyle = SEASON_STYLES[season];
  const batteryLevel = profile?.socialBatteryCurrent || 3;

  const getSeasonActions = (): SeasonAction[] => {
    switch (season) {
      case 'resting':
        return [
          { label: 'Journal', icon: BookOpen, onPress: () => console.log('📖 Journal') },
          { label: 'View History', icon: BarChart3, onPress: () => console.log('📊 History') },
        ];
      case 'balanced':
        return [
          { label: 'Suggestions', icon: Sparkles, route: '/home' },
          { label: 'Constellation', icon: Telescope, onPress: () => console.log('🌌 Constellation') },
        ];
      case 'blooming':
        return [
          { label: 'Creative Ideas', icon: Lightbulb, onPress: () => console.log('💡 Creative') },
          { label: 'Check In', icon: Flame, onPress: () => console.log('🕯️ Check-in') },
        ];
    }
  };

  const actions = getSeasonActions();
  const gradientColors = isDarkMode ? seasonStyle.gradientColorsDark : seasonStyle.gradientColorsLight;

  const handleOverrideSeason = async (newSeason: SocialSeason) => {
    await updateSocialSeason(newSeason);
    setSeason(newSeason);
    setShowOverride(false);
  };

  return (
    <>
      <HomeWidgetBase config={WIDGET_CONFIG} isLoading={isCalculating}>
        <Pressable onPress={() => setShowModal(true)} onLongPress={() => setShowOverride(true)} delayLongPress={800}>
          <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
            {/* Header */}
            <View style={styles.header}>
              <SeasonIcon season={season} size={48} color="#FFFFFF" />
              <Text style={styles.headline}>{getSeasonDisplayName(season)}</Text>
              <Text style={styles.subtext}>{greeting.subtext}</Text>
            </View>

            {/* Activity Knots */}
            <View style={styles.knotsContainer}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => {
                const today = new Date();
                const currentDayOfWeek = today.getDay();
                const daysFromMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
                const isToday = index === daysFromMonday;
                const isFilled = activityKnots[index];

                return (
                  <View key={index} style={styles.knotColumn}>
                    <View style={[
                      styles.knot,
                      isToday && styles.knotToday,
                      isFilled && styles.knotFilledBorder
                    ]}>
                      {isFilled && (
                        <LinearGradient
                          colors={['#FFD700', '#F59E0B']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={[
                            StyleSheet.absoluteFill,
                            styles.knotGradient,
                            isToday && styles.knotTodayGradient
                          ]}
                        />
                      )}
                    </View>
                    <Text style={[styles.knotLabel, isToday && styles.knotLabelToday]}>{day}</Text>
                  </View>
                );
              })}
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <Text style={styles.statText}>
                {weeklyWeaves} {weeklyWeaves === 1 ? 'weave' : 'weaves'}
              </Text>
              <Text style={styles.statDivider}>·</Text>
              <Text style={styles.statText}>{currentStreak}-day streak</Text>
            </View>

            {/* Tap to see more */}
            <View style={styles.tapToSeeMoreRow}>
              <Text style={styles.tapToSeeMoreText}>Tap to see more</Text>
              <ChevronDown size={14} color="rgba(255, 255, 255, 0.7)" />
            </View>
          </LinearGradient>
        </Pressable>
      </HomeWidgetBase>

      {/* Social Season Modal */}
      <SocialSeasonModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        season={season}
        seasonData={seasonData}
        weeklyWeaves={weeklyWeaves}
        currentStreak={currentStreak}
        networkHealth={networkHealth}
      />

      {/* Override Modal */}
      <Modal visible={showOverride} transparent animationType="fade" onRequestClose={() => setShowOverride(false)}>
        <View style={styles.modalOverlay}>
          <BlurView intensity={isDarkMode ? 40 : 20} style={StyleSheet.absoluteFill} />
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowOverride(false)} />

          <View style={styles.modalContent}>
            <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TouchableOpacity
                onPress={() => setShowOverride(false)}
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={colors['muted-foreground']} />
              </TouchableOpacity>

              <Text style={[styles.overrideTitle, { color: colors.foreground }]}>Override Season</Text>
              <Text style={[styles.overrideSubtext, { color: colors['muted-foreground'] }]}>
                Manually set your season if the app misjudged it. The app will recalculate automatically later.
              </Text>

              <View style={styles.overrideOptions}>
                {(['resting', 'balanced', 'blooming'] as SocialSeason[]).map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => handleOverrideSeason(s)}
                    style={[
                      styles.overrideOption,
                      { backgroundColor: season === s ? `${colors.primary}20` : colors.muted },
                      season === s && { borderWidth: 2, borderColor: colors.primary },
                    ]}
                  >
                    <View style={styles.overrideIconContainer}>
                      <SeasonIcon season={s} size={32} color={colors.foreground} />
                    </View>
                    <View style={styles.overrideOptionText}>
                      <Text style={[styles.overrideOptionTitle, { color: colors.foreground }]}>{getSeasonDisplayName(s)}</Text>
                      <Text style={[styles.overrideOptionDesc, { color: colors['muted-foreground'] }]}>{SEASON_EXPLANATIONS[s].description}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  gradient: {
    borderRadius: 16,
    marginHorizontal: -20,
    marginTop: -20,
    marginBottom: -20,
    padding: 20,
    minHeight: 180,
    gap: 16,
  },
  header: {
    alignItems: 'center',
    gap: 4,
  },
  emoji: {
    fontSize: 32,
  },
  headline: {
    fontFamily: 'Lora_700Bold',
    fontSize: 20,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtext: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 17,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  knotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  knotColumn: {
    alignItems: 'center',
    gap: 6,
  },
  knot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  knotToday: {
    width: 28,
    height: 28,
    borderRadius: 14,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  knotFilledBorder: {
    borderColor: '#FFD700',
  },
  knotGradient: {
    borderRadius: 12,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 8,
  },
  knotTodayGradient: {
    borderRadius: 14,
    shadowRadius: 10,
    shadowOpacity: 1,
    elevation: 10,
  },
  knotLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  knotLabelToday: {
    color: 'rgba(255, 255, 255, 1)',
    fontFamily: 'Inter_700Bold',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  statText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.95)',
  },
  statDivider: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  tapToSeeMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 8,
  },
  tapToSeeMoreText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    letterSpacing: 0.3,
  },
  modalOverlay: {
    flex: 1,
  },
  modalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    zIndex: 10,
  },
  modalTitle: {
    fontFamily: 'Lora_700Bold',
    fontSize: 24,
    marginBottom: 8,
  },
  modalDescription: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    marginBottom: 16,
  },
  reasonsContainer: {
    marginTop: 12,
    marginBottom: 20,
    gap: 8,
  },
  reasonsLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  reasonBullet: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    lineHeight: 20,
  },
  reasonText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  meaningBox: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  meaningText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  gotItButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
    alignItems: 'center',
  },
  gotItText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  overrideTitle: {
    fontFamily: 'Lora_700Bold',
    fontSize: 20,
    marginBottom: 8,
  },
  overrideSubtext: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    marginBottom: 24,
  },
  overrideOptions: {
    gap: 12,
  },
  overrideOption: {
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  overrideIconContainer: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overrideOptionText: {
    flex: 1,
  },
  overrideOptionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  overrideOptionDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
});
