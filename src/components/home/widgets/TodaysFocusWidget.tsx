import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { differenceInDays } from 'date-fns';
import { Cake, Heart, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../../hooks/useTheme';
import { HomeWidgetBase, HomeWidgetConfig } from '../HomeWidgetBase';
import { useFriendStore } from '../../../stores/friendStore';
import { useSuggestions } from '../../../hooks/useSuggestions';
import FriendModel from '../../../db/models/Friend';

const WIDGET_CONFIG: HomeWidgetConfig = {
  id: 'todays-focus',
  type: 'todays-focus',
  title: "Today's Focus",
  minHeight: 200,
  fullWidth: true,
};

interface UpcomingDate {
  friend: FriendModel;
  type: 'birthday' | 'anniversary';
  daysUntil: number;
}

export const TodaysFocusWidget: React.FC = () => {
  const { colors } = useTheme();
  const router = useRouter();
  const { friends } = useFriendStore();
  const { suggestions } = useSuggestions();
  const [upcomingDates, setUpcomingDates] = useState<UpcomingDate[]>([]);

  // Calculate upcoming special dates (30 days)
  useEffect(() => {
    if (!friends || friends.length === 0) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const events: UpcomingDate[] = [];

    friends.forEach(friend => {
      // Check birthday
      if (friend.birthday) {
        const birthdayThisYear = new Date(friend.birthday);
        birthdayThisYear.setFullYear(today.getFullYear());
        birthdayThisYear.setHours(0, 0, 0, 0);

        if (birthdayThisYear < today) {
          birthdayThisYear.setFullYear(today.getFullYear() + 1);
        }

        const daysUntil = differenceInDays(birthdayThisYear, today);
        if (daysUntil >= 0 && daysUntil <= 30) {
          events.push({ friend, type: 'birthday', daysUntil });
        }
      }

      // Check anniversary
      if (friend.anniversary) {
        const anniversaryThisYear = new Date(friend.anniversary);
        anniversaryThisYear.setFullYear(today.getFullYear());
        anniversaryThisYear.setHours(0, 0, 0, 0);

        if (anniversaryThisYear < today) {
          anniversaryThisYear.setFullYear(today.getFullYear() + 1);
        }

        const daysUntil = differenceInDays(anniversaryThisYear, today);
        if (daysUntil >= 0 && daysUntil <= 30) {
          events.push({ friend, type: 'anniversary', daysUntil });
        }
      }
    });

    // Sort by proximity and show top 3
    events.sort((a, b) => a.daysUntil - b.daysUntil);
    setUpcomingDates(events.slice(0, 3));
  }, [friends]);

  const primarySuggestion = suggestions.length > 0 ? suggestions[0] : null;

  const getDaysText = (days: number) => {
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days <= 7) return `${days}d`;
    return `${days}d`;
  };

  return (
    <HomeWidgetBase config={WIDGET_CONFIG}>
      <View style={styles.container}>
        {/* Primary Suggestion from Engine */}
        {primarySuggestion ? (
          <TouchableOpacity
            onPress={() => router.push(`/friend-profile?friendId=${primarySuggestion.friendId}`)}
            style={[
              styles.suggestionCard,
              { backgroundColor: colors.muted, borderColor: colors.border },
            ]}
          >
            <View style={styles.suggestionHeader}>
              <Text style={styles.suggestionIcon}>{primarySuggestion.icon}</Text>
              <View style={styles.suggestionContent}>
                <Text style={[styles.suggestionTitle, { color: colors.foreground }]}>
                  {primarySuggestion.title}
                </Text>
                <Text style={[styles.suggestionSubtitle, { color: colors['muted-foreground'] }]}>
                  {primarySuggestion.subtitle}
                </Text>
              </View>
              <ChevronRight size={20} color={colors['muted-foreground']} />
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✨</Text>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              All threads healthy
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors['muted-foreground'] }]}>
              Your connections are thriving
            </Text>
          </View>
        )}

        {/* Upcoming Special Dates Preview */}
        {upcomingDates.length > 0 && (
          <View style={styles.upcomingSection}>
            <Text style={[styles.upcomingSectionTitle, { color: colors['muted-foreground'] }]}>
              Upcoming
            </Text>
            {upcomingDates.map((event, index) => (
              <TouchableOpacity
                key={`${event.friend.id}-${event.type}`}
                onPress={() => router.push(`/friend-profile?friendId=${event.friend.id}`)}
                style={[
                  styles.upcomingItem,
                  { borderColor: colors.border },
                ]}
              >
                <View style={styles.upcomingIcon}>
                  {event.type === 'birthday' ? (
                    <Cake size={16} color={colors['muted-foreground']} />
                  ) : (
                    <Heart size={16} color={colors['muted-foreground']} />
                  )}
                </View>
                <Text style={[styles.upcomingName, { color: colors.foreground }]}>
                  {event.friend.name}
                </Text>
                <View
                  style={[
                    styles.upcomingBadge,
                    {
                      backgroundColor: event.daysUntil <= 7 ? colors.primary + '20' : colors.card,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.upcomingDays,
                      {
                        color: event.daysUntil <= 7 ? colors.primary : colors['muted-foreground'],
                      },
                    ]}
                  >
                    {getDaysText(event.daysUntil)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </HomeWidgetBase>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  suggestionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  suggestionIcon: {
    fontSize: 32,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionTitle: {
    fontFamily: 'Lora_700Bold',
    fontSize: 16,
    marginBottom: 4,
  },
  suggestionSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: 'Lora_700Bold',
    fontSize: 18,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
  upcomingSection: {
    gap: 8,
  },
  upcomingSectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  upcomingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  upcomingIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upcomingName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    flex: 1,
  },
  upcomingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  upcomingDays: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
});
