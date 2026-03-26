import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import * as SuggestionTracker from '../suggestion-tracker.service';
import { Suggestion } from '@/types/suggestions';
import { OpportunityPoolService } from '../opportunity-system/OpportunityPoolService';

jest.mock('../opportunity-system/OpportunityPoolService', () => ({
  OpportunityPoolService: {
    recordOpportunityEventByIds: jest.fn().mockResolvedValue(undefined),
    recordSelectorSystemEvent: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../opportunity-system/SelectorExperimentService', () => ({
  SelectorExperimentService: {
    getConfig: jest.fn().mockResolvedValue({
      thresholdVariant: 'strict',
      copyVariant: 'why-now',
      updatedAt: 123,
    }),
  },
}));

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

    it('forwards selector surface metadata into the opportunity pool log', async () => {
      const mockCreate = jest.fn();
      (database.get as jest.Mock).mockReturnValue({
        create: mockCreate,
      });

      const suggestion: Suggestion = {
        id: 's1',
        friendId: 'f1',
        friendName: 'Friend',
        category: 'maintain',
        urgency: 'medium',
        action: { type: 'log' },
      } as any;

      await SuggestionTracker.trackSuggestionShown(
        suggestion,
        {
          friendScore: 50,
          daysSinceLastInteraction: 10,
        },
        {
          compositeScore: 64,
          scoreBreakdown: { urgency: 20 },
          surfaceSource: 'selector',
          selectionReason: 'selected',
          surfaceSlot: 'primary',
          opportunitySource: 'pool',
          surfaceRequestKind: 'manual_pull',
        }
      );

      expect(OpportunityPoolService.recordOpportunityEventByIds).toHaveBeenCalledWith(
        ['s1'],
        'surfaced',
        expect.objectContaining({
          compositeScore: 64,
          scoreBreakdown: { urgency: 20 },
          surfaceSource: 'selector',
          selectionReason: 'selected',
          surfaceSlot: 'primary',
          opportunitySource: 'pool',
          surfaceRequestKind: 'manual_pull',
          thresholdVariant: 'strict',
          copyVariant: 'why-now',
          presentationCopy: {
            title: suggestion.title,
            subtitle: suggestion.subtitle,
            contextSnippet: suggestion.contextSnippet,
            actionLabel: suggestion.actionLabel,
            reason: suggestion.reason,
            aiEnriched: suggestion.aiEnriched,
          },
        })
      );
    });

    it('records selector quiet displays separately from surfaced suggestions', async () => {
      await SuggestionTracker.trackSelectorQuietDisplayed({
        quietReason: 'recently_handled',
        selectionReason: 'empty',
        surfaceRequestKind: 'automatic',
        pacingSnapshot: {
          season: 'balanced',
          dailyFreshBudget: 1,
          budgetRemaining: 0,
        },
      });

      expect(OpportunityPoolService.recordSelectorSystemEvent).toHaveBeenCalledWith(
        'quiet',
        expect.objectContaining({
          surfaceSource: 'selector',
          selectionReason: 'empty',
          quietReason: 'recently_handled',
          surfaceRequestKind: 'automatic',
          thresholdVariant: 'strict',
          copyVariant: 'why-now',
          pacingSnapshot: {
            season: 'balanced',
            dailyFreshBudget: 1,
            budgetRemaining: 0,
          },
        })
      );
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
