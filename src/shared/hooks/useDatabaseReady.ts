import { useState, useEffect } from 'react';
import { database } from '@/db';

/**
 * Hook to check if the database is ready and accessible.
 * Handles the race condition where the component might unmount while waiting for the database check.
 * 
 * @param enabled - Whether the check should be performed. Useful for chaining initializations.
 * @returns boolean - True if the database is ready.
 */
export function useDatabaseReady(enabled: boolean = true): boolean {
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        if (!enabled) return;

        let isMounted = true;

        const checkReady = async () => {
            try {
                // Ensure database is accessible by performing a lightweight query
                await database.get('friends').query().fetchCount();

                if (isMounted) {
                    setIsReady(true);
                }
            } catch (e) {
                console.error('[useDatabaseReady] Failed to check database readiness', e);
                // Even if check fails, we might want to proceed or handle error
                // For now, we mimic the original behavior of proceeding to avoid stuck splash screen,
                // but arguably we should handle this better.
                if (isMounted) {
                    setIsReady(true);
                }
            }
        };

        checkReady();

        return () => {
            isMounted = false;
        };
    }, [enabled]);

    return isReady;
}
