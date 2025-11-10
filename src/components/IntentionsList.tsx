import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import { Q } from '@nozbe/watermelondb';
import { Trash2 } from 'lucide-react-native';
import { useTheme } from '../hooks/useTheme';
import { getCategoryMetadata } from '../lib/interaction-categories';
import Intention from '../db/models/Intention';
import FriendModel from '../db/models/Friend';
import { InteractionCategory } from './types';
import { database } from '../db';
import { useIntentionStore } from '../stores/intentionStore';

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
 * Always visible section - shows "No intentions set" when empty
 */
export function IntentionsList({ intentions, onIntentionPress }: IntentionsListProps) {
  const { colors } = useTheme();
  const [intentionsWithFriends, setIntentionsWithFriends] = useState<IntentionWithFriend[]>([]);
  const { clearAllIntentions, cleanupOrphanedIntentions } = useIntentionStore();

  // Clean up orphaned intentions on mount
  useEffect(() => {
    cleanupOrphanedIntentions().catch(error => {
      console.error('Error cleaning orphaned intentions:', error);
    });
  }, []);

  // Load friend data for each intention
  useEffect(() => {
    const loadFriends = async () => {
      const withFriends = await Promise.all(
        intentions.map(async (intention) => {
          // Get the IntentionFriend join records for this intention
          const intentionFriends = await database
            .get('intention_friends')
            .query(Q.where('intention_id', intention.id))
            .fetch();

          // Get the first friend (intentions can have multiple friends, but we'll show the first one)
          if (intentionFriends.length > 0) {
            const friend = await intentionFriends[0].friend.fetch();
            return { intention, friend };
          }

          return null;
        })
      );

      // Filter out any null values (intentions without friends)
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
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await clearAllIntentions();
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.muted + '40', borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>🌱 Connection Intentions</Text>
          <Text style={[styles.headerCount, { color: colors['muted-foreground'] }]}>
            {intentionsWithFriends.length}
          </Text>
        </View>
        {intentionsWithFriends.length > 0 && (
          <TouchableOpacity onPress={handleClearAll} style={styles.clearButton}>
            <Trash2 size={18} color={colors['muted-foreground']} />
          </TouchableOpacity>
        )}
      </View>

      {intentionsWithFriends.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors['muted-foreground'] }]}>
          No intentions set yet
        </Text>
      ) : (
        <View style={styles.intentionsGrid}>
          {intentionsWithFriends.map(({ intention, friend }) => {
            const category = intention.interactionCategory
              ? getCategoryMetadata(intention.interactionCategory as InteractionCategory)
              : null;

            const timeAgo = formatDistanceToNow(intention.createdAt, { addSuffix: true });

            return (
              <TouchableOpacity
                key={intention.id}
                style={[styles.intentionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => onIntentionPress(intention)}
                activeOpacity={0.7}
              >
                <View style={styles.intentionContent}>
                  {category && (
                    <Text style={styles.categoryIcon}>{category.icon}</Text>
                  )}
                  <View style={styles.intentionText}>
                    <Text style={[styles.friendName, { color: colors.foreground }]} numberOfLines={1}>
                      {friend.name}
                    </Text>
                    {intention.description && (
                      <Text style={[styles.description, { color: colors['muted-foreground'] }]} numberOfLines={1}>
                        {intention.description}
                      </Text>
                    )}
                  </View>
                </View>
                <Text style={[styles.timeAgo, { color: colors['muted-foreground'] }]}>
                  {timeAgo}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Lora_700Bold',
  },
  headerCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  clearButton: {
    padding: 4,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  intentionsGrid: {
    gap: 12,
  },
  intentionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  intentionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  categoryIcon: {
    fontSize: 24,
  },
  intentionText: {
    flex: 1,
  },
  friendName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  description: {
    fontSize: 13,
  },
  timeAgo: {
    fontSize: 12,
    marginLeft: 8,
  },
});
