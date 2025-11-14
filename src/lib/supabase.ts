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
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing Supabase environment variables. Cloud sync will be disabled.\n' +
    'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env'
  );
}

/**
 * Custom storage adapter using Expo SecureStore
 * Persists auth tokens securely on device
 */
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error('SecureStore getItem error:', error);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error('SecureStore setItem error:', error);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('SecureStore removeItem error:', error);
    }
  },
};

/**
 * Main Supabase client instance
 * Used for all auth and database operations
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

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
