/**
 * FocusPill
 * Simple, compact pill showing today's most important focus item
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { differenceInDays } from 'date-fns';
import { Cake, Heart, AlertCircle } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { useRelationshipsStore } from '@/modules/relationships';
import { useSuggestions } from '@/modules/interactions';
import FriendModel from '@/db/models/Friend';
import { database } from '@/db';
import LifeEvent from '@/db/models/LifeEvent';
import { Q } from '@nozbe/watermelondb';

interface FocusItem {
  type: 'birthday' | 'anniversary' | 'critical' | 'suggestion';
  friend: FriendModel;
  message: string;
  icon: typeof Cake;
  color: string;
}

export const FocusPill: React.FC = () => {
  const { colors } = useTheme();
  const router = useRouter();
  const { friends } = useRelationshipsStore();
  const { suggestions, hasCritical } = useSuggestions();
  const focusItem = React.useMemo(() => {
    if (!friends || friends.length === 0) {
      return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check for birthdays in next 7 days
    for (const friend of friends) {
      if (friend.birthday) {
        // Birthday is stored in "MM-DD" format
        const [month, day] = friend.birthday.split('-').map(n => parseInt(n, 10));

        // Create birthday for this year
        const thisYearBirthday = new Date(today.getFullYear(), month - 1, day);
        thisYearBirthday.setHours(0, 0, 0, 0);

        if (thisYearBirthday < today) {
          thisYearBirthday.setFullYear(today.getFullYear() + 1);
        }

        const daysUntil = differenceInDays(thisYearBirthday, today);

        if (daysUntil === 0) {
          return {
            type: 'birthday' as const,
            friend,
            message: `${friend.name}'s birthday is today! 🎂`,
            icon: Cake,
            color: '#F59E0B',
          };
        } else if (daysUntil > 0 && daysUntil <= 7) {
          return {
            type: 'birthday' as const,
            friend,
            message: `${friend.name}'s birthday in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`,
            icon: Cake,
            color: '#F59E0B',
          };
        }
      }
    }

    // Check for critical suggestions
    if (hasCritical && suggestions.length > 0) {
      const critical = suggestions.find(s => s.urgency === 'critical');
      if (critical) {
        const friend = friends.find(f => f.id === critical.friendId);
        if (friend) {
          return {
            type: 'critical' as const,
            friend,
            message: `${friend.name} needs attention`,
            icon: AlertCircle,
            color: '#EF4444',
          };
        }
      }
    }

    // Check for high-priority suggestions
    if (suggestions.length > 0) {
      const highPriority = suggestions.find(s => s.urgency === 'high' || s.priority === 'high');
      if (highPriority) {
        const friend = friends.find(f => f.id === highPriority.friendId);
        if (friend) {
          return {
            type: 'suggestion' as const,
            friend,
            message: `Reach out to ${friend.name}`,
            icon: Heart,
            color: colors.primary,
          };
        }
      }
    }

    return null;
  }, [friends, suggestions, hasCritical, colors.primary]);

  const handlePress = () => {
    if (!focusItem) return;

    // Navigate to friend profile
    router.push({
      pathname: '/friend-profile',
      params: { friendId: focusItem.friend.id },
    });
  };

  if (!focusItem) return null;

  const Icon = focusItem.icon;

  return (
    <TouchableOpacity
      onPress={handlePress}
      className="mx-5 mb-4 px-4 py-3 rounded-full flex-row items-center gap-3"
      style={{ backgroundColor: `${focusItem.color}15`, borderWidth: 1, borderColor: `${focusItem.color}40` }}
      activeOpacity={0.7}
    >
      <Icon size={18} color={focusItem.color} />
      <Text
        className="flex-1 text-sm font-medium"
        style={{ color: focusItem.color, fontFamily: 'Inter_500Medium' }}
      >
        {focusItem.message}
      </Text>
      <View
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: focusItem.color }}
      />
    </TouchableOpacity>
  );
};
