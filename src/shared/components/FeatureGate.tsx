/**
 * Feature Gate Component
 * 
 * Conditionally renders children based on feature flags.
 * When the flag is disabled, renders nothing (or fallback if provided).
 * 
 * Usage:
 *   <FeatureGate flag="SHARED_WEAVES_ENABLED">
 *     <ShareWeaveToggle />
 *   </FeatureGate>
 * 
 *   <FeatureGate flag="ACCOUNTS_ENABLED" fallback={<UpgradePrompt />}>
 *     <AccountSection />
 *   </FeatureGate>
 */

import React from 'react';
import { isFeatureEnabled, type FeatureFlagKey } from '@/shared/config/feature-flags';

interface FeatureGateProps {
    /** The feature flag to check */
    flag: FeatureFlagKey;

    /** Content to render when the feature is enabled */
    children: React.ReactNode;

    /** Optional content to render when the feature is disabled */
    fallback?: React.ReactNode;
}

/**
 * Gate component that conditionally renders based on feature flags.
 * Respects the master ACCOUNTS_ENABLED switch.
 */
export function FeatureGate({ flag, children, fallback = null }: FeatureGateProps): React.ReactNode {
    if (isFeatureEnabled(flag)) {
        return children;
    }
    return fallback;
}

/**
 * Hook version for more complex conditional logic.
 * 
 * Usage:
 *   const isEnabled = useFeatureFlag('SHARED_WEAVES_ENABLED');
 *   if (isEnabled) { ... }
 */
export function useFeatureFlag(flag: FeatureFlagKey): boolean {
    // Currently static, but could be made reactive in the future
    // if we add runtime flag management (e.g., via remote config)
    return isFeatureEnabled(flag);
}

/**
 * Hook that returns whether any account features are active.
 * Useful for knowing if we should render account-related UI at all.
 */
export function useAccountsEnabled(): boolean {
    return isFeatureEnabled('ACCOUNTS_ENABLED');
}
