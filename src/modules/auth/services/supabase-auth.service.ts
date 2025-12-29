/**
 * Supabase Auth Service
 * 
 * Handles authentication flows including:
 * - Native Apple Sign-In
 * - Email/Password
 * - Session management
 */

import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { getSupabaseClient } from '@/shared/services/supabase-client';
import { isFeatureEnabled } from '@/shared/config/feature-flags';

// Configure Google Sign-In
// Note: client IDs should come from env vars
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';

GoogleSignin.configure({
    scopes: ['email', 'profile'],
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
});

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Error codes for auth operations
 * Used for programmatic error handling in UI
 */
export type AuthErrorCode =
    | 'CANCELLED'           // User cancelled the flow
    | 'RATE_LIMITED'        // Too many attempts
    | 'INVALID_PHONE'       // Phone number format invalid
    | 'INVALID_OTP'         // OTP code incorrect or expired
    | 'NETWORK_ERROR'       // Network connectivity issue
    | 'NOT_CONFIGURED'      // Supabase not configured
    | 'NOT_AUTHENTICATED'   // User not logged in
    | 'ALREADY_EXISTS'      // Account already exists
    | 'UNKNOWN';            // Unknown error

export interface AuthResult {
    success: boolean;
    error?: string;
    errorCode?: AuthErrorCode;
    userId?: string;
}

export interface UserSession {
    userId: string;
    email?: string;
    displayName?: string;
}

/**
 * Classify a Supabase error into a specific error code
 */
function classifyAuthError(error: any): { code: AuthErrorCode; message: string } {
    const msg = error?.message?.toLowerCase() || '';
    const errorCode = error?.code || error?.status || '';

    // Rate limiting
    if (msg.includes('rate limit') || msg.includes('too many') || errorCode === 429) {
        return {
            code: 'RATE_LIMITED',
            message: 'Too many attempts. Please wait a few minutes and try again.',
        };
    }

    // Invalid phone format
    if (msg.includes('invalid') && (msg.includes('phone') || msg.includes('number'))) {
        return {
            code: 'INVALID_PHONE',
            message: 'Please enter a valid phone number with country code (e.g., +1234567890).',
        };
    }

    // OTP errors
    if (msg.includes('otp') || msg.includes('token') || msg.includes('code')) {
        if (msg.includes('expired')) {
            return {
                code: 'INVALID_OTP',
                message: 'Code expired. Please request a new one.',
            };
        }
        if (msg.includes('invalid') || msg.includes('incorrect')) {
            return {
                code: 'INVALID_OTP',
                message: 'Invalid code. Please check and try again.',
            };
        }
    }

    // Network errors
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('connection') || msg.includes('offline')) {
        return {
            code: 'NETWORK_ERROR',
            message: 'Please check your internet connection and try again.',
        };
    }

    // Account exists
    if (msg.includes('already') || msg.includes('exists') || msg.includes('duplicate')) {
        return {
            code: 'ALREADY_EXISTS',
            message: 'An account with this phone number already exists.',
        };
    }

    // Unknown error
    return {
        code: 'UNKNOWN',
        message: error?.message || 'An unexpected error occurred. Please try again.',
    };
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
// GOOGLE SIGN-IN
// ═══════════════════════════════════════════════════════════════════

/**
 * Sign in with Google
 */
export async function signInWithGoogle(): Promise<AuthResult> {
    const client = getSupabaseClient();
    if (!client) {
        return { success: false, error: 'Supabase not available' };
    }

    try {
        await GoogleSignin.hasPlayServices();
        const response = await GoogleSignin.signIn();

        if (response.data?.idToken) {
            const { data, error } = await client.auth.signInWithIdToken({
                provider: 'google',
                token: response.data.idToken,
            });

            if (error) throw error;

            // If first sign-in, update profile
            if (data.user && response.data.user.name) {
                await updateUserProfile(data.user.id, {
                    displayName: response.data.user.name,
                    photoUrl: response.data.user.photo ?? undefined,
                    googleId: response.data.user.id,
                });
            }

            return { success: true, userId: data.user?.id };
        } else {
            return { success: false, error: 'No ID token present' };
        }
    } catch (error: any) {
        if (error.code === statusCodes.SIGN_IN_CANCELLED) {
            return { success: false, error: 'cancelled' };
        } else if (error.code === statusCodes.IN_PROGRESS) {
            return { success: false, error: 'Sign in in progress' };
        } else {
            console.error('[Auth] Google Sign-in error:', error);
            return { success: false, error: error.message || 'Google Sign-in failed' };
        }
    }
}

// ═══════════════════════════════════════════════════════════════════
// PHONE AUTH (STANDALONE & LINKING)
// ═══════════════════════════════════════════════════════════════════

/**
 * Initiate phone sign-in (sends OTP)
 */
export async function signInWithPhone(phone: string): Promise<AuthResult> {
    const client = getSupabaseClient();
    if (!client) {
        return { success: false, error: 'Supabase not available', errorCode: 'NOT_CONFIGURED' };
    }

    // Basic phone format validation
    if (!phone || phone.length < 10 || !phone.startsWith('+')) {
        return {
            success: false,
            error: 'Please enter a valid phone number with country code (e.g., +1234567890).',
            errorCode: 'INVALID_PHONE',
        };
    }

    try {
        const { error } = await client.auth.signInWithOtp({
            phone,
        });

        if (error) {
            const classified = classifyAuthError(error);
            return { success: false, error: classified.message, errorCode: classified.code };
        }

        return { success: true };
    } catch (error: any) {
        const classified = classifyAuthError(error);
        return { success: false, error: classified.message, errorCode: classified.code };
    }
}

/**
 * Verify OTP for phone sign-in
 */
export async function verifyPhoneOtp(phone: string, token: string): Promise<AuthResult> {
    const client = getSupabaseClient();
    if (!client) {
        return { success: false, error: 'Supabase not available', errorCode: 'NOT_CONFIGURED' };
    }

    try {
        const { data, error } = await client.auth.verifyOtp({
            phone,
            token,
            type: 'sms',
        });

        if (error) {
            const classified = classifyAuthError(error);
            return { success: false, error: classified.message, errorCode: classified.code };
        }

        // Ensure profile exists
        if (data.user) {
            // Check if profile exists, if not create basic one
            const profile = await getUserProfile(data.user.id);
            if (!profile) {
                await createUserProfile(data.user.id, {
                    displayName: 'Weave User', // Placeholder until they set it
                });
            }
            // Ensure phone is set in profile
            await updateUserProfile(data.user.id, { phone });
        }

        return { success: true, userId: data.user?.id };
    } catch (error: any) {
        const classified = classifyAuthError(error);
        return { success: false, error: classified.message, errorCode: classified.code };
    }
}

/**
 * Link phone number to existing user (Step 1: Send OTP)
 * Used for Apple/Google users adding a phone number
 */
export async function linkPhoneToUser(phone: string): Promise<AuthResult> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase not available' };

    try {
        const { error } = await client.auth.updateUser({
            phone,
        });

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Verify and link phone number (Step 2: Verify OTP)
 * Used for Apple/Google users confirming the number
 */
export async function verifyAndLinkPhone(phone: string, token: string): Promise<AuthResult> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase not available' };

    try {
        const { data, error } = await client.auth.verifyOtp({
            phone,
            token,
            type: 'phone_change',
        });

        if (error) throw error;

        // Update profile with verified phone
        if (data.user) {
            await updateUserProfile(data.user.id, { phone });
        }

        return { success: true, userId: data.user?.id };
    } catch (error: any) {
        return { success: false, error: error.message };
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
    data: {
        displayName?: string;
        username?: string;
        photoUrl?: string;
        phone?: string;
        googleId?: string;
    }
): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;

    try {
        const updates: Record<string, string> = {};
        if (data.displayName) updates.display_name = data.displayName;
        if (data.username) updates.username = data.username;
        if (data.photoUrl) updates.photo_url = data.photoUrl;
        if (data.phone) updates.phone = data.phone;
        if (data.googleId) updates.google_id = data.googleId;

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
    timezone?: string;
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
            timezone: undefined, // Column not yet in Supabase
        };
    } catch (e) {
        console.error('[Auth] getUserProfile exception:', e);
        return null;
    }
}
