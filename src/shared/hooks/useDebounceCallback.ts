import { useCallback, useRef, useEffect } from 'react';

/**
 * A hook that returns a debounced version of the provided callback.
 * This is useful for preventing double-taps on buttons or multiple submissions.
 * 
 * @param callback The function to debounce
 * @param delay The delay in milliseconds (default: 500ms)
 * @param leading Whether to execute on the leading edge (default: true)
 * @returns A memorized debounced callback
 */
export function useDebounceCallback<T extends (...args: any[]) => any>(
    callback: T,
    delay: number = 500,
    leading: boolean = true
): (...args: Parameters<T>) => void {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const leadingCalledRef = useRef(false);
    const callbackRef = useRef(callback);

    // Keep callback ref up to date
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    return useCallback(
        (...args: Parameters<T>) => {
            // Clear previous timeout
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            // If leading edge execution is enabled
            if (leading) {
                // If we haven't called it yet in this window, call it now
                if (!leadingCalledRef.current) {
                    callbackRef.current(...args);
                    leadingCalledRef.current = true;
                }

                // Set timeout to reset the leading called flag
                timeoutRef.current = setTimeout(() => {
                    leadingCalledRef.current = false;
                }, delay);
            } else {
                // Standard trailing debounce
                timeoutRef.current = setTimeout(() => {
                    callbackRef.current(...args);
                }, delay);
            }
        },
        [delay, leading]
    );
}
