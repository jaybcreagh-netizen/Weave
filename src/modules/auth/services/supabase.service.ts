/**
 * Supabase Client Configuration
 * Handles authentication and cloud sync for Weave
 */

import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

// Important: Complete auth session for OAuth flows
WebBrowser.maybeCompleteAuthSession();

// Supabase configuration
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Main Supabase client instance
 * Used for all auth and database operations
 */

// Define a partial interface for the dummy client to avoid 'any'
interface DummySupabaseClient {
  auth: {
    getSession: () => Promise<{ data: { session: null }, error: null }>;
    onAuthStateChange: () => { data: { subscription: { unsubscribe: () => void } } };
    signInWithOAuth: () => Promise<{ error: { message: string } }>;
    signOut: () => Promise<{ error: null }>;
  };
  from: () => {
    select: () => { data: any[], error: { message: string } };
    insert: () => { data: null, error: { message: string } };
    update: () => { data: null, error: { message: string } };
    delete: () => { data: null, error: { message: string } };
    upload: () => { data: null, error: { message: string } };
    getPublicUrl: () => { data: { publicUrl: string } };
    remove: () => { error: { message: string } };
  };
  storage: {
    from: (bucket: string) => {
      upload: () => { data: null, error: { message: string } };
      getPublicUrl: () => { data: { publicUrl: string } };
      remove: () => { error: { message: string } };
    };
  };
}

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    SecureStore.deleteItemAsync(key);
  },
};

export const supabase = (() => {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      'Missing Supabase environment variables. Cloud sync will be disabled.\n' +
      'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env'
    );

    // Return a dummy client that warns on usage but doesn't crash
    // This allows the app to load even if Supabase isn't configured
    return {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
        signInWithOAuth: async () => ({ error: { message: 'Supabase not configured' } }),
        signOut: async () => ({ error: null }),
      },
      from: () => ({
        select: () => ({ data: [], error: { message: 'Supabase not configured' } }),
        insert: () => ({ data: null, error: { message: 'Supabase not configured' } }),
        update: () => ({ data: null, error: { message: 'Supabase not configured' } }),
        delete: () => ({ data: null, error: { message: 'Supabase not configured' } }),
        upload: () => ({ data: null, error: { message: 'Supabase not configured' } }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
        remove: () => ({ error: { message: 'Supabase not configured' } }),
      }),
      storage: {
        from: () => ({
          upload: () => ({ data: null, error: { message: 'Supabase not configured' } }),
          getPublicUrl: () => ({ data: { publicUrl: '' } }),
          remove: () => ({ error: { message: 'Supabase not configured' } }),
        }),
      }
    } as unknown as TypedSupabaseClient;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: ExpoSecureStoreAdapter as any,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
})();

/**
 * Database types for TypeScript
 * Auto-generated from Supabase schema
 */
export type Database = {
  public: {
    Tables: {
      user_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          tier: 'free' | 'plus' | 'premium';
          status: 'active' | 'canceled' | 'past_due' | 'trialing';
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          trial_ends_at: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          canceled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_subscriptions']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['user_subscriptions']['Insert']>;
      };
      usage_tracking: {
        Row: {
          id: string;
          user_id: string;
          period_start: string;
          period_end: string;
          friends_count: number;
          weaves_this_month: number;
          created_at: string;
          updated_at: string;
        };
      };
      friends: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          dunbar_tier: string;
          archetype: string;
          weave_score: number;
          // ... other fields
        };
      };
      // ... other tables
    };
  };
};

/**
 * Type-safe Supabase client
 */
export type TypedSupabaseClient = ReturnType<typeof createClient<Database>>;
