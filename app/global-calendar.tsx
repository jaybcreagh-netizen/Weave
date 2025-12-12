import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, X, Calendar as CalendarIcon, Users } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { format, isToday } from 'date-fns';
import * as Haptics from 'expo-haptics';

import { GlobalYearCalendar } from '@/components/GlobalYearCalendar';
import { useInteractions } from '@/modules/interactions';
import { useTheme } from '@/shared/hooks/useTheme';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import InteractionFriend from '@/db/models/InteractionFriend';
import FriendModel from '@/db/models/Friend';
import { getCategoryMetadata } from '@/shared/constants/interaction-categories';
import { InteractionDetailModal } from '@/components/interaction-detail-modal';
import { Interaction } from '@/components/types';

export default function GlobalCalendar() {
  const router = useRouter();
  const { fromFriendId } = useLocalSearchParams<{ fromFriendId: string }>();
  const { colors } = useTheme();
  const { allInteractions } = useInteractions();

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDateInteractions, setSelectedDateInteractions] = useState<any[]>([]);
  const [dayDetailModalVisible, setDayDetailModalVisible] = useState(false);
  const [interactionFriends, setInteractionFriends] = useState<Map<string, FriendModel[]>>(new Map());
  const [selectedInteractionDetail, setSelectedInteractionDetail] = useState<Interaction | null>(null);
  const [interactionDetailVisible, setInteractionDetailVisible] = useState(false);

  // Load friends for interactions when modal opens
  useEffect(() => {
    if (selectedDateInteractions.length > 0) {
      loadInteractionFriends();
    }
  }, [selectedDateInteractions]);

  const loadInteractionFriends = async () => {
    const friendsMap = new Map<string, FriendModel[]>();

    for (const interaction of selectedDateInteractions) {
      const interactionFriendLinks = await database
        .get<InteractionFriend>('interaction_friends')
        .query(Q.where('interaction_id', interaction.id))
        .fetch();

      const friendIds = interactionFriendLinks.map(link => link.friendId);
      const friends = await database
        .get<FriendModel>('friends')
        .query(Q.where('id', Q.oneOf(friendIds)))
        .fetch();

      friendsMap.set(interaction.id, friends);
    }

    setInteractionFriends(friendsMap);
  };

  const handleDateSelect = (date: Date, interactions: any[]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDate(date);
    setSelectedDateInteractions(interactions);
    setDayDetailModalVisible(true);
  };

  const handleInteractionPress = (interaction: any) => {
    const friends = interactionFriends.get(interaction.id) || [];
    if (friends.length === 1) {
      // Navigate to friend profile
      setDayDetailModalVisible(false);

      // Prevent circular navigation if we came from this friend's profile
      if (friends[0].id === fromFriendId) {
        router.back();
      } else {
        router.push(`/friend-profile?friendId=${friends[0].id}`);
      }
    } else if (friends.length > 1) {
      // For group weaves, could navigate to interaction detail or show options
      setDayDetailModalVisible(false);
      setSelectedInteractionDetail(interaction);
      setInteractionDetailVisible(true);
    }
  };

  const getInteractionDisplay = (interaction: any) => {
    const friends = interactionFriends.get(interaction.id) || [];
    const friendNames = friends.map(f => f.name).join(', ');

    const categoryMeta = getCategoryMetadata(interaction.interactionCategory);
    const displayTitle = interaction.title || categoryMeta?.label || interaction.activity || 'Weave';

    return { friendNames, displayTitle };
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View
        className="flex-row justify-between items-center px-5 py-3 border-b"
        style={{ borderColor: colors.border }}
      >
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            }
          }}
          className="flex-row items-center gap-2"
        >
          <ArrowLeft size={20} color={colors['muted-foreground']} />
          <Text style={{ color: colors.foreground, fontFamily: 'Inter_400Regular' }}>Back</Text>
        </TouchableOpacity>

        <View className="flex-row items-center gap-2">
          <CalendarIcon size={20} color={colors.primary} />
          <Text
            className="text-lg font-bold"
            style={{ color: colors.foreground, fontFamily: 'Lora_700Bold' }}
          >
            Your Weave Calendar
          </Text>
        </View>

        <View style={{ width: 60 }} />
      </View>

      {/* Calendar */}
      <GlobalYearCalendar
        interactions={allInteractions}
        onDateSelect={handleDateSelect}
      />

      {/* Day Detail Modal */}
      <Modal
        visible={dayDetailModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDayDetailModalVisible(false)}
      >
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
          {/* Modal Header */}
          <View
            className="flex-row justify-between items-center px-5 py-4 border-b"
            style={{ borderColor: colors.border }}
          >
            <View className="flex-1">
              <Text
                className="text-lg font-bold"
                style={{ color: colors.foreground, fontFamily: 'Lora_700Bold' }}
              >
                {selectedDate ? format(selectedDate, 'EEEE, MMMM d') : ''}
              </Text>
              {isToday(selectedDate || new Date()) && (
                <Text
                  className="text-sm"
                  style={{ color: colors.accent, fontFamily: 'Inter_500Medium' }}
                >
                  Today
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => setDayDetailModalVisible(false)}
              className="p-2"
            >
              <X size={24} color={colors['muted-foreground']} />
            </TouchableOpacity>
          </View>

          {/* Weaves List */}
          <ScrollView className="flex-1 px-5 py-4">
            {selectedDateInteractions.length === 0 ? (
              <View className="items-center py-12">
                <Text
                  className="text-4xl mb-2 opacity-50"
                >
                  🧵
                </Text>
                <Text style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}>
                  No weaves on this day
                </Text>
              </View>
            ) : (
              <View className="gap-3">
                {selectedDateInteractions.map((interaction) => {
                  const { friendNames, displayTitle } = getInteractionDisplay(interaction);
                  const isPlanned = interaction.status === 'planned' || interaction.status === 'pending_confirm';

                  return (
                    <TouchableOpacity
                      key={interaction.id}
                      onPress={() => handleInteractionPress(interaction)}
                      className="p-4 rounded-2xl"
                      style={{
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        borderWidth: 1,
                      }}
                    >
                      {/* Status indicator */}
                      <View className="flex-row items-center justify-between mb-2">
                        <View className="flex-row items-center gap-2">
                          <View
                            className="rounded-full"
                            style={{
                              width: 8,
                              height: 8,
                              backgroundColor: isPlanned ? colors.accent : colors['weave-vibrant'],
                            }}
                          />
                          <Text
                            className="text-xs font-medium"
                            style={{
                              color: isPlanned ? colors.accent : colors['weave-vibrant'],
                              fontFamily: 'Inter_600SemiBold',
                            }}
                          >
                            {isPlanned ? 'Planned' : 'Completed'}
                          </Text>
                        </View>
                        {interaction.title && (
                          <Text
                            className="text-xs"
                            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                          >
                            {format(new Date(interaction.interactionDate), 'h:mm a')}
                          </Text>
                        )}
                      </View>

                      {/* Title */}
                      <Text
                        className="text-base font-semibold mb-1"
                        style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}
                      >
                        {displayTitle}
                      </Text>

                      {/* Friends */}
                      {friendNames && (
                        <View className="flex-row items-center gap-2">
                          <Users size={14} color={colors['muted-foreground']} />
                          <Text
                            className="text-sm"
                            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                          >
                            {friendNames}
                          </Text>
                        </View>
                      )}

                      {/* Notes preview */}
                      {interaction.note && (
                        <Text
                          className="text-sm mt-2 italic"
                          style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                          numberOfLines={2}
                        >
                          "{interaction.note}"
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Interaction Detail Modal */}
      <InteractionDetailModal
        interaction={selectedInteractionDetail}
        isOpen={interactionDetailVisible}
        onClose={() => setInteractionDetailVisible(false)}
      />
    </SafeAreaView>
  );
}
