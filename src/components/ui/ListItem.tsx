import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
}

export const ListItem: React.FC<ListItemProps> = ({
    leading,
    title,
    subtitle,
    trailing,
    onPress,
    showChevron = false,
    showDivider = true,
}) => {
    const { tokens, typography, spacing } = useTheme();

    const content = (
        <View style={[
            styles.container,
            { paddingVertical: spacing[3] },
            showDivider && { borderBottomWidth: 1, borderBottomColor: tokens.borderSubtle },
        ]}>
            {leading && (
                <View style={styles.leading}>
                    {leading}
                </View>
            )}

            <View style={styles.content}>
                <Text style={[
                    {
                        color: tokens.foreground,
                        fontSize: typography.scale.body.fontSize,
                        lineHeight: typography.scale.body.lineHeight,
                        fontFamily: typography.fonts.sans,
                    }
                ]}>
                    {title}
                </Text>
                {subtitle && (
                    <Text style={[
                        {
                            color: tokens.foregroundMuted,
                            fontSize: typography.scale.bodySmall.fontSize,
                            lineHeight: typography.scale.bodySmall.lineHeight,
                            fontFamily: typography.fonts.sans,
                            marginTop: spacing[0.5],
                        }
                    ]}>
                        {subtitle}
                    </Text>
                )}
            </View>

            {(trailing || showChevron) && (
                <View style={styles.trailing}>
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

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    leading: {
        width: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    content: {
        flex: 1,
    },
    trailing: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 12,
    },
});
