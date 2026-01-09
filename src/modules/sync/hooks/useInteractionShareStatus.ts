/**
 * useInteractionShareStatus Hook
 * 
 * Provides share status information for interactions by querying SharedWeaveRef.
 * Returns a map of interactionId -> ShareInfo for efficient lookups.
 */

import { useState, useEffect, useMemo } from 'react';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import SharedWeaveRef from '@/db/models/SharedWeaveRef';

export interface ShareInfo {
    isShared: true;
    status: 'pending' | 'accepted' | 'declined' | 'expired';
    isCreator: boolean;
    serverWeaveId: string;
    sharedAt: number;
}

export type ShareInfoMap = Map<string, ShareInfo>;

/**
 * Hook to get share status for a list of interaction IDs
 * Returns a Map for O(1) lookups in components
 */
export function useInteractionShareStatus(interactionIds: string[]): {
    shareInfoMap: ShareInfoMap;
    isLoading: boolean;
} {
    const [shareInfoMap, setShareInfoMap] = useState<ShareInfoMap>(new Map());
    const [isLoading, setIsLoading] = useState(true);

    // Memoize the sorted ID string for stable dependency
    const idsKey = useMemo(() => [...interactionIds].sort().join(','), [interactionIds]);

    useEffect(() => {
        if (interactionIds.length === 0) {
            setShareInfoMap(new Map());
            setIsLoading(false);
            return;
        }

        setIsLoading(true);

        // Query SharedWeaveRefs for all interaction IDs
        const subscription = database
            .get<SharedWeaveRef>('shared_weave_refs')
            .query(Q.where('interaction_id', Q.oneOf(interactionIds)))
            .observe()
            .subscribe({
                next: (refs) => {
                    const map = new Map<string, ShareInfo>();
                    refs.forEach((ref) => {
                        map.set(ref.interactionId, {
                            isShared: true,
                            status: ref.status,
                            isCreator: ref.isCreator,
                            serverWeaveId: ref.serverWeaveId,
                            sharedAt: ref.sharedAt,
                        });
                    });
                    setShareInfoMap(map);
                    setIsLoading(false);
                },
                error: (err) => {
                    console.error('[useInteractionShareStatus] Error:', err);
                    setShareInfoMap(new Map());
                    setIsLoading(false);
                },
            });

        return () => subscription.unsubscribe();
    }, [idsKey]); // eslint-disable-line react-hooks/exhaustive-deps

    return { shareInfoMap, isLoading };
}

/**
 * Get share info for a single interaction (synchronous lookup from pre-fetched map)
 */
export function getShareInfo(
    shareInfoMap: ShareInfoMap,
    interactionId: string
): ShareInfo | null {
    return shareInfoMap.get(interactionId) ?? null;
}
