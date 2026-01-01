/**
 * Username Service
 * 
 * Handles username validation, availability checking, and protected changes
 * with cooldowns, yearly limits, and reservation.
 */

import { getSupabaseClient } from '@/shared/services/supabase-client';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface UsernameChangeStatus {
    allowed: boolean;
    reason?: 'cooldown' | 'yearly_limit';
    cooldownEndsAt?: Date;
    resetsAt?: Date;
    changesRemaining: number;
}

export interface UsernameChangeResult {
    success: boolean;
    error?: 'cooldown' | 'yearly_limit' | 'taken' | 'reserved' | 'same_username' | 'invalid' | 'unknown';
    cooldownEndsAt?: Date;
    resetsAt?: Date;
    oldUsername?: string;
    oldUsernameReservedUntil?: Date;
    changesRemaining?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate username format
 * Rules: 3-30 chars, lowercase alphanumeric + underscore only
 */
export function isValidUsernameFormat(username: string): boolean {
    if (!username || username.length < 3 || username.length > 30) {
        return false;
    }
    return /^[a-z0-9_]+$/.test(username);
}

/**
 * Sanitize username input
 */
export function sanitizeUsername(input: string): string {
    return input.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30);
}

// ═══════════════════════════════════════════════════════════════════════════
// AVAILABILITY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if a username is available (not taken and not reserved)
 */
export async function isUsernameAvailable(
    username: string,
    excludeUserId?: string
): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    // Check if taken by another user
    const { data: existingUser } = await client
        .from('user_profiles')
        .select('id')
        .eq('username', username.toLowerCase())
        .single();

    if (existingUser && existingUser.id !== excludeUserId) {
        return false;
    }

    // Check if reserved by someone else
    const { data: reservation } = await client
        .from('reserved_usernames')
        .select('reserved_by, expires_at')
        .eq('username', username.toLowerCase())
        .single();

    if (reservation) {
        const isExpired = new Date(reservation.expires_at) < new Date();
        const isOwnReservation = reservation.reserved_by === excludeUserId;

        if (!isExpired && !isOwnReservation) {
            return false;
        }
    }

    return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// CHANGE PERMISSIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if user can change their username (cooldown + yearly limit)
 */
export async function canChangeUsername(userId: string): Promise<UsernameChangeStatus> {
    const client = getSupabaseClient();
    if (!client) {
        return { allowed: false, reason: 'cooldown', changesRemaining: 0 };
    }

    const { data, error } = await client.rpc('can_change_username', {
        p_user_id: userId,
    });

    if (error || !data) {
        console.error('[UsernameService] canChangeUsername error:', error);
        return { allowed: false, reason: 'cooldown', changesRemaining: 0 };
    }

    return {
        allowed: data.allowed,
        reason: data.reason,
        cooldownEndsAt: data.cooldown_ends_at ? new Date(data.cooldown_ends_at) : undefined,
        resetsAt: data.resets_at ? new Date(data.resets_at) : undefined,
        changesRemaining: data.changes_remaining ?? 0,
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// CHANGE EXECUTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Change username with all protections
 * This should only be called AFTER re-authentication!
 */
export async function changeUsername(
    userId: string,
    newUsername: string
): Promise<UsernameChangeResult> {
    const client = getSupabaseClient();
    if (!client) {
        return { success: false, error: 'unknown' };
    }

    // Validate format first
    if (!isValidUsernameFormat(newUsername)) {
        return { success: false, error: 'invalid' };
    }

    const { data, error } = await client.rpc('change_username', {
        p_user_id: userId,
        p_new_username: newUsername.toLowerCase(),
    });

    if (error) {
        console.error('[UsernameService] changeUsername error:', error);
        return { success: false, error: 'unknown' };
    }

    if (!data.success) {
        return {
            success: false,
            error: data.error as UsernameChangeResult['error'],
            cooldownEndsAt: data.cooldown_ends_at ? new Date(data.cooldown_ends_at) : undefined,
            resetsAt: data.resets_at ? new Date(data.resets_at) : undefined,
        };
    }

    return {
        success: true,
        oldUsername: data.old_username,
        oldUsernameReservedUntil: data.old_username_reserved_until
            ? new Date(data.old_username_reserved_until)
            : undefined,
        changesRemaining: data.changes_remaining,
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Format cooldown remaining as human-readable string
 */
export function formatCooldownRemaining(endsAt: Date): string {
    const now = new Date();
    const diff = endsAt.getTime() - now.getTime();

    if (diff <= 0) return 'now';

    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (days === 1) return 'tomorrow';
    if (days < 7) return `in ${days} days`;
    if (days < 14) return 'in about a week';
    return `in ${Math.ceil(days / 7)} weeks`;
}
