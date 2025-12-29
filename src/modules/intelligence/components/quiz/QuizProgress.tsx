/**
 * QuizProgress
 * 
 * Progress indicator showing current question out of total.
 */

import React from 'react';
import { View } from 'react-native';

import { Text } from '@/shared/ui/Text';
import { useTheme } from '@/shared/hooks/useTheme';

interface QuizProgressProps {
    current: number;
    total: number;
}

export function QuizProgress({ current, total }: QuizProgressProps) {
    const { colors } = useTheme();
    const progress = current / total;

    return (
        <View className="px-6 pt-4">
            <View className="mb-2">
                <Text
                    variant="caption"
                    style={{ color: colors['muted-foreground'] }}
                >
                    Question {current} of {total}
                </Text>
            </View>

            <View
                className="h-1 rounded-full overflow-hidden"
                style={{ backgroundColor: colors.muted }}
            >
                <View
                    className="h-full rounded-full"
                    style={{
                        backgroundColor: colors.primary,
                        width: `${progress * 100}%`,
                    }}
                />
            </View>
        </View>
    );
}
