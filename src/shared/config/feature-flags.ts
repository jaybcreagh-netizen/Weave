/**
 * Feature Flags for Accounts & Sharing System
 * 
 * These flags control the gradual rollout of new features.
 * When ALL flags are false, the app behaves exactly as before.
 * 
 * Usage:
 *   import { FeatureFlags } from '@/shared/config/feature-flags';
 *   if (FeatureFlags.SHARED_WEAVES_ENABLED) { ... }
 */

export const FeatureFlags = {
    // ═══════════════════════════════════════════════════════════════════
    // MASTER SWITCH
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Master switch for the entire accounts system.
     * When false, ALL account-related features are disabled.
     * The app works completely offline-only as before.
     */
    ACCOUNTS_ENABLED: true, // ✅ ENABLED FOR TESTING

    // ═══════════════════════════════════════════════════════════════════
    // GRANULAR FLAGS (only effective when ACCOUNTS_ENABLED is true)
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Enable Supabase authentication flows.
     * Controls: Sign-in, sign-up, sign-out, session management.
     */
    SUPABASE_AUTH_ENABLED: true, // ✅ ENABLED FOR TESTING

    /**
     * Enable friend linking features.
     * Controls: Username search, link requests, QR codes.
     */
    FRIEND_LINKING_ENABLED: false,

    /**
     * Enable shared weaves in the WeaveLogger.
     * Controls: "Share with friends" toggle, share flow.
     */
    SHARED_WEAVES_ENABLED: false,

    /**
     * Enable push notification registration and handling.
     * Controls: Push token registration, incoming weave notifications.
     */
    PUSH_NOTIFICATIONS_ENABLED: false,

    /**
     * Enable the background sync engine.
     * Controls: Offline queue processing, realtime subscriptions.
     */
    SYNC_ENGINE_ENABLED: false,

    /**
     * Enable account-related UI in settings.
     * Controls: Account section, sign-out button, sync status.
     */
    ACCOUNT_UI_ENABLED: true, // ✅ ENABLED FOR TESTING
} as const;

/**
 * Type for individual feature flags
 */
export type FeatureFlagKey = keyof typeof FeatureFlags;

/**
 * Check if a specific feature is enabled.
 * Respects the master switch - if ACCOUNTS_ENABLED is false,
 * all other flags return false regardless of their value.
 */
export function isFeatureEnabled(flag: FeatureFlagKey): boolean {
    // Master switch check
    if (flag !== 'ACCOUNTS_ENABLED' && !FeatureFlags.ACCOUNTS_ENABLED) {
        return false;
    }
    return FeatureFlags[flag];
}

/**
 * Check if any account features are enabled.
 * Useful for conditional provider wrapping.
 */
export function isAnyAccountFeatureEnabled(): boolean {
    return FeatureFlags.ACCOUNTS_ENABLED;
}
