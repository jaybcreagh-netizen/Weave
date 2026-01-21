/**
 * Secure Store Adapter for Supabase
 *
 * Provides a secure storage implementation for Supabase auth tokens using
 * Expo SecureStore (encrypted) instead of AsyncStorage (unencrypted on iOS).
 *
 * FEATURES:
 * - Encrypted storage for sensitive tokens
 * - "Soft Migration": Automatically migrates existing sessions from AsyncStorage
 *   to SecureStore on first access, preventing user logout during upgrade.
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * Custom storage adapter for Supabase auth
 */
export const SecureStoreAdapter = {
    /**
     * Get value from secure store (with fallback to AsyncStorage migration)
     */
    getItem: async (key: string): Promise<string | null> => {
        try {
            // 1. Try to get from SecureStore first (the new standard)
            const secureValue = await SecureStore.getItemAsync(key);
            if (secureValue) {
                return secureValue;
            }

            // 2. If not found, check AsyncStorage (legacy storage)
            // This is the "Soft Migration" step to keep users logged in
            const legacyValue = await AsyncStorage.getItem(key);

            if (legacyValue) {
                console.log('[Auth] Migrating session from AsyncStorage to SecureStore...');
                // 3. If found in legacy, silently upgrade it to SecureStore
                await SecureStore.setItemAsync(key, legacyValue);

                // 4. Remove from legacy storage to complete migration
                await AsyncStorage.removeItem(key);

                return legacyValue;
            }

            return null;
        } catch (error) {
            console.warn('[Auth] Error reading/migrating auth token:', error);
            return null;
        }
    },

    /**
     * Set value in secure store
     */
    setItem: async (key: string, value: string): Promise<void> => {
        try {
            await SecureStore.setItemAsync(key, value);
        } catch (error) {
            console.warn('[Auth] Error saving auth token:', error);
        }
    },

    /**
     * Remove value from secure store (and ensure cleared from legacy)
     */
    removeItem: async (key: string): Promise<void> => {
        try {
            await SecureStore.deleteItemAsync(key);
            // Ensure legacy is also cleared just in case
            await AsyncStorage.removeItem(key);
        } catch (error) {
            console.warn('[Auth] Error removing auth token:', error);
        }
    },
};
