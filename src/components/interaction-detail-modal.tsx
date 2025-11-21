import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { X, Calendar, MapPin, Heart, MessageCircle, Sparkles, Edit3, Trash2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/shared/hooks/useTheme';
import { type Interaction, type MoonPhase, type InteractionCategory } from './types';
import { modeIcons } from '@/shared/constants/constants';
import { getCategoryMetadata } from '@/shared/constants/interaction-categories';
import { STORY_CHIPS } from '@/modules/reflection';

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
  onEdit?: (interactionId: string) => void;
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
  const translateY = useSharedValue(0);

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      translateY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if (event.translationY > 200) {
        runOnJS(onClose)();
      } else {
        translateY.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!interaction) return null;

  const { date, time } = formatDateTime(interaction.interactionDate);
  const moonIcon = interaction.vibe ? moonPhaseIcons[interaction.vibe as MoonPhase] : null;
  const isPast = new Date(interaction.interactionDate) < new Date();

  // Get friendly label and icon for category (or fall back to activity)
  // Check if activity looks like a category ID (has a dash)
  const isCategory = interaction.activity && interaction.activity.includes('-');

  let displayLabel: string;
  let displayIcon: string;

  if (isCategory) {
    const categoryData = getCategoryMetadata(interaction.activity as InteractionCategory);
    if (categoryData) {
      displayLabel = categoryData.label;
      displayIcon = categoryData.icon;
    } else {
      // Fallback if category not found
      displayLabel = interaction.activity || 'Interaction';
      displayIcon = modeIcons[interaction.mode as keyof typeof modeIcons] || modeIcons.default;
    }
  } else {
    // Old format - use mode icon and activity name
    displayLabel = interaction.activity || 'Interaction';
    displayIcon = modeIcons[interaction.mode as keyof typeof modeIcons] || modeIcons.default;
  }

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isOpen}
      onRequestClose={onClose}
    >
      <BlurView style={styles.backdrop} intensity={isDarkMode ? 10 : 30} tint={isDarkMode ? 'dark' : 'light'}>
        <GestureDetector gesture={pan}>
          <Animated.View style={[
            styles.modalContainer,
            {
              paddingBottom: insets.bottom,
              backgroundColor: isDarkMode ? colors.background + 'F0' : colors.background,
            },
            animatedStyle
          ]}>
            <View style={styles.handleBarContainer}>
              <View style={[styles.handleBar, { backgroundColor: colors.muted }]} />
            </View>

            <View style={styles.header}>
              <View style={styles.headerTitleContainer}>
                <Text style={styles.headerIcon}>{displayIcon}</Text>
                <View>
                  <Text style={[styles.headerTitle, { color: colors.foreground }]}>{displayLabel}</Text>
                  <Text style={[styles.headerSubtitle, { color: colors['muted-foreground'] }]}>
                    {interaction.mode?.replace('-', ' ')} • {interaction.type}
                  </Text>
                </View>
              </View>

              {/* Action buttons */}
              <View style={styles.headerActions}>
                {onEdit && (
                  <TouchableOpacity
                    onPress={() => {
                      onEdit(interaction.id);
                      onClose();
                    }}
                    style={styles.actionButton}
                  >
                    <Edit3 color={colors.primary} size={20} />
                  </TouchableOpacity>
                )}
                {onDelete && (
                  <TouchableOpacity
                    onPress={() => {
                      onDelete(interaction.id);
                      onClose();
                    }}
                    style={styles.actionButton}
                  >
                    <Trash2 color={colors.destructive} size={20} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={onClose} style={styles.actionButton}>
                  <X color={colors['muted-foreground']} size={24} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollViewContent}>
              <View style={[styles.statusBadge, interaction.status === 'completed' ? styles.statusCompleted : styles.statusPlanned]}>
                <Text style={[styles.statusBadgeText, interaction.status === 'completed' ? styles.statusCompletedText : styles.statusPlannedText]}>
                  {interaction.status === 'completed' ? '✓ Completed' : '⏳ Planned'}
                </Text>
              </View>

              <InfoRow icon={<Calendar color={colors['muted-foreground']} size={20} />} title={date} subtitle={time} colors={colors} />
              {friendName && <InfoRow icon={<Heart color={colors['muted-foreground']} size={20} />} title={friendName} subtitle="With" colors={colors} />}
              {isPast && moonIcon && <InfoRow icon={<Text style={{ fontSize: 24 }}>{moonIcon}</Text>} title={interaction.vibe?.replace(/([A-Z])/g, ' $1').trim()} subtitle="Moon phase" colors={colors} />}
              {interaction.location && <InfoRow icon={<MapPin color={colors['muted-foreground']} size={20} />} title={interaction.location} subtitle="Location" colors={colors} />}

              {/* Reflection chips display */}
              {interaction.reflection && (interaction.reflection.chips?.length || interaction.reflection.customNotes) && (
                <View style={[styles.reflectionSection, { backgroundColor: colors.muted + '80' }]}>
                  <View style={styles.reflectionHeader}>
                    <Sparkles color={colors.primary} size={16} />
                    <Text style={[styles.reflectionHeaderText, { color: colors.foreground }]}>Reflection</Text>
                  </View>

                  {/* Story chips */}
                  {interaction.reflection.chips && interaction.reflection.chips.length > 0 && (
                    <View style={styles.reflectionChips}>
                      {interaction.reflection.chips.map((chip, index) => {
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
                  {interaction.reflection.customNotes && (
                    <Text style={[styles.reflectionCustomNotes, { color: colors.foreground }]}>
                      {interaction.reflection.customNotes}
                    </Text>
                  )}
                </View>
              )}

              {interaction.notes && <InfoRow icon={<MessageCircle color={colors['muted-foreground']} size={20} />} title={interaction.notes} subtitle="Notes" colors={colors} />}
            </ScrollView>

            {/* Deepen Weave / Edit Reflection Button - Only for past interactions */}
            {onEditReflection && isPast && (
              <View style={[styles.footer, { paddingBottom: insets.bottom + 16, borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.deepenButton, { backgroundColor: colors.primary }]}
                  onPress={() => onEditReflection(interaction)}
                >
                  <Sparkles color={colors['primary-foreground']} size={20} />
                  <Text style={[styles.deepenButtonText, { color: colors['primary-foreground'] }]}>
                    {interaction.reflection?.chips?.length ? 'Edit Reflection' : 'Deepen this weave'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </GestureDetector>
      </BlurView>
    </Modal>
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