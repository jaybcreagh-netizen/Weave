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
import { setUserProperties } from '@/shared/services/analytics.service';
import { withTimeout, AUTH_TIMEOUTS } from './auth-utils';

// Configure Google Sign-In
// Note: client IDs should come from env vars
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';
const GOOGLE_SIGN_IN_CONFIGURED = Boolean(GOOGLE_WEB_CLIENT_ID);

function maskPhoneForLog(phone?: string | null): string {
    if (!phone) return '(none)';
    const digits = phone.replace(/[^0-9]/g, '');
    if (digits.length <= 4) return `***${digits}`;
    return `***${digits.slice(-4)}`;
}

if (GOOGLE_SIGN_IN_CONFIGURED) {
    GoogleSignin.configure({
        scopes: ['email', 'profile'],
        webClientId: GOOGLE_WEB_CLIENT_ID,
        iosClientId: GOOGLE_IOS_CLIENT_ID,
    });
}

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
    | 'INVALID_EMAIL'       // Email format invalid
    | 'INVALID_OTP'         // OTP code incorrect or expired
    | 'WEAK_PASSWORD'       // Password doesn't meet requirements
    | 'WRONG_PASSWORD'      // Incorrect password for sign in
    | 'EMAIL_NOT_CONFIRMED' // Email verification required
    | 'NETWORK_ERROR'       // Network connectivity issue
    | 'NOT_CONFIGURED'      // Supabase not configured
    | 'NOT_AUTHENTICATED'   // User not logged in
    | 'ALREADY_EXISTS'      // Account already exists
    | 'TIMEOUT'             // Request timed out
    | 'UNKNOWN';            // Unknown error

export interface AuthResult {
    success: boolean;
    error?: string;
    errorCode?: AuthErrorCode;
    userId?: string;
    isAlreadyLinked?: boolean;
}

export interface UserSession {
    userId: string;
    email?: string;
    displayName?: string;
}

// ... (rest of the file until classifyAuthError)

/**
 * Classify a Supabase error into a specific error code
 */
function classifyAuthError(error: any): { code: AuthErrorCode; message: string } {
    const msg = error?.message?.toLowerCase() || '';
    const errorCode = error?.code || error?.status || '';

    // Log the raw error for debugging
    console.log('[Auth] classifyAuthError:', { msg, errorCode, rawError: error });

    // Timeout Error
    if (msg.includes('timed out') || msg.includes('timeout')) {
        return {
            code: 'TIMEOUT',
            message: 'The request timed out. Please check your connection.',
        };
    }

    // Rate limiting
    if (msg.includes('rate limit') || msg.includes('too many') || errorCode === 429) {
        return {
            code: 'RATE_LIMITED',
            message: 'Too many attempts. Please wait a few minutes and try again.',
        };
    }

    // SMS provider / Twilio setup issues
    if (
        msg.includes('sms provider') ||
        msg.includes('twilio') ||
        msg.includes('messaging service') ||
        msg.includes('auth token') ||
        msg.includes('unable to create record')
    ) {
        return {
            code: 'NOT_CONFIGURED',
            message: 'SMS service is temporarily unavailable. Please try again shortly.',
        };
    }

    // Phone already in use
    if (
        msg.includes('phone') &&
        (msg.includes('already') || msg.includes('exists') || msg.includes('registered') || msg.includes('taken'))
    ) {
        return {
            code: 'ALREADY_EXISTS',
            message: 'This phone number is already linked to another account.',
        };
    }


    // Twilio/Provider Configuration Error (Invalid Sender ID)
    if (msg.includes('invalid from number') || msg.includes('caller id')) {
        return {
            code: 'NOT_CONFIGURED',
            message: `Configuration Error: The server's SMS sender ID is invalid. Please check your Supabase/Twilio settings. (Error: ${msg})`,
        };
    }

    // Invalid phone format (User error)
    if (msg.includes('invalid') && (msg.includes('phone') || msg.includes('number'))) {
        return {
            code: 'INVALID_PHONE',
            // Append the raw message so we can see if it's "twilio error" or "sms provider not set up" etc
            message: `Please enter a valid phone number with country code. (Error: ${msg})`,
        };
    }

    // Invalid email format
    if (msg.includes('invalid') && msg.includes('email')) {
        return {
            code: 'INVALID_EMAIL',
            message: 'Please enter a valid email address.',
        };
    }

    // Password too weak
    if (msg.includes('password') && (msg.includes('weak') || msg.includes('short') || msg.includes('least'))) {
        return {
            code: 'WEAK_PASSWORD',
            message: 'Password must be at least 6 characters long.',
        };
    }

    // Wrong password / invalid credentials
    if (msg.includes('invalid login') || msg.includes('invalid credentials') ||
        (msg.includes('password') && msg.includes('incorrect')) ||
        msg.includes('wrong password')) {
        return {
            code: 'WRONG_PASSWORD',
            message: 'Incorrect email or password. Please try again.',
        };
    }

    // Email not confirmed
    if (msg.includes('email not confirmed') || msg.includes('confirm your email') ||
        msg.includes('verify your email')) {
        return {
            code: 'EMAIL_NOT_CONFIRMED',
            message: 'Please check your inbox and verify your email before signing in.',
        };
    }

    // OTP errors
    if (msg.includes('otp') || msg.includes('token') || msg.includes('code')) {
        if (msg.includes('expired') || msg.includes('token has expired')) {
            return {
                code: 'INVALID_OTP',
                message: 'Code expired. Please request a new one.',
            };
        }
        if (
            msg.includes('invalid') ||
            msg.includes('incorrect') ||
            msg.includes('not valid') ||
            msg.includes('mismatch')
        ) {
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

    // Account already exists (user already registered)
    if (msg.includes('already') || msg.includes('exists') || msg.includes('duplicate') ||
        msg.includes('user already registered')) {
        return {
            code: 'ALREADY_EXISTS',
            message: 'An account with this email already exists. Try signing in instead.',
        };
    }

    // Unknown error - return the original message if available
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

        if (data.user) {
            setUserProperties({
                email: data.user.email,
                name: fullName,
                auth_provider: 'apple'
            });
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
export function isGoogleSignInAvailable(): boolean {
    return isFeatureEnabled('SUPABASE_AUTH_ENABLED') && GOOGLE_SIGN_IN_CONFIGURED;
}

/**
 * Sign in with Google
 */
export async function signInWithGoogle(): Promise<AuthResult> {
    if (!GOOGLE_SIGN_IN_CONFIGURED) {
        return {
            success: false,
            error: 'Google Sign-In is not configured for this build.',
            errorCode: 'NOT_CONFIGURED',
        };
    }

    const client = getSupabaseClient();
    if (!client) {
        return { success: false, error: 'Supabase not available', errorCode: 'NOT_CONFIGURED' };
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

            if (data.user) {
                setUserProperties({
                    email: data.user.email,
                    name: response.data.user.name,
                    auth_provider: 'google'
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
    // Must start with + and have at least 7 digits after the country code
    if (!phone || !phone.startsWith('+')) {
        return {
            success: false,
            error: 'Please enter a valid phone number with country code (e.g., +14155551234).',
            errorCode: 'INVALID_PHONE',
        };
    }

    // Extract just the digits (excluding the +)
    const digitsOnly = phone.slice(1).replace(/[^0-9]/g, '');
    // Most country codes are 1-3 digits, so we need at least 8 total digits 
    // (1 for country code + 7 for number) to be valid
    if (digitsOnly.length < 8) {
        return {
            success: false,
            error: 'Phone number is too short. Please include your full number.',
            errorCode: 'INVALID_PHONE',
        };
    }

    try {
        console.log('[Auth] Sending OTP to:', phone);
        console.log('[Auth] Client ready, invoking signInWithOtp...');
        const otpStart = Date.now();

        const { error } = await withTimeout(
            client.auth.signInWithOtp({ phone }),
            AUTH_TIMEOUTS.OTP_SEND,
            'OTP Send'
        );

        console.log(`[Auth] signInWithOtp completed in ${Date.now() - otpStart}ms`);

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
        const verifyPromise = client.auth.verifyOtp({
            phone,
            token,
            type: 'sms',
        });

        const { data, error } = await withTimeout(
            verifyPromise,
            AUTH_TIMEOUTS.OTP_VERIFY,
            'OTP Verify'
        );

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

            setUserProperties({
                phone: phone,
                auth_provider: 'phone'
            });
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
    if (!client) return { success: false, error: 'Supabase not available', errorCode: 'NOT_CONFIGURED' };

    try {
        console.log('[Auth] Linking phone:', maskPhoneForLog(phone));

        // 1. Check if already linked to THIS user
        const { data: userData } = await client.auth.getUser();

        if (!userData?.user) {
            return {
                success: false,
                error: 'You need to be signed in before linking a phone number.',
                errorCode: 'NOT_AUTHENTICATED',
            };
        }

        console.log('[Auth] Current user phone:', maskPhoneForLog(userData?.user?.phone));

        // Normalize for comparison (remove non-digits)
        const currentPhoneClean = userData?.user?.phone?.replace(/[^0-9]/g, '');
        const newPhoneClean = phone.replace(/[^0-9]/g, '');

        console.log('[Auth] Comparing clean phones:', {
            current: maskPhoneForLog(currentPhoneClean),
            next: maskPhoneForLog(newPhoneClean),
        });

        if (currentPhoneClean && currentPhoneClean === newPhoneClean) {
            console.log('[Auth] Phone already linked to this user. Returning success.');
            return { success: true, isAlreadyLinked: true };
        }

        console.log('[Auth] Client ready, invoking updateUser...');
        const params = { phone };
        console.log('[Auth] Update params: { phone: [redacted] }');
        const start = Date.now();

        const authPromise = client.auth.updateUser(params);

        // Restore timeout wrapper
        const { data, error } = await withTimeout(
            authPromise,
            AUTH_TIMEOUTS.OTP_SEND,
            'Link Phone'
        );

        console.log(`[Auth] linkPhoneToUser completed in ${Date.now() - start}ms`);

        console.log('[Auth] linkPhoneToUser response:', { hasData: !!data, error });

        if (error) {
            const classified = classifyAuthError(error);
            return { success: false, error: classified.message, errorCode: classified.code };
        }
        return { success: true };
    } catch (error: any) {
        console.error('[Auth] linkPhoneToUser exception:', error);
        const classified = classifyAuthError(error);
        return { success: false, error: classified.message, errorCode: classified.code };
    }
}

/**
 * Verify and link phone number (Step 2: Verify OTP)
 * Used for Apple/Google users confirming the number
 */
export async function verifyAndLinkPhone(phone: string, token: string): Promise<AuthResult> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Supabase not available', errorCode: 'NOT_CONFIGURED' };

    try {
        const { data: { user } } = await client.auth.getUser();
        if (!user) {
            return {
                success: false,
                error: 'You need to be signed in before verifying a phone change.',
                errorCode: 'NOT_AUTHENTICATED',
            };
        }

        const verifyPromise = client.auth.verifyOtp({
            phone,
            token,
            type: 'phone_change',
        });

        const { data, error } = await withTimeout(
            verifyPromise,
            AUTH_TIMEOUTS.OTP_VERIFY,
            'Link Verify'
        );

        if (error) {
            const classified = classifyAuthError(error);
            return { success: false, error: classified.message, errorCode: classified.code };
        }

        // Update profile with verified phone
        if (data.user) {
            await updateUserProfile(data.user.id, { phone });
        }

        return { success: true, userId: data.user?.id };
    } catch (error: any) {
        const classified = classifyAuthError(error);
        return { success: false, error: classified.message, errorCode: classified.code };
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
            const classified = classifyAuthError(error);
            return { success: false, error: classified.message, errorCode: classified.code };
        }

        // Create user profile
        if (data.user) {
            await createUserProfile(data.user.id, {
                email,
                displayName,
            });

            setUserProperties({
                email: email,
                name: displayName,
                auth_provider: 'email'
            });
        }

        return { success: true, userId: data.user?.id };
    } catch (error: unknown) {
        const classified = classifyAuthError(error);
        return { success: false, error: classified.message, errorCode: classified.code };
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
            const classified = classifyAuthError(error);
            return { success: false, error: classified.message, errorCode: classified.code };
        }

        return { success: true, userId: data.user?.id };
    } catch (error: unknown) {
        const classified = classifyAuthError(error);
        return { success: false, error: classified.message, errorCode: classified.code };
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

/**
 * Unlink phone number from user account
 *
 * This only clears the phone from user_profiles (for UI/contact matching).
 * It does NOT remove phone from auth.users to avoid SMS provider latency.
 *
 * If phone is the user's ONLY auth method, this operation is blocked.
 */
export async function unlinkPhone(): Promise<AuthResult> {
    const client = getSupabaseClient();
    if (!client) {
        return { success: false, error: 'Supabase not available', errorCode: 'NOT_CONFIGURED' };
    }

    try {
        console.log('[Auth] Unlinking phone number...');

        // 1. Get current user and check auth methods
        const { data: { user }, error: userError } = await client.auth.getUser();

        if (userError || !user) {
            return { success: false, error: 'Not authenticated', errorCode: 'NOT_AUTHENTICATED' };
        }

        // 2. Check if phone is their only auth method
        // Users have identities array with their auth providers
        const identities = user.identities || [];
        const providers = identities.map(i => i.provider);

        // Check for non-phone auth methods (apple, google, email)
        const hasOtherAuth = providers.some(p => p !== 'phone');
        const hasPhoneAuth = providers.includes('phone');

        console.log('[Auth] User providers:', providers, { hasOtherAuth, hasPhoneAuth });

        // If phone is their only auth method, block the operation
        if (hasPhoneAuth && !hasOtherAuth) {
            console.log('[Auth] Cannot unlink - phone is only auth method');
            return {
                success: false,
                error: 'Cannot remove phone number - it\'s your only sign-in method. Add another sign-in method first.',
                errorCode: 'NOT_CONFIGURED'
            };
        }

        // 3. Find the phone identity to unlink
        const phoneIdentity = identities.find(i => i.provider === 'phone');
        if (!phoneIdentity) {
            console.log('[Auth] No phone identity found to unlink');
            // Check if profile has it stashed (inconsistent state), maybe clear profile anyway?
        } else {
            // 4. Unlink the identity
            console.log('[Auth] Unlinking identity:', phoneIdentity.id);
            const { error: unlinkError } = await client.auth.unlinkIdentity(phoneIdentity);

            if (unlinkError) {
                console.error('[Auth] Failed to unlink identity:', unlinkError);
                const classified = classifyAuthError(unlinkError);
                return { success: false, error: classified.message, errorCode: classified.code };
            }
        }

        // 5. Clear phone from user_profiles (keep for UI consistency and contact matching)
        const { error: profileError } = await client
            .from('user_profiles')
            .update({
                phone: null,
                phone_hash: null,
                updated_at: Date.now(),  // Epoch ms for WatermelonDB compatibility
            })
            .eq('id', user.id);

        if (profileError) {
            console.error('[Auth] Failed to clear phone from user_profiles:', profileError);
            // We successfully unlinked auth identity, so we should probably return success 
            // but warn about profile sync
        }

        console.log('[Auth] Phone unlinked successfully');
        return { success: true };
    } catch (error: any) {
        console.error('[Auth] unlinkPhone exception:', error);
        const classified = classifyAuthError(error);
        return { success: false, error: classified.message, errorCode: classified.code };
    }
}
