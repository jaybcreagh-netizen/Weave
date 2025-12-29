/**
 * QuizPromptCard
 * 
 * Soft prompt shown after first weave is logged.
 * "Nice - you're tracking your connections. Want to discover your friendship style?"
 */

import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { X, Sparkles, ArrowRight } from 'lucide-react-native';
import { router } from 'expo-router';

import { Text } from '@/shared/ui/Text';
import { Card } from '@/shared/ui/Card';
import { useTheme } from '@/shared/hooks/useTheme';
import { useTutorialStore } from '@/shared/stores/tutorialStore';

interface QuizPromptCardProps {
    onDismiss?: () => void;
}

export function QuizPromptCard({ onDismiss }: QuizPromptCardProps) {
    const { colors } = useTheme();
    const { markQuizPromptSeen, markQuizTaken } = useTutorialStore();

    const handleTakeQuiz = async () => {
        await markQuizPromptSeen();
        await markQuizTaken();
        router.push('/archetype-quiz');
    };

    const handleDismiss = async () => {
        await markQuizPromptSeen();
        onDismiss?.();
    };

    return (
        <Card
            className="p-4 rounded-xl mx-4 my-2"
            style={{
                backgroundColor: colors.primary + '10',
                borderColor: colors.primary + '30',
                borderWidth: 1,
            }}
        >
            <TouchableOpacity
                className="absolute top-2 right-2 p-1 z-10"
                onPress={handleDismiss}
            >
                <X size={18} color={colors['muted-foreground']} />
            </TouchableOpacity>

            <View className="flex-row items-center gap-3 mb-4 pr-6">
                <View
                    className="w-12 h-12 rounded-full items-center justify-center"
                    style={{ backgroundColor: colors.primary + '20' }}
                >
                    <Sparkles size={24} color={colors.primary} />
                </View>

                <View className="flex-1">
                    <Text
                        variant="body"
                        className="font-semibold mb-0.5"
                        style={{ color: colors.foreground }}
                    >
                        Discover your friendship style
                    </Text>
                    <Text
                        variant="caption"
                        style={{ color: colors['muted-foreground'] }}
                    >
                        Quick 60-second quiz to find your archetype
                    </Text>
                </View>
            </View>

            <TouchableOpacity
                className="flex-row items-center justify-center gap-2 py-3 px-4 rounded-lg"
                style={{ backgroundColor: colors.primary }}
                onPress={handleTakeQuiz}
            >
                <Text className="text-white font-semibold text-sm">
                    Take the Quiz
                </Text>
                <ArrowRight size={16} color="#FFFFFF" />
            </TouchableOpacity>
        </Card>
    );
}
