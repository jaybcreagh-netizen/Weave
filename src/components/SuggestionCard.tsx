import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Suggestion } from '@/shared/types/common';
import { useTheme } from '@/shared/hooks/useTheme';
import { Text } from '@/shared/ui/Text';
import {
  Gift, Heart, Briefcase, Home, GraduationCap, Activity,
  PartyPopper, HeartCrack, Egg, Calendar, Star, Target,
  AlertTriangle, History, Sparkles, Zap, Clock, Wind,
  Anchor, Cloud, Feather
} from 'lucide-react-native';

interface SuggestionCardProps {
  suggestion: Suggestion;
  onAct: () => void;
  onLater: () => void;
}

const ICON_MAP: Record<string, any> = {
  Gift, Heart, Briefcase, Home, GraduationCap, Activity,
  PartyPopper, HeartCrack, Egg, Calendar, Star, Target,
  AlertTriangle, History, Sparkles, Zap, Clock, Wind,
  Anchor, Cloud, Feather
};

export function SuggestionCard({ suggestion, onAct, onLater }: SuggestionCardProps) {
  const { colors } = useTheme();

  const urgencyColors = {
    critical: colors.destructive,
    high: colors.accent,
    medium: colors.primary,
    low: colors['muted-foreground'],
  };

  const urgencyColor: string = urgencyColors[suggestion.urgency || 'low'];

  const IconComponent = ICON_MAP[suggestion.icon] || Star;

  return (
    <View style={[styles.container, { backgroundColor: colors.muted, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <IconComponent size={24} color={urgencyColor} />
        </View>
        <View style={styles.headerText}>
          <Text variant="h3" weight="bold" style={{ color: urgencyColor }}>
            {suggestion.title}
          </Text>
        </View>
      </View>

      <Text variant="body" style={[styles.subtitle, { color: colors.foreground }]}>
        {suggestion.subtitle}
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: urgencyColor }]}
          onPress={onAct}
        >
          <Text variant="button" style={styles.primaryButtonText}>
            {suggestion.actionLabel}
          </Text>
        </TouchableOpacity>

        {suggestion.dismissible && (
          <TouchableOpacity style={styles.secondaryButton} onPress={onLater}>
            <Text variant="button" style={{ color: colors['muted-foreground'] }}>
              Later
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  subtitle: {
    marginBottom: 20,
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
});
