import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { selectReflectionSentences, type ReflectionSentence } from '../lib/reflection-sentences';
import { type InteractionCategory, type Archetype, type Vibe } from './types';
import { useTheme } from '../hooks/useTheme';

interface ReflectionSentenceChipsProps {
  category: InteractionCategory;
  archetype?: Archetype;
  vibe?: Vibe | null;
  onSentenceSelect: (sentence: ReflectionSentence) => void;
}

/**
 * Simple sentence chip selector
 * Shows 4-6 complete reflections - tap one to use it
 */
export function ReflectionSentenceChips({
  category,
  archetype,
  vibe,
  onSentenceSelect,
}: ReflectionSentenceChipsProps) {
  const { colors } = useTheme();
  const [sentences, setSentences] = useState<ReflectionSentence[]>([]);

  // Update sentences when context changes
  useEffect(() => {
    const selected = selectReflectionSentences(
      category,
      archetype,
      vibe || undefined,
      6
    );
    setSentences(selected);
  }, [category, archetype, vibe]);

  if (sentences.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.hint, { color: colors['muted-foreground'] }]}>
        Tap to use, or write your own below
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {sentences.map((sentence, index) => (
          <Animated.View
            key={sentence.id}
            entering={FadeInDown.duration(400).delay(index * 80)}
          >
            <TouchableOpacity
              style={[
                styles.chip,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => onSentenceSelect(sentence)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, { color: colors.foreground }]}>
                {sentence.plainText}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  hint: {
    fontSize: 13,
    fontWeight: '500',
    paddingLeft: 4,
  },
  scrollContent: {
    gap: 12,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    maxWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  chipText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
});
