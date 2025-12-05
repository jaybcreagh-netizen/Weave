import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';

interface ProgressBarProps {
    progress: number; // 0-100
    color?: string;
    height?: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
    progress,
    color,
    height = 6,
}) => {
    const { tokens, radius } = useTheme();

    const clampedProgress = Math.min(100, Math.max(0, Number.isFinite(progress) ? progress : 0));
    const fillColor = color || tokens.primary;

    return (
        <View style={[
            styles.track,
            {
                height,
                borderRadius: height / 2,
                backgroundColor: tokens.borderSubtle,
            }
        ]}>
            <View style={[
                styles.fill,
                {
                    width: `${clampedProgress}%`,
                    height,
                    borderRadius: height / 2,
                    backgroundColor: fillColor,
                }
            ]} />
        </View>
    );
};

const styles = StyleSheet.create({
    track: {
        width: '100%',
        overflow: 'hidden',
    },
    fill: {},
});
