import React from 'react';
import { TextInput, TextInputProps, View } from 'react-native';
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
    inputClassName = '',
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
                className={`h-12 rounded-xl px-4 border text-base font-inter-regular ${inputClassName}`}
                style={[
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

