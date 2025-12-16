import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';

interface WidgetHeaderProps {
    icon?: React.ReactNode;
    title: string;
    subtitle?: string;
    action?: {
        label: string;
        onPress: () => void;
    };
}

export const WidgetHeader: React.FC<WidgetHeaderProps> = ({
    icon,
    title,
    subtitle,
    action,
}) => {
    const { tokens, typography } = useTheme();

    return (
        <View className="flex-row justify-between items-start mb-3">
            <View className="flex-row items-center flex-1">
                {icon && <View className="mr-2">{icon}</View>}
                <View>
                    <Text
                        className="font-lora-bold"
                        style={{
                            color: tokens.foreground,
                            fontSize: typography.scale.h3.fontSize,
                            lineHeight: typography.scale.h3.lineHeight,
                        }}
                    >
                        {title}
                    </Text>
                    {subtitle && (
                        <Text
                            className="mt-0.5 font-inter-regular"
                            style={{
                                color: tokens.foregroundMuted,
                                fontSize: typography.scale.caption.fontSize,
                                lineHeight: typography.scale.caption.lineHeight,
                            }}
                        >
                            {subtitle}
                        </Text>
                    )}
                </View>
            </View>

            {action && (
                <TouchableOpacity onPress={action.onPress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text
                        className="font-inter-semibold"
                        style={{
                            color: tokens.primary,
                            fontSize: typography.scale.label.fontSize,
                        }}
                    >
                        {action.label}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

