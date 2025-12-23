import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook for buffered text input handling in modals/sheets
 * 
 * Prevents re-render flickering when typing by:
 * 1. Managing local state for immediate UI feedback
 * 2. Debouncing updates to parent state
 * 3. Syncing immediately on blur
 * 
 * @param externalValue - The value from parent state/props
 * @param onChangeExternal - Callback to update parent state
 * @param debounceMs - Debounce delay in ms (default: 300)
 */
export function useBufferedInput(
    externalValue: string,
    onChangeExternal: (value: string) => void,
    debounceMs: number = 300
) {
    const [localValue, setLocalValue] = useState(externalValue);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Track the last value we sent to parent to avoid feedback loops
    const lastSentValueRef = useRef(externalValue);

    // Track if we're in the middle of an edit (have pending unsent changes)
    const isEditingRef = useRef(false);

    // Sync local state from external ONLY when it changes externally
    // (not from our own debounced update)
    useEffect(() => {
        // Only sync if the external value is different from what we last sent
        // This means it was changed externally (e.g., form reset, initial load)
        if (externalValue !== lastSentValueRef.current && !isEditingRef.current) {
            setLocalValue(externalValue);
            lastSentValueRef.current = externalValue;
        }
    }, [externalValue]);

    // Handle text changes locally, debounce sync to parent
    const handleChange = useCallback((text: string) => {
        setLocalValue(text);
        isEditingRef.current = true;

        // Clear existing timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Debounce the parent update
        debounceTimerRef.current = setTimeout(() => {
            lastSentValueRef.current = text;
            isEditingRef.current = false;
            onChangeExternal(text);
        }, debounceMs);
    }, [onChangeExternal, debounceMs]);

    // Sync immediately on blur
    const handleBlur = useCallback(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        lastSentValueRef.current = localValue;
        isEditingRef.current = false;
        onChangeExternal(localValue);
    }, [localValue, onChangeExternal]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    return {
        value: localValue,
        onChangeText: handleChange,
        onBlur: handleBlur,
    };
}
