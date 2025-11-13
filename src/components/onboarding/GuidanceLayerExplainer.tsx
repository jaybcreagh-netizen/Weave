import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeIn, FadeOut } from 'react-native-reanimated';
import { Lightbulb, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react-native';
import { theme } from '../../theme';

interface FocusExample {
  icon: React.ReactNode;
  type: string;
  title: string;
  subtitle: string;
  color: string;
}

const FOCUS_EXAMPLES: FocusExample[] = [
  {
    icon: <Lightbulb size={20} color={theme.colors.primary} />,
    type: 'Active Intention',
    title: 'Ready to schedule?',
    subtitle: 'You wanted to connect with Alex',
    color: theme.colors.primary,
  },
  {
    icon: <Calendar size={20} color="#10b981" />,
    type: 'Plan Today',
    title: 'Coffee with Sarah',
    subtitle: 'Today at 2pm',
    color: '#10b981',
  },
  {
    icon: <AlertCircle size={20} color="#f59e0b" />,
    type: 'Friend Fading',
    title: 'Mike needs attention',
    subtitle: 'Score at 18 - Haven't connected in 4 weeks',
    color: '#f59e0b',
  },
  {
    icon: <CheckCircle2 size={20} color="#8b5cf6" />,
    type: 'Pending Confirmation',
    title: 'Did dinner happen?',
    subtitle: 'Your plan with Rachel last night',
    color: '#8b5cf6',
  },
];

export function GuidanceLayerExplainer() {
  const [currentExample, setCurrentExample] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentExample((prev) => (prev + 1) % FOCUS_EXAMPLES.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const example = FOCUS_EXAMPLES[currentExample];

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.duration(500)}>
        <Text style={styles.title}>Weave guides you proactively</Text>
        <Text style={styles.subtitle}>
          Your home screen becomes a relationship compass
        </Text>
      </Animated.View>

      {/* Mock Today's Focus Widget */}
      <View style={styles.widgetPreview}>
        <View style={styles.widgetHeader}>
          <Text style={styles.widgetTitle}>Today's Focus</Text>
        </View>

        <Animated.View
          key={currentExample}
          style={styles.focusCard}
          entering={FadeIn.duration(400)}
          exiting={FadeOut.duration(300)}
        >
          <View style={[styles.focusIconContainer, { backgroundColor: `${example.color}15` }]}>
            {example.icon}
          </View>
          <View style={styles.focusContent}>
            <Text style={styles.focusType}>{example.type}</Text>
            <Text style={styles.focusTitle}>{example.title}</Text>
            <Text style={styles.focusSubtitle}>{example.subtitle}</Text>
          </View>
        </Animated.View>

        {/* Page indicators */}
        <View style={styles.indicators}>
          {FOCUS_EXAMPLES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.indicator,
                currentExample === index && styles.indicatorActive,
              ]}
            />
          ))}
        </View>
      </View>

      <Animated.View
        style={styles.features}
        entering={FadeInDown.delay(600).duration(400)}
      >
        <Text style={styles.featuresTitle}>You won't have to remember:</Text>
        <View style={styles.featuresList}>
          <View style={styles.featureItem}>
            <Text style={styles.featureBullet}>💡</Text>
            <Text style={styles.featureText}>Active intentions waiting for you</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureBullet}>📅</Text>
            <Text style={styles.featureText}>Plans coming up today</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureBullet}>⚠️</Text>
            <Text style={styles.featureText}>Friends who need attention</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureBullet}>✅</Text>
            <Text style={styles.featureText}>Past plans to confirm</Text>
          </View>
        </View>
      </Animated.View>

      <Animated.View
        style={styles.footer}
        entering={FadeInDown.delay(800).duration(400)}
      >
        <Text style={styles.footerText}>
          It's gentle guidance, not nagging.
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
  widgetPreview: {
    width: '100%',
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    minHeight: 180,
  },
  widgetHeader: {
    marginBottom: 12,
  },
  widgetTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.foreground,
  },
  focusCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  focusIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusContent: {
    flex: 1,
    gap: 2,
  },
  focusType: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  focusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.foreground,
  },
  focusSubtitle: {
    fontSize: 13,
    color: theme.colors['muted-foreground'],
  },
  indicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.muted,
  },
  indicatorActive: {
    backgroundColor: theme.colors.primary,
    width: 20,
  },
  features: {
    marginTop: 24,
    width: '100%',
    gap: 12,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.foreground,
    marginBottom: 4,
  },
  featuresList: {
    gap: 10,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureBullet: {
    fontSize: 20,
    width: 28,
  },
  featureText: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.foreground,
  },
  footer: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  footerText: {
    fontSize: 15,
    textAlign: 'center',
    color: theme.colors['muted-foreground'],
    fontStyle: 'italic',
  },
});
