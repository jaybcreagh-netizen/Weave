import { FocusGenerator } from '../focus-generator';
import { fetchSuggestions } from '@/modules/interactions/services/SuggestionFacade';
import type { Suggestion } from '@/shared/types/common';

jest.mock('@/modules/interactions/services/SuggestionFacade', () => ({
  fetchSuggestions: jest.fn(),
}));

function createSuggestion(overrides: Partial<Suggestion> = {}): Suggestion {
  return {
    id: 'suggestion-1',
    friendId: 'friend-1',
    friendName: 'Alex',
    type: 'connect',
    title: 'Check in with Alex',
    subtitle: 'It has been a while.',
    icon: 'MessageCircle',
    action: {
      type: 'log',
      prefilledCategory: 'text-call',
    },
    category: 'maintain',
    urgency: 'medium',
    actionLabel: 'Reach out',
    dismissible: true,
    createdAt: new Date('2026-03-23T10:00:00.000Z'),
    ...overrides,
  };
}

describe('FocusGenerator', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('requests selector-backed suggestions and caps the focus surface to two items', async () => {
    const fetchedSuggestions = [createSuggestion()];
    (fetchSuggestions as jest.Mock).mockResolvedValue(fetchedSuggestions);
    const enrichSpy = jest
      .spyOn(FocusGenerator, 'enrichWithContext')
      .mockResolvedValue(fetchedSuggestions);

    const result = await FocusGenerator.getSuggestions(10, 'balanced');

    expect(fetchSuggestions).toHaveBeenCalledWith(2, 'balanced', undefined, {
      forceSelector: true,
      trackAnalytics: false,
    });
    expect(enrichSpy).toHaveBeenCalledWith(fetchedSuggestions);
    expect(result).toEqual(fetchedSuggestions);
  });
});
