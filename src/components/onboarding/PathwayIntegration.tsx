import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { Lightbulb, Calendar, CheckCircle2, TrendingUp } from 'lucide-react-native';
import { theme } from '../../theme';

interface FlowStepProps {
  icon: React.ReactNode;
  day: string;
  action: string;
  description: string;
  delay: number;
  isLast?: boolean;
}

function FlowStep({ icon, day, action, description, delay, isLast }: FlowStepProps) {
  const lineHeight = useSharedValue(0);

  useEffect(() => {
    if (!isLast) {
      lineHeight.value = withDelay(
        delay + 300,
        withTiming(1, { duration: 400 })
      );
    }
  }, []);

  const animatedLineStyle = useAnimatedStyle(() => ({
    height: `${lineHeight.value * 100}%`,
  }));

  return (
    <View style={styles.flowStepContainer}>
      <Animated.View
        style={styles.flowStep}
        entering={FadeInDown.delay(delay).duration(400).springify()}
      >
        <View style={styles.stepIcon}>
          {icon}
        </View>
        <View style={styles.stepContent}>
          <Text style={styles.stepDay}>{day}</Text>
          <Text style={styles.stepAction}>{action}</Text>
          <Text style={styles.stepDescription}>{description}</Text>
        </View>
      </Animated.View>
      {!isLast && (
        <View style={styles.lineContainer}>
          <Animated.View style={[styles.connectingLine, animatedLineStyle]} />
        </View>
      )}
    </View>
  );
}

export function PathwayIntegration() {
  const resultOpacity = useSharedValue(0);
  const resultScale = useSharedValue(0.8);

  useEffect(() => {
    resultOpacity.value = withDelay(2200, withTiming(1, { duration: 400 }));
    resultScale.value = withDelay(
      2200,
      withSequence(
        withTiming(1.1, { duration: 200 }),
        withTiming(1, { duration: 200 })
      )
    );
  }, []);

  const animatedResultStyle = useAnimatedStyle(() => ({
    opacity: resultOpacity.value,
    transform: [{ scale: resultScale.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.duration(500)}>
        <Text style={styles.title}>How they work together</Text>
        <Text style={styles.subtitle}>
          A typical journey from intention to connection
        </Text>
      </Animated.View>

      <View style={styles.scenarioCard}>
        <View style={styles.flowContainer}>
          <FlowStep
            icon={<Lightbulb size={20} color={theme.colors.primary} />}
            day="Monday"
            action="💡 Set intention"
            description='"Want to see Alex soon"'
            delay={600}
          />

          <FlowStep
            icon={<Calendar size={20} color={theme.colors.primary} />}
            day="Wednesday"
            action="📅 Schedule plan"
            description="Intention reminder → Schedule for Saturday"
            delay={1000}
          />

          <FlowStep
            icon={<CheckCircle2 size={20} color={theme.colors.primary} />}
            day="Saturday"
            action="✅ Confirm & log"
            description="Plan happens → Auto-logged"
            delay={1400}
            isLast
          />
        </View>

        <Animated.View style={[styles.resultBadge, animatedResultStyle]}>
          <TrendingUp size={18} color="#10b981" />
          <Text style={styles.resultText}>Score: 68 → 84 points!</Text>
        </Animated.View>
      </View>

      <Animated.View
        style={styles.alternativeCard}
        entering={FadeIn.delay(2400).duration(400)}
      >
        <Text style={styles.alternativeTitle}>Or take a different path:</Text>
        <View style={styles.alternativeFlow}>
          <Text style={styles.alternativeText}>
            💡 Set intention → ✅ Spontaneously hung out → Log it directly
          </Text>
          <Text style={styles.alternativeSubtext}>(Intention auto-dismissed)</Text>
        </View>
      </Animated.View>

      <Animated.View
        style={styles.footer}
        entering={FadeInDown.delay(2600).duration(400)}
      >
        <Text style={styles.footerTitle}>Use the right tool for the moment:</Text>
        <View style={styles.footerList}>
          <Text style={styles.footerItem}>💡 Intentions = Possibilities without pressure</Text>
          <Text style={styles.footerItem}>📅 Plans = Commitments with accountability</Text>
          <Text style={styles.footerItem}>✅ Logs = Reflecting on what happened</Text>
        </View>
        <Text style={styles.footerNote}>
          They're all valid. They all strengthen the weave.
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
  },
  scenarioCard: {
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
  flowContainer: {
    gap: 0,
  },
  flowStepContainer: {
    position: 'relative',
  },
  flowStep: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
  },
  stepIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${theme.colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepContent: {
    flex: 1,
  },
  stepDay: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  stepAction: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.foreground,
    marginBottom: 2,
  },
  stepDescription: {
    fontSize: 14,
    color: theme.colors['muted-foreground'],
    fontStyle: 'italic',
  },
  lineContainer: {
    position: 'absolute',
    left: 18,
    top: 44,
    bottom: -8,
    width: 2,
    backgroundColor: theme.colors.muted,
    overflow: 'hidden',
  },
  connectingLine: {
    width: '100%',
    backgroundColor: theme.colors.primary,
    opacity: 0.4,
  },
  resultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#10b98115',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 16,
    alignSelf: 'center',
  },
  resultText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#10b981',
  },
  alternativeCard: {
    width: '100%',
    backgroundColor: theme.colors.muted,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  alternativeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.foreground,
    marginBottom: 8,
  },
  alternativeFlow: {
    gap: 4,
  },
  alternativeText: {
    fontSize: 14,
    color: theme.colors.foreground,
    lineHeight: 20,
  },
  alternativeSubtext: {
    fontSize: 12,
    color: theme.colors['muted-foreground'],
    fontStyle: 'italic',
  },
  footer: {
    marginTop: 24,
    paddingHorizontal: 8,
    gap: 12,
  },
  footerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.foreground,
    textAlign: 'center',
  },
  footerList: {
    gap: 8,
  },
  footerItem: {
    fontSize: 14,
    color: theme.colors.foreground,
    lineHeight: 20,
  },
  footerNote: {
    fontSize: 14,
    textAlign: 'center',
    color: theme.colors['muted-foreground'],
    fontStyle: 'italic',
    marginTop: 4,
  },
});
