import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TextInput, TextInputProps, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { Text } from './Text';

export interface BufferedTextInputProps extends TextInputProps {
    label?: string;
    error?: string;
    containerClassName?: string;
    inputClassName?: string;
}

/**
 * A standard TextInput with internal buffering to prevent parent re-renders on every keystroke.
 * Useful for large forms or complex modals where typing performance is critical.
 */
export const BufferedTextInput = React.forwardRef<TextInput, BufferedTextInputProps>(({
    label,
    error,
    containerClassName = '',
    inputClassName = '',
    style,
    value,
    onChangeText,
    autoCapitalize = 'sentences',
    ...props
}, ref) => {
    const { colors, tokens } = useTheme();

    // Internal buffering logic
    const [localValue, setLocalValue] = useState(value || '');
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastSentValueRef = useRef(value);
    const isEditingRef = useRef(false);

    // Sync from parent only when parent changes externally
    useEffect(() => {
        if (value !== lastSentValueRef.current && !isEditingRef.current) {
            setLocalValue(value || '');
            lastSentValueRef.current = value;
        }
    }, [value]);

    const handleChangeText = useCallback((text: string) => {
        setLocalValue(text);
        isEditingRef.current = true;

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            if (onChangeText) {
                lastSentValueRef.current = text;
                isEditingRef.current = false;
                onChangeText(text);
            }
        }, 300);
    }, [onChangeText]);

    const handleBlur = useCallback((e: any) => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        if (onChangeText) {
            lastSentValueRef.current = localValue;
            isEditingRef.current = false;
            onChangeText(localValue);
        }
        if (props.onBlur) {
            props.onBlur(e);
        }
    }, [localValue, onChangeText, props.onBlur]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    return (
        <View className={`w-full ${containerClassName}`}>
            {label && (
                <Text variant="label" className="mb-2" style={{ color: colors.foreground }}>
                    {label}
                </Text>
            )}

            <TextInput
                ref={ref}
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
                value={localValue}
                onChangeText={handleChangeText}
                onBlur={handleBlur}
                autoCapitalize={autoCapitalize}
                {...props}
            />

            {error && (
                <Text variant="caption" style={{ color: colors.destructive, marginTop: 4 }}>
                    {error}
                </Text>
            )}
        </View>
    );
});

BufferedTextInput.displayName = 'BufferedTextInput';
