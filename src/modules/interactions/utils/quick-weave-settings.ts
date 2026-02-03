import AsyncStorage from '@react-native-async-storage/async-storage';

export const QUICK_WEAVE_ENABLED_KEY = '@weave:quick_weave_enabled';
export const QUICK_WEAVE_MODE_KEY = '@weave:quick_weave_mode';

export type QuickWeaveMode = 'gesture' | 'click';

/**
 * Check if Quick Weave is enabled.
 * Defaults to true if not set.
 */
export async function isQuickWeaveEnabled(): Promise<boolean> {
    try {
        const value = await AsyncStorage.getItem(QUICK_WEAVE_ENABLED_KEY);
        return value ? JSON.parse(value) : true;
    } catch {
        return true;
    }
}

/**
 * Get the current Quick Weave mode.
 * Defaults to 'gesture' if not set.
 */
export async function getQuickWeaveMode(): Promise<QuickWeaveMode> {
    try {
        const value = await AsyncStorage.getItem(QUICK_WEAVE_MODE_KEY);
        return (value as QuickWeaveMode) || 'gesture';
    } catch {
        return 'gesture';
    }
}
