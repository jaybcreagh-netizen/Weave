import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import Animated, { FadeIn, ZoomIn, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { tagSelector, tagAssembler, type ReflectionTag } from '../lib/reflection-tags';
import { type InteractionCategory, type Archetype, type Vibe } from './types';
import { useTheme } from '../hooks/useTheme';

interface ReflectionTagChipsProps {
  category: InteractionCategory;
  archetype?: Archetype;
  vibe?: Vibe | null;
  selectedTags: string[]; // Array of tag IDs
  onTagsChange: (tagIds: string[]) => void;
  maxTags?: number; // Optional limit on number of tags
}

/**
 * Interactive tag/chip selector
 * Users tap chips to build reflections
 */
export function ReflectionTagChips({
  category,
  archetype,
  vibe,
  selectedTags,
  onTagsChange,
  maxTags = 5,
}: ReflectionTagChipsProps) {
  const { colors } = useTheme();
  const [availableTags, setAvailableTags] = useState<ReflectionTag[]>([]);
  const [showAll, setShowAll] = useState(false);

  // Update available tags when context changes
  useEffect(() => {
    const tags = tagSelector.selectTags(
      { category, archetype, vibe: vibe || undefined },
      showAll ? 30 : 12
    );
    setAvailableTags(tags);
  }, [category, archetype, vibe, showAll]);

  const handleTagPress = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      // Deselect
      onTagsChange(selectedTags.filter(id => id !== tagId));
    } else {
      // Select (if under limit)
      if (selectedTags.length < maxTags) {
        onTagsChange([...selectedTags, tagId]);
      }
    }
  };

  // Group tags by type for better organization
  const groupedTags = availableTags.reduce((acc, tag) => {
    if (!acc[tag.type]) {
      acc[tag.type] = [];
    }
    acc[tag.type].push(tag);
    return acc;
  }, {} as Record<string, ReflectionTag[]>);

  const typeOrder = ['topic', 'action', 'quality', 'connection'];
  const typeLabels = {
    topic: 'What',
    action: 'Did',
    quality: 'How',
    connection: 'Felt',
  };

  return (
    <View style={styles.container}>
      {/* Tag groups by type */}
      {typeOrder.map((type, typeIndex) => {
        const tags = groupedTags[type] || [];
        if (tags.length === 0) return null;

        return (
          <Animated.View
            key={type}
            entering={FadeIn.duration(400).delay(typeIndex * 100)}
            style={styles.typeGroup}
          >
            {/* Type label */}
            <Text style={[styles.typeLabel, { color: colors['muted-foreground'] }]}>
              {typeLabels[type as keyof typeof typeLabels]}
            </Text>

            {/* Horizontal scroll of chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipScroll}
            >
              {tags.map((tag, index) => {
                const isSelected = selectedTags.includes(tag.id);
                const isDisabled = !isSelected && selectedTags.length >= maxTags;

                return (
                  <Animated.View
                    key={tag.id}
                    entering={ZoomIn.duration(300).delay(index * 50)}
                  >
                    <TagChip
                      tag={tag}
                      isSelected={isSelected}
                      isDisabled={isDisabled}
                      onPress={() => handleTagPress(tag.id)}
                      colors={colors}
                    />
                  </Animated.View>
                );
              })}
            </ScrollView>
          </Animated.View>
        );
      })}

      {/* Show more/less button */}
      {!showAll && availableTags.length >= 12 && (
        <TouchableOpacity
          style={[styles.moreButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => setShowAll(true)}
        >
          <Text style={[styles.moreButtonText, { color: colors['muted-foreground'] }]}>
            Show more tags...
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/**
 * Individual tag chip component
 */
function TagChip({
  tag,
  isSelected,
  isDisabled,
  onPress,
  colors,
}: {
  tag: ReflectionTag;
  isSelected: boolean;
  isDisabled: boolean;
  onPress: () => void;
  colors: any;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: withSpring(isSelected ? 1.05 : 1) },
      ],
    };
  });

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={[
          styles.chip,
          { backgroundColor: colors.card, borderColor: colors.border },
          isSelected && [styles.chipSelected, {
            backgroundColor: colors.primary,
            borderColor: colors.primary
          }],
          isDisabled && styles.chipDisabled,
        ]}
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.7}
      >
        {tag.emoji && <Text style={styles.chipEmoji}>{tag.emoji}</Text>}
        <Text
          style={[
            styles.chipLabel,
            { color: colors.foreground },
            isSelected && { color: colors['primary-foreground'] },
            isDisabled && { color: colors['muted-foreground'] },
          ]}
        >
          {tag.label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  typeGroup: {
    gap: 8,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingLeft: 4,
  },
  chipScroll: {
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  chipSelected: {
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  chipDisabled: {
    opacity: 0.4,
  },
  chipEmoji: {
    fontSize: 16,
  },
  chipLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  moreButton: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 8,
  },
  moreButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
