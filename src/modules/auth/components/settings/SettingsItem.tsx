import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { ChevronRight } from 'lucide-react-native';

interface SettingsItemProps {
    icon: React.ElementType;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
    destructive?: boolean;
    badge?: number;
}

export const SettingsItem: React.FC<SettingsItemProps> = ({
    icon: Icon,
    title,
    subtitle,
    onPress,
    rightElement,
    destructive = false,
    badge,
}) => {
    const { colors } = useTheme();

    const content = (
        <View className="flex-row items-center justify-between py-2">
            <View className="flex-row items-center gap-3 flex-1 mr-4">
                <View className="w-10 h-10 rounded-lg items-center justify-center" style={{ backgroundColor: colors.muted }}>
                    <Icon color={destructive ? colors.destructive : colors.foreground} size={20} />
                </View>
                <View className="flex-1">
                    <Text className="text-base font-inter-medium" style={{ color: destructive ? colors.destructive : colors.foreground }}>
                        {title}
                    </Text>
                    {subtitle && (
                        <Text className="text-sm font-inter-regular" style={{ color: colors['muted-foreground'] }}>
                            {subtitle}
                        </Text>
                    )}
                </View>
            </View>
            <View className="flex-row items-center gap-2">
                {badge !== undefined && badge > 0 && (
                    <View
                        className="min-w-[20px] h-5 rounded-full items-center justify-center px-1.5"
                        style={{ backgroundColor: colors.primary }}
                    >
                        <Text className="text-xs font-semibold" style={{ color: colors['primary-foreground'] }}>
                            {badge}
                        </Text>
                    </View>
                )}
                {rightElement ? (
                    rightElement
                ) : onPress ? (
                    <ChevronRight color={colors['muted-foreground']} size={20} />
                ) : null}
            </View>
        </View>
    );

    if (onPress) {
        return <TouchableOpacity onPress={onPress}>{content}</TouchableOpacity>;
    }

    return content;
};
