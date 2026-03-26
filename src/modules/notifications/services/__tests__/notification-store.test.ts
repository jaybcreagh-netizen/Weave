import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationStore } from '../notification-store';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  mergeItem: jest.fn(),
  clear: jest.fn(),
  getAllKeys: jest.fn(),
  flushGetRequests: jest.fn(),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn(),
  multiMerge: jest.fn(),
}));

describe('notificationStore preferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sanitizes legacy maxDailySuggestions from stored preferences', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({
      frequency: 'light',
      quietHoursStart: 21,
      quietHoursEnd: 7,
      respectBattery: false,
      digestEnabled: false,
      digestTime: '18:30',
      maxDailySuggestions: 12,
    }));

    const prefs = await notificationStore.getPreferences();

    expect(prefs).toEqual({
      quietHoursStart: 21,
      quietHoursEnd: 7,
      respectBattery: false,
      digestEnabled: false,
      digestTime: '18:30',
    });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@weave:notification_preferences',
      JSON.stringify(prefs)
    );
  });

  it('writes only normalized fields when saving preferences', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({
      frequency: 'moderate',
      quietHoursStart: 22,
      quietHoursEnd: 8,
      respectBattery: true,
      digestEnabled: true,
      digestTime: '19:00',
      maxDailySuggestions: 10,
    }));

    await notificationStore.setPreferences({
      respectBattery: false,
    });

    expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(
      '@weave:notification_preferences',
      JSON.stringify({
        quietHoursStart: 22,
        quietHoursEnd: 8,
        respectBattery: false,
        digestEnabled: true,
        digestTime: '19:00',
      })
    );
  });

  it('can still read the legacy smart suggestion cadence for migration', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({
      frequency: 'light',
      quietHoursStart: 22,
      quietHoursEnd: 8,
      respectBattery: true,
      digestEnabled: true,
      digestTime: '19:00',
    }));

    const frequency = await notificationStore.getLegacySmartSuggestionFrequency();

    expect(frequency).toBe('light');
  });
});
