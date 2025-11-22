import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SuggestionStorage from '../suggestion-storage.service';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('SuggestionStorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDismissedSuggestions', () => {
    it('should return empty map if no data', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      const result = await SuggestionStorage.getDismissedSuggestions();
      expect(result.size).toBe(0);
    });

    it('should return active dismissals and filter expired ones', async () => {
      const now = Date.now();
      const data = [
        { id: '1', dismissedAt: now, cooldownDays: 1 }, // Active
        { id: '2', dismissedAt: now - (2 * 86400000), cooldownDays: 1 }, // Expired
      ];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(data));

      const result = await SuggestionStorage.getDismissedSuggestions();

      expect(result.size).toBe(1);
      expect(result.has('1')).toBe(true);
      expect(result.has('2')).toBe(false);

      // Should save cleaned list
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'weave:suggestions:dismissed',
        expect.stringContaining('"id":"1"')
      );
    });
  });

  describe('dismissSuggestion', () => {
    it('should add dismissal', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      await SuggestionStorage.dismissSuggestion('s1', 7);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'weave:suggestions:dismissed',
        expect.stringContaining('"id":"s1"')
      );
    });
  });
});
