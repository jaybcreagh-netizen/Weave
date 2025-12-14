import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
    const { tokens, typography, spacing } = useTheme();

    const valueStyle = size === 'default'
        ? typography.scale.stat
        : typography.scale.statSmall;

    const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
    const trendColor = trend === 'up' ? tokens.success : trend === 'down' ? tokens.destructive : tokens.foregroundMuted;

    return (
        <View style={styles.container}>
            <View style={styles.valueRow}>
                <Text style={[
                    {
                        color: tokens.foreground,
                        fontSize: valueStyle.fontSize,
                        lineHeight: valueStyle.lineHeight,
                        fontFamily: typography.fonts.serifBold,
                    }
                ]}>
                    {value}
                </Text>
                {trend && (
                    <TrendIcon size={size === 'default' ? 16 : 14} color={trendColor} style={{ marginLeft: spacing[1] }} />
                )}
            </View>
            <Text style={[
                {
                    color: tokens.foregroundMuted,
                    fontSize: typography.scale.caption.fontSize,
                    lineHeight: typography.scale.caption.lineHeight,
                    fontFamily: typography.fonts.sans,
                    marginTop: spacing[0.5],
                }
            ]}>
                {label}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {},
    valueRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});
