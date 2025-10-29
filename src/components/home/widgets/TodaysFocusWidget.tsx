import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../../hooks/useTheme';
import { HomeWidgetBase, HomeWidgetConfig } from '../HomeWidgetBase';

const WIDGET_CONFIG: HomeWidgetConfig = {
  id: 'todays-focus',
  type: 'todays-focus',
  title: "Today's Focus",
  minHeight: 200,
  fullWidth: true,
};

export const TodaysFocusWidget: React.FC = () => {
  const { colors } = useTheme();

  return (
    <HomeWidgetBase config={WIDGET_CONFIG}>
      <View style={styles.container}>
        {/* Icon */}
        <Text style={styles.icon}>🎯</Text>

        {/* Coming Soon Message */}
        <Text style={[styles.title, { color: colors.foreground }]}>
          Today's Focus
        </Text>
        <Text style={[styles.subtitle, { color: colors['muted-foreground'] }]}>
          Coming in Phase 2: Your personalized daily connection suggestion
        </Text>

        {/* Feature Tease */}
        <View style={[styles.featureTease, { backgroundColor: colors['muted'] }]}>
          <Text style={[styles.teaseText, { color: colors['muted-foreground'] }]}>
            ✨ Life event-aware suggestions{'\n'}
            🎂 Birthday & milestone reminders{'\n'}
            💡 Archetype-matched activities
          </Text>
        </View>
      </View>
    </HomeWidgetBase>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  icon: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontFamily: 'Lora_700Bold',
    fontSize: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  featureTease: {
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  teaseText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'left',
  },
});
