import AsyncStorage from '@react-native-async-storage/async-storage';

export const SUGGESTION_NUDGES_ENABLED_KEY = '@weave:suggestion_nudges_enabled';

/**
 * Check if subtle suggestion nudges are enabled in Circle tier tabs.
 * Defaults to true if not set.
 */
export async function areSuggestionNudgesEnabled(): Promise<boolean> {
    try {
        const value = await AsyncStorage.getItem(SUGGESTION_NUDGES_ENABLED_KEY);
        return value ? JSON.parse(value) : true;
    } catch {
        return true;
    }
}
