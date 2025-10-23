import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { theme } from '../theme';
import { selectReflectionPrompt, type ReflectionPrompt } from '../lib/reflection-prompts';
import { type InteractionCategory, type Archetype, type Vibe } from './types';

interface ContextualReflectionInputProps {
  category: InteractionCategory;
  archetype?: Archetype;
  vibe?: Vibe | null;
  value: string;
  onChange: (text: string) => void;
  multiline?: boolean;
}

/**
 * Smart reflection input that shows contextual prompts
 * based on category, archetype, and vibe
 */
export function ContextualReflectionInput({
  category,
  archetype,
  vibe,
  value,
  onChange,
  multiline = true,
}: ContextualReflectionInputProps) {
  const [prompt, setPrompt] = useState<ReflectionPrompt | null>(null);

  // Update prompt when context changes
  useEffect(() => {
    const selectedPrompt = selectReflectionPrompt(
      category,
      archetype,
      vibe || undefined
    );
    setPrompt(selectedPrompt);
  }, [category, archetype, vibe]);

  if (!prompt) {
    return null;
  }

  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.container}>
      {/* Prompt question */}
      <Text style={styles.promptText}>{prompt.prompt}</Text>

      {/* Text input */}
      <TextInput
        style={[
          styles.input,
          multiline && styles.multilineInput
        ]}
        placeholder={prompt.placeholder || 'Share your thoughts...'}
        placeholderTextColor={theme.colors['muted-foreground']}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
      />

      {/* Optional: Show prompt metadata in dev mode */}
      {__DEV__ && (
        <Text style={styles.debugText}>
          Prompt ID: {prompt.id}
        </Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  promptText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.foreground,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: theme.colors.card,
    color: theme.colors.foreground,
  },
  multilineInput: {
    height: 120,
    textAlignVertical: 'top',
  },
  debugText: {
    fontSize: 10,
    color: theme.colors['muted-foreground'],
    fontStyle: 'italic',
    marginTop: 4,
  },
});
