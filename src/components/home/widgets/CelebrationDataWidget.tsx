import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../../hooks/useTheme';
import { HomeWidgetBase, HomeWidgetConfig } from '../HomeWidgetBase';

const WIDGET_CONFIG: HomeWidgetConfig = {
  id: 'celebration-data',
  type: 'celebration-data',
  title: 'Your Weave',
  minHeight: 160,
  fullWidth: false, // Half-width widget
};

export const CelebrationDataWidget: React.FC = () => {
  const { colors } = useTheme();

  return (
    <HomeWidgetBase config={WIDGET_CONFIG}>
      <View style={styles.container}>
        {/* Icon */}
        <Text style={styles.icon}>📊</Text>

        {/* Coming Soon Message */}
        <Text style={[styles.title, { color: colors.foreground }]}>
          Your Weave
        </Text>
        <Text style={[styles.subtitle, { color: colors['muted-foreground'] }]}>
          Coming in Phase 5
        </Text>

        {/* Placeholder Stats */}
        <View style={styles.statsPreview}>
          <Text style={[styles.statLabel, { color: colors['muted-foreground'] }]}>
            Threads woven • Seeds planted
          </Text>
        </View>
      </View>
    </HomeWidgetBase>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  icon: {
    fontSize: 32,
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Lora_700Bold',
    fontSize: 16,
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
  },
  statsPreview: {
    marginTop: 8,
  },
  statLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    textAlign: 'center',
  },
});
