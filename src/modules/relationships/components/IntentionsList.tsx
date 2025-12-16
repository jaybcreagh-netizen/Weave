import React, { useEffect, useState } from 'react';
import { logger } from '@/shared/services/logger.service';
import { View, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import { Q } from '@nozbe/watermelondb';
import { useTheme } from '@/shared/hooks/useTheme';
import { getCategoryMetadata } from '@/shared/constants/interaction-categories';
import Intention from '@/db/models/Intention';
import FriendModel from '@/db/models/Friend';
import IntentionFriend from '@/db/models/IntentionFriend';
import { InteractionCategory } from '@/shared/types/legacy-types';
import { database } from '@/db';
import { Text } from '@/shared/ui/Text'; // Use shared Text component

interface IntentionWithFriend {
  intention: Intention;
  friend: FriendModel;
}

interface IntentionsListProps {
  intentions: Intention[];
  onIntentionPress: (intention: Intention) => void;
}

/**
 * Displays active intentions at the top of Insights sheet
 * Horizontal scrolling layout for a more modern feel
 */
export function IntentionsList({ intentions, onIntentionPress }: IntentionsListProps) {
  const { colors, tokens } = useTheme();
  const [intentionsWithFriends, setIntentionsWithFriends] = useState<IntentionWithFriend[]>([]);

  const clearAllIntentions = async () => {
    try {
      logger.info('IntentionsList', 'Clearing all intentions...');
      await database.write(async () => {
        const activeIntentions = await database.get<Intention>('intentions')
          .query(Q.where('status', 'active'))
          .fetch();

        logger.info('IntentionsList', `Found ${activeIntentions.length} active intentions to clear`);

        if (activeIntentions.length > 0) {
          const updates = activeIntentions.map(intention =>
            intention.prepareUpdate(record => {
              record.status = 'dismissed';
            })
          );
          await database.batch(...updates);
        }
      });
    } catch (error) {
      logger.error('IntentionsList', 'Error clearing intentions:', error);
      Alert.alert('Error', 'Failed to clear intentions');
    }
  };

  const cleanupOrphanedIntentions = async () => {
    try {
      await database.write(async () => {
        const activeIntentions = await database.get<Intention>('intentions')
          .query(Q.where('status', 'active'))
          .fetch();

        const intentionsToDelete: Intention[] = [];

        for (const intention of activeIntentions) {
          const count = await intention.intentionFriends.fetchCount();
          if (count === 0) {
            intentionsToDelete.push(intention);
          }
        }

        if (intentionsToDelete.length > 0) {
          await database.batch(
            intentionsToDelete.map(intention => intention.prepareDestroyPermanently())
          );
        }
      });
    } catch (error) {
      logger.error('IntentionsList', 'Error cleaning orphaned intentions:', error);
    }
  };

  useEffect(() => {
    cleanupOrphanedIntentions().catch(error => {
      logger.error('IntentionsList', 'Error cleaning orphaned intentions:', error);
    });
  }, []);

  useEffect(() => {
    const loadFriends = async () => {
      const withFriends = await Promise.all(
        intentions.map(async (intention) => {
          const intentionFriends = await database
            .get<IntentionFriend>('intention_friends')
            .query(Q.where('intention_id', intention.id))
            .fetch();

          if (intentionFriends.length > 0) {
            const friend = await intentionFriends[0].friend.fetch();
            return { intention, friend };
          }
          return null;
        })
      );
      setIntentionsWithFriends(withFriends.filter(Boolean) as IntentionWithFriend[]);
    };

    if (intentions.length > 0) {
      loadFriends();
    } else {
      setIntentionsWithFriends([]);
    }
  }, [intentions]);

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Intentions',
      'Are you sure you want to dismiss all active intentions?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear All', style: 'destructive', onPress: clearAllIntentions },
      ]
    );
  };

  if (intentionsWithFriends.length === 0) {
    return null; // Hide completely if empty to save space, or we can keep a "Good job" state
  }

  return (
    <View className="mb-6">
      <View className="flex-row justify-between items-center mb-3 px-1">
        <View className="flex-row items-center gap-2">
          <Text variant="h3" style={{ color: colors.foreground }}>
            Focus & Intentions
          </Text>
          <View className="px-1.5 py-0.5 rounded-full" style={{ backgroundColor: colors.secondary }}>
            <Text variant="caption" style={{ color: colors.foreground }}>
              {intentionsWithFriends.length}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleClearAll} className="p-1">
          <Text variant="caption" style={{ color: colors['muted-foreground'] }}>Clear All</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 16, gap: 12 }}
      >
        {intentionsWithFriends.map(({ intention, friend }) => {
          const category = intention.interactionCategory
            ? getCategoryMetadata(intention.interactionCategory as InteractionCategory)
            : null;

          return (
            <TouchableOpacity
              key={intention.id}
              className="w-40 p-3 rounded-2xl border shadow-sm elevation-2"
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
                shadowColor: tokens.shadow.color,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8
              }}
              onPress={() => onIntentionPress(intention)}
              activeOpacity={0.7}
            >
              <View className="flex-row justify-between items-start">
                <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: colors.secondary }}>
                  <Text style={{ fontSize: 16 }}>{category?.icon || '🎯'}</Text>
                </View>
                <Text variant="caption" style={{ color: colors['muted-foreground'] }}>
                  {formatDistanceToNow(intention.createdAt, { addSuffix: true })}
                </Text>
              </View>

              <Text variant="body" weight="bold" style={{ color: colors.foreground, marginTop: 8 }} numberOfLines={1}>
                {friend.name}
              </Text>

              {intention.description ? (
                <Text variant="caption" style={{ color: colors['muted-foreground'], marginTop: 4 }} numberOfLines={2}>
                  {intention.description}
                </Text>
              ) : (
                <Text variant="caption" style={{ color: colors['muted-foreground'], marginTop: 4, fontStyle: 'italic' }}>
                  No specifics set
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
