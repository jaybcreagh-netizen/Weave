import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
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
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          shadowColor: tokens.shadow.color
        }
      ]}
    >
      <View style={styles.content}>
        <View style={[styles.header, { borderBottomColor: tokens.borderSubtle }]}>
          <View style={[styles.iconContainer, { backgroundColor: tokens.backgroundSubtle }]}>
            <Icon name={iconName} size={20} color={urgencyColor} />
          </View>
          <View style={styles.titleContainer}>
            <Text variant="h3" weight="bold" style={{ color: colors.foreground }}>
              {suggestion.title}
            </Text>
            {suggestion.urgency === 'critical' && (
              <View style={[styles.badge, { backgroundColor: tokens.destructiveSubtle }]}>
                <Text variant="caption" color="destructive">Urgent</Text>
              </View>
            )}
          </View>
        </View>

        <Text variant="body" color="muted" style={{ marginTop: 12, marginBottom: 16, lineHeight: 22 }}>
          {suggestion.subtitle}
        </Text>

        <View style={styles.actions}>
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

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});
