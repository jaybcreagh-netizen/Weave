import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { theme } from '../../theme';

/**
 * QuickWeave (Logging) Tutorial Explainer
 * Explains the gesture-based logging mechanic
 */
export function QuickWeaveExplainer() {
  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.duration(500)}>
        <Text style={styles.title}>Looking back: QuickWeave</Text>
        <Text style={styles.subtitle}>
          The fastest way to log an interaction
        </Text>
      </Animated.View>

      <Animated.View
        style={styles.demoCard}
        entering={FadeInDown.delay(400).duration(500)}
      >
        <Text style={styles.demoEmoji}>👆</Text>
        <View style={styles.stepsList}>
          <View style={styles.step}>
            <Text style={styles.stepNumber}>1</Text>
            <Text style={styles.stepText}>
              <Text style={styles.bold}>Press & hold</Text> on a friend's card
            </Text>
          </View>
          <View style={styles.step}>
            <Text style={styles.stepNumber}>2</Text>
            <Text style={styles.stepText}>
              <Text style={styles.bold}>Drag</Text> to an activity you did together
            </Text>
          </View>
          <View style={styles.step}>
            <Text style={styles.stepNumber}>3</Text>
            <Text style={styles.stepText}>
              <Text style={styles.bold}>Release</Text> to log it instantly
            </Text>
          </View>
        </View>

        <View style={styles.resultBadge}>
          <Text style={styles.resultText}>✅ Logged! Score updated in seconds.</Text>
        </View>
      </Animated.View>

      <Animated.View
        style={styles.footer}
        entering={FadeInDown.delay(800).duration(400)}
      >
        <Text style={styles.footerText}>
          Perfect for quickly capturing moments as you remember them.{'\n'}
          Try it when you first add friends!
        </Text>
      </Animated.View>
    </View>
  );
}

/**
 * Intentions Tutorial Explainer
 * Explains the lightweight intention-setting feature
 */
export function IntentionExplainer() {
  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.duration(500)}>
        <Text style={styles.title}>Hold the thought: Intentions</Text>
        <Text style={styles.subtitle}>
          No pressure, just awareness
        </Text>
      </Animated.View>

      <Animated.View
        style={styles.explanationCard}
        entering={FadeInDown.delay(400).duration(500)}
      >
        <Text style={styles.explanationTitle}>What are intentions?</Text>
        <Text style={styles.explanationText}>
          Intentions are lightweight placeholders for when you want to connect
          but aren't ready to commit to a specific date:
        </Text>

        <View style={styles.examplesList}>
          <Text style={styles.exampleItem}>• "Grab coffee with Alex sometime"</Text>
          <Text style={styles.exampleItem}>• "Should check in on Sarah soon"</Text>
          <Text style={styles.exampleItem}>• "We talked about going hiking"</Text>
        </View>
      </Animated.View>

      <Animated.View
        style={styles.demoCard}
        entering={FadeInDown.delay(700).duration(500)}
      >
        <Text style={styles.demoLabel}>When you're ready:</Text>
        <View style={styles.actionsList}>
          <Text style={styles.actionItem}>📅 Schedule it → Becomes a concrete plan</Text>
          <Text style={styles.actionItem}>✅ Log it → If you already did it spontaneously</Text>
          <Text style={styles.actionItem}>✖️ Dismiss → No longer relevant</Text>
        </View>
      </Animated.View>

      <Animated.View
        style={styles.footer}
        entering={FadeInDown.delay(1000).duration(400)}
      >
        <Text style={styles.footerText}>
          Weave gently reminds you without pressure.{'\n'}
          Intentions keep possibilities alive.
        </Text>
      </Animated.View>
    </View>
  );
}

/**
 * Planning Tutorial Explainer
 * Explains the plan wizard and accountability system
 */
export function PlanningExplainer() {
  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.duration(500)}>
        <Text style={styles.title}>Make it real: Planning</Text>
        <Text style={styles.subtitle}>
          Turn "sometime" into a specific date
        </Text>
      </Animated.View>

      <Animated.View
        style={styles.explanationCard}
        entering={FadeInDown.delay(400).duration(500)}
      >
        <Text style={styles.explanationTitle}>Why plan?</Text>
        <Text style={styles.explanationText}>
          Planning turns vague ideas into concrete commitments:{'\n\n'}
          "We should hang out sometime" → "Saturday at 2pm, coffee at Bluestone"
        </Text>
      </Animated.View>

      <Animated.View
        style={styles.demoCard}
        entering={FadeInDown.delay(700).duration(500)}
      >
        <Text style={styles.demoLabel}>Creating a plan:</Text>
        <View style={styles.stepsList}>
          <View style={styles.step}>
            <Text style={styles.stepNumber}>1</Text>
            <Text style={styles.stepText}>Pick a date</Text>
          </View>
          <View style={styles.step}>
            <Text style={styles.stepNumber}>2</Text>
            <Text style={styles.stepText}>Choose an activity</Text>
          </View>
          <View style={styles.step}>
            <Text style={styles.stepNumber}>3</Text>
            <Text style={styles.stepText}>Add details (optional)</Text>
          </View>
        </View>
      </Animated.View>

      <Animated.View
        style={styles.demoCard}
        entering={FadeInDown.delay(1000).duration(500)}
      >
        <Text style={styles.demoLabel}>When the day arrives:</Text>
        <View style={styles.actionsList}>
          <Text style={styles.actionItem}>✅ Confirm → Auto-logged with full points</Text>
          <Text style={styles.actionItem}>📅 Reschedule → Pick a new date</Text>
          <Text style={styles.actionItem}>✖️ Cancel → No harm, life changes</Text>
        </View>
      </Animated.View>

      <Animated.View
        style={styles.footer}
        entering={FadeInDown.delay(1300).duration(400)}
      >
        <Text style={styles.footerText}>
          Gentle accountability helps you follow through.{'\n'}
          You'll try creating a plan after onboarding!
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
    marginBottom: 24,
  },
  demoCard: {
    width: '100%',
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 16,
    gap: 16,
  },
  demoEmoji: {
    fontSize: 48,
    textAlign: 'center',
  },
  demoLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.foreground,
    marginBottom: 4,
  },
  stepsList: {
    gap: 12,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 28,
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.foreground,
    lineHeight: 28,
  },
  bold: {
    fontWeight: '700',
  },
  resultBadge: {
    backgroundColor: `${theme.colors.primary}15`,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  resultText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
    textAlign: 'center',
  },
  explanationCard: {
    width: '100%',
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 16,
    gap: 12,
  },
  explanationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.foreground,
  },
  explanationText: {
    fontSize: 15,
    color: theme.colors.foreground,
    lineHeight: 22,
  },
  examplesList: {
    gap: 8,
    marginTop: 8,
  },
  exampleItem: {
    fontSize: 14,
    color: theme.colors['muted-foreground'],
    fontStyle: 'italic',
    lineHeight: 20,
  },
  actionsList: {
    gap: 10,
  },
  actionItem: {
    fontSize: 14,
    color: theme.colors.foreground,
    lineHeight: 20,
  },
  footer: {
    marginTop: 8,
    paddingHorizontal: 16,
  },
  footerText: {
    fontSize: 14,
    textAlign: 'center',
    color: theme.colors['muted-foreground'],
    lineHeight: 21,
  },
});
