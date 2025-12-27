/**
 * Supabase Auth Service
 * 
 * Handles authentication flows including:
 * - Native Apple Sign-In
 * - Email/Password
 * - Session management
 */

import * as AppleAuthentication from 'expo-apple-authentication';
import { getSupabaseClient } from '@/shared/services/supabase-client';
import { isFeatureEnabled } from '@/shared/config/feature-flags';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface AuthResult {
    success: boolean;
    error?: string;
    userId?: string;
}

export interface UserSession {
    userId: string;
    email?: string;
    displayName?: string;
}

// ═══════════════════════════════════════════════════════════════════
// APPLE SIGN-IN
// ═══════════════════════════════════════════════════════════════════

/**
 * Check if Apple Sign-In is available on this device
 */
export async function isAppleSignInAvailable(): Promise<boolean> {
    if (!isFeatureEnabled('SUPABASE_AUTH_ENABLED')) {
        return false;
    }
    return await AppleAuthentication.isAvailableAsync();
}

/**
 * Sign in with Apple using native iOS flow
 * The credential is passed to Supabase to create a session
 */
export async function signInWithApple(): Promise<AuthResult> {
    const client = getSupabaseClient();
    if (!client) {
        console.log('[Auth] Supabase client not available');
        return { success: false, error: 'Supabase not available' };
    }

    try {
        console.log('[Auth] Starting Apple Sign-In...');

        // Request native Apple Sign-In
        const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
                AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
        });

        console.log('[Auth] Apple credential received:', {
            user: credential.user,
            email: credential.email,
            hasIdentityToken: !!credential.identityToken,
            hasAuthorizationCode: !!credential.authorizationCode,
        });

        // Apple only provides name/email on FIRST sign-in
        // We need to store these if provided
        const fullName = credential.fullName
            ? `${credential.fullName.givenName ?? ''} ${credential.fullName.familyName ?? ''}`.trim()
            : undefined;

        console.log('[Auth] Full name from Apple:', fullName);

        if (!credential.identityToken) {
            console.log('[Auth] No identity token received');
            return { success: false, error: 'No identity token received from Apple' };
        }

        console.log('[Auth] Calling Supabase signInWithIdToken...');

        // Pass the Apple credential to Supabase
        const { data, error } = await client.auth.signInWithIdToken({
            provider: 'apple',
            token: credential.identityToken,
        });

        console.log('[Auth] Supabase response:', {
            hasData: !!data,
            hasUser: !!data?.user,
            userId: data?.user?.id,
            error: error ? { message: error.message, status: error.status, name: error.name } : null,
        });

        if (error) {
            console.error('[Auth] Supabase auth error:', error);
            return { success: false, error: error.message };
        }

        // If this is first sign-in and we got a name, update the profile
        if (data.user && fullName) {
            console.log('[Auth] Updating user profile with name...');
            await updateUserProfile(data.user.id, { displayName: fullName });
        }

        console.log('[Auth] Sign-in successful!');
        return { success: true, userId: data.user?.id };
    } catch (error: unknown) {
        console.error('[Auth] Exception during Apple Sign-In:', error);
        if (error instanceof Error) {
            // User cancelled
            if (error.message.includes('cancelled') || error.message.includes('canceled')) {
                return { success: false, error: 'cancelled' };
            }
            return { success: false, error: error.message };
        }
        return { success: false, error: 'Unknown error' };
    }
}

// ═══════════════════════════════════════════════════════════════════
// EMAIL SIGN-IN
// ═══════════════════════════════════════════════════════════════════

/**
 * Sign up with email and password
 */
export async function signUpWithEmail(
    email: string,
    password: string,
    displayName: string
): Promise<AuthResult> {
    const client = getSupabaseClient();
    if (!client) {
        return { success: false, error: 'Supabase not available' };
    }

    try {
        const { data, error } = await client.auth.signUp({
            email,
            password,
            options: {
                data: {
                    display_name: displayName,
                },
            },
        });

        if (error) {
            return { success: false, error: error.message };
        }

        // Create user profile
        if (data.user) {
            await createUserProfile(data.user.id, {
                email,
                displayName,
            });
        }

        return { success: true, userId: data.user?.id };
    } catch (error: unknown) {
        if (error instanceof Error) {
            return { success: false, error: error.message };
        }
        return { success: false, error: 'Unknown error' };
    }
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(
    email: string,
    password: string
): Promise<AuthResult> {
    const client = getSupabaseClient();
    if (!client) {
        return { success: false, error: 'Supabase not available' };
    }

    try {
        const { data, error } = await client.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true, userId: data.user?.id };
    } catch (error: unknown) {
        if (error instanceof Error) {
            return { success: false, error: error.message };
        }
        return { success: false, error: 'Unknown error' };
    }
}

// ═══════════════════════════════════════════════════════════════════
// SESSION MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

/**
 * Get the current session
 */
export async function getCurrentSession(): Promise<UserSession | null> {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
        const { data: { session } } = await client.auth.getSession();
        if (!session) return null;

        return {
            userId: session.user.id,
            email: session.user.email,
            displayName: session.user.user_metadata?.display_name,
        };
    } catch {
        return null;
    }
}

/**
 * Check if user is signed in
 */
export async function isSignedIn(): Promise<boolean> {
    const session = await getCurrentSession();
    return session !== null;
}

/**
 * Sign out
 */
export async function signOut(): Promise<AuthResult> {
    const client = getSupabaseClient();
    if (!client) {
        return { success: false, error: 'Supabase not available' };
    }

    try {
        const { error } = await client.auth.signOut();
        if (error) {
            return { success: false, error: error.message };
        }
        return { success: true };
    } catch (error: unknown) {
        if (error instanceof Error) {
            return { success: false, error: error.message };
        }
        return { success: false, error: 'Unknown error' };
    }
}

// ═══════════════════════════════════════════════════════════════════
// USER PROFILE
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a user profile in the database
 */
async function createUserProfile(
    userId: string,
    data: { email?: string; displayName?: string }
): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;

    // Generate a temporary username from email or random
    const username = data.email
        ? data.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') + Math.floor(Math.random() * 1000)
        : `user${Math.floor(Math.random() * 100000)}`;

    try {
        await client.from('user_profiles').insert({
            id: userId,
            username,
            display_name: data.displayName || 'Weave User',
        });
    } catch (error) {
        console.warn('[Auth] Failed to create user profile:', error);
    }
}

/**
 * Update user profile
 */
async function updateUserProfile(
    userId: string,
    data: { displayName?: string; username?: string; photoUrl?: string }
): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;

    try {
        const updates: Record<string, string> = {};
        if (data.displayName) updates.display_name = data.displayName;
        if (data.username) updates.username = data.username;
        if (data.photoUrl) updates.photo_url = data.photoUrl;

        await client.from('user_profiles').update(updates).eq('id', userId);
    } catch (error) {
        console.warn('[Auth] Failed to update user profile:', error);
    }
}

/**
 * Get user profile
 */
export async function getUserProfile(userId: string): Promise<{
    username: string;
    displayName: string;
    photoUrl?: string;
    birthday?: string;
    archetype?: string;
} | null> {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
        console.log('[Auth] Fetching profile for user:', userId);
        const { data, error } = await client
            .from('user_profiles')
            .select('username, display_name, photo_url, birthday, archetype')
            .eq('id', userId)
            .single();

        console.log('[Auth] Profile query result:', { data, error });

        if (error || !data) {
            console.log('[Auth] No profile found or error:', error);
            return null;
        }

        return {
            username: data.username,
            displayName: data.display_name,
            photoUrl: data.photo_url ?? undefined,
            birthday: data.birthday ?? undefined,
            archetype: data.archetype ?? undefined,
        };
    } catch (e) {
        console.error('[Auth] getUserProfile exception:', e);
        return null;
    }
}
