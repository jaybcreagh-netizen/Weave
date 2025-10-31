import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Q } from '@nozbe/watermelondb';
import { startOfWeek, startOfDay } from 'date-fns';
import { useTheme } from '../../../hooks/useTheme';
import { HomeWidgetBase, HomeWidgetConfig } from '../HomeWidgetBase';
import { database } from '../../../db';
import Interaction from '../../../db/models/Interaction';
import InteractionFriend from '../../../db/models/InteractionFriend';
import { useFriendStore } from '../../../stores/friendStore';

const WIDGET_CONFIG: HomeWidgetConfig = {
  id: 'celebration-data',
  type: 'celebration-data',
  title: 'Your Weave',
  minHeight: 160,
  fullWidth: false, // Half-width widget
};

interface WeaveStats {
  thisWeek: number;
  currentStreak: number;
  mostActiveFriend: string | null;
}

export const CelebrationDataWidget: React.FC = () => {
  const { colors } = useTheme();
  const { friends } = useFriendStore();
  const [stats, setStats] = useState<WeaveStats>({
    thisWeek: 0,
    currentStreak: 0,
    mostActiveFriend: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const calculateStats = async () => {
      try {
        // Get all completed interactions
        const interactions = await database
          .get<Interaction>('interactions')
          .query(
            Q.where('status', 'completed'),
            Q.sortBy('interaction_date', Q.desc)
          )
          .fetch();

        // Calculate this week's count
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
        const thisWeekCount = interactions.filter(
          i => i.interactionDate >= weekStart
        ).length;

        // Calculate current streak (consecutive days with at least one weave)
        const streak = calculateStreak(interactions);

        // Find most active friend (most weaves in last 30 days)
        const mostActive = await findMostActiveFriend(interactions);

        setStats({
          thisWeek: thisWeekCount,
          currentStreak: streak,
          mostActiveFriend: mostActive,
        });
        setLoading(false);
      } catch (error) {
        console.error('Error calculating weave stats:', error);
        setLoading(false);
      }
    };

    calculateStats();

    // Subscribe to interactions to update stats when new weaves are logged
    const subscription = database
      .get<Interaction>('interactions')
      .query()
      .observe()
      .subscribe(() => {
        calculateStats();
      });

    return () => subscription.unsubscribe();
  }, []);

  const calculateStreak = (interactions: Interaction[]): number => {
    if (interactions.length === 0) return 0;

    const today = startOfDay(new Date());
    const dates = new Set(
      interactions.map(i => startOfDay(i.interactionDate).getTime())
    );

    let streak = 0;
    let currentDate = today;

    // Check if there's a weave today or yesterday (grace period)
    if (!dates.has(currentDate.getTime())) {
      const yesterday = new Date(currentDate);
      yesterday.setDate(yesterday.getDate() - 1);
      if (!dates.has(yesterday.getTime())) {
        return 0; // Streak broken
      }
      currentDate = yesterday;
    }

    // Count consecutive days
    while (dates.has(currentDate.getTime())) {
      streak++;
      currentDate = new Date(currentDate);
      currentDate.setDate(currentDate.getDate() - 1);
    }

    return streak;
  };

  const findMostActiveFriend = async (
    interactions: Interaction[]
  ): Promise<string | null> => {
    // Get interactions from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentInteractions = interactions.filter(
      i => i.interactionDate >= thirtyDaysAgo
    );

    if (recentInteractions.length === 0) return null;

    // Count weaves per friend
    const friendCounts: Record<string, number> = {};

    for (const interaction of recentInteractions) {
      const interactionFriends = await database
        .get<InteractionFriend>('interaction_friends')
        .query(Q.where('interaction_id', interaction.id))
        .fetch();

      for (const ifriend of interactionFriends) {
        friendCounts[ifriend.friendId] = (friendCounts[ifriend.friendId] || 0) + 1;
      }
    }

    // Find friend with most weaves
    const sortedFriends = Object.entries(friendCounts).sort((a, b) => b[1] - a[1]);
    if (sortedFriends.length === 0) return null;

    const [friendId] = sortedFriends[0];
    const friend = friends.find(f => f.id === friendId);
    return friend?.name || null;
  };

  if (loading) {
    return (
      <HomeWidgetBase config={WIDGET_CONFIG}>
        <View className="items-center py-2">
          <Text
            className="font-inter-regular text-sm text-center py-5"
            style={{ color: colors['muted-foreground'] }}
          >
            Loading...
          </Text>
        </View>
      </HomeWidgetBase>
    );
  }

  return (
    <HomeWidgetBase config={WIDGET_CONFIG}>
      <View className="flex-row items-center justify-around py-3">
        {/* This Week */}
        <View className="items-center flex-1">
          <Text
            className="font-lora-bold text-[32px] mb-1"
            style={{ color: colors.primary }}
          >
            {stats.thisWeek}
          </Text>
          <Text
            className="font-inter-medium text-[11px] uppercase tracking-wider"
            style={{ color: colors['muted-foreground'] }}
          >
            This Week
          </Text>
        </View>

        {/* Divider */}
        <View
          className="w-px h-10 mx-2"
          style={{ backgroundColor: colors.border }}
        />

        {/* Current Streak */}
        <View className="items-center flex-1">
          <View className="flex-row items-center gap-1">
            <Text
              className="font-lora-bold text-[32px]"
              style={{ color: colors.primary }}
            >
              {stats.currentStreak}
            </Text>
            {stats.currentStreak > 0 && (
              <Text className="text-[20px]">🔥</Text>
            )}
          </View>
          <Text
            className="font-inter-medium text-[11px] uppercase tracking-wider"
            style={{ color: colors['muted-foreground'] }}
          >
            Day Streak
          </Text>
        </View>
      </View>

      {/* Most Active Friend */}
      {stats.mostActiveFriend && (
        <View
          className="border-t pt-3 pb-1 items-center"
          style={{ borderTopColor: colors.border }}
        >
          <Text
            className="font-inter-medium text-[10px] uppercase tracking-wider mb-1"
            style={{ color: colors['muted-foreground'] }}
          >
            Most Active
          </Text>
          <Text
            className="font-inter-semibold text-[13px]"
            style={{ color: colors.foreground }}
          >
            {stats.mostActiveFriend}
          </Text>
        </View>
      )}
    </HomeWidgetBase>
  );
};