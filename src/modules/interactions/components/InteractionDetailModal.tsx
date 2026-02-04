import React, { useEffect, useState } from 'react';
import { View, LayoutAnimation, Platform, ActivityIndicator, TouchableOpacity, Pressable } from 'react-native';
import {
  Calendar,
  MapPin,
  Heart,
  MessageCircle,
  Sparkles,
  Edit3,
  Trash2,
  Share2,
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useTheme } from '@/shared/hooks/useTheme';
import { StandardBottomSheet } from '@/shared/ui/Sheet';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Text } from '@/shared/ui/Text';
import { InteractionShape } from '@/shared/types/derived';
import { modeIcons } from '@/shared/constants/constants';
import { getCategoryMetadata } from '@/shared/constants/interaction-categories';
import { type Interaction, type MoonPhase, type InteractionCategory } from '../types';
import { MoonPhaseIllustration } from '@/modules/intelligence';
import { STORY_CHIPS } from '@/modules/reflection';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import FriendModel from '@/db/models/Friend';
import InteractionModel from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import { shareInteractionAsICS } from '../services/calendar-export.service';
import { ShareStatusBadge, getShareStatus } from '@/modules/sync';
import { generateInviteCode } from '../services/invite.service';

const MOON_PHASE_LEVELS: Record<MoonPhase, number> = {
  NewMoon: 1,
  WaxingCrescent: 2,
  FirstQuarter: 3,
  WaxingGibbous: 4,
  FullMoon: 5,
  WaningGibbous: 4,
  LastQuarter: 3,
  WaningCrescent: 2,
};

const STATUS_LABELS: Record<string, string> = {
  completed: 'Completed',
  planned: 'Planned',
  pending_confirm: 'Awaiting confirmation',
  cancelled: 'Cancelled',
  missed: 'Missed',
};

type ThemeColors = ReturnType<typeof useTheme>['colors'];

type InteractionLike = Interaction | InteractionShape;

type ShareState = {
  isShared: boolean;
  status?: 'pending' | 'accepted' | 'declined' | 'expired';
};

type ReflectionChipData = {
  chipId: string;
  componentOverrides: Record<string, string>;
};

const formatDateTime = (date: Date | string): { date: string; time: string } => {
  const d = typeof date === 'string' ? new Date(date) : date;

  return {
    date: d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    time: d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }),
  };
};

const formatMode = (mode?: string) => {
  if (!mode) return 'General weave';
  return mode
    .replace(/[-_]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const formatMoonPhase = (phase: MoonPhase) => phase.replace(/([A-Z])/g, ' $1').trim();

const getStatusPillColors = (status: string, colors: ThemeColors) => {
  switch (status) {
    case 'completed':
      return {
        bg: colors.success + '20',
        border: colors.success + '55',
        text: colors.success,
      };
    case 'cancelled':
    case 'missed':
      return {
        bg: colors.destructive + '20',
        border: colors.destructive + '45',
        text: colors.destructive,
      };
    default:
      return {
        bg: colors.warning + '20',
        border: colors.warning + '45',
        text: colors.warning,
      };
  }
};

const getChipText = (chip: ReflectionChipData) => {
  const storyChip = STORY_CHIPS.find((item) => item.id === chip.chipId);
  if (!storyChip) return null;

  let text = storyChip.template;

  if (storyChip.components) {
    Object.entries(storyChip.components).forEach(([componentId, component]) => {
      const value = chip.componentOverrides[componentId] || component.original;
      text = text.replace(`{${componentId}}`, value);
    });
  }

  return text;
};

const isPlannedStatus = (status?: string) => status === 'planned' || status === 'pending_confirm';

interface InteractionDetailModalProps {
  interaction: InteractionLike | null;
  isOpen: boolean;
  onClose: () => void;
  friendName?: string;
  onEditReflection?: (interaction: InteractionLike) => void;
  onEdit?: (interaction: InteractionLike) => void;
  onDelete?: (interactionId: string) => void;
  onUpdate?: (interactionId: string, updates: Partial<Interaction>) => Promise<void>;
}

export function InteractionDetailModal({
  interaction,
  isOpen,
  onClose,
  friendName,
  onEditReflection,
  onEdit,
  onDelete,
  onUpdate,
}: InteractionDetailModalProps) {
  const { colors } = useTheme();

  // Keep rendering data while the close animation runs.
  const [cachedInteraction, setCachedInteraction] = useState<InteractionLike | null>(interaction);

  // Inline date editing state.
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  // Sharing state.
  const [friendToInvite, setFriendToInvite] = useState<FriendModel | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [participants, setParticipants] = useState<FriendModel[]>([]);
  const [shareStatus, setShareStatus] = useState<ShareState>({ isShared: false });

  useEffect(() => {
    if (interaction) {
      setCachedInteraction(interaction);
      setIsEditingDate(false);
    }
  }, [interaction]);

  const activeInteraction = interaction || cachedInteraction;
  const interactionId = activeInteraction?.id;

  useEffect(() => {
    if (!interactionId) {
      setParticipants([]);
      return;
    }

    let cancelled = false;

    const fetchParticipants = async () => {
      try {
        const joinRecords = await database
          .get<InteractionFriend>('interaction_friends')
          .query(Q.where('interaction_id', interactionId))
          .fetch();

        if (joinRecords.length === 0) {
          if (!cancelled) setParticipants([]);
          return;
        }

        const friendIds = joinRecords.map((record) => record.friendId);

        const friends = await database
          .get<FriendModel>('friends')
          .query(Q.where('id', Q.oneOf(friendIds)))
          .fetch();

        if (!cancelled) {
          setParticipants(friends);
        }
      } catch (error) {
        console.error('Error fetching participants:', error);
        if (!cancelled) {
          setParticipants([]);
        }
      }
    };

    fetchParticipants();

    return () => {
      cancelled = true;
    };
  }, [interactionId]);

  useEffect(() => {
    if (participants.length === 0) {
      setFriendToInvite(null);
      return;
    }

    const unlinked = participants.find((participant) => !participant.linkedUserId);
    setFriendToInvite(unlinked || null);
  }, [participants]);

  useEffect(() => {
    if (!interactionId) {
      setShareStatus({ isShared: false });
      return;
    }

    let cancelled = false;

    getShareStatus(interactionId)
      .then((status) => {
        if (!cancelled) {
          setShareStatus(status);
        }
      })
      .catch((error) => {
        console.error('Error fetching share status:', error);
        if (!cancelled) {
          setShareStatus({ isShared: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [interactionId]);

  if (!activeInteraction) return null;

  const { date, time } = formatDateTime(activeInteraction.interactionDate);
  const moonLevel = activeInteraction.vibe
    ? MOON_PHASE_LEVELS[activeInteraction.vibe as MoonPhase]
    : null;

  const isPast = new Date(activeInteraction.interactionDate) < new Date();
  const isPlanned = isPlannedStatus(activeInteraction.status);

  const isCategory =
    !!activeInteraction.activity &&
    typeof activeInteraction.activity === 'string' &&
    activeInteraction.activity.includes('-');

  let displayLabel: string;
  let DisplayIcon: React.ElementType | null = null;
  let displayIconName: string | null = null;

  if (isCategory) {
    const categoryData = getCategoryMetadata(activeInteraction.activity as InteractionCategory);

    if (categoryData) {
      displayLabel = categoryData.label;
      DisplayIcon = categoryData.iconComponent;
    } else {
      displayLabel = activeInteraction.activity || 'Interaction';
      displayIconName = modeIcons[activeInteraction.mode as keyof typeof modeIcons] || 'Calendar';
    }
  } else {
    displayLabel = activeInteraction.activity || 'Interaction';
    displayIconName = modeIcons[activeInteraction.mode as keyof typeof modeIcons] || 'Calendar';
  }

  const participantValue =
    participants.length > 0
      ? participants.map((participant) => participant.name).join(', ')
      : friendName || '';

  const hasReflection =
    !!activeInteraction.reflection &&
    !!(activeInteraction.reflection.chips?.length || activeInteraction.reflection.customNotes);

  const statusLabel = STATUS_LABELS[activeInteraction.status] || activeInteraction.status;
  const statusStyles = getStatusPillColors(activeInteraction.status, colors);

  const handleShare = async () => {
    try {
      setIsSharing(true);

      const interactionModel = await database
        .get<InteractionModel>('interactions')
        .find(activeInteraction.id);

      let code: string | undefined;

      if (friendToInvite) {
        const generated = await generateInviteCode(
          friendToInvite.id,
          friendToInvite.name,
          interactionModel
        );
        if (generated) {
          code = generated.code;
        }
      }

      const success = await shareInteractionAsICS(interactionModel, code);
      if (!success) {
        console.warn('Share was cancelled or failed');
      }
    } catch (error) {
      console.error('Error sharing interaction:', error);
    } finally {
      setIsSharing(false);
    }
  };

  const handleEditPress = () => {
    if (!onEdit) return;
    onEdit(activeInteraction);
    onClose();
  };

  const handleDeletePress = () => {
    if (!onDelete) return;
    onDelete(activeInteraction.id);
    onClose();
  };

  const handleEditReflectionPress = () => {
    if (!onEditReflection) return;
    onEditReflection(activeInteraction);
    onClose();
  };

  const toggleDateEdit = () => {
    if (!isPlanned || !onUpdate) return;

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    if (!isEditingDate) {
      setTempDate(new Date(activeInteraction.interactionDate));
      setIsEditingDate(true);
      return;
    }

    setIsEditingDate(false);
  };

  const handleSaveDate = async () => {
    if (!activeInteraction || !onUpdate) return;

    setCachedInteraction({
      ...activeInteraction,
      interactionDate: tempDate,
    } as InteractionLike);

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsEditingDate(false);

    await onUpdate(activeInteraction.id, { interactionDate: tempDate });
  };

  const actions = [
    isPlanned
      ? {
          key: 'share',
          label: 'Share',
          icon: <Share2 size={16} color={colors.primary} />,
          onPress: handleShare,
          loading: isSharing,
          tint: colors.primary,
          background: colors.primary + '15',
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    icon: React.ReactNode;
    onPress: () => void;
    tint: string;
    background: string;
    loading?: boolean;
  }>;

  const footerComponent = onEditReflection && isPast
    ? (
      <Button
        label={activeInteraction.reflection?.chips?.length ? 'Edit Reflection' : 'Deepen this weave'}
        variant="primary"
        size="lg"
        fullWidth
        onPress={handleEditReflectionPress}
        icon={<Sparkles size={18} color={colors['primary-foreground']} />}
      />
    )
    : undefined;

  return (
    <>
      <StandardBottomSheet
        visible={isOpen}
        onClose={onClose}
        snapPoints={['88%']}
        scrollable
        footerComponent={footerComponent}
        titleComponent={<View />}
        headerLeft={
          onDelete ? (
            <Pressable
              onPress={handleDeletePress}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Delete interaction"
              style={({ pressed }) => ({
                padding: 8,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Trash2 size={22} color={colors.destructive} />
            </Pressable>
          ) : undefined
        }
      >
        <View className="px-1 pb-4">
            {/* Hero */}
            <View className="pt-1 pb-6">
              <View className="w-16 h-16 rounded-2xl items-center justify-center mb-4" style={{ backgroundColor: colors.muted }}>
                {DisplayIcon ? (
                  <DisplayIcon size={28} color={colors.foreground} />
                ) : (
                  <Icon
                    name={(displayIconName || 'Calendar') as any}
                    size={28}
                    color={colors.foreground}
                  />
                )}
              </View>

              <Text
                variant="h3"
                weight="bold"
                style={{ color: colors.foreground }}
              >
                {activeInteraction.title || displayLabel}
              </Text>

              <Text
                variant="caption"
                className="mt-1"
                style={{ color: colors['muted-foreground'] }}
              >
                {(isCategory ? 'Category' : 'Activity') + ': ' + displayLabel + ' • ' + formatMode(activeInteraction.mode)}
              </Text>

              <View className="flex-row flex-wrap items-center gap-2 mt-4">
                <View
                  className="px-2.5 py-1 rounded-full border"
                  style={{
                    backgroundColor: statusStyles.bg,
                    borderColor: statusStyles.border,
                  }}
                >
                  <Text
                    variant="caption"
                    weight="semibold"
                    style={{ color: statusStyles.text }}
                  >
                    {statusLabel}
                  </Text>
                </View>

                {shareStatus.isShared && shareStatus.status && (
                  <View
                    className="flex-row items-center gap-1.5 px-2 py-1 rounded-full border"
                    style={{
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    }}
                  >
                    <ShareStatusBadge status={shareStatus.status} />
                    <Text variant="caption" style={{ color: colors['muted-foreground'] }}>
                      Shared
                    </Text>
                  </View>
                )}

                {onEdit && (
                  <Pressable
                    onPress={handleEditPress}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="Edit interaction"
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 9999,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: pressed ? colors.muted : colors.background,
                    })}
                  >
                    <Edit3 size={14} color={colors.primary} />
                    <Text variant="caption" weight="medium" style={{ color: colors.primary }}>
                      Edit
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>

            {actions.length > 0 && (
              <View className={`mb-6 ${actions.length > 1 ? 'flex-row gap-2' : ''}`}>
                {actions.map((action) => (
                  <View key={action.key} className={actions.length > 1 ? 'flex-1' : ''}>
                    <ActionCard
                      icon={action.icon}
                      label={action.label}
                      onPress={action.onPress}
                      tint={action.tint}
                      background={action.background}
                      loading={action.loading}
                      colors={colors}
                    />
                  </View>
                ))}
              </View>
            )}

            {/* Details */}
            <View className="mb-6">
              <Text
                variant="label"
                className="mb-2"
                style={{ color: colors['muted-foreground'] }}
              >
                Details
              </Text>

              <View
                className="rounded-2xl border overflow-hidden"
                style={{
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                }}
              >
                <InfoRow
                  icon={<Calendar size={18} color={colors['muted-foreground']} />}
                  label="Date & time"
                  value={`${date} at ${time}`}
                  colors={colors}
                  onPress={isPlanned && onUpdate ? toggleDateEdit : undefined}
                  isEditable={isPlanned && !!onUpdate && !isEditingDate}
                />

                {isEditingDate && (
                  <View
                    className="px-4 py-3 border-t"
                    style={{
                      borderTopColor: colors.border,
                      backgroundColor: colors.muted + '45',
                    }}
                  >
                    <DateTimePicker
                      value={tempDate}
                      mode="datetime"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(_, selectedDate) => {
                        if (selectedDate) {
                          setTempDate(selectedDate);
                        }
                      }}
                      {...(Platform.OS === 'ios' ? { textColor: colors.foreground } : {})}
                      style={Platform.OS === 'ios' ? { height: 170 } : undefined}
                    />

                    <View className="flex-row gap-3 mt-3">
                      <View className="flex-1">
                        <Button
                          label="Cancel"
                          variant="ghost"
                          size="sm"
                          onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setIsEditingDate(false);
                          }}
                        />
                      </View>

                      <View className="flex-1">
                        <Button
                          label="Save"
                          variant="primary"
                          size="sm"
                          onPress={handleSaveDate}
                        />
                      </View>
                    </View>
                  </View>
                )}

                {!!participantValue && (
                  <>
                    <RowDivider colors={colors} />
                    <InfoRow
                      icon={<Heart size={18} color={colors['muted-foreground']} />}
                      label="With"
                      value={participantValue}
                      colors={colors}
                    />
                  </>
                )}

                {moonLevel && activeInteraction.vibe && (
                  <>
                    <RowDivider colors={colors} />
                    <InfoRow
                      icon={<MoonPhaseIllustration phase={moonLevel / 5} size={18} />}
                      label="Vibe"
                      value={formatMoonPhase(activeInteraction.vibe as MoonPhase)}
                      colors={colors}
                    />
                  </>
                )}

                {!!activeInteraction.location && (
                  <>
                    <RowDivider colors={colors} />
                    <InfoRow
                      icon={<MapPin size={18} color={colors['muted-foreground']} />}
                      label="Location"
                      value={activeInteraction.location}
                      colors={colors}
                    />
                  </>
                )}

                {!!activeInteraction.note && (
                  <>
                    <RowDivider colors={colors} />
                    <InfoRow
                      icon={<MessageCircle size={18} color={colors['muted-foreground']} />}
                      label="Notes"
                      value={activeInteraction.note}
                      colors={colors}
                      multiline
                    />
                  </>
                )}
              </View>
            </View>

            {/* Reflection */}
            {hasReflection && (
              <View>
                <Text
                  variant="label"
                  className="mb-2"
                  style={{ color: colors['muted-foreground'] }}
                >
                  Reflection
                </Text>

                <View
                  className="rounded-2xl border p-4"
                  style={{
                    borderColor: colors.border,
                    backgroundColor: colors.muted + '35',
                  }}
                >
                  {!!activeInteraction.reflection?.chips?.length && (
                    <View className="flex-row flex-wrap gap-2">
                      {activeInteraction.reflection.chips.map((chip, index) => {
                        const text = getChipText(chip as ReflectionChipData);
                        if (!text) return null;

                        return (
                          <View
                            key={`${chip.chipId}-${index}`}
                            className="px-3 py-1.5 rounded-full border"
                            style={{
                              borderColor: colors.border,
                              backgroundColor: colors.background,
                            }}
                          >
                            <Text
                              variant="caption"
                              weight="medium"
                              style={{ color: colors.foreground }}
                            >
                              {text}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {!!activeInteraction.reflection?.customNotes && (
                    <View
                      className={`flex-row gap-2 ${activeInteraction.reflection?.chips?.length ? 'mt-3' : ''}`}
                    >
                      <View className="w-0.5 rounded-full" style={{ backgroundColor: colors.primary + '70' }} />
                      <Text
                        variant="body"
                        className="flex-1 italic"
                        style={{ color: colors.foreground }}
                      >
                        {`"${activeInteraction.reflection.customNotes}"`}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
      </StandardBottomSheet>
    </>
  );
}

function RowDivider({ colors }: { colors: ThemeColors }) {
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
}

interface ActionCardProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  tint: string;
  background: string;
  loading?: boolean;
  colors: ThemeColors;
}

function ActionCard({
  icon,
  label,
  onPress,
  tint,
  background,
  loading,
  colors,
}: ActionCardProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.7}
      className="rounded-xl border px-3 py-3 flex-row items-center justify-center gap-2"
      style={{
        borderColor: colors.border,
        backgroundColor: colors.card,
        opacity: loading ? 0.7 : 1,
      }}
    >
      <View
        className="w-7 h-7 rounded-full items-center justify-center"
        style={{ backgroundColor: background }}
      >
        {loading ? <ActivityIndicator size="small" color={tint} /> : icon}
      </View>
      <Text variant="caption" weight="semibold" style={{ color: tint }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  colors: ThemeColors;
  isEditable?: boolean;
  onPress?: () => void;
  multiline?: boolean;
}

function InfoRow({ icon, label, value, colors, isEditable, onPress, multiline }: InfoRowProps) {
  const content = (
    <>
      <View className="w-7 items-center justify-start pt-0.5">{icon}</View>

      <View className="flex-1">
        <Text
          variant="label"
          style={{ color: colors['muted-foreground'] }}
        >
          {label}
        </Text>
        <Text
          variant="body"
          weight="medium"
          className="mt-0.5"
          style={{ color: colors.foreground }}
          numberOfLines={multiline ? undefined : 3}
        >
          {value}
        </Text>
      </View>

      {isEditable && (
        <View
          className="px-2 py-1 rounded-md flex-row items-center gap-1"
          style={{ backgroundColor: colors.primary + '12' }}
        >
          <Edit3 size={12} color={colors.primary} />
          <Text
            variant="caption"
            weight="semibold"
            style={{ color: colors.primary }}
          >
            Edit
          </Text>
        </View>
      )}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        className="flex-row items-start px-4 py-3.5 gap-3"
        activeOpacity={0.7}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return <View className="flex-row items-start px-4 py-3.5 gap-3">{content}</View>;
}
