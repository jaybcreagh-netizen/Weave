import AsyncStorage from '@react-native-async-storage/async-storage';
import Logger from '@/shared/utils/Logger';

const DISMISSED_KEY = 'weave:suggestions:dismissed';
const LAST_SHOWN_KEY = 'weave:suggestions:lastShown';

export interface DismissedSuggestion {
  id: string;
  dismissedAt: number;
  cooldownDays: number;
}

export async function getDismissedSuggestions(): Promise<Map<string, DismissedSuggestion>> {
  try {
    const json = await AsyncStorage.getItem(DISMISSED_KEY);
    if (!json) return new Map();

    const array: DismissedSuggestion[] = JSON.parse(json);
    const now = Date.now();

    // Filter out expired dismissals
    const active = array.filter(d => {
      const expiresAt = d.dismissedAt + (d.cooldownDays * 86400000);
      return now < expiresAt;
    });

    // Save cleaned list
    await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(active));

    return new Map(active.map(d => [d.id, d]));
  } catch (error) {
    Logger.error('Failed to get dismissed suggestions', error);
    return new Map();
  }
}

export async function dismissSuggestion(id: string, cooldownDays: number): Promise<void> {
  try {
    const dismissed = await getDismissedSuggestions();
    dismissed.set(id, {
      id,
      dismissedAt: Date.now(),
      cooldownDays,
    });

    const array = Array.from(dismissed.values());
    await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(array));
  } catch (error) {
    Logger.error('Failed to dismiss suggestion', error);
  }
}

export async function getLastShownTimestamp(): Promise<number> {
  try {
    const value = await AsyncStorage.getItem(LAST_SHOWN_KEY);
    return value ? parseInt(value, 10) : 0;
  } catch (error) {
    Logger.error('Failed to get last shown timestamp', error);
    return 0;
  }
}

export async function setLastShownTimestamp(timestamp: number): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_SHOWN_KEY, timestamp.toString());
  } catch (error) {
    Logger.error('Failed to set last shown timestamp', error);
  }
}

export async function clearAllDismissed(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DISMISSED_KEY);
    Logger.info('Cleared all dismissed suggestions');
  } catch (error) {
    Logger.error('Failed to clear dismissed suggestions', error);
  }
}
