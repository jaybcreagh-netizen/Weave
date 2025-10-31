import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { startOfDay, subDays } from 'date-fns';
import { Q } from '@nozbe/watermelondb';
import { useRouter } from 'expo-router';
import { BookOpen, X, Sparkles, BarChart3, Telescope, Lightbulb, Flame, Battery } from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';
import { useUserProfileStore } from '../../../stores/userProfileStore';
import { useFriends } from '../../../hooks/useFriends';
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
import { calculateCurrentScore } from '../../../lib/weave-engine';
import { database } from '../../../db';
import Interaction from '../../../db/models/Interaction';

const WIDGET_CONFIG: HomeWidgetConfig = {
  id: 'social-season',
  type: 'social-season',
  title: 'Your Season',
  minHeight: 240,
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
    title: 'Balanced Season ☀️',
    description: 'You\'re in a sustainable rhythm of connection.',
    meaning: 'You\'re connecting mindfully while listening to your needs. This consistency is something to celebrate. The app will offer gentle, context-aware suggestions to maintain your flow.',
  },
  blooming: {
    title: 'Blooming Season ✨',
    description: 'You\'re radiating connection and high social energy.',
    meaning: 'Your connections are thriving! Remember to check in with yourself and avoid burnout. The app will offer creative ideas while gently reminding you to maintain balance.',
  },
};

export const SocialSeasonWidget: React.FC = () => {
  const { colors, isDarkMode } = useTheme();
  const router = useRouter();
  const { profile, updateSocialSeason, getRecentBatteryAverage, getBatteryTrend } = useUserProfileStore();
  const friends = useFriends();
  const [isCalculating, setIsCalculating] = useState(false);
  const [season, setSeason] = useState<SocialSeason>('balanced');
  const [showExplanation, setShowExplanation] = useState(false);
  const [showOverride, setShowOverride] = useState(false);

  useEffect(() => {
    calculateAndUpdateSeason();
    const interval = setInterval(calculateAndUpdateSeason, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [friends, profile]);

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

      const friendScores = friends.map(f => calculateCurrentScore(f));
      const avgScoreAllFriends = friendScores.reduce((sum, score) => sum + score, 0) / friendScores.length || 0;

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
    avgScoreAllFriends: friends.reduce((sum, f) => sum + calculateCurrentScore(f), 0) / friends.length || 50,
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
      <Pressable onPress={() => setShowExplanation(true)} onLongPress={() => setShowOverride(true)} delayLongPress={800}>
        <HomeWidgetBase config={WIDGET_CONFIG} isLoading={isCalculating}>
          <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
            {/* Battery Badge */}
            <View style={styles.batteryBadge}>
              <Battery size={14} color="#FFFFFF" />
              <Text style={styles.batteryText}>{batteryLevel}/5</Text>
            </View>

            {/* Content */}
            <View style={styles.content}>
              <Text style={styles.emoji}>{greeting.emoji}</Text>
              <Text style={styles.headline}>{greeting.headline}</Text>
              <Text style={styles.subtext}>{greeting.subtext}</Text>

              {/* Action Buttons */}
              <View style={styles.buttonRow}>
                {actions.map((action) => (
                  <TouchableOpacity
                    key={action.label}
                    onPress={() => {
                      if (action.route) router.push(action.route as any);
                      else if (action.onPress) action.onPress();
                    }}
                    style={styles.button}
                  >
                    <action.icon size={16} color="#FFFFFF" />
                    <Text style={styles.buttonText}>{action.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.hint}>Tap for details · Long press to override</Text>
            </View>
          </LinearGradient>
        </HomeWidgetBase>
      </Pressable>

      {/* Explanation Modal */}
      <Modal visible={showExplanation} transparent animationType="fade" onRequestClose={() => setShowExplanation(false)}>
        <View style={styles.modalOverlay}>
          <BlurView intensity={isDarkMode ? 40 : 20} style={StyleSheet.absoluteFill} />
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowExplanation(false)} />

          <View style={styles.modalContent}>
            <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TouchableOpacity
                onPress={() => setShowExplanation(false)}
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={colors['muted-foreground']} />
              </TouchableOpacity>

              <Text style={[styles.modalTitle, { color: colors.foreground }]}>{SEASON_EXPLANATIONS[season].title}</Text>
              <Text style={[styles.modalDescription, { color: colors['muted-foreground'] }]}>{SEASON_EXPLANATIONS[season].description}</Text>

              <View style={[styles.meaningBox, { backgroundColor: colors.muted }]}>
                <Text style={[styles.meaningText, { color: colors.foreground }]}>{SEASON_EXPLANATIONS[season].meaning}</Text>
              </View>

              <TouchableOpacity onPress={() => setShowExplanation(false)} style={[styles.gotItButton, { backgroundColor: colors.primary }]}>
                <Text style={styles.gotItText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
                    <Text style={styles.overrideEmoji}>{SEASON_EXPLANATIONS[s].title.split(' ')[2]}</Text>
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
    padding: 24,
    minHeight: 220,
  },
  batteryBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  batteryText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  headline: {
    fontFamily: 'Lora_700Bold',
    fontSize: 24,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtext: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    maxWidth: '85%',
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  buttonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  hint: {
    marginTop: 8,
    color: 'rgba(255, 255, 255, 0.5)',
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    textAlign: 'center',
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
  overrideEmoji: {
    fontSize: 32,
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
