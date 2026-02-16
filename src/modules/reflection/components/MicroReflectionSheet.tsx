import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, Keyboard } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import { Sparkles } from 'lucide-react-native';
import { type Vibe, type InteractionCategory } from '@/shared/types/common';

import { useTheme } from '@/shared/hooks/useTheme';
import { getCategoryMetadata } from '@/shared/constants/interaction-categories';
import { StandardBottomSheet } from '@/shared/ui/Sheet';
import { BufferedTextInput } from '@/shared/ui/BufferedTextInput';
import { MoonPhaseSelector } from '@/modules/intelligence/components/MoonPhaseSelector';
import { GuidedReflectionSheet } from '@/modules/journal/components/GuidedReflection/GuidedReflectionSheet';
import { database } from '@/db/index';
import FriendModel from '@/db/models/Friend';
import { CachedImage } from '@/shared/ui/CachedImage';
import { Icon } from '@/shared/ui/Icon';

interface MicroReflectionSheetProps {
  isVisible: boolean;
  friendName: string;
  friendId?: string;
  activityLabel: string;
  activityId: string;
  interactionId?: string;
  friendArchetype?: string;
  onSave: (data: { vibe?: Vibe; notes?: string; title?: string }) => void;
  onSkip: () => void;
}

export function MicroReflectionSheet({
  isVisible,
  friendName,
  friendId,
  activityLabel,
  activityId,
  interactionId,
  friendArchetype,
  onSave,
  onSkip,
}: MicroReflectionSheetProps) {
  const { colors, isDarkMode, tokens } = useTheme();
  const [selectedVibe, setSelectedVibe] = useState<Vibe | null>(null);
  const [notes, setNotes] = useState('');
  const [title, setTitle] = useState(activityLabel);
  const [showGuidedReflection, setShowGuidedReflection] = useState(false);
  const [guidedFlowSaved, setGuidedFlowSaved] = useState(false);
  const [friend, setFriend] = useState<FriendModel | null>(null);

  // Fetch friend to get photo
  useEffect(() => {
    if (friendId && isVisible) {
      const fetchFriend = async () => {
        try {
          const f = await database.get<FriendModel>('friends').find(friendId);
          setFriend(f);
        } catch (error) {
          // consistent fail-safe
        }
      };
      fetchFriend();
    }
  }, [friendId, isVisible]);

  // Resolve photo URL
  const resolvedPhotoUrl = useMemo(() => {
    const photoUrl = friend?.photoUrl;
    if (!photoUrl) return null;
    if (!photoUrl.startsWith('file://') && !photoUrl.startsWith('/') && !photoUrl.startsWith('http')) {
      return `${FileSystem.documentDirectory}${photoUrl.replace(/^\//, '')}`;
    }
    return photoUrl;
  }, [friend?.photoUrl]);

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  // Set title from activityLabel when opening
  useEffect(() => {
    if (isVisible) {
      if (activityLabel && activityLabel.includes('-')) {
        const metadata = getCategoryMetadata(activityLabel as InteractionCategory);
        if (metadata && metadata.label) {
          setTitle(metadata.label);
          return;
        }
      }
      setTitle(activityLabel);
    }
  }, [isVisible, activityLabel]);

  const handleVibeSelect = (vibe: Vibe) => {
    setSelectedVibe(vibe);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSave = () => {
    Keyboard.dismiss();
    onSave({
      vibe: selectedVibe || undefined,
      notes: notes.trim() || undefined,
      title: title.trim() || activityLabel,
    });
  };

  const handleSkip = () => {
    Keyboard.dismiss();
    onSkip();
  };

  const handleCloseComplete = () => {
    setSelectedVibe(null);
    setNotes('');
    setTitle('');
  };

  const getPrompt = () => {
    const archetypePrompts: Record<string, string> = {
      'The Sun': 'How was the joy shared?',
      'The Hermit': 'What depth did you find?',
      'The Fool': 'What adventure unfolded?',
      'The Empress': 'How did you nurture each other?',
      'The Magician': 'What magic happened?',
      'The High Priestess': 'What truth emerged?',
      'The Emperor': 'How did you support each other?',
    };

    return friendArchetype && archetypePrompts[friendArchetype]
      ? archetypePrompts[friendArchetype]
      : 'How did it feel?';
  };

  // Get category metadata for icon
  const categoryMetadata = activityLabel && activityLabel.includes('-')
    ? getCategoryMetadata(activityLabel as InteractionCategory)
    : getCategoryMetadata('hangout'); // fallback


  // ... (keep other imports)


  // ...

  return (
    <>
      <StandardBottomSheet
        visible={isVisible}
        onClose={handleSkip}
        height="full"
        scrollable
        title="Log Interaction"
        footerComponent={
          <View className="flex-row gap-4">
            <TouchableOpacity
              className="flex-1 py-3.5 rounded-full border items-center justify-center"
              style={{ borderColor: colors.border }}
              onPress={handleSkip}
              activeOpacity={0.7}
            >
              <Text className="text-[15px] font-semibold" style={{ color: colors.foreground }}>
                Skip
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-1 py-3.5 rounded-full items-center justify-center shadow-sm"
              style={{
                backgroundColor: colors.primary,
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4
              }}
              onPress={handleSave}
              activeOpacity={0.8}
            >
              <Text className="text-[15px] font-bold" style={{ color: colors['primary-foreground'] }}>
                Save
              </Text>
            </TouchableOpacity>
          </View>
        }
      >
        {/* Header Section */}
        <View className="items-center mb-6 pt-2">
          {/* Avatar with accent ring */}
          <View
            className="relative mb-3"
            style={{
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 8,
            }}
          >
            {resolvedPhotoUrl ? (
              <CachedImage
                source={{ uri: resolvedPhotoUrl }}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  borderWidth: 2,
                  borderColor: colors.card,
                }}
                contentFit="cover"
              />
            ) : (
              <View
                className="items-center justify-center"
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: colors.primary + '20',
                  borderWidth: 2,
                  borderColor: colors.card,
                }}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 24,
                    fontWeight: 'bold',
                    fontFamily: 'Lora-Bold',
                  }}
                >
                  {getInitials(friendName)}
                </Text>
              </View>
            )}

            {/* Category badge overlay */}
            <View
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full items-center justify-center"
              style={{
                backgroundColor: colors.card,
                borderWidth: 2,
                borderColor: colors.card,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
              }}
            >
              <categoryMetadata.iconComponent size={13} color={colors.primary} />
            </View>
          </View>

          {/* Friend Name */}
          <Text
            className="text-lg font-bold font-lora-bold text-center mb-5"
            style={{ color: colors.foreground }}
          >
            {friendName}
          </Text>

          {/* Interaction Title Card - More compact */}
          <View
            className="w-full px-4 py-3 bg-card rounded-xl border items-center shadow-sm"
            style={{
              borderColor: colors.border,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 2,
              elevation: 2,
              backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'white'
            }}
          >
            <Text
              className="text-[10px] font-bold uppercase tracking-widest mb-1 opacity-60"
              style={{ color: colors['muted-foreground'] }}
            >
              Logged {categoryMetadata.label}
            </Text>

            <BufferedTextInput
              inputClassName="text-xl font-bold font-lora-bold text-center h-auto p-0 border-0 bg-transparent min-w-[200px]"
              style={{ color: colors.foreground }}
              value={title}
              onChangeText={setTitle}
              placeholder="Interaction Title"
              placeholderTextColor={colors['muted-foreground'] + '80'}
              returnKeyType="done"
              multiline={true}
              numberOfLines={1}
              maxLength={60}
            />
          </View>
        </View>

        {/* Prompt */}
        <Text className="text-base font-semibold text-center mb-5" style={{ color: colors.foreground }}>
          {getPrompt()}
        </Text>

        {/* Moon Phase Selector */}
        <View className="w-full mb-6">
          <MoonPhaseSelector
            selectedVibe={selectedVibe}
            onSelect={handleVibeSelect}
          />
        </View>

        {/* Optional Note */}
        <View className="mb-4">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xs font-medium" style={{ color: colors['muted-foreground'] }}>
              Add a note
            </Text>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowGuidedReflection(true);
              }}
              className="flex-row items-center gap-1"
            >
              <Sparkles size={11} color={colors.primary} />
              <Text className="text-[11px] font-medium" style={{ color: colors.primary }}>
                Help me write
              </Text>
            </TouchableOpacity>
          </View>
          <BufferedTextInput
            inputClassName="border rounded-xl p-3 text-[15px] min-h-[100px]"
            style={{
              backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
              color: colors.foreground,
              borderColor: colors.border,
              textAlignVertical: 'top'
            }}
            placeholder="What happened? How are you feeling?"
            placeholderTextColor={colors['muted-foreground'] + '80'}
            value={notes}
            onChangeText={setNotes}
            multiline
            returnKeyType="default"
            blurOnSubmit={true}
          />
        </View>
      </StandardBottomSheet>

      {/* Oracle Help me write */}
      <GuidedReflectionSheet
        isOpen={showGuidedReflection}
        onClose={() => {
          setShowGuidedReflection(false)
          if (guidedFlowSaved) {
            setGuidedFlowSaved(false)
            onSkip()
          }
        }}
        context={friendId ? {
          type: 'post_weave',
          friendIds: [friendId],
          friendNames: [friendName],
          interactionId: interactionId,
          activity: activityLabel,
        } : undefined}
        onComplete={() => {
          setGuidedFlowSaved(true)
        }}
        onEscape={() => {
          setShowGuidedReflection(false);
        }}
      />
    </>
  );

}
