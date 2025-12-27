/**
 * Cloud Adapter Pattern for Supabase Integration
 * 
 * This adapter pattern allows the app to:
 * 1. Work completely offline when features are disabled
 * 2. Swap implementations for testing
 * 3. Gracefully degrade when network is unavailable
 * 
 * Usage:
 *   import { getCloudAdapter } from '@/shared/services/cloud-adapter';
 *   const adapter = getCloudAdapter();
 *   if (adapter.isAvailable()) { ... }
 */

import { isFeatureEnabled } from '@/shared/config/feature-flags';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface SyncResult {
    success: boolean;
    error?: string;
    serverId?: string;
}

export interface SharedWeaveData {
    localInteractionId: string;
    weaveDate: string;
    title?: string;
    location?: string;
    category: string;
    duration?: string;
    participantUserIds: string[];
}

export interface IncomingSharedWeave {
    serverId: string;
    createdByUserId: string;
    createdByDisplayName: string;
    weaveDate: string;
    title?: string;
    location?: string;
    category: string;
    duration?: string;
    status: 'pending' | 'accepted' | 'declined';
    createdAt: string;
}

export interface LinkRequestData {
    targetUserId?: string;
    targetUsername?: string;
}

export interface IncomingLinkRequest {
    requestId: string;
    fromUserId: string;
    fromUsername: string;
    fromDisplayName: string;
    fromPhotoUrl?: string;
    createdAt: string;
}

export interface UserProfile {
    id: string;
    username: string;
    displayName: string;
    photoUrl?: string;
    pushToken?: string;
}

// ═══════════════════════════════════════════════════════════════════
// CLOUD ADAPTER INTERFACE
// ═══════════════════════════════════════════════════════════════════

/**
 * Abstract interface for cloud operations.
 * Implementations can be swapped for testing or disabled entirely.
 */
export interface CloudAdapter {
    // ─────────────────────────────────────────────────────────────────
    // Status
    // ─────────────────────────────────────────────────────────────────

    /** Check if cloud features are available and enabled */
    isAvailable(): boolean;

    /** Check if the user is authenticated */
    isAuthenticated(): Promise<boolean>;

    /** Get the current user's ID, or null if not authenticated */
    getCurrentUserId(): Promise<string | null>;

    // ─────────────────────────────────────────────────────────────────
    // Shared Weaves
    // ─────────────────────────────────────────────────────────────────

    /** Share a weave with other users */
    shareWeave(weave: SharedWeaveData): Promise<SyncResult>;

    /** Accept an incoming shared weave */
    acceptSharedWeave(serverId: string, localInteractionId: string): Promise<SyncResult>;

    /** Decline an incoming shared weave */
    declineSharedWeave(serverId: string): Promise<SyncResult>;

    /** Fetch pending incoming shared weaves */
    fetchPendingShares(): Promise<IncomingSharedWeave[]>;

    // ─────────────────────────────────────────────────────────────────
    // Friend Linking
    // ─────────────────────────────────────────────────────────────────

    /** Search for a user by username */
    searchByUsername(username: string): Promise<UserProfile | null>;

    /** Send a link request to another user */
    sendLinkRequest(data: LinkRequestData): Promise<SyncResult>;

    /** Accept an incoming link request */
    acceptLinkRequest(requestId: string, localFriendId: string): Promise<SyncResult>;

    /** Decline an incoming link request */
    declineLinkRequest(requestId: string): Promise<SyncResult>;

    /** Fetch pending incoming link requests */
    fetchPendingLinkRequests(): Promise<IncomingLinkRequest[]>;

    /** Check if a friend is linked (has a server user ID) */
    isLinkedFriend(linkedUserId: string): Promise<boolean>;

    // ─────────────────────────────────────────────────────────────────
    // Push Notifications
    // ─────────────────────────────────────────────────────────────────

    /** Register push token with the server */
    registerPushToken(token: string): Promise<SyncResult>;
}

// ═══════════════════════════════════════════════════════════════════
// NO-OP IMPLEMENTATION (used when features are disabled)
// ═══════════════════════════════════════════════════════════════════

/**
 * Null implementation that does nothing.
 * Used when account features are disabled or during testing.
 */
class NoOpCloudAdapter implements CloudAdapter {
    isAvailable(): boolean {
        return false;
    }

    async isAuthenticated(): Promise<boolean> {
        return false;
    }

    async getCurrentUserId(): Promise<string | null> {
        return null;
    }

    async shareWeave(): Promise<SyncResult> {
        return { success: false, error: 'Cloud features not enabled' };
    }

    async acceptSharedWeave(): Promise<SyncResult> {
        return { success: false, error: 'Cloud features not enabled' };
    }

    async declineSharedWeave(): Promise<SyncResult> {
        return { success: false, error: 'Cloud features not enabled' };
    }

    async fetchPendingShares(): Promise<IncomingSharedWeave[]> {
        return [];
    }

    async searchByUsername(): Promise<UserProfile | null> {
        return null;
    }

    async sendLinkRequest(): Promise<SyncResult> {
        return { success: false, error: 'Cloud features not enabled' };
    }

    async acceptLinkRequest(): Promise<SyncResult> {
        return { success: false, error: 'Cloud features not enabled' };
    }

    async declineLinkRequest(): Promise<SyncResult> {
        return { success: false, error: 'Cloud features not enabled' };
    }

    async fetchPendingLinkRequests(): Promise<IncomingLinkRequest[]> {
        return [];
    }

    async isLinkedFriend(): Promise<boolean> {
        return false;
    }

    async registerPushToken(): Promise<SyncResult> {
        return { success: false, error: 'Cloud features not enabled' };
    }
}

// ═══════════════════════════════════════════════════════════════════
// SINGLETON INSTANCES
// ═══════════════════════════════════════════════════════════════════

// Singleton instances (lazy initialized)
let noOpAdapter: NoOpCloudAdapter | null = null;
let supabaseAdapter: CloudAdapter | null = null;

/**
 * Get the NoOp adapter (singleton)
 */
function getNoOpAdapter(): CloudAdapter {
    if (!noOpAdapter) {
        noOpAdapter = new NoOpCloudAdapter();
    }
    return noOpAdapter;
}

/**
 * Lazily create the Supabase adapter.
 * Uses dynamic import to avoid loading Supabase code when not needed.
 */
async function createSupabaseAdapter(): Promise<CloudAdapter> {
    const { SupabaseCloudAdapter } = await import('./supabase-adapter');
    return new SupabaseCloudAdapter();
}

/**
 * Initialize the Supabase adapter.
 * Call this once during app startup when features are enabled.
 */
export async function initializeCloudAdapter(): Promise<void> {
    if (!isFeatureEnabled('ACCOUNTS_ENABLED')) {
        return;
    }

    if (!supabaseAdapter) {
        supabaseAdapter = await createSupabaseAdapter();
    }
}

/**
 * Set a custom adapter instance (useful for testing).
 */
export function setSupabaseAdapter(adapter: CloudAdapter): void {
    supabaseAdapter = adapter;
}

/**
 * Get the appropriate cloud adapter based on feature flags.
 * Returns NoOpAdapter if features are disabled or not yet initialized.
 */
export function getCloudAdapter(): CloudAdapter {
    if (!isFeatureEnabled('ACCOUNTS_ENABLED')) {
        return getNoOpAdapter();
    }

    if (!supabaseAdapter) {
        // Not initialized yet - return NoOp but trigger async init
        // Next call will have the real adapter
        initializeCloudAdapter().catch(console.error);
        return getNoOpAdapter();
    }

    return supabaseAdapter;
}

/**
 * Check if cloud features are currently available.
 * Convenience function that doesn't require getting the adapter.
 */
export function isCloudAvailable(): boolean {
    return getCloudAdapter().isAvailable();
}

