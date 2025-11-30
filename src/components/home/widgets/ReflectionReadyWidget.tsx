import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { Sparkles, ArrowRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { HomeWidgetBase, HomeWidgetConfig } from '../HomeWidgetBase';
import { Card } from '@/components/ui/Card';

const WIDGET_CONFIG: HomeWidgetConfig = {
  id: 'reflection-ready',
  type: 'reflection-ready',
  title: 'Reflection Ready',
  fullWidth: true,
};

interface ReflectionReadyWidgetProps {
  onPress?: () => void;
}

export function ReflectionReadyWidget({ onPress }: ReflectionReadyWidgetProps) {
  const { tokens, typography, spacing } = useTheme();

  const handlePress = () => {
    if (onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  };

  return (
    <HomeWidgetBase config={WIDGET_CONFIG} padding="none">
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.7}
        style={{ padding: 16 }}
      >
        <View style={styles.container}>
          <View style={[styles.iconContainer, { backgroundColor: tokens.primary + '20' }]}>
            <Sparkles size={24} color={tokens.primary} />
          </View>

          <View style={styles.content}>
            <Text style={[styles.title, {
              color: tokens.foreground,
              fontFamily: typography.fonts.serifBold,
              fontSize: typography.scale.h3.fontSize,
              lineHeight: typography.scale.h3.lineHeight
            }]}>
              Your weekly reflection is ready
            </Text>
            <Text style={[styles.subtitle, {
              color: tokens.foregroundMuted,
              fontFamily: typography.fonts.sans,
              fontSize: typography.scale.body.fontSize,
              lineHeight: typography.scale.body.lineHeight
            }]}>
              Tap to reflect on this week's connections
            </Text>
          </View>

          <View style={[styles.arrowContainer, { backgroundColor: tokens.primary }]}>
            <ArrowRight size={16} color={tokens.primaryForeground} />
          </View>
        </View>
      </TouchableOpacity>
    </HomeWidgetBase>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {},
  arrowContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
