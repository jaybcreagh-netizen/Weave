import { useState, useEffect } from 'react';
import { useSuggestions } from '../hooks/useSuggestions';
import { usePlans } from '../hooks/usePlans';

/**
 * Headless component to keep suggestions fresh in the background.
 * Now deferred to avoid startup contention.
 */
function InnerFetcher() {
    useSuggestions();
    usePlans();
    return null;
}

/**
 * BackgroundSuggestionFetcher
 *
 * A headless component that mounts globally to ensure:
 * 1. Suggestions and Plans are pre-fetched and kept fresh in React Query cache.
 * 2. Expensive derivation logic runs in the background, not when blocking UI interactions.
 *
 * This prevents the massive delay (3-5s) seen when opening Oracle/Insights for the first time.
 * The fetching is now deferred to avoid startup contention.
 */
export function BackgroundSuggestionFetcher() {
    const [shouldFetch, setShouldFetch] = useState(false);

    useEffect(() => {
        // Defer fetching to avoid database contention during app launch/journal load
        const timer = setTimeout(() => {
            setShouldFetch(true);
        }, 10000); // 10 seconds delay

        return () => clearTimeout(timer);
    }, []);

    if (!shouldFetch) return null;

    return <InnerFetcher />;
}
