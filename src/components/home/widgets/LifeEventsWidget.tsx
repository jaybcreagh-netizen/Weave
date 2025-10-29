import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Calendar, Heart, Cake, PartyPopper } from 'lucide-react-native';
import { format, differenceInDays, isThisYear } from 'date-fns';

import { HomeWidgetBase, HomeWidgetConfig } from '../HomeWidgetBase';
import { useTheme } from '../../../hooks/useTheme';
import { useFriendStore } from '../../../stores/friendStore';
import FriendModel from '../../../db/models/Friend';

const WIDGET_CONFIG: HomeWidgetConfig = {
  id: 'life-events',
  type: 'life-events',
  title: 'Special Dates',
  minHeight: 200,
  fullWidth: true,
};

interface UpcomingEvent {
  friend: FriendModel;
  type: 'birthday' | 'anniversary';
  date: Date;
  daysUntil: number;
}

export const LifeEventsWidget: React.FC = () => {
  const { colors } = useTheme();
  const router = useRouter();
  const { friends } = useFriendStore();
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);

  useEffect(() => {
    if (!friends || friends.length === 0) return;

    const events: UpcomingEvent[] = [];
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    friends.forEach(friend => {
      // Check birthday
      if (friend.birthday) {
        const birthdayThisYear = new Date(friend.birthday);
        birthdayThisYear.setFullYear(today.getFullYear());

        // If birthday already passed this year, check next year
        if (birthdayThisYear < today) {
          birthdayThisYear.setFullYear(today.getFullYear() + 1);
        }

        const daysUntil = differenceInDays(birthdayThisYear, today);
        if (daysUntil >= 0 && daysUntil <= 30) {
          events.push({
            friend,
            type: 'birthday',
            date: birthdayThisYear,
            daysUntil,
          });
        }
      }

      // Check anniversary
      if (friend.anniversary) {
        const anniversaryThisYear = new Date(friend.anniversary);
        anniversaryThisYear.setFullYear(today.getFullYear());

        // If anniversary already passed this year, check next year
        if (anniversaryThisYear < today) {
          anniversaryThisYear.setFullYear(today.getFullYear() + 1);
        }

        const daysUntil = differenceInDays(anniversaryThisYear, today);
        if (daysUntil >= 0 && daysUntil <= 30) {
          events.push({
            friend,
            type: 'anniversary',
            date: anniversaryThisYear,
            daysUntil,
          });
        }
      }
    });

    // Sort by days until
    events.sort((a, b) => a.daysUntil - b.daysUntil);
    setUpcomingEvents(events);
  }, [friends]);

  const getEventIcon = (type: 'birthday' | 'anniversary') => {
    return type === 'birthday' ? (
      <Cake size={20} color={colors.primary} />
    ) : (
      <Heart size={20} color={colors.primary} />
    );
  };

  const getDaysText = (days: number) => {
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `In ${days} days`;
  };

  return (
    <HomeWidgetBase config={WIDGET_CONFIG}>
      <View className="mb-4 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View
            style={{ backgroundColor: colors.primary + '20' }}
            className="h-10 w-10 items-center justify-center rounded-full"
          >
            <PartyPopper size={20} color={colors.primary} />
          </View>
          <Text
            style={{ color: colors.foreground }}
            className="font-lora text-xl font-bold"
          >
            Special Dates
          </Text>
        </View>
      </View>

      {upcomingEvents.length === 0 ? (
        <View className="items-center py-8">
          <Text
            style={{ color: colors['muted-foreground'] }}
            className="text-center font-inter text-sm"
          >
            No special dates in the next 30 days
          </Text>
          <Text
            style={{ color: colors['muted-foreground'] }}
            className="mt-2 text-center font-inter text-xs"
          >
            Add birthdays and anniversaries to your friends!
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ maxHeight: 280 }}
          showsVerticalScrollIndicator={false}
          className="gap-3"
        >
          {upcomingEvents.map((event, index) => (
            <TouchableOpacity
              key={`${event.friend.id}-${event.type}`}
              onPress={() => router.push(`/friend-profile?friendId=${event.friend.id}`)}
              style={{
                backgroundColor: colors.muted,
                borderColor: colors.border,
              }}
              className="mb-3 flex-row items-center gap-3 rounded-xl border p-4"
            >
              {/* Icon */}
              <View
                style={{ backgroundColor: colors.card }}
                className="h-10 w-10 items-center justify-center rounded-full"
              >
                {getEventIcon(event.type)}
              </View>

              {/* Info */}
              <View className="flex-1">
                <Text
                  style={{ color: colors.foreground }}
                  className="font-inter text-base font-semibold"
                >
                  {event.friend.name}
                </Text>
                <Text
                  style={{ color: colors['muted-foreground'] }}
                  className="font-inter text-sm"
                >
                  {event.type === 'birthday' ? 'Birthday' : 'Friendship Anniversary'}
                </Text>
              </View>

              {/* Date badge */}
              <View
                style={{
                  backgroundColor: event.daysUntil <= 7 ? colors.primary + '20' : colors.card,
                  borderColor: event.daysUntil <= 7 ? colors.primary : colors.border,
                }}
                className="rounded-lg border px-3 py-2"
              >
                <Text
                  style={{
                    color: event.daysUntil <= 7 ? colors.primary : colors['muted-foreground'],
                  }}
                  className="font-inter text-xs font-semibold"
                >
                  {getDaysText(event.daysUntil)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </HomeWidgetBase>
  );
};
