import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Animated, { FadeInDown, FadeIn, FadeOut } from 'react-native-reanimated';
import { theme } from '../../theme';

interface ArchetypeExample {
  archetype: string;
  icon: string;
  essence: string;
  thrives: string;
  example: string;
}

const ARCHETYPE_EXAMPLES: ArchetypeExample[] = [
  {
    archetype: 'High Priestess',
    icon: '🌙',
    essence: 'Depth & intuition',
    thrives: 'Deep 1-on-1 talks over tea',
    example: 'A quick text feels shallow (0.8×), but a deep conversation gives 2× connection',
  },
  {
    archetype: 'Fool',
    icon: '🃏',
    essence: 'Spontaneity & play',
    thrives: 'Spontaneous adventures and playful moments',
    example: 'Quick texts are great (1.7×), planned milestones feel heavy (1.2×)',
  },
  {
    archetype: 'Empress',
    icon: '🌹',
    essence: 'Nurture & comfort',
    thrives: 'Cozy meals at home and caring gestures',
    example: 'Sharing a home-cooked meal together (1.8×) vs. a quick call (0.9×)',
  },
];

export function ArchetypeExplainer() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedExample = ARCHETYPE_EXAMPLES[selectedIndex];

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeInDown.duration(500)}>
        <Text style={styles.title}>Every friendship has a rhythm</Text>
        <Text style={styles.subtitle}>
          Understanding how each friend connects helps you nurture{'\n'}
          the relationship in ways that actually resonate.
        </Text>
      </Animated.View>

      {/* Archetype selector */}
      <View style={styles.selectorContainer}>
        {ARCHETYPE_EXAMPLES.map((example, index) => (
          <TouchableOpacity
            key={example.archetype}
            style={[
              styles.selectorButton,
              selectedIndex === index && styles.selectorButtonActive,
            ]}
            onPress={() => setSelectedIndex(index)}
            activeOpacity={0.7}
          >
            <Text style={styles.selectorIcon}>{example.icon}</Text>
            <Text
              style={[
                styles.selectorText,
                selectedIndex === index && styles.selectorTextActive,
              ]}
              numberOfLines={1}
            >
              {example.archetype}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Selected archetype card */}
      <Animated.View
        key={selectedIndex}
        style={styles.card}
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.iconContainer}>
            <Text style={styles.cardIcon}>{selectedExample.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{selectedExample.archetype}</Text>
            <Text style={styles.cardEssence}>{selectedExample.essence}</Text>
          </View>
        </View>

        <View style={styles.cardSection}>
          <Text style={styles.sectionLabel}>Thrives on:</Text>
          <Text style={styles.sectionText}>{selectedExample.thrives}</Text>
        </View>

        <View style={styles.cardSection}>
          <Text style={styles.sectionLabel}>Impact example:</Text>
          <Text style={styles.sectionText}>{selectedExample.example}</Text>
        </View>
      </Animated.View>

      <Animated.View
        style={styles.footer}
        entering={FadeInDown.delay(400).duration(400)}
      >
        <Text style={styles.footerText}>
          You'll choose an archetype for your first friend in a moment.
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
    fontSize: 15,
    textAlign: 'center',
    color: theme.colors['muted-foreground'],
    marginBottom: 24,
    lineHeight: 22,
  },
  selectorContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.card,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  selectorButtonActive: {
    borderColor: theme.colors.primary,
    backgroundColor: `${theme.colors.primary}10`,
  },
  selectorIcon: {
    fontSize: 20,
  },
  selectorText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors['muted-foreground'],
  },
  selectorTextActive: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  card: {
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
    gap: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: `${theme.colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIcon: {
    fontSize: 28,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.foreground,
    marginBottom: 2,
  },
  cardEssence: {
    fontSize: 14,
    color: theme.colors['muted-foreground'],
    fontStyle: 'italic',
  },
  cardSection: {
    gap: 6,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionText: {
    fontSize: 15,
    color: theme.colors.foreground,
    lineHeight: 22,
  },
  footer: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  footerText: {
    fontSize: 14,
    textAlign: 'center',
    color: theme.colors['muted-foreground'],
    fontStyle: 'italic',
  },
});
