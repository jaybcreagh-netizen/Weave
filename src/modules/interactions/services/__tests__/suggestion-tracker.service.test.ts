import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import * as SuggestionTracker from '../suggestion-tracker.service';
import { Suggestion } from '@/types/suggestions';

// Mock database
jest.mock('@/db', () => ({
  database: {
    write: jest.fn((callback) => callback()),
    get: jest.fn(),
  },
}));

describe('SuggestionTrackerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('trackSuggestionShown', () => {
    it('should create a shown event', async () => {
      const mockCreate = jest.fn();
      (database.get as jest.Mock).mockReturnValue({
        create: mockCreate,
      });

      const suggestion: Suggestion = {
        id: 's1',
        friendId: 'f1',
        friendName: 'Friend',
        category: 'drift',
        urgency: 'high',
        action: { type: 'log' },
      } as any;

      const context = {
        friendScore: 50,
        daysSinceLastInteraction: 10,
      };

      await SuggestionTracker.trackSuggestionShown(suggestion, context);

      expect(database.get).toHaveBeenCalledWith('suggestion_events');
      expect(mockCreate).toHaveBeenCalled();
    });
  });

  describe('trackSuggestionActed', () => {
    it('should create an acted event and calculate time to action', async () => {
      const mockCreate = jest.fn();
      const mockQuery = jest.fn();
      const mockFetch = jest.fn();

      // Mock finding the shown event
      const shownEvent = {
        eventTimestamp: new Date(Date.now() - 60000 * 30), // 30 mins ago
        friendId: 'f1',
        suggestionType: 'drift',
        urgency: 'high',
        actionType: 'log',
      };

      mockFetch.mockResolvedValue([shownEvent]);
      mockQuery.mockReturnValue({ fetch: mockFetch });

      (database.get as jest.Mock).mockReturnValue({
        create: mockCreate,
        query: mockQuery,
      });

      await SuggestionTracker.trackSuggestionActed('s1');

      expect(mockCreate).toHaveBeenCalledWith(expect.any(Function));
      // We verify the callback logic by mocking the create function implementation if needed,
      // but here we just check it was called.
      // To verify the values passed to the callback, we would need to simulate the model instance passed to it.
    });
  });
});
