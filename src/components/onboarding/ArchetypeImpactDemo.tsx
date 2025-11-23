import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '@/shared/theme/theme';
import { ArchetypeIcon } from '../ArchetypeIcon';

interface ScoreBarProps {
  score: number;
  multiplier: string;
  label: string;
  color: string;
  delay: number;
}

function ScoreBar({ score, multiplier, label, color, delay }: ScoreBarProps) {
  const width = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    width.value = withDelay(
      delay,
      withSpring(score / 40, { // Scale to 40 as max (38 is close to full width)
        damping: 15,
        stiffness: 100,
      })
    );
    opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
  }, []);

  const animatedBarStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={styles.scoreBarContainer}
      entering={FadeInDown.delay(delay - 100).duration(400)}
    >
      <View style={styles.scoreBarHeader}>
        <Text style={styles.scoreBarLabel}>{label}</Text>
        <View style={styles.multiplierBadge}>
          <Text style={styles.multiplierText}>{multiplier}</Text>
        </View>
      </View>
      <View style={styles.barBackground}>
        <Animated.View
          style={[
            styles.barFill,
            { backgroundColor: color },
            animatedBarStyle,
          ]}
        />
      </View>
      <Text style={styles.scoreText}>+{score} points</Text>
    </Animated.View>
  );
}

export function ArchetypeImpactDemo() {
  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.duration(500)}>
        <Text style={styles.title}>Why archetypes matter</Text>
        <Text style={styles.subtitle}>
          Same friend. Different activities. Different impact.
        </Text>
      </Animated.View>

      <View style={styles.demoCard}>
        <View style={styles.friendHeader}>
          <View style={styles.archetypeIcon}>
            <ArchetypeIcon archetype="Emperor" size={24} color={theme.colors.primary} />
          </View>
          <View>
            <Text style={styles.friendName}>Alex (The Emperor)</Text>
            <Text style={styles.friendSubtext}>Values structure & achievement</Text>
          </View>
        </View>

        <View style={styles.comparisonContainer}>
          <ScoreBar
            score={38}
            multiplier="2.0× multiplier"
            label="🎊 Milestone celebration"
            color={theme.colors.primary}
            delay={600}
          />

          <ScoreBar
            score={6}
            multiplier="0.6× multiplier"
            label="💬 Quick text"
            color={theme.colors['muted-foreground']}
            delay={1000}
          />
        </View>
      </View>

      <Animated.View
        style={styles.explanation}
        entering={FadeInDown.delay(1400).duration(400)}
      >
        <Text style={styles.explanationText}>
          Archetypes help Weave suggest the <Text style={styles.bold}>right</Text> ways to connect,{'\n'}
          not just <Text style={styles.bold}>any</Text> ways.
        </Text>
      </Animated.View>

      <Animated.View
        style={styles.reassurance}
        entering={FadeInDown.delay(1600).duration(400)}
      >
        <Text style={styles.reassuranceText}>
          Don't worry—you can always change archetypes later as you learn.
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Lora_700Bold',
    textAlign: 'center',
    color: theme.colors.foreground,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: theme.colors['muted-foreground'],
    marginBottom: 32,
    lineHeight: 24,
  },
  demoCard: {
    width: '100%',
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  friendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  archetypeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${theme.colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.foreground,
  },
  friendSubtext: {
    fontSize: 13,
    color: theme.colors['muted-foreground'],
    marginTop: 2,
  },
  comparisonContainer: {
    gap: 20,
  },
  scoreBarContainer: {
    gap: 8,
  },
  scoreBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreBarLabel: {
    fontSize: 15,
    color: theme.colors.foreground,
    fontWeight: '500',
  },
  multiplierBadge: {
    backgroundColor: theme.colors.muted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  multiplierText: {
    fontSize: 11,
    color: theme.colors['muted-foreground'],
    fontWeight: '600',
  },
  barBackground: {
    height: 12,
    backgroundColor: theme.colors.muted,
    borderRadius: 6,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.foreground,
    textAlign: 'right',
  },
  explanation: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  explanationText: {
    fontSize: 16,
    textAlign: 'center',
    color: theme.colors.foreground,
    lineHeight: 24,
  },
  bold: {
    fontWeight: '700',
  },
  reassurance: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  reassuranceText: {
    fontSize: 14,
    textAlign: 'center',
    color: theme.colors['muted-foreground'],
    fontStyle: 'italic',
  },
});
