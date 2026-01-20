import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Calendar, MapPin, Heart, MessageCircle, Sparkles, Edit3, Trash2, Share2, Clock } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/shared/hooks/useTheme';
import { AnimatedBottomSheet, AnimatedBottomSheetRef } from '@/shared/ui/Sheet';
import { CustomCalendar } from '@/shared/components/CustomCalendar';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BlurView } from 'expo-blur';
import { StyleSheet, Platform, Modal } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Button } from '@/shared/ui/Button';
import { type Interaction, type MoonPhase, type InteractionCategory } from '../types';
import { InteractionShape } from '@/shared/types/derived';
import { modeIcons } from '@/shared/constants/constants';
import { getCategoryMetadata } from '@/shared/constants/interaction-categories';
import { Icon } from '@/shared/ui/Icon';
import { MoonPhaseIllustration } from '@/modules/intelligence/components/social-season/YearInMoons/MoonPhaseIllustration';
import { STORY_CHIPS } from '@/modules/reflection/services/story-chips.service';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import FriendModel from '@/db/models/Friend';
import InteractionModel from '@/db/models/Interaction';
import { shareInteractionAsICS } from '../services/calendar-export.service';
import { ShareStatusBadge, getShareStatus } from '@/modules/sync';
import { InviteFriendSheet } from './InviteFriendSheet';
import { Ticket } from 'lucide-react-native';

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

  // Ref to control the sheet animation
  const sheetRef = useRef<AnimatedBottomSheetRef>(null);

  // Cache interaction to keep displaying it during close animation
  const [cachedInteraction, setCachedInteraction] = useState<Interaction | InteractionShape | null>(interaction);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date | null>(null);

  // Invite Logic
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [friendToInvite, setFriendToInvite] = useState<FriendModel | null>(null);

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
  const [shareStatus, setShareStatus] = useState<{
    isShared: boolean;
    status?: 'pending' | 'accepted' | 'declined' | 'expired';
  }>({ isShared: false });

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
  let DisplayIcon: React.ElementType | null = null;
  let displayIconName: string | null = null;

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
      <AnimatedBottomSheet
        ref={sheetRef}
        visible={isOpen}
        onClose={onClose}
        height="form"
        onCloseComplete={handleCloseComplete}
      >
        <View className="flex-row justify-between items-start px-6 pt-2">
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
            {/* Invite Button for unlinked friends */}
            {isPlanned && friendToInvite && (
              <TouchableOpacity
                onPress={() => setShowInviteSheet(true)}
                className="p-2"
              >
                <Ticket color={colors.primary} size={20} />
              </TouchableOpacity>
            )}

            {isPlanned && (
              <TouchableOpacity
                onPress={handleShare}
                className="p-2"
              >
                <Share2 color={colors.primary} size={20} />
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

        <ScrollView contentContainerStyle={{ padding: 24, gap: 24 }}>
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
              if (activeInteraction && onUpdate && isPlanned) {
                setTempDate(new Date(activeInteraction.interactionDate));
                setShowDatePicker(true);
              }
            }}
            // Disable if not planned or no update capability
            // BUT: If the user expects to 'Tap to change', we should probably show a message or just not disable opacity so much if it's confusing.
            // For now, keeping logic but relying on correct props.
            disabled={!isPlanned || !onUpdate}
          >
            <InfoRow
              icon={<Calendar color={colors['muted-foreground']} size={20} />}
              title={date}
              subtitle={time}
              colors={colors}
              isEditable={isPlanned && !!onUpdate}
            />
          </TouchableOpacity>
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
        </ScrollView>

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
      </AnimatedBottomSheet>

      {/* Date Picker Modal */}
      {
        showDatePicker && (
          <Modal
            key="reschedule-modal"
            visible={true}
            transparent
            animationType="fade"
            onRequestClose={() => setShowDatePicker(false)}
            onDismiss={() => setShowDatePicker(false)}
          >
            <BlurView intensity={isDarkMode ? 20 : 40} tint={isDarkMode ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
              <TouchableOpacity
                className="flex-1 justify-center items-center p-5"
                activeOpacity={1}
                onPress={() => setShowDatePicker(false)}
              >
                <Animated.View
                  entering={FadeInUp.duration(200).springify()}
                  className="w-full max-w-md rounded-3xl p-6 shadow-2xl"
                  style={{
                    backgroundColor: isDarkMode ? colors.background + 'F5' : colors.background + 'F8',
                  }}
                  onStartShouldSetResponder={() => true}
                >
                  <View className="flex-row justify-between items-center mb-4">
                    <Text className="text-xl font-bold" style={{ color: colors.foreground }}>
                      Reschedule Weave
                    </Text>
                    <TouchableOpacity onPress={() => setShowDatePicker(false)} className="p-2 -mr-2">
                      <Edit3 color={colors['muted-foreground']} size={22} style={{ transform: [{ rotate: '45deg' }, { scale: 1.2 }] }} />
                    </TouchableOpacity>
                  </View>

                  {/* Date Selection */}
                  <CustomCalendar
                    selectedDate={tempDate || new Date()}
                    onDateSelect={(date) => {
                      // Preserve time
                      const newDate = new Date(date);
                      if (tempDate) {
                        newDate.setHours(tempDate.getHours(), tempDate.getMinutes());
                      } else {
                        newDate.setHours(12, 0); // Default to noon if no temp date
                      }
                      setTempDate(newDate);
                    }}
                  />

                  {/* Time Selection - Always Visible & Integrated */}
                  <View className="mt-4 pt-4 border-t" style={{ borderColor: colors.border }}>
                    <Text className="text-sm font-medium mb-3" style={{ color: colors.foreground }}>Time</Text>

                    <View className="flex-row items-center justify-between">
                      <TouchableOpacity
                        onPress={() => setShowTimePicker(true)}
                        className="flex-1 p-3 rounded-xl border flex-row justify-between items-center mr-2"
                        style={{
                          borderColor: colors.border,
                          backgroundColor: colors.card,
                          opacity: Platform.OS === 'ios' ? 0.6 : 1 // Dim on iOS because we show spinner below
                        }}
                        disabled={Platform.OS === 'ios'}
                      >
                        <Text style={{ color: colors.foreground }}>
                          {tempDate ? tempDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Set Time'}
                        </Text>
                        <Clock size={16} color={colors['muted-foreground']} />
                      </TouchableOpacity>
                    </View>

                    {/* iOS Inline Time Picker - Always visible for easier editing */}
                    {Platform.OS === 'ios' && (
                      <View className="mt-2 items-center">
                        <DateTimePicker
                          value={tempDate || new Date()}
                          mode="time"
                          display="spinner"
                          onChange={(event, time) => {
                            if (time && event.type === 'set') {
                              const newDate = new Date(tempDate || new Date());
                              newDate.setHours(time.getHours(), time.getMinutes());
                              setTempDate(newDate);
                            }
                          }}
                          style={{ height: 120 }}
                          textColor={colors.foreground}
                        />
                      </View>
                    )}
                  </View>

                  {/* Android Time Picker (Modal) */}
                  {Platform.OS === 'android' && showTimePicker && (
                    <DateTimePicker
                      value={tempDate || new Date()}
                      mode="time"
                      display="default"
                      onChange={(event, time) => {
                        setShowTimePicker(false);
                        if (time && event.type === 'set') {
                          const newDate = new Date(tempDate || new Date());
                          newDate.setHours(time.getHours(), time.getMinutes());
                          setTempDate(newDate);
                        }
                      }}
                    />
                  )}

                  <View className="mt-6 gap-3">
                    <Button
                      label="Save Changes"
                      variant="primary"
                      onPress={async () => {
                        if (activeInteraction && onUpdate && tempDate) {
                          await onUpdate(activeInteraction.id, { interactionDate: tempDate });
                          setCachedInteraction({
                            ...activeInteraction,
                            interactionDate: tempDate
                          } as Interaction | InteractionShape);
                          setShowDatePicker(false);
                        }
                      }}
                    />
                    <Button
                      label="Cancel"
                      variant="ghost"
                      onPress={() => setShowDatePicker(false)}
                    />
                  </View>

                </Animated.View>
              </TouchableOpacity>
            </BlurView>
          </Modal>
        )
      }

      {/* Invite Friend Sheet */}
      {friendToInvite && activeInteraction && (
        <InviteFriendSheet
          visible={showInviteSheet}
          onClose={() => setShowInviteSheet(false)}
          weaveId={activeInteraction.id}
          friendName={friendToInvite.name}
          friendLocalId={friendToInvite.id}
          weaveSnapshot={{
            title: activeInteraction.title,
            interaction_date: activeInteraction.interactionDate, // Serialized
            location: activeInteraction.location,
            activity: activeInteraction.activity,
            duration: activeInteraction.duration,
            vibe: activeInteraction.vibe,
            note: activeInteraction.note,
            mode: activeInteraction.mode,
            interaction_type: activeInteraction.interactionType,
            event_importance: activeInteraction.eventImportance,
            interaction_category: activeInteraction.interactionCategory,
          }}
        />
      )}
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