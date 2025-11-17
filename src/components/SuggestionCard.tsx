import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Suggestion } from '../types/suggestions';
import { useTheme } from '@/shared/hooks/useTheme';

interface SuggestionCardProps {
  suggestion: Suggestion;
  onAct: () => void;
  onLater: () => void;
}

export function SuggestionCard({ suggestion, onAct, onLater }: SuggestionCardProps) {
  const { colors } = useTheme();

  const urgencyColors = {
    critical: colors.destructive,
    high: colors.accent,
    medium: colors.primary,
    low: colors['muted-foreground'],
  };

  const urgencyColor = urgencyColors[suggestion.urgency];

  return (
    <View style={[styles.container, { backgroundColor: colors.muted, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={styles.icon}>{suggestion.icon}</Text>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: urgencyColor }]}>
            {suggestion.title}
          </Text>
        </View>
      </View>

      <Text style={[styles.subtitle, { color: colors.foreground }]}>
        {suggestion.subtitle}
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: urgencyColor }]}
          onPress={onAct}
        >
          <Text style={styles.primaryButtonText}>{suggestion.actionLabel}</Text>
        </TouchableOpacity>

        {suggestion.dismissible && (
          <TouchableOpacity style={styles.secondaryButton} onPress={onLater}>
            <Text style={[styles.secondaryButtonText, { color: colors['muted-foreground'] }]}>
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
  icon: {
    fontSize: 28,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Lora_700Bold',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
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
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
