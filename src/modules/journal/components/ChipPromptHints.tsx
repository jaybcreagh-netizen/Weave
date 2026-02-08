import React from 'react';
import { View } from 'react-native';
import { Text } from '@/shared/ui/Text';
import { Icon } from '@/shared/ui/Icon';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTheme } from '@/shared/hooks/useTheme';
import { STORY_CHIPS, CHIP_PROMPTS, type StoryChip } from '@/modules/reflection/services/story-chips.service';

interface ChipPromptHintsProps {
    selectedChipIds: string[];
    textLength: number;
}

export const ChipPromptHints: React.FC<ChipPromptHintsProps> = ({ selectedChipIds, textLength }) => {
    const { colors } = useTheme();

    if (textLength > 50 || selectedChipIds.length === 0) return null;

    const prompts = selectedChipIds
        .map(id => STORY_CHIPS.find(c => c.id === id))
        .filter((c): c is StoryChip => !!c)
        .map(chip => CHIP_PROMPTS[chip.type])
        .filter(Boolean);

    const uniquePrompts = Array.from(new Set(prompts));

    if (uniquePrompts.length === 0) return null;

    return (
        <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(200)} className="py-2">
            {uniquePrompts.map((prompt, index) => (
                <View key={prompt} className="flex-row items-start gap-2 mb-1.5">
                    <Icon
                        name="Lightbulb"
                        size={12}
                        color={colors.primary + '60'}
                        style={{ marginTop: 2 }}
                    />
                    <Text
                        variant="caption"
                        style={{
                            color: colors['muted-foreground'],
                            fontStyle: 'italic',
                            fontSize: 13,
                            lineHeight: 18,
                            flex: 1,
                        }}
                    >
                        {prompt}
                    </Text>
                </View>
            ))}
        </Animated.View>
    );
};
