import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
    const { tokens, typography, spacing } = useTheme();

    return (
        <View style={styles.container}>
            <View style={styles.left}>
                {icon && <View style={[styles.icon, { marginRight: spacing[2] }]}>{icon}</View>}
                <View>
                    <Text style={[
                        styles.title,
                        {
                            color: tokens.foreground,
                            fontSize: typography.scale.h3.fontSize,
                            lineHeight: typography.scale.h3.lineHeight,
                            fontFamily: typography.fonts.serifBold,
                        }
                    ]}>
                        {title}
                    </Text>
                    {subtitle && (
                        <Text style={[
                            styles.subtitle,
                            {
                                color: tokens.foregroundMuted,
                                fontSize: typography.scale.caption.fontSize,
                                lineHeight: typography.scale.caption.lineHeight,
                                fontFamily: typography.fonts.sans,
                                marginTop: spacing[0.5],
                            }
                        ]}>
                            {subtitle}
                        </Text>
                    )}
                </View>
            </View>

            {action && (
                <TouchableOpacity onPress={action.onPress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={[
                        styles.action,
                        {
                            color: tokens.primary,
                            fontSize: typography.scale.label.fontSize,
                            fontFamily: typography.fonts.sansSemiBold,
                        }
                    ]}>
                        {action.label}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    icon: {
        // Margin handled inline with spacing token
    },
    title: {},
    subtitle: {},
    action: {},
});
