import React from 'react';
import { View } from 'react-native';
import { Text } from '@/shared/ui/Text';
import { Icon } from '@/shared/ui/Icon';
import { useTheme } from '@/shared/hooks/useTheme';
import Animated, { FadeInDown } from 'react-native-reanimated';

export interface ArcSummaryProps {
    type: 'sentiment_shift' | 'thread_highlight';
    title: string;
    description: string;
    index: number;
}

const ARC_CONFIG: Record<ArcSummaryProps['type'], { icon: string }> = {
    sentiment_shift: { icon: 'TrendingUp' },
    thread_highlight: { icon: 'GitBranch' },
};

export const ArcSummary: React.FC<ArcSummaryProps> = ({ type, title, description, index }) => {
    const { colors } = useTheme();
    const config = ARC_CONFIG[type];
    const accentColor = type === 'sentiment_shift' ? colors.info : colors.primary;

    return (
        <Animated.View
            entering={FadeInDown.delay(index * 30).duration(400)}
            className="mb-3 mx-2 p-3.5 rounded-xl flex-row items-center gap-3"
            style={{
                backgroundColor: accentColor + '08',
                borderWidth: 1,
                borderColor: accentColor + '18',
            }}
        >
            <View
                className="w-8 h-8 rounded-full items-center justify-center"
                style={{ backgroundColor: accentColor + '15' }}
            >
                <Icon name={config.icon as any} size={14} color={accentColor} />
            </View>

            <View className="flex-1">
                <Text
                    weight="medium"
                    variant="body"
                    style={{ color: colors.foreground, fontSize: 13 }}
                >
                    {title}
                </Text>
                <Text
                    variant="caption"
                    style={{ color: colors['muted-foreground'], fontSize: 11 }}
                >
                    {description}
                </Text>
            </View>
        </Animated.View>
    );
};
