/**
 * Debounced Observable Utility
 * 
 * Provides hooks for using WatermelonDB observables with debouncing
 * to prevent cascade re-renders during rapid database changes.
 * 
 * Use this when you need real-time updates but don't need instant
 * response to every single change.
 */

import { useEffect, useState, useRef } from 'react';
import { Observable } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

/**
 * Hook that subscribes to an observable with debouncing.
 * Useful for preventing cascade re-renders during rapid database changes.
 * 
 * @param createObservable Factory function that returns the observable
 * @param debounceMs Debounce time in milliseconds (default: 100)
 * @param deps Dependencies array for re-creating the subscription
 * @returns The latest value from the observable
 * 
 * @example
 * const friends = useDebouncedObservable(
 *   () => database.get('friends').query().observe(),
 *   100, // 100ms debounce
 *   []
 * );
 */
export function useDebouncedObservable<T>(
    createObservable: () => Observable<T>,
    debounceMs: number = 100,
    deps: React.DependencyList = []
): T | undefined {
    const [value, setValue] = useState<T>();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const subscription = createObservable()
            .pipe(
                debounceTime(debounceMs),
                distinctUntilChanged() // Skip if value hasn't actually changed
            )
            .subscribe({
                next: (data) => {
                    setValue(data);
                    setIsLoading(false);
                },
                error: (err) => {
                    console.error('[useDebouncedObservable] Error:', err);
                    setIsLoading(false);
                }
            });

        return () => subscription.unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return value;
}

/**
 * Same as useDebouncedObservable but also returns loading state.
 */
export function useDebouncedObservableWithLoading<T>(
    createObservable: () => Observable<T>,
    debounceMs: number = 100,
    deps: React.DependencyList = []
): { data: T | undefined; isLoading: boolean } {
    const [data, setData] = useState<T>();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        const subscription = createObservable()
            .pipe(
                debounceTime(debounceMs),
                distinctUntilChanged()
            )
            .subscribe({
                next: (value) => {
                    setData(value);
                    setIsLoading(false);
                },
                error: (err) => {
                    console.error('[useDebouncedObservableWithLoading] Error:', err);
                    setIsLoading(false);
                }
            });

        return () => subscription.unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return { data, isLoading };
}

/**
 * Throttled version - emits first value immediately then throttles subsequent.
 * Good for when you want immediate feedback on first load but throttle updates.
 */
export function useThrottledObservable<T>(
    createObservable: () => Observable<T>,
    throttleMs: number = 200,
    deps: React.DependencyList = []
): T | undefined {
    const [value, setValue] = useState<T>();
    const lastEmitRef = useRef<number>(0);

    useEffect(() => {
        const subscription = createObservable()
            .subscribe({
                next: (data) => {
                    const now = Date.now();
                    // Always emit first value or if enough time has passed
                    if (value === undefined || now - lastEmitRef.current >= throttleMs) {
                        setValue(data);
                        lastEmitRef.current = now;
                    }
                },
                error: (err) => {
                    console.error('[useThrottledObservable] Error:', err);
                }
            });

        return () => subscription.unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return value;
}
