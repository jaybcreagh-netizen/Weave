import React from 'react';
import { View, Text } from 'react-native';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';

interface StatProps {
    value: string | number;
    label: string;
    trend?: 'up' | 'down' | 'stable';
    size?: 'default' | 'small';
}

export const Stat: React.FC<StatProps> = ({
    value,
    label,
    trend,
    size = 'default',
}) => {
    const { tokens, typography } = useTheme();

    const valueStyle = size === 'default'
        ? typography.scale.stat
        : typography.scale.statSmall;

    const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
    const trendColor = trend === 'up' ? tokens.success : trend === 'down' ? tokens.destructive : tokens.foregroundMuted;

    return (
        <View>
            <View className="flex-row items-center">
                <Text
                    className="font-lora-bold"
                    style={{
                        color: tokens.foreground,
                        fontSize: valueStyle.fontSize,
                        lineHeight: valueStyle.lineHeight,
                    }}
                >
                    {value}
                </Text>
                {trend && (
                    <View className="ml-1">
                        <TrendIcon size={size === 'default' ? 16 : 14} color={trendColor} />
                    </View>
                )}
            </View>
            <Text
                className="mt-0.5 font-inter-regular"
                style={{
                    color: tokens.foregroundMuted,
                    fontSize: typography.scale.caption.fontSize,
                    lineHeight: typography.scale.caption.lineHeight,
                }}
            >
                {label}
            </Text>
        </View>
    );
};

