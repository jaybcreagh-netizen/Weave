import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Default stale time of 5 minutes
            staleTime: 5 * 60 * 1000,
            // Cache data for 24 hours unused
            gcTime: 24 * 60 * 60 * 1000,
            // Retry twice on failure
            retry: 2,
        },
    },
});
