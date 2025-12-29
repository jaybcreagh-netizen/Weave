/**
 * Auth Context
 * 
 * Provides authentication state to React components.
 * 
 * ARCHITECTURE NOTE:
 * - useAuthStore (Zustand) is the SINGLE SOURCE OF TRUTH for auth state
 * - AuthProvider triggers store initialization on mount
 * - useAuth() wraps store selectors for backwards compatibility
 * 
 * This consolidation prevents state desync between Context and Zustand.
 */

import React, { useEffect } from 'react';
import { useAuthStore } from '../store/auth.store';

// =============================================================================
// PROVIDER
// =============================================================================

/**
 * AuthProvider - Initializes auth state on mount
 * 
 * No longer holds state - delegates entirely to Zustand store.
 * This is a thin wrapper that triggers initialization.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        // Initialize auth store on mount
        // Store handles session fetching and auth state change listeners
        useAuthStore.getState().initialize();
    }, []);

    return <>{children}</>;
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * useAuth - Access authentication state
 * 
 * Uses Zustand selectors for optimal re-render behavior.
 * Each property is selected individually to prevent unnecessary re-renders.
 * 
 * @example
 * // Component only re-renders when isAuthenticated changes
 * const { isAuthenticated } = useAuth();
 * 
 * // Or destructure only what you need
 * const { user, signOut } = useAuth();
 */
export function useAuth() {
    const user = useAuthStore(state => state.user);
    const session = useAuthStore(state => state.session);
    const isAuthenticated = useAuthStore(state => state.isAuthenticated);
    const isLoading = useAuthStore(state => state.isLoading);
    const signOut = useAuthStore(state => state.signOut);

    return {
        user,
        session,
        isAuthenticated,
        isLoading,
        signOut,
    };
}

/**
 * useIsAuthenticated - Check if user is authenticated
 * 
 * Minimal selector for components that only need auth status.
 * More efficient than useAuth() when you only need this boolean.
 */
export function useIsAuthenticated(): boolean {
    return useAuthStore(state => state.isAuthenticated);
}

/**
 * useAuthLoading - Check if auth is still initializing
 * 
 * Useful for splash screens or loading states.
 */
export function useAuthLoading(): boolean {
    return useAuthStore(state => state.isLoading);
}

/**
 * useCurrentUser - Get the current user
 * 
 * Returns null if not authenticated.
 */
export function useCurrentUser() {
    return useAuthStore(state => state.user);
}

/**
 * useSession - Get the current session
 * 
 * Returns null if not authenticated.
 */
export function useSession() {
    return useAuthStore(state => state.session);
}
