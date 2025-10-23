import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, BlurView } from 'react-native';
import Animated, { FadeIn, ZoomIn, FadeInDown } from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { type ReflectionSentence } from '../lib/reflection-sentences';
import { useTheme } from '../hooks/useTheme';

interface SelectedSentenceCardProps {
  sentence: ReflectionSentence;
  componentOverrides: Record<string, string>;
  onComponentChange: (componentId: string, value: string) => void;
  onDeselect: () => void;
  onShowMore?: () => void; // Optional callback to show more chips
}

/**
 * Displays the selected sentence with tappable components
 * User can tap underlined words to see alternatives
 */
export function SelectedSentenceCard({
  sentence,
  componentOverrides,
  onComponentChange,
  onDeselect,
  onShowMore,
}: SelectedSentenceCardProps) {
  const { colors } = useTheme();
  const [editingComponent, setEditingComponent] = useState<string | null>(null);

  // Build the sentence with current component values
  const buildSentenceText = () => {
    let text = sentence.template;

    Object.entries(sentence.components).forEach(([componentId, component]) => {
      const value = componentOverrides[componentId] || component.original;
      text = text.replace(`{${componentId}}`, value);
    });

    return text;
  };

  // Parse the template to find component positions
  const parseTemplateForComponents = () => {
    const parts: Array<{ type: 'text' | 'component'; value: string; componentId?: string }> = [];
    let remaining = sentence.template;

    // Find all {component_id} placeholders
    const regex = /\{([^}]+)\}/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(sentence.template)) !== null) {
      // Add text before the component
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          value: remaining.substring(lastIndex, match.index),
        });
      }

      // Add the component
      const componentId = match[1];
      const component = sentence.components[componentId];
      const value = componentOverrides[componentId] || component.original;

      parts.push({
        type: 'component',
        value,
        componentId,
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < sentence.template.length) {
      parts.push({
        type: 'text',
        value: remaining.substring(lastIndex),
      });
    }

    return parts;
  };

  const parts = parseTemplateForComponents();

  return (
    <Animated.View
      entering={ZoomIn.duration(400).springify()}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.primary,
        },
      ]}
    >
      {/* Remove button */}
      <TouchableOpacity
        style={styles.removeButton}
        onPress={onDeselect}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <X size={20} color={colors['muted-foreground']} />
      </TouchableOpacity>

      {/* Sentence with tappable components */}
      <View style={styles.sentenceContainer}>
        <Text style={[styles.sentence, { color: colors.foreground }]}>
          {parts.map((part, index) => {
            if (part.type === 'text') {
              return <Text key={index}>{part.value}</Text>;
            }

            // Tappable component
            return (
              <TouchableOpacity
                key={index}
                onPress={() => setEditingComponent(part.componentId!)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.componentText,
                    { color: colors.primary },
                  ]}
                >
                  {part.value}
                </Text>
              </TouchableOpacity>
            );
          })}
        </Text>
      </View>

      {/* Hint and Show More button */}
      <View style={styles.footer}>
        <Text style={[styles.hint, { color: colors['muted-foreground'] }]}>
          Tap colored words to customize
        </Text>
        {onShowMore && (
          <TouchableOpacity onPress={onShowMore} style={styles.showMoreButton}>
            <Text style={[styles.showMoreText, { color: colors.primary }]}>
              or choose different
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Component editor modal - blur background with vertical bubble buttons */}
      {editingComponent && (
        <Modal
          visible={true}
          transparent
          animationType="none"
          onRequestClose={() => setEditingComponent(null)}
        >
          <Animated.View
            entering={FadeIn.duration(200)}
            style={styles.modalOverlay}
          >
            {/* Blur background */}
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setEditingComponent(null)}
            >
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]} />
            </TouchableOpacity>

            {/* Vertical bubble menu */}
            <Animated.View
              entering={FadeInDown.duration(300).springify()}
              style={styles.bubbleMenu}
            >
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                Choose alternative
              </Text>

              {/* Show original + alternatives as vertical bubbles */}
              {[
                sentence.components[editingComponent].original,
                ...sentence.components[editingComponent].alternatives,
              ].map((option, index) => {
                const isSelected = (componentOverrides[editingComponent] || sentence.components[editingComponent].original) === option;

                return (
                  <Animated.View
                    key={index}
                    entering={FadeInDown.duration(300).delay(index * 50)}
                  >
                    <TouchableOpacity
                      style={[
                        styles.bubbleButton,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.card,
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => {
                        onComponentChange(editingComponent, option);
                        setEditingComponent(null);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.bubbleText,
                          {
                            color: isSelected ? colors['primary-foreground'] : colors.foreground,
                            fontWeight: isSelected ? '600' : '500',
                          },
                        ]}
                      >
                        {option}
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}

              {/* Close button */}
              <TouchableOpacity
                style={styles.closeButtonCircle}
                onPress={() => setEditingComponent(null)}
              >
                <X size={24} color={colors.foreground} />
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        </Modal>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    gap: 8,
  },
  removeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
  },
  sentenceContainer: {
    paddingRight: 30, // Space for remove button
  },
  sentence: {
    fontSize: 17,
    lineHeight: 26,
  },
  componentText: {
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  hint: {
    fontSize: 12,
    fontStyle: 'italic',
    flex: 1,
  },
  showMoreButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  showMoreText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubbleMenu: {
    width: '80%',
    maxWidth: 400,
    gap: 12,
    paddingBottom: 80, // Space for close button
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
    color: '#fff',
  },
  bubbleButton: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 24,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  bubbleText: {
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  closeButtonCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});
