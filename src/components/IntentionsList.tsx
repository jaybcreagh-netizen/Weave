import React, { useEffect, useState } from 'react';
import { logger } from '@/shared/services/logger.service';
import { View, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import { Q } from '@nozbe/watermelondb';
import { Trash2, Target } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { getCategoryMetadata } from '@/shared/constants/interaction-categories';
import Intention from '@/db/models/Intention';
import FriendModel from '@/db/models/Friend';
import IntentionFriend from '@/db/models/IntentionFriend';
import { InteractionCategory } from './types';
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
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text variant="h3" style={{ color: colors.foreground }}>
            Focus & Intentions
          </Text>
          <View style={[styles.countBadge, { backgroundColor: colors.secondary }]}>
            <Text variant="caption" style={{ color: colors.foreground }}>
              {intentionsWithFriends.length}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleClearAll} style={styles.clearButton}>
          <Text variant="caption" style={{ color: colors['muted-foreground'] }}>Clear All</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {intentionsWithFriends.map(({ intention, friend }) => {
          const category = intention.interactionCategory
            ? getCategoryMetadata(intention.interactionCategory as InteractionCategory)
            : null;

          return (
            <TouchableOpacity
              key={intention.id}
              style={[
                styles.intentionCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  shadowColor: tokens.shadow.color
                }
              ]}
              onPress={() => onIntentionPress(intention)}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.iconContainer, { backgroundColor: colors.secondary }]}>
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

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4, // Align with parent padding
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  clearButton: {
    padding: 4,
  },
  scrollContent: {
    paddingRight: 16, // End padding for scroll
    gap: 12,
  },
  intentionCard: {
    width: 160,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

