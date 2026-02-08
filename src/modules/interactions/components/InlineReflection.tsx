import React, { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity } from 'react-native';
import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { useTheme } from '@/shared/hooks/useTheme';
import Interaction from '@/db/models/Interaction';
import { generateWeavePrompts } from '@/modules/journal';
import type { MeaningfulWeave } from '@/modules/journal';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ThreadContinuityBar } from '@/modules/journal/components/ThreadContinuityBar';
import { useActiveThreads } from '@/modules/journal/hooks/useActiveThreads';
import FriendModel from '@/db/models/Friend';

interface InlineReflectionProps {
    interaction: Interaction;
    friends: FriendModel[];
    onComplete: (text: string) => void;
    onGoDeeper: () => void;
    initialNotes?: string;
}

export const InlineReflection: React.FC<InlineReflectionProps> = ({
    interaction,
    friends,
    onComplete,
    onGoDeeper,
    initialNotes
}) => {
    const { colors } = useTheme();
    const [text, setText] = useState('');
    const [prompt, setPrompt] = useState('');

    const friendIds = friends.map(f => f.id);
    const { threads } = useActiveThreads(friendIds);

    useEffect(() => {
        // Build a MeaningfulWeave wrapper for the prompt generator
        const weave: MeaningfulWeave = {
            interaction,
            friends,
            meaningfulnessScore: 50,
            meaningfulnessReasons: [],
        };
        const prompts = generateWeavePrompts(weave);
        if (prompts && prompts.length > 0) {
            setPrompt(prompts[0].question);
        }
    }, [interaction, friends]);

    const handleThreadSelect = (thread: any) => {
        const insertion = `Updating on ${thread.topic}... `;
        setText(prev => prev ? `${prev}\n${insertion}` : insertion);
    };

    return (
        <Animated.View
            entering={FadeInDown.duration(400).springify()}
            className="flex-1 bg-background pt-6 px-5"
        >
            {/* Context from Notes (if any) */}
            {initialNotes && (
                <View
                    className="mb-5 px-4 py-3 rounded-xl"
                    style={{ backgroundColor: colors.muted, borderLeftWidth: 3, borderLeftColor: colors.primary + '40' }}
                >
                    <Text
                        variant="caption"
                        style={{ color: colors['muted-foreground'], fontSize: 10, letterSpacing: 0.5, marginBottom: 4 }}
                    >
                        YOUR NOTES
                    </Text>
                    <Text
                        variant="body"
                        style={{ color: colors.foreground, fontStyle: 'italic', lineHeight: 20 }}
                    >
                        "{initialNotes}"
                    </Text>
                </View>
            )}

            {/* Prompt */}
            <Text
                variant="body"
                weight="medium"
                style={{ color: colors.foreground, fontSize: 18, lineHeight: 26, marginBottom: 16 }}
            >
                {prompt}
            </Text>

            {/* Thread Continuity */}
            <ThreadContinuityBar
                threads={threads}
                onSelectThread={handleThreadSelect}
            />

            {/* Input Area */}
            <TextInput
                className="flex-1 min-h-[120px]"
                multiline
                placeholder="Start writing..."
                placeholderTextColor={colors['muted-foreground']}
                value={text}
                onChangeText={setText}
                autoFocus
                textAlignVertical="top"
                style={{ color: colors.foreground, fontSize: 17, lineHeight: 26 }}
            />

            {/* Actions */}
            <View className="mt-4 flex-row justify-between items-center pb-8">
                <TouchableOpacity
                    onPress={onGoDeeper}
                    className="flex-row items-center px-4 py-2.5 rounded-full"
                    style={{ backgroundColor: colors.primary + '10' }}
                    activeOpacity={0.7}
                >
                    <Icon name="Sparkles" size={14} color={colors.primary} />
                    <Text
                        variant="body"
                        weight="medium"
                        style={{ color: colors.primary, fontSize: 14, marginLeft: 6 }}
                    >
                        Go deeper
                    </Text>
                </TouchableOpacity>

                <Button
                    label="Done"
                    onPress={() => onComplete(text)}
                    size="md"
                    className="rounded-full px-8"
                />
            </View>
        </Animated.View>
    );
};
