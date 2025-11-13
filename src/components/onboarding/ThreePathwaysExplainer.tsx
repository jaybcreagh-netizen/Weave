import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Lightbulb, Calendar, CheckCircle2 } from 'lucide-react-native';
import { theme } from '../../theme';

interface PathwayCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  example: string;
  delay: number;
}

function PathwayCard({ icon, title, subtitle, example, delay }: PathwayCardProps) {
  return (
    <Animated.View
      style={styles.card}
      entering={FadeInDown.delay(delay).duration(400).springify()}
    >
      <View style={styles.iconContainer}>
        {icon}
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>
        <View style={styles.exampleChip}>
          <Text style={styles.exampleText}>{example}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

export function ThreePathwaysExplainer() {
  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.duration(500)}>
        <Text style={styles.title}>Three ways to stay connected</Text>
        <Text style={styles.subtitle}>Use whichever feels right in the moment</Text>
      </Animated.View>

      <View style={styles.pathwaysContainer}>
        <PathwayCard
          icon={<Lightbulb size={28} color={theme.colors.primary} />}
          title="Hold the thought"
          subtitle="Want to connect but not sure when? Set an intention."
          example="Catch up with Alex soon"
          delay={200}
        />

        <PathwayCard
          icon={<Calendar size={28} color={theme.colors.primary} />}
          title="Make it real"
          subtitle="Ready to commit? Schedule a plan with a date."
          example="Coffee with Sarah - Saturday 2pm"
          delay={400}
        />

        <PathwayCard
          icon={<CheckCircle2 size={28} color={theme.colors.primary} />}
          title="Remember what happened"
          subtitle="Already connected? Log it to track your bond."
          example="Dinner with Mike last night"
          delay={600}
        />
      </View>

      <Animated.View
        style={styles.footer}
        entering={FadeInDown.delay(800).duration(400)}
      >
        <Text style={styles.footerText}>
          Weave meets you where you are.
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
  pathwaysContainer: {
    width: '100%',
    gap: 16,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: `${theme.colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.foreground,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: theme.colors['muted-foreground'],
    lineHeight: 20,
    marginBottom: 8,
  },
  exampleChip: {
    backgroundColor: theme.colors.muted,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  exampleText: {
    fontSize: 13,
    color: theme.colors['muted-foreground'],
    fontStyle: 'italic',
  },
  footer: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 16,
    textAlign: 'center',
    color: theme.colors.foreground,
    fontWeight: '500',
  },
});
