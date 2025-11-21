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
import { useSuggestions } from '@/hooks/useSuggestions';
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
  const [focusItem, setFocusItem] = useState<FocusItem | null>(null);

  useEffect(() => {
    loadFocusItem();
  }, [friends, suggestions]);

  const loadFocusItem = async () => {
    if (!friends || friends.length === 0) {
      setFocusItem(null);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check for birthdays in next 7 days
    for (const friend of friends) {
      if (friend.birthday) {
        const bday = new Date(friend.birthday);
        const thisYearBirthday = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());

        if (thisYearBirthday < today) {
          thisYearBirthday.setFullYear(today.getFullYear() + 1);
        }

        const daysUntil = differenceInDays(thisYearBirthday, today);

        if (daysUntil === 0) {
          setFocusItem({
            type: 'birthday',
            friend,
            message: `${friend.name}'s birthday is today! 🎂`,
            icon: Cake,
            color: '#F59E0B',
          });
          return;
        } else if (daysUntil > 0 && daysUntil <= 7) {
          setFocusItem({
            type: 'birthday',
            friend,
            message: `${friend.name}'s birthday in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`,
            icon: Cake,
            color: '#F59E0B',
          });
          return;
        }
      }
    }

    // Check for critical suggestions
    if (hasCritical && suggestions.length > 0) {
      const critical = suggestions.find(s => s.priority === 'critical');
      if (critical) {
        setFocusItem({
          type: 'critical',
          friend: critical.friend,
          message: `${critical.friend.name} needs attention`,
          icon: AlertCircle,
          color: '#EF4444',
        });
        return;
      }
    }

    // Check for high-priority suggestions
    if (suggestions.length > 0) {
      const highPriority = suggestions.find(s => s.priority === 'high');
      if (highPriority) {
        setFocusItem({
          type: 'suggestion',
          friend: highPriority.friend,
          message: `Reach out to ${highPriority.friend.name}`,
          icon: Heart,
          color: colors.primary,
        });
        return;
      }
    }

    setFocusItem(null);
  };

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
