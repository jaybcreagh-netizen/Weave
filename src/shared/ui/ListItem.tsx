import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';

interface ListItemProps {
    leading?: React.ReactNode;
    title: string;
    subtitle?: string;
    trailing?: React.ReactNode;
    onPress?: () => void;
    showChevron?: boolean;
    showDivider?: boolean;
    compact?: boolean;
}

export const ListItem: React.FC<ListItemProps> = ({
    leading,
    title,
    subtitle,
    trailing,
    onPress,
    showChevron = false,
    showDivider = true,
    compact = false,
}) => {
    const { tokens, typography } = useTheme();

    const content = (
        <View
            className={`flex-row items-center ${compact ? 'py-2' : 'py-3'}`}
            style={[
                showDivider && { borderBottomWidth: 1, borderBottomColor: tokens.borderSubtle },
            ]}
        >
            {leading && (
                <View className="w-10 items-center justify-center mr-3">
                    {leading}
                </View>
            )}

            <View className="flex-1">
                <Text
                    className="font-inter-regular"
                    style={{
                        color: tokens.foreground,
                        fontSize: compact ? typography.scale.bodySmall.fontSize : typography.scale.body.fontSize,
                        lineHeight: compact ? typography.scale.bodySmall.lineHeight : typography.scale.body.lineHeight,
                    }}
                >
                    {title}
                </Text>
                {subtitle && (
                    <Text
                        className="mt-0.5 font-inter-regular"
                        style={{
                            color: tokens.foregroundMuted,
                            fontSize: compact ? typography.scale.caption.fontSize : typography.scale.bodySmall.fontSize,
                            lineHeight: compact ? typography.scale.caption.lineHeight : typography.scale.bodySmall.lineHeight,
                        }}
                    >
                        {subtitle}
                    </Text>
                )}
            </View>

            {(trailing || showChevron) && (
                <View className="flex-row items-center ml-3">
                    {trailing}
                    {showChevron && <ChevronRight size={20} color={tokens.foregroundSubtle} />}
                </View>
            )}
        </View>
    );

    if (onPress) {
        return (
            <TouchableOpacity onPress={onPress} activeOpacity={0.6}>
                {content}
            </TouchableOpacity>
        );
    }

    return content;
};

