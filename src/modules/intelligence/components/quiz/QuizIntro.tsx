/**
 * QuizIntro
 * 
 * Intro screen with headline and CTA to start the quiz.
 */

import React from 'react';
import { View } from 'react-native';
import { Sparkles } from 'lucide-react-native';

import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { useTheme } from '@/shared/hooks/useTheme';

interface QuizIntroProps {
    onStart: () => void;
}

export function QuizIntro({ onStart }: QuizIntroProps) {
    const { colors } = useTheme();

    return (
        <View className="flex-1 justify-between px-6 pt-16 pb-10">
            <View className="flex-1 items-center justify-center">
                <View
                    className="w-24 h-24 rounded-full items-center justify-center mb-8"
                    style={{ backgroundColor: colors.primary + '20' }}
                >
                    <Sparkles size={48} color={colors.primary} />
                </View>

                <Text variant="h1" className="text-center mb-3">
                    Discover Your Archetype
                </Text>

                <Text
                    variant="body"
                    className="text-center mb-2"
                    style={{ color: colors['muted-foreground'] }}
                >
                    8 quick questions about how you connect
                </Text>

                <Text
                    variant="caption"
                    className="text-center"
                    style={{ color: colors['muted-foreground'] }}
                >
                    Takes about 60 seconds
                </Text>
            </View>

            <View className="pt-5">
                <Button
                    variant="primary"
                    label="Let's go"
                    onPress={onStart}
                    className="w-full"
                />
            </View>
        </View>
    );
}
