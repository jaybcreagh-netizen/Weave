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
    critical: colors.celebrate,
    high: colors.accent,
    medium: colors.primary,
    low: colors.primary, // Changed from muted-foreground to primary to avoid grey UI
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
      className="mb-4 rounded-3xl border overflow-hidden"
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border,
        shadowColor: tokens.shadow?.color ?? '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <View className="p-5">
        <View className="flex-row items-start gap-4">
          <View
            className="w-12 h-12 rounded-full items-center justify-center shrink-0"
            style={{ backgroundColor: suggestion.urgency === 'critical' ? tokens.celebrateSubtle : tokens.backgroundSubtle }}
          >
            <Icon name={iconName} size={24} color={urgencyColor} />
          </View>

          <View className="flex-1">
            <View className="flex-row justify-between items-start mb-1">
              <View className="flex-1 mr-2">
                {suggestion.urgency === 'critical' && (
                  <View
                    className="self-start px-2 py-0.5 rounded-full mb-1"
                    style={{ backgroundColor: tokens.celebrateSubtle }}
                  >
                    <Text variant="caption" style={{ color: colors.celebrate, fontSize: 10, fontWeight: '700' }}>SPECIAL</Text>
                  </View>
                )}
                <Text variant="h3" weight="bold" style={{ color: colors.foreground }}>
                  {suggestion.title}
                </Text>
              </View>

              {suggestion.dismissible && (
                <Pressable
                  onPress={onLater}
                  hitSlop={8}
                  className="opacity-60 active:opacity-100"
                >
                  <Icon name="X" size={18} color={colors['muted-foreground']} />
                </Pressable>
              )}
            </View>

            <Text variant="body" style={{ color: colors.foreground, marginTop: 4, marginBottom: 16, lineHeight: 22 }}>
              {suggestion.subtitle}
            </Text>

            <Button
              onPress={onAct}
              className="w-full"
              style={{ backgroundColor: urgencyColor }}
              label={suggestion.actionLabel}
            />
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

