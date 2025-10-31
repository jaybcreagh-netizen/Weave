import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { startOfWeek, startOfDay, subDays } from 'date-fns';
import { Q } from '@nozbe/watermelondb';
import { useTheme } from '../../../hooks/useTheme';
import { HomeWidgetBase, HomeWidgetConfig } from '../HomeWidgetBase';
import { getUserProgress, CONSISTENCY_MILESTONES, getCurrentMilestone } from '../../../lib/milestone-tracker';
import { database } from '../../../db';
import Interaction from '../../../db/models/Interaction';

const WIDGET_CONFIG: HomeWidgetConfig = {
  id: 'weaving-practice',
  type: 'weaving-practice',
  title: '✨ Your Weaving Practice',
  minHeight: 180,
  fullWidth: true,
};

/**
 * Get last 7 days of practice activity for dot timeline
 * Checks if user logged any interactions (completed or planned) on that day
 * This represents "showing up" in the app to be intentional
 */
async function getLast7DaysActivity(): Promise<boolean[]> {
  const today = startOfDay(new Date());
  const days: boolean[] = [];

  for (let i = 6; i >= 0; i--) {
    const day = subDays(today, i);
    const dayStart = day.getTime();
    const dayEnd = dayStart + 86400000; // +24 hours

    const count = await database
      .get<Interaction>('interactions')
      .query(
        Q.where('created_at', Q.gte(dayStart)),
        Q.where('created_at', Q.lt(dayEnd))
      )
      .fetchCount();

    days.push(count > 0);
  }

  return days;
}

/**
 * Get this week's counts
 */
async function getThisWeekCounts(): Promise<{ weaves: number; reflections: number }> {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

  const interactions = await database
    .get<Interaction>('interactions')
    .query(
      Q.where('status', 'completed'),
      Q.where('interaction_date', Q.gte(weekStart.getTime()))
    )
    .fetch();

  const reflections = interactions.filter(
    i => (i.note && i.note.trim().length > 0) || i.vibe
  ).length;

  return {
    weaves: interactions.length,
    reflections,
  };
}

export const WeavingPracticeWidget: React.FC = () => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [currentMilestone, setCurrentMilestone] = useState<any>(null);
  const [weekCounts, setWeekCounts] = useState({ weaves: 0, reflections: 0 });
  const [last7Days, setLast7Days] = useState<boolean[]>([]);

  useEffect(() => {
    const loadProgress = async () => {
      try {
        const progress = await getUserProgress();
        const counts = await getThisWeekCounts();
        const activity = await getLast7DaysActivity();

        const currentConsistency = getCurrentMilestone(
          progress.consistencyMilestones || [],
          CONSISTENCY_MILESTONES
        );

        setCurrentStreak(progress.currentStreak);
        setCurrentMilestone(currentConsistency);
        setWeekCounts(counts);
        setLast7Days(activity);
        setLoading(false);
      } catch (error) {
        console.error('Error loading weaving progress:', error);
        setLoading(false);
      }
    };

    loadProgress();

    // Subscribe to interactions table - updates dots, counts, and streak
    const subscription = database
      .get<Interaction>('interactions')
      .query()
      .observe()
      .subscribe(() => {
        loadProgress();
      });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <HomeWidgetBase config={WIDGET_CONFIG}>
        <View className="items-center py-6">
          <Text
            className="font-inter-regular text-sm"
            style={{ color: colors['muted-foreground'] }}
          >
            Loading...
          </Text>
        </View>
      </HomeWidgetBase>
    );
  }

  // Generate short insight
  const shortInsight = weekCounts.weaves === 0
    ? "Start your week with a thread"
    : weekCounts.reflections >= weekCounts.weaves * 0.7
    ? "Mindful and intentional this week"
    : weekCounts.weaves >= 5
    ? "Building strong momentum"
    : "Building consistency";

  return (
    <HomeWidgetBase config={WIDGET_CONFIG}>
      <View className="px-4 py-3">
        {/* Icon + Milestone Badge */}
        <View className="items-center mb-3">
          <View className="flex-row items-center gap-2">
            <Text className="text-3xl">💫</Text>
            {currentMilestone && (
              <View
                className="flex-row items-center gap-1 px-2 py-1 rounded-full"
                style={{
                  backgroundColor: `${colors.primary}15`,
                  borderWidth: 1,
                  borderColor: `${colors.primary}30`,
                }}
              >
                <Text className="text-xs">{currentMilestone.icon}</Text>
                <Text
                  className="font-inter-semibold text-[10px]"
                  style={{ color: colors.primary }}
                >
                  {currentMilestone.name}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Top: Streak + Counts */}
        <View className="items-center mb-4">
          <Text
            className="font-inter-medium text-sm mb-1"
            style={{ color: colors['muted-foreground'] }}
          >
            {currentStreak} day streak
          </Text>
          <Text
            className="font-inter-regular text-xs"
            style={{ color: colors['muted-foreground'] }}
          >
            {weekCounts.weaves} logs, {weekCounts.reflections} reflections
          </Text>
        </View>

        {/* 7-Day Dot Timeline */}
        <View className="mb-4">
          <View className="flex-row justify-between items-center">
            {last7Days.map((active, index) => (
              <View
                key={index}
                className="w-6 h-6 rounded-full"
                style={{
                  backgroundColor: active ? colors.primary : colors.border,
                  opacity: active ? 1 : 0.3,
                  shadowColor: active ? colors.primary : 'transparent',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: active ? 0.8 : 0,
                  shadowRadius: active ? 6 : 0,
                  elevation: active ? 4 : 0,
                }}
              />
            ))}
          </View>
        </View>

        {/* Bottom: Insight Text */}
        <View className="items-center">
          <Text
            className="font-inter-regular text-sm text-center"
            style={{ color: colors['muted-foreground'] }}
          >
            {shortInsight}
          </Text>
        </View>
      </View>
    </HomeWidgetBase>
  );
};
