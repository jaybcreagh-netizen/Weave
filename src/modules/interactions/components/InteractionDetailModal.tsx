import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Calendar, MapPin, Heart, MessageCircle, Sparkles, Edit3, Trash2, Share2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/shared/hooks/useTheme';
import { AnimatedBottomSheet, AnimatedBottomSheetRef } from '@/shared/ui/Sheet';
import { type Interaction, type MoonPhase, type InteractionCategory } from '../types';
import { modeIcons } from '@/shared/constants/constants';
import { getCategoryMetadata } from '@/shared/constants/interaction-categories';
import { STORY_CHIPS } from '@/modules/reflection';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import FriendModel from '@/db/models/Friend';
import InteractionModel from '@/db/models/Interaction';
import { shareInteractionAsICS } from '@/modules/interactions';

const moonPhaseIcons: Record<MoonPhase, string> = {
  'NewMoon': '🌑',
  'WaxingCrescent': '🌒',
  'FirstQuarter': '🌓',
  'WaxingGibbous': '🌔',
  'FullMoon': '🌕',
  'WaningGibbous': '🌖',
  'LastQuarter': '🌗',
  'WaningCrescent': '🌘'
};

const formatDateTime = (date: Date | string): { date: string; time: string } => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return {
    date: d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  };
};

interface InteractionDetailModalProps {
  interaction: Interaction | null;
  isOpen: boolean;
  onClose: () => void;
  friendName?: string;
  onEditReflection?: (interaction: Interaction) => void;
  onEdit?: (interaction: Interaction) => void;
  onDelete?: (interactionId: string) => void;
}

export function InteractionDetailModal({
  interaction,
  isOpen,
  onClose,
  friendName,
  onEditReflection,
  onEdit,
  onDelete,
}: InteractionDetailModalProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDarkMode } = useTheme();

  // Ref to control the sheet animation
  const sheetRef = useRef<AnimatedBottomSheetRef>(null);

  // Cache interaction to keep displaying it during close animation
  const [cachedInteraction, setCachedInteraction] = useState<Interaction | null>(interaction);

  useEffect(() => {
    if (interaction) {
      setCachedInteraction(interaction);
    }
  }, [interaction]);

  // Use cached version if current is null (during closing)
  const activeInteraction = interaction || cachedInteraction;

  // Track pending actions for after close animation
  const pendingActionRef = useRef<'edit' | 'delete' | 'editReflection' | null>(null);

  const [participants, setParticipants] = useState<FriendModel[]>([]);

  // Fetch all participants for this interaction
  useEffect(() => {
    if (!activeInteraction) {
      setParticipants([]);
      return;
    }

    const fetchParticipants = async () => {
      try {
        // Get join records for this interaction
        const joinRecords = await database
          .get('interaction_friends')
          .query(Q.where('interaction_id', activeInteraction.id))
          .fetch();

        if (joinRecords.length === 0) {
          setParticipants([]);
          return;
        }

        // Get friend IDs from join records
        const friendIds = joinRecords.map((jr: any) => jr.friendId);

        // Fetch all friend models
        const friends = await database
          .get<FriendModel>('friends')
          .query(Q.where('id', Q.oneOf(friendIds)))
          .fetch();

        setParticipants(friends);
      } catch (error) {
        console.error('Error fetching participants:', error);
        setParticipants([]);
      }
    };

    fetchParticipants();
  }, [activeInteraction]);

  if (!activeInteraction) return null;

  const { date, time } = formatDateTime(activeInteraction.interactionDate);
  const moonIcon = activeInteraction.vibe ? moonPhaseIcons[activeInteraction.vibe as MoonPhase] : null;
  const isPast = new Date(activeInteraction.interactionDate) < new Date();
  const isPlanned = activeInteraction.status === 'planned' || activeInteraction.status === 'pending_confirm';

  // Handler for sharing the plan
  const handleShare = async () => {
    try {
      // Fetch the full Interaction model from database to pass to share function
      const interactionModel = await database.get<InteractionModel>('interactions').find(activeInteraction.id);
      const success = await shareInteractionAsICS(interactionModel);
      if (!success) {
        console.warn('Share was cancelled or failed');
      }
    } catch (error) {
      console.error('Error sharing interaction:', error);
    }
  };

  // Handle close completion - execute pending action
  const handleCloseComplete = () => {
    if (!activeInteraction) return;

    if (pendingActionRef.current === 'edit' && onEdit) {
      onEdit(activeInteraction);
    } else if (pendingActionRef.current === 'delete' && onDelete) {
      onDelete(activeInteraction.id);
    } else if (pendingActionRef.current === 'editReflection' && onEditReflection) {
      onEditReflection(activeInteraction);
    }
    pendingActionRef.current = null;
  };

  // Action handlers that set pending action and close via ref to trigger animation
  const handleEditPress = () => {
    pendingActionRef.current = 'edit';
    sheetRef.current?.close();
  };

  const handleDeletePress = () => {
    pendingActionRef.current = 'delete';
    sheetRef.current?.close();
  };

  const handleEditReflectionPress = () => {
    pendingActionRef.current = 'editReflection';
    sheetRef.current?.close();
  };

  // Get friendly label and icon for category (or fall back to activity)
  // Check if activity looks like a category ID (has a dash)
  const isCategory = activeInteraction.activity && activeInteraction.activity.includes('-');

  let displayLabel: string;
  let displayIcon: string;

  if (isCategory) {
    const categoryData = getCategoryMetadata(activeInteraction.activity as InteractionCategory);
    if (categoryData) {
      displayLabel = categoryData.label;
      displayIcon = categoryData.icon;
    } else {
      // Fallback if category not found
      displayLabel = activeInteraction.activity || 'Interaction';
      displayIcon = modeIcons[activeInteraction.mode as keyof typeof modeIcons] || '📅';
    }
  } else {
    // Old format - use mode icon and activity name
    displayLabel = activeInteraction.activity || 'Interaction';
    displayIcon = modeIcons[activeInteraction.mode as keyof typeof modeIcons] || '📅';
  }

  return (
    <AnimatedBottomSheet
      ref={sheetRef}
      visible={isOpen}
      onClose={onClose}
      height="form"
      onCloseComplete={handleCloseComplete}
    >
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerIcon}>{displayIcon}</Text>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>{displayLabel}</Text>
            <Text style={[styles.headerSubtitle, { color: colors['muted-foreground'] }]}>
              {activeInteraction.mode?.replace('-', ' ')} • {activeInteraction.interactionType}
            </Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.headerActions}>
          {isPlanned && (
            <TouchableOpacity
              onPress={handleShare}
              style={styles.actionButton}
            >
              <Share2 color={colors.primary} size={20} />
            </TouchableOpacity>
          )}
          {onEdit && (
            <TouchableOpacity
              onPress={handleEditPress}
              style={styles.actionButton}
            >
              <Edit3 color={colors.primary} size={20} />
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity
              onPress={handleDeletePress}
              style={styles.actionButton}
            >
              <Trash2 color={colors.destructive} size={20} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        <View style={[styles.statusBadge, activeInteraction.status === 'completed' ? styles.statusCompleted : styles.statusPlanned]}>
          <Text style={[styles.statusBadgeText, activeInteraction.status === 'completed' ? styles.statusCompletedText : styles.statusPlannedText]}>
            {activeInteraction.status === 'completed' ? '✓ Completed' : '⏳ Planned'}
          </Text>
        </View>

        <InfoRow icon={<Calendar color={colors['muted-foreground']} size={20} />} title={date} subtitle={time} colors={colors} />
        {participants.length > 0 && (
          <InfoRow
            icon={<Heart color={colors['muted-foreground']} size={20} />}
            title={participants.map(f => f.name).join(', ')}
            subtitle={participants.length === 1 ? 'With' : `With ${participants.length} friends`}
            colors={colors}
          />
        )}
        {isPast && moonIcon && <InfoRow icon={<Text style={{ fontSize: 24 }}>{moonIcon}</Text>} title={(activeInteraction.vibe || '').replace(/([A-Z])/g, ' $1').trim()} subtitle="Moon phase" colors={colors} />}
        {activeInteraction.location && <InfoRow icon={<MapPin color={colors['muted-foreground']} size={20} />} title={activeInteraction.location} subtitle="Location" colors={colors} />}

        {/* Reflection chips display */}
        {activeInteraction.reflection && (activeInteraction.reflection.chips?.length || activeInteraction.reflection.customNotes) && (
          <View style={[styles.reflectionSection, { backgroundColor: colors.muted + '80' }]}>
            <View style={styles.reflectionHeader}>
              <Sparkles color={colors.primary} size={16} />
              <Text style={[styles.reflectionHeaderText, { color: colors.foreground }]}>Reflection</Text>
            </View>

            {/* Story chips */}
            {activeInteraction.reflection.chips && activeInteraction.reflection.chips.length > 0 && (
              <View style={styles.reflectionChips}>
                {activeInteraction.reflection.chips.map((chip, index) => {
                  const storyChip = STORY_CHIPS.find(s => s.id === chip.chipId);
                  if (!storyChip) return null;

                  // Build the text with overrides
                  let text = storyChip.template;
                  if (storyChip.components) {
                    Object.entries(storyChip.components).forEach(([componentId, component]) => {
                      const value = chip.componentOverrides[componentId] || component.original;
                      text = text.replace(`{${componentId}}`, value);
                    });
                  }

                  return (
                    <View key={index} style={[styles.reflectionChip, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '40' }]}>
                      <Text style={[styles.reflectionChipText, { color: colors.foreground }]}>{text}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Custom notes */}
            {activeInteraction.reflection.customNotes && (
              <Text style={[styles.reflectionCustomNotes, { color: colors.foreground }]}>
                {activeInteraction.reflection.customNotes}
              </Text>
            )}
          </View>
        )}

        {activeInteraction.note && <InfoRow icon={<MessageCircle color={colors['muted-foreground']} size={20} />} title={activeInteraction.note} subtitle="Notes" colors={colors} />}
      </ScrollView>

      {/* Deepen Weave / Edit Reflection Button - Only for past interactions */}
      {onEditReflection && isPast && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.deepenButton, { backgroundColor: colors.primary }]}
            onPress={handleEditReflectionPress}
          >
            <Sparkles color={colors['primary-foreground']} size={20} />
            <Text style={[styles.deepenButtonText, { color: colors['primary-foreground'] }]}>
              {activeInteraction.reflection?.chips?.length ? 'Edit Reflection' : 'Deepen this weave'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </AnimatedBottomSheet>
  );
}

const InfoRow = ({ icon, title, subtitle, colors }: { icon: React.ReactNode, title: string, subtitle: string, colors: any }) => (
  <View style={[styles.infoRow, { backgroundColor: colors.muted + '80' }]}>
    <View style={{ width: 24, alignItems: 'center' }}>{icon}</View>
    <View style={{ flex: 1 }}>
      <Text style={[styles.infoSubtitle, { color: colors['muted-foreground'] }]}>{subtitle}</Text>
      <Text style={[styles.infoTitle, { color: colors.foreground }]}>{title}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
    height: '75%',
  },
  handleBarContainer: {
    padding: 16,
    alignItems: 'center',
  },
  handleBar: {
    width: 48,
    height: 6,
    borderRadius: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionButton: {
    padding: 8,
  },
  headerIcon: {
    fontSize: 32,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 14,
    textTransform: 'capitalize',
  },
  scrollViewContent: {
    padding: 24,
    gap: 24,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  statusCompleted: {
    backgroundColor: '#dcfce7',
  },
  statusPlanned: {
    backgroundColor: '#fef9c3',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusCompletedText: {
    color: '#166534',
  },
  statusPlannedText: {
    color: '#854d0e',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  infoSubtitle: {
    fontSize: 14,
  },
  infoTitle: {
    fontWeight: '500',
  },
  reflectionSection: {
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },
  reflectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  reflectionHeaderText: {
    fontSize: 14,
    fontWeight: '600',
  },
  reflectionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reflectionChip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  reflectionChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  reflectionCustomNotes: {
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  deepenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  deepenButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});