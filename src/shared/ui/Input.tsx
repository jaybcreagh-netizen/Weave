import React from 'react';
import { TextInput, TextInputProps, View, StyleSheet } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { Text } from './Text';

export interface InputProps extends TextInputProps {
    label?: string;
    error?: string;
    containerClassName?: string;
    inputClassName?: string;
}

export function Input({
    label,
    error,
    containerClassName = '',
    // inputClassName is unused in styles but could be passed if needed, removing for now to avoid confusion or keep if intended for future
    style,
    ...props
}: InputProps) {
    const { colors, tokens } = useTheme();

    return (
        <View className={`w-full ${containerClassName}`}>
            {label && (
                <Text variant="label" className="mb-2" style={{ color: colors.foreground }}>
                    {label}
                </Text>
            )}

            <TextInput
                style={[
                    styles.input,
                    {
                        backgroundColor: tokens?.input.background || colors['input-background'] || colors.card,
                        borderColor: error ? colors.destructive : colors.border,
                        color: colors.foreground,
                    },
                    style,
                ]}
                placeholderTextColor={colors['muted-foreground']}
                {...props}
            />

            {error && (
                <Text variant="caption" style={{ color: colors.destructive, marginTop: 4 }}>
                    {error}
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    input: {
        height: 48,
        borderRadius: 12,
        paddingHorizontal: 16,
        borderWidth: 1,
        fontSize: 16,
        fontFamily: 'Inter_400Regular',
    },
});
