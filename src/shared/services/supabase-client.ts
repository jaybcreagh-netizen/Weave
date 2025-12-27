/**
 * Supabase Client Configuration
 * 
 * Central Supabase client instance for the app.
 * Only initialized when ACCOUNTS_ENABLED feature flag is true.
 * 
 * Configuration is done via environment variables:
 *   EXPO_PUBLIC_SUPABASE_URL - Your Supabase project URL
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY - Your Supabase anon/public key
 * 
 * NOTE: Using flexible typing until Supabase project is created and
 * types are generated with `supabase gen types typescript`.
 */

import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isFeatureEnabled } from '@/shared/config/feature-flags';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

// Read from environment variables (set in app.config.js or .env)
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Check if Supabase is properly configured
 */
export function isSupabaseConfigured(): boolean {
    return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

// ═══════════════════════════════════════════════════════════════════
// CLIENT SINGLETON
// ═══════════════════════════════════════════════════════════════════

// Using any for now - will be replaced with generated Database types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supabaseInstance: SupabaseClient<any> | null = null;

/**
 * Get or create the Supabase client instance.
 * Returns null if:
 * - Supabase is not configured (missing env vars)
 * - ACCOUNTS_ENABLED feature flag is false
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupabaseClient(): SupabaseClient<any> | null {
    // Check feature flag first
    if (!isFeatureEnabled('ACCOUNTS_ENABLED')) {
        return null;
    }

    // Check if configured
    if (!isSupabaseConfigured()) {
        console.warn('[Supabase] Not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
        return null;
    }

    // Create singleton instance
    if (!supabaseInstance) {
        supabaseInstance = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
            auth: {
                storage: AsyncStorage,
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: false, // Not needed for React Native
            },
        });
    }

    return supabaseInstance;
}

/**
 * Reset the Supabase client (useful for testing or sign-out)
 */
export function resetSupabaseClient(): void {
    supabaseInstance = null;
}

// ═══════════════════════════════════════════════════════════════════
// CONVENIENCE EXPORTS
// ═══════════════════════════════════════════════════════════════════

// Re-export types that consumers might need
export type { SupabaseClient } from '@supabase/supabase-js';
