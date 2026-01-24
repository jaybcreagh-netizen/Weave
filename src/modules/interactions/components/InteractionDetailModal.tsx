import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, LayoutAnimation, Platform, ActivityIndicator } from 'react-native';
import { Calendar, MapPin, Heart, MessageCircle, Sparkles, Edit3, Trash2, Share2, Clock, X, Check } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/shared/hooks/useTheme';
import { StandardBottomSheet } from '@/shared/ui/Sheet';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Button } from '@/shared/ui/Button';
import { type Interaction, type MoonPhase, type InteractionCategory } from '../types';
import { InteractionShape } from '@/shared/types/derived';
import { modeIcons } from '@/shared/constants/constants';
import { getCategoryMetadata } from '@/shared/constants/interaction-categories';
import { Icon } from '@/shared/ui/Icon';
import { MoonPhaseIllustration } from '@/modules/intelligence';
import { STORY_CHIPS } from '@/modules/reflection';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import FriendModel from '@/db/models/Friend';
import InteractionModel from '@/db/models/Interaction';
import { shareInteractionAsICS } from '../services/calendar-export.service';
import { ShareStatusBadge, getShareStatus } from '@/modules/sync';
import { InviteFriendSheet } from './InviteFriendSheet';
import { generateInviteCode } from '../services/invite.service';

const MOON_PHASE_LEVELS: Record<MoonPhase, number> = {
  'NewMoon': 1,
  'WaxingCrescent': 2,
  'FirstQuarter': 3,
  'WaxingGibbous': 4,
  'FullMoon': 5,
  'WaningGibbous': 4,
  'LastQuarter': 3,
  'WaningCrescent': 2
};

const formatDateTime = (date: Date | string): { date: string; time: string } => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return {
    date: d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  };
};

interface InteractionDetailModalProps {
  interaction: Interaction | InteractionShape | null;
  isOpen: boolean;
  onClose: () => void;
  friendName?: string;
  onEditReflection?: (interaction: Interaction | InteractionShape) => void;
  onEdit?: (interaction: Interaction | InteractionShape) => void;

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
  const insets = useSafeAreaInsets();
  const { colors, isDarkMode } = useTheme();

  // Cache interaction to keep displaying it during close animation
  const [cachedInteraction, setCachedInteraction] = useState<Interaction | InteractionShape | null>(interaction);

  // Inline editing state
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  // Invite Logic
  // const [showInviteSheet, setShowInviteSheet] = useState(false); // Removed separate sheet
  const [friendToInvite, setFriendToInvite] = useState<FriendModel | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    if (interaction) {
      setCachedInteraction(interaction);
    }
  }, [interaction]);

  // Use cached version if current is null (during closing)
  const activeInteraction = interaction || cachedInteraction;

  const [participants, setParticipants] = useState<FriendModel[]>([]);
  const [shareStatus, setShareStatus] = useState<{
    isShared: boolean;
    status?: 'pending' | 'accepted' | 'declined' | 'expired';
  }>({ isShared: false });

  // Fetch all participants for this interaction
  useEffect(() => {
    if (!activeInteraction || !activeInteraction.id) {
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


  // Determine if we should show the invite button
  // Show if:
  // 1. We have participants
  // 2. At least one participant is NOT linked (no linkedUserId) 
  // For MVP: If multiple unlinked, we'll just pick the first one or logic could be improved
  useEffect(() => {
    if (participants.length > 0) {
      // Find the first unlinked friend
      const unlinked = participants.find(p => !p.linkedUserId);
      setFriendToInvite(unlinked || null);
    } else {
      setFriendToInvite(null);
    }
  }, [participants]);

  // Fetch share status
  useEffect(() => {
    if (!activeInteraction) {
      setShareStatus({ isShared: false });
      return;
    }
    getShareStatus(activeInteraction.id).then(setShareStatus);
  }, [activeInteraction]);

  if (!activeInteraction) return null;

  const { date, time } = formatDateTime(activeInteraction.interactionDate);
  const moonLevel = activeInteraction.vibe ? MOON_PHASE_LEVELS[activeInteraction.vibe as MoonPhase] : null;
  const isPast = new Date(activeInteraction.interactionDate) < new Date();
  const isPlanned = activeInteraction.status === 'planned' || activeInteraction.status === 'pending_confirm';

  // Handler for sharing the plan
  const handleShare = async () => {
    try {
      setIsSharing(true);
      // Fetch the full Interaction model
      const interactionModel = await database.get<InteractionModel>('interactions').find(activeInteraction.id);

      let code: string | undefined = undefined;

      // If we have an unlinked friend to invite, generate a code
      if (friendToInvite) {
        const generated = await generateInviteCode(friendToInvite.id, friendToInvite.name, interactionModel);
        if (generated) code = generated.code;
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

  // Action handlers now trigger immediately and close the sheet
  const handleEditPress = () => {
    if (activeInteraction && onEdit) {
      onEdit(activeInteraction);
      onClose();
    }
  };

  const handleDeletePress = () => {
    if (activeInteraction && onDelete) {
      onDelete(activeInteraction.id);
      onClose();
    }
  };

  const handleEditReflectionPress = () => {
    if (activeInteraction && onEditReflection) {
      onEditReflection(activeInteraction);
      onClose();
    }
  };

  // Get friendly label and icon for category (or fall back to activity)
  // Check if activity looks like a category ID (has a dash)
  const isCategory = activeInteraction.activity && activeInteraction.activity.includes('-');

  let displayLabel: string;
  let DisplayIcon: React.ElementType | null = null;
  let displayIconName: string | null = null;

  // Save Date Handler
  const handleSaveDate = async () => {
    if (activeInteraction && onUpdate && tempDate) {
      // Optimistic update
      setCachedInteraction({
        ...activeInteraction,
        interactionDate: tempDate
      } as Interaction | InteractionShape);

      // Close inline edit
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIsEditingDate(false);

      // Perform update
      await onUpdate(activeInteraction.id, { interactionDate: tempDate });
    }
  };

  if (isCategory) {
    const categoryData = getCategoryMetadata(activeInteraction.activity as InteractionCategory);
    if (categoryData) {
      displayLabel = categoryData.label;
      DisplayIcon = categoryData.iconComponent;
    } else {
      // Fallback if category not found
      displayLabel = activeInteraction.activity || 'Interaction';
      displayIconName = modeIcons[activeInteraction.mode as keyof typeof modeIcons] || 'Calendar';
    }
  } else {
    // Old format - use mode icon and activity name
    displayLabel = activeInteraction.activity || 'Interaction';
    displayIconName = modeIcons[activeInteraction.mode as keyof typeof modeIcons] || 'Calendar';
  }

  return (
    <>
      <StandardBottomSheet
        visible={isOpen}
        onClose={onClose}
        snapPoints={['85%']}
        scrollable={false} // We manage scrolling internally with BottomSheetScrollView
      >
        <View className="flex-row justify-between items-start px-6 pt-6">
          <View className="flex-1 flex-row items-center gap-3 mb-2">
            {DisplayIcon ? (
              <DisplayIcon size={32} color={colors.foreground} />
            ) : (
              <Icon name={(displayIconName || 'Calendar') as any} size={32} color={colors.foreground} />
            )}
            <View>
              <Text
                className="text-2xl font-semibold"
                style={{ color: colors.foreground }}
              >
                {displayLabel}
              </Text>
              <Text
                className="text-sm capitalize"
                style={{ color: colors['muted-foreground'] }}
              >
                {activeInteraction.mode?.replace('-', ' ')} • {activeInteraction.interactionType}
              </Text>
            </View>
          </View>

          {/* Action buttons */}
          <View className="flex-row items-center gap-1">
            {isPlanned && (
              <TouchableOpacity
                onPress={handleShare}
                className="p-2"
                disabled={isSharing}
              >
                {isSharing ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Share2 color={colors.primary} size={20} />
                )}
              </TouchableOpacity>
            )}
            {onEdit && (
              <TouchableOpacity
                onPress={handleEditPress}
                className="p-2"
              >
                <Edit3 color={colors.primary} size={20} />
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity
                onPress={handleDeletePress}
                className="p-2"
              >
                <Trash2 color={colors.destructive} size={20} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <BottomSheetScrollView
          contentContainerStyle={{ padding: 24, gap: 24 }}
          style={{ flex: 1 }}
        >
          <View className="flex-row items-center gap-2">
            <View
              className="self-start px-3 py-1.5 rounded-full"
              style={{
                backgroundColor: activeInteraction.status === 'completed' ? '#dcfce7' : '#fef9c3'
              }}
            >
              <Text
                className="text-xs font-medium"
                style={{
                  color: activeInteraction.status === 'completed' ? '#166534' : '#854d0e'
                }}
              >
                {activeInteraction.status === 'completed' ? '✓ Completed' : '⏳ Planned'}
              </Text>
            </View>
            {shareStatus.isShared && shareStatus.status && (
              <View className="flex-row items-center gap-1.5 px-2 py-1 rounded-full" style={{ backgroundColor: colors.muted }}>
                <ShareStatusBadge status={shareStatus.status} size="small" />
                <Text className="text-xs" style={{ color: colors['muted-foreground'] }}>Shared</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            onPress={() => {
              if (isPlanned && onUpdate && activeInteraction) {
                if (!isEditingDate) {
                  // Enter edit mode
                  setTempDate(new Date(activeInteraction.interactionDate));
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setIsEditingDate(true);
                } else {
                  // Close edit mode without saving? Or maybe just toggle?
                  // Let's toggle off on press if already open (cancel)
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setIsEditingDate(false);
                }
              }
            }}
            disabled={!isPlanned || !onUpdate}
            activeOpacity={0.7}
          >
            <InfoRow
              icon={<Calendar color={colors['muted-foreground']} size={20} />}
              title={date}
              subtitle={time}
              colors={colors}
              isEditable={isPlanned && !!onUpdate && !isEditingDate}
            />
          </TouchableOpacity>

          {/* Inline Date Picker */}
          {isEditingDate && (
            <View
              className="rounded-2xl -mt-4 p-4 gap-4"
              style={{
                backgroundColor: colors.muted + '40',
                borderWidth: 1,
                borderColor: colors.border
              }}
            >
              <DateTimePicker
                value={tempDate}
                mode="datetime"
                display="spinner"
                onChange={(event, selectedDate) => {
                  if (selectedDate) setTempDate(selectedDate);
                }}
                textColor={colors.foreground}
                style={{ height: 180 }}
              />

              <View className="flex-row gap-3">
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
                    icon={<Check size={16} color="white" />}
                  />
                </View>
              </View>
            </View>
          )}
          {participants.length > 0 && (
            <InfoRow
              icon={<Heart color={colors['muted-foreground']} size={20} />}
              title={participants.map(f => f.name).join(', ')}
              subtitle={participants.length === 1 ? 'With' : `With ${participants.length} friends`}
              colors={colors}
            />
          )}
          {isPast && moonLevel && <InfoRow icon={<MoonPhaseIllustration phase={0} size={24} batteryLevel={moonLevel} hasCheckin={true} />} title={(activeInteraction.vibe || '').replace(/([A-Z])/g, ' $1').trim()} subtitle="Moon phase" colors={colors} />}
          {activeInteraction.location && <InfoRow icon={<MapPin color={colors['muted-foreground']} size={20} />} title={activeInteraction.location} subtitle="Location" colors={colors} />}

          {/* Reflection chips display */}
          {activeInteraction.reflection && (activeInteraction.reflection.chips?.length || activeInteraction.reflection.customNotes) && (
            <View
              className="p-4 rounded-2xl gap-3"
              style={{ backgroundColor: colors.muted + '80' }}
            >
              <View className="flex-row items-center gap-2 mb-1">
                <Sparkles color={colors.primary} size={16} />
                <Text
                  className="text-sm font-semibold"
                  style={{ color: colors.foreground }}
                >
                  Reflection
                </Text>
              </View>

              {/* Story chips */}
              {activeInteraction.reflection.chips && activeInteraction.reflection.chips.length > 0 && (
                <View className="flex-row flex-wrap gap-2">
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
                      <View
                        key={index}
                        className="border rounded-2xl px-3 py-1.5"
                        style={{
                          backgroundColor: colors.primary + '20',
                          borderColor: colors.primary + '40'
                        }}
                      >
                        <Text
                          className="text-[13px] font-medium"
                          style={{ color: colors.foreground }}
                        >
                          {text}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Custom notes */}
              {activeInteraction.reflection.customNotes && (
                <Text
                  className="text-sm leading-5 italic"
                  style={{ color: colors.foreground }}
                >
                  {activeInteraction.reflection.customNotes}
                </Text>
              )}
            </View>
          )}

          {activeInteraction.note && <InfoRow icon={<MessageCircle color={colors['muted-foreground']} size={20} />} title={activeInteraction.note} subtitle="Notes" colors={colors} />}
        </BottomSheetScrollView>

        {/* Deepen Weave / Edit Reflection Button - Only for past interactions */}
        {onEditReflection && isPast && (
          <View
            className="px-6 pt-4 border-t"
            style={{
              paddingBottom: insets.bottom + 16,
              borderTopColor: colors.border
            }}
          >
            <TouchableOpacity
              className="flex-row items-center justify-center gap-2 p-4 rounded-xl shadow-sm"
              style={{
                backgroundColor: colors.primary,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 12,
                elevation: 8,
              }}
              onPress={handleEditReflectionPress}
            >
              <Sparkles color={colors['primary-foreground']} size={20} />
              <Text
                className="text-base font-semibold"
                style={{ color: colors['primary-foreground'] }}
              >
                {activeInteraction.reflection?.chips?.length ? 'Edit Reflection' : 'Deepen this weave'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </StandardBottomSheet>



    </>
  );
}

const InfoRow = ({ icon, title, subtitle, colors, isEditable }: { icon: React.ReactNode, title: string, subtitle: string, colors: any, isEditable?: boolean }) => (
  <View
    className="flex-row items-start gap-3 p-4 rounded-2xl shadow-sm"
    style={{
      backgroundColor: colors.muted + '80',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 4,
      borderWidth: isEditable ? 1 : 0,
      borderColor: isEditable ? colors.primary + '40' : 'transparent',
    }}
  >
    <View className="w-6 items-center">{icon}</View>
    <View className="flex-1">
      <Text
        className="text-sm"
        style={{ color: colors['muted-foreground'] }}
      >
        {subtitle} {isEditable && <Text style={{ color: colors.primary }}>(Tap to change)</Text>}
      </Text>
      <Text
        className="font-medium"
        style={{ color: colors.foreground }}
      >
        {title}
      </Text>
    </View>
    {isEditable && <Edit3 size={16} color={colors.primary} style={{ opacity: 0.7 }} />}
  </View>
);