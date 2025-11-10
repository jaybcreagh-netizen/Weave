import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Calendar, Heart, Cake, PartyPopper, Briefcase, Home, Award } from 'lucide-react-native';
import { format, differenceInDays, isThisYear } from 'date-fns';

import { HomeWidgetBase, HomeWidgetConfig } from '../HomeWidgetBase';
import { useTheme } from '../../../hooks/useTheme';
import { useFriends } from '../../../hooks/useFriends';
import FriendModel from '../../../db/models/Friend';
import { getAllFriendsWithActiveLifeEvents } from '../../../lib/life-event-detection';
import LifeEvent, { LifeEventType } from '../../../db/models/LifeEvent';

const WIDGET_CONFIG: HomeWidgetConfig = {
  id: 'life-events',
  type: 'life-events',
  title: 'Life Events',
  minHeight: 200,
  fullWidth: true,
};

interface DisplayEvent {
  id: string;
  friend: FriendModel;
  type: LifeEventType | 'birthday' | 'anniversary';
  date: Date;
  daysUntil: number;
  title: string;
}

export const LifeEventsWidget: React.FC = () => {
  const { colors } = useTheme();
  const router = useRouter();
  const allFriends = useFriends();
  const [allEvents, setAllEvents] = useState<DisplayEvent[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const fetchAndProcessEvents = async () => {
      if (!allFriends || allFriends.length === 0) return;

      const specialDates: DisplayEvent[] = [];
      const today = new Date();
      
      // 1. Process Birthdays and Anniversaries
      allFriends.forEach(friend => {
        if (friend.birthday) {
          const eventDate = new Date(friend.birthday);
          eventDate.setFullYear(today.getFullYear());
          if (eventDate < today) {
            eventDate.setFullYear(today.getFullYear() + 1);
          }
          const daysUntil = differenceInDays(eventDate, today);
          if (daysUntil >= 0 && daysUntil <= 60) { // Widen scope to 60 days
            specialDates.push({ id: `${friend.id}-birthday`, friend, type: 'birthday', date: eventDate, daysUntil, title: 'Birthday' });
          }
        }
        // Only show anniversaries for partners
        if (friend.anniversary && friend.relationshipType?.toLowerCase().includes('partner')) {
          const eventDate = new Date(friend.anniversary);
          eventDate.setFullYear(today.getFullYear());
          if (eventDate < today) {
            eventDate.setFullYear(today.getFullYear() + 1);
          }
          const daysUntil = differenceInDays(eventDate, today);
          if (daysUntil >= 0 && daysUntil <= 14) {
            specialDates.push({ id: `${friend.id}-anniversary`, friend, type: 'anniversary', date: eventDate, daysUntil, title: 'Relationship Anniversary' });
          }
        }
      });

      // 2. Fetch dynamic life events
      const dynamicEventsRaw = await getAllFriendsWithActiveLifeEvents();
      const dynamicEvents: DisplayEvent[] = dynamicEventsRaw
        .map(({ friendId, events }) => {
          const friend = allFriends.find(f => f.id === friendId);
          if (!friend) return null;
          return events.map(event => ({
            id: event.id,
            friend,
            type: event.eventType,
            date: event.eventDate,
            daysUntil: differenceInDays(event.eventDate, today),
            title: event.title,
          }));
        })
        .flat()
        .filter((e): e is DisplayEvent => e !== null);

      // 3. Merge and sort all events
      const combinedEvents = [...specialDates, ...dynamicEvents];
      combinedEvents.sort((a, b) => a.daysUntil - b.daysUntil);
      
      // 4. Remove duplicates (preferring dynamic events over special dates if they are the same)
      const uniqueEvents = combinedEvents.filter((event, index, self) =>
        index === self.findIndex((e) => (
          e.friend.id === event.friend.id && e.type === event.type && e.date.toDateString() === event.date.toDateString()
        ))
      );

      setAllEvents(uniqueEvents);
    };

    fetchAndProcessEvents();
  }, [allFriends]);

  const getEventIcon = (type: DisplayEvent['type']) => {
    switch (type) {
      case 'birthday':
        return <Cake size={20} color={colors.primary} />;
      case 'anniversary':
        return <Heart size={20} color={colors.primary} />;
      case 'new_job':
        return <Briefcase size={20} color={colors.primary} />;
      case 'moving':
        return <Home size={20} color={colors.primary} />;
      case 'celebration':
        return <Award size={20} color={colors.primary} />;
      default:
        return <Calendar size={20} color={colors.primary} />;
    }
  };

  const getDaysText = (days: number) => {
    if (days < 0) return `${Math.abs(days)} days ago`;
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `In ${days} days`;
  };

  const displayedEvents = isExpanded ? allEvents : allEvents.slice(0, 2);

  return (
    <HomeWidgetBase config={WIDGET_CONFIG}>
      <View className="mb-4 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View style={{ backgroundColor: colors.primary + '20' }} className="h-10 w-10 items-center justify-center rounded-full">
            <PartyPopper size={20} color={colors.primary} />
          </View>
          <Text style={{ color: colors.foreground }} className="font-lora text-xl font-bold">
            Life Events
          </Text>
        </View>
      </View>

      {allEvents.length === 0 ? (
        <View className="items-center py-8">
          <Text style={{ color: colors['muted-foreground'] }} className="text-center font-inter text-sm">
            No life events or special dates in the near future.
          </Text>
          <Text style={{ color: colors['muted-foreground'] }} className="mt-2 text-center font-inter text-xs">
            Log weaves with notes to automatically detect events!
          </Text>
        </View>
      ) : (
        <View>
          <View className="gap-3">
            {displayedEvents.map((event) => (
              <TouchableOpacity
                key={event.id}
                onPress={() => router.push(`/friend-profile?friendId=${event.friend.id}`)}
                style={{ backgroundColor: colors.muted, borderColor: colors.border }}
                className="flex-row items-center gap-3 rounded-xl border p-4"
              >
                <View style={{ backgroundColor: colors.card }} className="h-10 w-10 items-center justify-center rounded-full">
                  {getEventIcon(event.type)}
                </View>
                <View className="flex-1">
                  <Text style={{ color: colors.foreground }} className="font-inter text-base font-semibold">
                    {event.friend.name}
                  </Text>
                  <Text style={{ color: colors['muted-foreground'] }} className="font-inter text-sm">
                    {event.title}
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: event.daysUntil <= 7 && event.daysUntil >= 0 ? colors.primary + '20' : colors.card,
                    borderColor: event.daysUntil <= 7 && event.daysUntil >= 0 ? colors.primary : colors.border,
                  }}
                  className="rounded-lg border px-3 py-2"
                >
                  <Text
                    style={{
                      color: event.daysUntil <= 7 && event.daysUntil >= 0 ? colors.primary : colors['muted-foreground'],
                    }}
                    className="font-inter text-xs font-semibold"
                  >
                    {getDaysText(event.daysUntil)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {allEvents.length > 2 && (
            <TouchableOpacity
              onPress={() => setIsExpanded(!isExpanded)}
              className="mt-4 items-center rounded-lg py-2"
            >
              <Text style={{ color: colors.primary }} className="font-inter font-semibold">
                {isExpanded ? 'Show Less' : `Show ${allEvents.length - 2} More`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </HomeWidgetBase>
  );
};
