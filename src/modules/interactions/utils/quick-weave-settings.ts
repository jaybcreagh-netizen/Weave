import AsyncStorage from '@react-native-async-storage/async-storage';

export const QUICK_WEAVE_ENABLED_KEY = '@weave:quick_weave_enabled';

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
