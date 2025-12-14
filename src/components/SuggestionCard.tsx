import React from 'react';
import { View, Pressable } from 'react-native';
import Animated, { FadeInDown, FadeOutLeft, LinearTransition } from 'react-native-reanimated';
import { Suggestion } from '@/shared/types/common';
import { useTheme } from '@/shared/hooks/useTheme';
import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { icons } from 'lucide-react-native';

interface SuggestionCardProps {
  suggestion: Suggestion;
  onAct: () => void;
  onLater: () => void;
  index?: number; // For staggered animation
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function SuggestionCard({ suggestion, onAct, onLater, index = 0 }: SuggestionCardProps) {
  const { colors, tokens } = useTheme();

  // Urgency colors mapping
  const urgencyColors = {
    critical: colors.destructive,
    high: colors.accent,
    medium: colors.primary,
    low: colors['muted-foreground'],
  };

  const urgencyColor: string = urgencyColors[suggestion.urgency || 'low'];

  // Icon handling
  const iconName = (suggestion.icon && icons[suggestion.icon as keyof typeof icons])
    ? (suggestion.icon as keyof typeof icons)
    : 'Star';

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 100).springify().damping(12)}
      exiting={FadeOutLeft.springify().damping(12)}
      layout={LinearTransition.springify().damping(12)}
      className="mb-4 rounded-3xl border overflow-hidden shadow-sm"
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border,
        shadowColor: tokens.shadow?.color ?? '#000', // Keep shadow color dynamic/token-based
        // Native shadow props don't map perfectly to tailwind classes without custom config
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
      }}
    >
      <View className="p-5">
        <View
          className="flex-row items-center pb-4 border-b"
          style={{ borderBottomColor: tokens.borderSubtle }}
        >
          <View
            className="w-10 h-10 rounded-xl items-center justify-center mr-4"
            style={{ backgroundColor: tokens.backgroundSubtle }}
          >
            <Icon name={iconName} size={20} color={urgencyColor} />
          </View>
          <View className="flex-1 justify-center gap-1">
            <Text variant="h3" weight="bold" style={{ color: colors.foreground }}>
              {suggestion.title}
            </Text>
            {suggestion.urgency === 'critical' && (
              <View
                className="self-start px-2 py-0.5 rounded-md"
                style={{ backgroundColor: tokens.destructiveSubtle }}
              >
                <Text variant="caption" color="destructive">Urgent</Text>
              </View>
            )}
          </View>
        </View>

        <Text variant="body" color="muted" style={{ marginTop: 12, marginBottom: 16, lineHeight: 22 }}>
          {suggestion.subtitle}
        </Text>

        <View className="flex-row items-center justify-end">
          {suggestion.dismissible && (
            <Button
              variant="ghost"
              onPress={onLater}
              className="flex-1 mr-3"
              label="Later"
            />
          )}

          <Button
            onPress={onAct}
            className="flex-1"
            style={{ backgroundColor: urgencyColor }}
            label={suggestion.actionLabel}
          />
        </View>
      </View>
    </Animated.View>
  );
}

