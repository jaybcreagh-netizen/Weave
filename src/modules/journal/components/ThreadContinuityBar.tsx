import React from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { Text } from '@/shared/ui/Text';
import { Icon } from '@/shared/ui/Icon';
import { useTheme } from '@/shared/hooks/useTheme';
import ConversationThread from '@/db/models/ConversationThread';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

interface ThreadContinuityBarProps {
    threads: ConversationThread[];
    onSelectThread: (thread: ConversationThread) => void;
    isVisible?: boolean;
}

export const ThreadContinuityBar: React.FC<ThreadContinuityBarProps> = ({
    threads,
    onSelectThread,
    isVisible = true
}) => {
    const { colors } = useTheme();

    if (!isVisible || threads.length === 0) return null;

    const getSentimentColor = (sentiment: string) => {
        switch (sentiment) {
            case 'positive': return colors.success;
            case 'concern': return colors.warning;
            default: return colors['muted-foreground'];
        }
    };

    return (
        <Animated.View
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(200)}
            className="mb-4"
        >
            <View className="flex-row items-center gap-1.5 mb-2">
                <Icon name="GitBranch" size={11} color={colors['muted-foreground']} />
                <Text variant="caption" style={{ color: colors['muted-foreground'], fontSize: 11 }}>
                    Active threads
                </Text>
            </View>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
            >
                {threads.map(thread => (
                    <TouchableOpacity
                        key={thread.id}
                        onPress={() => onSelectThread(thread)}
                        className="flex-row items-center px-3 py-1.5 rounded-full"
                        style={{
                            backgroundColor: colors.muted,
                            borderLeftWidth: 3,
                            borderLeftColor: getSentimentColor(thread.sentiment),
                        }}
                        activeOpacity={0.7}
                    >
                        <Text
                            variant="caption"
                            style={{ color: colors.foreground, fontSize: 12 }}
                            numberOfLines={1}
                        >
                            {thread.topic}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </Animated.View>
    );
};
