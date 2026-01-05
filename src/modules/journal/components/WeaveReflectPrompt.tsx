/**
 * WeaveReflectPrompt
 * 
 * Post-weave prompt that appears after logging a meaningful interaction.
 * Bridges the weave logger to the journal for deeper reflection.
 * 
 * Shows when:
 * - Weave has notes > 20 chars
 * - High vibe (FullMoon, WaxingGibbous)
 * - Deep category (deep-talk, heart-to-heart, support)
 * - Extended duration
 * - User hasn't been prompted in last 3 weaves
 */

import React, { useEffect, useCallback, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInUp,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { Sparkles, X, ChevronRight, MessageCircle, PenLine } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import InteractionModel from '@/db/models/Interaction';
import FriendModel from '@/db/models/Friend';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GuidedReflectionSheet } from './GuidedReflection';
import { ReflectionContext } from '../services/oracle/types';

// ============================================================================
// TYPES
// ============================================================================

interface WeaveReflectPromptProps {
  visible: boolean;
  interaction: InteractionModel | null;
  friends: FriendModel[];
  onReflect: () => void;
  onDismiss: () => void;
  onGuidedReflectionComplete?: (content: string, friendIds: string[]) => void;
}

interface MeaningfulnessCheck {
  isMeaningful: boolean;
  reasons: string[];
}

// ============================================================================
// STORAGE KEYS
// ============================================================================

const LAST_PROMPT_KEY = '@weave_reflect_last_prompt';
const PROMPT_COUNT_KEY = '@weave_reflect_prompt_count';
const WEAVES_SINCE_PROMPT_KEY = '@weave_reflect_weaves_since';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a weave is meaningful enough to prompt for reflection.
 */
export function checkMeaningfulness(interaction: InteractionModel): MeaningfulnessCheck {
  const reasons: string[] = [];

  // Check notes length
  const noteLength = interaction.note?.length || 0;
  if (noteLength >= 20) {
    reasons.push('detailed notes');
  }

  // Check vibe
  if (['FullMoon', 'WaxingGibbous'].includes(interaction.vibe || '')) {
    reasons.push('meaningful moment');
  }

  // Check category
  const category = (interaction.interactionCategory || '').toLowerCase();
  if (['deep-talk', 'heart-to-heart', 'support'].some(c => category.includes(c))) {
    reasons.push('deep conversation');
  }

  // Check duration
  if (['Extended', 'Long'].includes(interaction.duration || '')) {
    reasons.push('extended time together');
  }

  return {
    isMeaningful: reasons.length >= 1,
    reasons,
  };
}

/**
 * Check if we should show the prompt (rate limiting).
 * Now shows after every meaningful weave to encourage reflection.
 */
export async function shouldShowPrompt(): Promise<boolean> {
  try {
    const weavesSinceStr = await AsyncStorage.getItem(WEAVES_SINCE_PROMPT_KEY);
    const weavesSince = weavesSinceStr ? parseInt(weavesSinceStr, 10) : 0;

    // Show every meaningful weave (was: only every 3+ weaves)
    // This helps users deepen their reflections while the moment is fresh
    return weavesSince >= 0; // Always show for meaningful weaves
  } catch {
    return true;
  }
}

/**
 * Increment the weaves counter.
 */
export async function incrementWeaveCount(): Promise<void> {
  try {
    const weavesSinceStr = await AsyncStorage.getItem(WEAVES_SINCE_PROMPT_KEY);
    const weavesSince = weavesSinceStr ? parseInt(weavesSinceStr, 10) : 0;
    await AsyncStorage.setItem(WEAVES_SINCE_PROMPT_KEY, String(weavesSince + 1));
  } catch {
    // Ignore errors
  }
}

/**
 * Reset the weaves counter (after showing prompt).
 */
export async function resetWeaveCount(): Promise<void> {
  try {
    await AsyncStorage.setItem(WEAVES_SINCE_PROMPT_KEY, '0');
    await AsyncStorage.setItem(LAST_PROMPT_KEY, String(Date.now()));
  } catch {
    // Ignore errors
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export function WeaveReflectPrompt({
  visible,
  interaction,
  friends,
  onReflect,
  onDismiss,
  onGuidedReflectionComplete,
}: WeaveReflectPromptProps) {
  const { colors } = useTheme();
  const [showGuidedSheet, setShowGuidedSheet] = useState(false);

  // Animation values
  const sparkleScale = useSharedValue(1);
  const sparkleRotation = useSharedValue(0);

  // Build guided reflection context
  const guidedContext: ReflectionContext | null = interaction ? {
    type: 'post_weave' as const,
    friendIds: friends.map(f => f.id),
    friendNames: friends.map(f => f.name),
    interactionId: interaction.id,
    activity: interaction.interactionCategory || undefined,
  } : null;

  // Animate sparkle on mount
  useEffect(() => {
    if (visible) {
      sparkleScale.value = withSequence(
        withTiming(1.2, { duration: 200 }),
        withTiming(1, { duration: 200 })
      );
      sparkleRotation.value = withSequence(
        withTiming(15, { duration: 150 }),
        withTiming(-15, { duration: 150 }),
        withTiming(0, { duration: 150 })
      );

      // Haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [visible]);

  const handleReflect = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await resetWeaveCount();
    onReflect();
  }, [onReflect]);

  const handleGuidedReflect = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await resetWeaveCount();
    setShowGuidedSheet(true);
  }, []);

  const handleGuidedComplete = useCallback((content: string, friendIds: string[]) => {
    setShowGuidedSheet(false);
    onGuidedReflectionComplete?.(content, friendIds);
    onDismiss();
  }, [onGuidedReflectionComplete, onDismiss]);

  const handleGuidedEscape = useCallback(() => {
    setShowGuidedSheet(false);
    // User chose to write themselves - go to journal
    onReflect();
  }, [onReflect]);

  const handleDismiss = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await resetWeaveCount();
    onDismiss();
  }, [onDismiss]);

  // Animated styles
  const sparkleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: sparkleScale.value },
      { rotate: `${sparkleRotation.value}deg` },
    ],
  }));

  if (!visible || !interaction) return null;

  // Get friend name(s)
  const friendNames = friends.map(f => f.name).join(' & ');


  // Get note preview (truncated)
  const notePreview = interaction.note
    ? interaction.note.length > 50
      ? `"${interaction.note.slice(0, 50)}..."`
      : `"${interaction.note}"`
    : null;

  return (
    <Animated.View
      entering={SlideInUp.springify().damping(18)}
      exiting={SlideOutDown.springify().damping(18)}
      className="absolute bottom-6 left-4 right-4"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 8,
      }}
    >
      <View
        className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: colors.card }}
      >
        {/* Dismiss Button */}
        <TouchableOpacity
          onPress={handleDismiss}
          className="absolute top-3 right-3 z-10 w-7 h-7 items-center justify-center rounded-full"
          style={{ backgroundColor: colors.muted }}
        >
          <X size={14} color={colors['muted-foreground']} />
        </TouchableOpacity>

        <View className="p-5">
          {/* Header with sparkle */}
          <View className="flex-row items-center gap-2.5 mb-3">
            <Animated.View style={sparkleAnimatedStyle}>
              <View
                className="w-9 h-9 rounded-full items-center justify-center"
                style={{ backgroundColor: colors.primary + '20' }}
              >
                <Sparkles size={18} color={colors.primary} />
              </View>
            </Animated.View>
            <Text
              className="text-base"
              style={{ color: colors.foreground, fontFamily: 'Lora_600SemiBold' }}
            >
              That sounded meaningful
            </Text>
          </View>

          {/* Note Preview */}
          {notePreview && (
            <View
              className="rounded-xl p-3 mb-3"
              style={{ backgroundColor: colors.muted }}
            >
              <Text
                className="text-sm italic"
                style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
              >
                {notePreview}
              </Text>
            </View>
          )}

          {/* Description */}
          <Text
            className="text-sm mb-4"
            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
          >
            {friendNames
              ? `Want to capture more about your time with ${friendNames}?`
              : 'Want to capture more about this moment while it\'s fresh?'}
          </Text>

          {/* Actions - Now with guided reflection as primary */}
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={handleDismiss}
              className="py-3 px-4 rounded-xl items-center"
              style={{
                backgroundColor: colors.muted,
                borderWidth: 1,
                borderColor: colors.border,
              }}
              activeOpacity={0.7}
            >
              <Text
                className="text-sm"
                style={{ color: colors['muted-foreground'], fontFamily: 'Inter_500Medium' }}
              >
                Skip
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleReflect}
              className="flex-1 flex-row items-center justify-center gap-1.5 py-3 rounded-xl"
              style={{
                backgroundColor: colors.muted,
                borderWidth: 1,
                borderColor: colors.border,
              }}
              activeOpacity={0.7}
            >
              <PenLine size={14} color={colors.foreground} />
              <Text
                className="text-sm"
                style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}
              >
                Write
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleGuidedReflect}
              className="flex-1 flex-row items-center justify-center gap-1.5 py-3 rounded-xl"
              style={{ backgroundColor: colors.primary }}
              activeOpacity={0.8}
            >
              <MessageCircle size={14} color={colors['primary-foreground']} />
              <Text
                className="text-sm"
                style={{ color: colors['primary-foreground'], fontFamily: 'Inter_600SemiBold' }}
              >
                Help me write
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Guided Reflection Sheet */}
      {guidedContext && (
        <GuidedReflectionSheet
          isOpen={showGuidedSheet}
          onClose={() => setShowGuidedSheet(false)}
          context={guidedContext}
          onComplete={handleGuidedComplete}
          onEscape={handleGuidedEscape}
        />
      )}
    </Animated.View>
  );
}

// ============================================================================
// HOOK FOR WEAVE LOGGER INTEGRATION
// ============================================================================

interface UseWeaveReflectPromptReturn {
  showPrompt: boolean;
  checkAndShowPrompt: (interaction: InteractionModel, friends: FriendModel[]) => Promise<boolean>;
  hidePrompt: () => void;
  promptInteraction: InteractionModel | null;
  promptFriends: FriendModel[];
}

/**
 * Hook for integrating the reflect prompt into the weave logger.
 * 
 * Usage in WeaveLogger:
 * ```
 * const { showPrompt, checkAndShowPrompt, hidePrompt, promptInteraction, promptFriends } = useWeaveReflectPrompt();
 * 
 * // After weave is saved:
 * const shouldShow = await checkAndShowPrompt(savedInteraction, friends);
 * 
 * // In render:
 * <WeaveReflectPrompt
 *   visible={showPrompt}
 *   interaction={promptInteraction}
 *   friends={promptFriends}
 *   onReflect={() => {
 *     hidePrompt();
 *     navigation.navigate('Journal', { weaveId: promptInteraction.id });
 *   }}
 *   onDismiss={hidePrompt}
 * />
 * ```
 */
export function useWeaveReflectPrompt(): UseWeaveReflectPromptReturn {
  const [showPrompt, setShowPrompt] = React.useState(false);
  const [promptInteraction, setPromptInteraction] = React.useState<InteractionModel | null>(null);
  const [promptFriends, setPromptFriends] = React.useState<FriendModel[]>([]);

  const checkAndShowPrompt = useCallback(async (
    interaction: InteractionModel,
    friends: FriendModel[]
  ): Promise<boolean> => {
    // Increment counter regardless
    await incrementWeaveCount();

    // Check meaningfulness
    const { isMeaningful } = checkMeaningfulness(interaction);
    if (!isMeaningful) return false;

    // Check rate limiting
    const shouldShow = await shouldShowPrompt();
    if (!shouldShow) return false;

    // Show prompt
    setPromptInteraction(interaction);
    setPromptFriends(friends);
    setShowPrompt(true);

    return true;
  }, []);

  const hidePrompt = useCallback(() => {
    setShowPrompt(false);
    setPromptInteraction(null);
    setPromptFriends([]);
  }, []);

  return {
    showPrompt,
    checkAndShowPrompt,
    hidePrompt,
    promptInteraction,
    promptFriends,
  };
}

export default WeaveReflectPrompt;
