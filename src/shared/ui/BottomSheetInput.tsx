import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TextInputProps, View } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useTheme } from '@/shared/hooks/useTheme';
import { Text } from './Text';

export interface BottomSheetInputProps extends TextInputProps {
    label?: string;
    error?: string;
    containerClassName?: string;
    inputClassName?: string;
}

/**
 * Input component specifically for use inside @gorhom/bottom-sheet.
 * Uses BottomSheetTextInput for proper keyboard handling and gesture coordination.
 * 
 * Includes internal buffering (local state) to prevent parent re-renders on every keystroke.
 * This is crucial for performance and preventing cursor flickering in complex modals.
 */
export const BottomSheetInput = React.forwardRef<any, BottomSheetInputProps>(({
    label,
    error,
    containerClassName = '',
    inputClassName = '',
    style,
    value,
    onChangeText,
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

            <BottomSheetTextInput
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
                autoCapitalize="sentences"
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

BottomSheetInput.displayName = 'BottomSheetInput';
