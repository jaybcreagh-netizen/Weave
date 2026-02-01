/**
 * Safe linking utilities
 * Provides error-handled wrappers for Linking API calls.
 */

import { Linking, Alert, Platform } from 'react-native';
import { logger } from '@/shared/services/logger.service';

/**
 * Safely opens the system settings for the app.
 * Handles errors gracefully instead of throwing unhandled rejections.
 *
 * @returns Promise<boolean> - true if settings opened, false if failed
 */
export async function safeOpenSettings(): Promise<boolean> {
    try {
        await Linking.openSettings();
        return true;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('LinkingUtils', 'Failed to open app settings:', errorMessage);

        // Show user-friendly fallback
        Alert.alert(
            'Unable to Open Settings',
            Platform.select({
                ios: 'Please open Settings > Weave manually to change permissions.',
                android: 'Please open Settings > Apps > Weave manually to change permissions.',
                default: 'Please open your device settings manually.',
            }),
            [{ text: 'OK' }]
        );

        return false;
    }
}

/**
 * Safely opens a URL.
 * Handles errors gracefully and validates the URL can be opened first.
 *
 * @param url - The URL to open
 * @returns Promise<boolean> - true if URL opened, false if failed
 */
export async function safeOpenURL(url: string): Promise<boolean> {
    try {
        const canOpen = await Linking.canOpenURL(url);
        if (!canOpen) {
            logger.warn('LinkingUtils', `Cannot open URL: ${url}`);
            return false;
        }

        await Linking.openURL(url);
        return true;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('LinkingUtils', `Failed to open URL ${url}:`, errorMessage);
        return false;
    }
}
