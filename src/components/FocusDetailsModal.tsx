import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { X, Calendar, CheckCircle2, Cake, Heart } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/shared/hooks/useTheme';
import { usePlans } from '@/modules/interactions';
import { useSuggestions } from '@/modules/interactions';
import { getCategoryMetadata } from '@/shared/constants/interaction-categories';
import { type InteractionCategory } from './types';
import FriendModel from '@/db/models/Friend';
import { differenceInDays, format } from 'date-fns';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';

interface UpcomingDate {
  friend: FriendModel;
  type: 'birthday' | 'anniversary' | 'life_event';
  daysUntil: number;
  title?: string;
}

interface FocusDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  upcomingDates: UpcomingDate[];
  pendingPlans?: any[];
  suggestions?: any[];
  onConfirmPlan: (interactionId: string) => void;
  onReschedulePlan: (plan: any) => void;
  onSuggestionPress: (suggestion: any) => void;
}

export const FocusDetailsModal: React.FC<FocusDetailsModalProps> = ({
  visible,
  onClose,
  upcomingDates,
  pendingPlans: propPendingPlans,
  suggestions: propSuggestions,
  onConfirmPlan,
  onReschedulePlan,
  onSuggestionPress,
}) => {
  const { colors, isDarkMode } = useTheme();
  const router = useRouter();
  const { pendingConfirmations: hookPendingPlans } = usePlans();
  const { suggestions: hookSuggestions } = useSuggestions();

  const pendingConfirmations = propPendingPlans || hookPendingPlans || [];
  const suggestions = propSuggestions || hookSuggestions || [];

  const getDaysText = (days: number) => {
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `${days}d`;
  };

  const FocusDetailsPlanItem = ({ plan, colors, onConfirm, onReschedule }: any) => {
    const [friends, setFriends] = React.useState<FriendModel[]>([]);

    React.useEffect(() => {
      const loadFriends = async () => {
        try {
          // Handle both raw Interaction and wrapped object
          const interaction = plan.interaction || plan;

          if (interaction.interactionFriends) {
            const linkedFriends = await interaction.interactionFriends.fetch();
            const friendIds = linkedFriends.map((link: any) => link.friendId);

            if (friendIds.length > 0) {
              const friendsList = await database.get<FriendModel>('friends')
                .query(Q.where('id', Q.oneOf(friendIds)))
                .fetch();
              setFriends(friendsList);
            }
          }
        } catch (e) {
          console.error('Error loading friends in FocusDetailsModal:', e);
        }
      };
      loadFriends();
    }, [plan]);

    const interaction = plan.interaction || plan;
    const friendName = friends.map(f => f.name).join(', ');

    // Calculate daysUntil if not present
    const daysUntil = plan.daysUntil !== undefined
      ? plan.daysUntil
      : differenceInDays(new Date(interaction.interactionDate), new Date());

    const dateText = getDaysText(daysUntil);
    const timeText = format(interaction.interactionDate, 'h:mm a');

    const categoryData = interaction.interactionCategory
      ? getCategoryMetadata(interaction.interactionCategory as InteractionCategory)
      : null;
    const displayTitle = interaction.title || categoryData?.label || interaction.activity;

    return (
      <View
        style={[styles.planCard, { backgroundColor: colors.muted, borderColor: colors.border }]}
      >
        <View style={styles.planHeader}>
          <Calendar size={20} color={colors.primary} />
          <View style={styles.planContent}>
            <Text style={[styles.planTitle, { color: colors.foreground }]}>
              {displayTitle}
            </Text>
            <Text style={[styles.planSubtitle, { color: colors['muted-foreground'] }]}>
              {friendName} · {timeText} · {dateText}
            </Text>
          </View>
        </View>
        <View style={styles.planActions}>
          <TouchableOpacity
            style={[styles.confirmButton, { backgroundColor: colors.primary }]}
            onPress={() => {
              onConfirm(interaction.id);
              onClose();
            }}
          >
            <CheckCircle2 size={16} color="#FFFFFF" />
            <Text style={styles.confirmButtonText}>Confirm</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.rescheduleButton, { borderColor: colors.border }]}
            onPress={() => {
              // Pass synthetic object for compatibility with TodaysFocusWidget
              onReschedule({
                interaction: interaction,
                friends: { fetch: async () => friends }
              });
              onClose();
            }}
          >
            <Text style={[styles.rescheduleButtonText, { color: colors['muted-foreground'] }]}>
              Reschedule
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <BlurView intensity={isDarkMode ? 40 : 20} style={StyleSheet.absoluteFill} />
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />

        <View style={styles.modalContent}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.foreground }]}>Your Focus</Text>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={24} color={colors['muted-foreground']} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              {/* Pending Plans Section */}
              {pendingConfirmations.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors['muted-foreground'] }]}>
                    PENDING PLANS
                  </Text>
                  {pendingConfirmations.map((plan: any) => (
                    <FocusDetailsPlanItem
                      key={plan.id || plan.interaction?.id}
                      plan={plan}
                      colors={colors}
                      onConfirm={onConfirmPlan}
                      onReschedule={onReschedulePlan}
                    />
                  ))}
                </View>
              )}

              {/* Upcoming Events Section */}
              {upcomingDates.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors['muted-foreground'] }]}>
                    UPCOMING
                  </Text>
                  {upcomingDates && upcomingDates.map((event) => (
                    <TouchableOpacity
                      key={`${event.friend.id}-${event.type}`}
                      onPress={() => {
                        router.push(`/friend-profile?friendId=${event.friend.id}`);
                        onClose();
                      }}
                      style={[styles.upcomingItem, { borderColor: colors.border }]}
                    >
                      <View style={styles.upcomingIcon}>
                        {event.type === 'birthday' ? (
                          <Cake size={18} color={colors['muted-foreground']} />
                        ) : event.type === 'anniversary' ? (
                          <Heart size={18} color={colors['muted-foreground']} />
                        ) : (
                          <Calendar size={18} color={colors['muted-foreground']} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.upcomingName, { color: colors.foreground }]}>
                          {event.title || (event.type === 'birthday' ? 'Birthday' : 'Anniversary')}
                        </Text>
                        <Text style={[styles.upcomingSubheading, { color: colors['muted-foreground'] }]}>
                          {event.friend.name}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.upcomingBadge,
                          { backgroundColor: event.daysUntil <= 7 ? colors.primary + '20' : colors.muted },
                        ]}
                      >
                        <Text
                          style={[
                            styles.upcomingDays,
                            { color: event.daysUntil <= 7 ? colors.primary : colors['muted-foreground'] },
                          ]}
                        >
                          {getDaysText(event.daysUntil)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Suggestions Section */}
              {suggestions.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors['muted-foreground'] }]}>
                    SUGGESTIONS
                  </Text>
                  {suggestions.slice(0, 5).map((suggestion) => (
                    <TouchableOpacity
                      key={suggestion.id}
                      onPress={() => {
                        onSuggestionPress(suggestion);
                        onClose();
                      }}
                      style={[
                        styles.suggestionCard,
                        { backgroundColor: colors.muted, borderColor: colors.border },
                      ]}
                    >
                      <Text style={styles.suggestionIcon}>{suggestion.icon}</Text>
                      <View style={styles.suggestionContent}>
                        <Text style={[styles.suggestionTitle, { color: colors.foreground }]}>
                          {suggestion.title}
                        </Text>
                        <Text style={[styles.suggestionSubtitle, { color: colors['muted-foreground'] }]}>
                          {suggestion.subtitle}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Empty State */}
              {pendingConfirmations.length === 0 && upcomingDates.length === 0 && suggestions.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>✨</Text>
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                    All Caught Up
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: colors['muted-foreground'] }]}>
                    Your connections are thriving
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
  },
  modalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    borderRadius: 24,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 16,
  },
  title: {
    fontFamily: 'Lora_700Bold',
    fontSize: 24,
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  planCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  planContent: {
    flex: 1,
  },
  planTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    marginBottom: 4,
  },
  planSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
  },
  planActions: {
    flexDirection: 'row',
    gap: 8,
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  confirmButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  rescheduleButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  rescheduleButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  upcomingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  upcomingIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upcomingName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    marginBottom: 2,
  },
  upcomingSubheading: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
  },
  upcomingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  upcomingDays: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  suggestionIcon: {
    fontSize: 32,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    marginBottom: 4,
  },
  suggestionSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: 'Lora_700Bold',
    fontSize: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
});
