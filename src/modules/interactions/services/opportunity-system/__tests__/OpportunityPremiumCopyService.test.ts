import AsyncStorage from '@react-native-async-storage/async-storage';
import { OpportunityPremiumCopyService } from '../OpportunityPremiumCopyService';
import type { Opportunity } from '../types';
import type { Suggestion } from '@/shared/types/common';

jest.mock('@/modules/intelligence/services/intelligence-capabilities.service', () => ({
  intelligenceCapabilitiesService: {
    getCapabilitiesForCurrentProfile: jest.fn(),
  },
}));

jest.mock('@/shared/services/llm', () => ({
  llmService: {
    isAvailable: jest.fn(),
    completeStructuredFromRegistry: jest.fn(),
  },
  getPromptVersion: jest.fn(() => '1.0.0'),
}));

jest.mock('../context-hash', () => ({
  buildOpportunityContextHash: jest.fn().mockResolvedValue('hash-1'),
}));

const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const { intelligenceCapabilitiesService } = jest.requireMock('@/modules/intelligence/services/intelligence-capabilities.service');
const { llmService } = jest.requireMock('@/shared/services/llm');

function createOpportunity(): Opportunity {
  return {
    id: 'opportunity-1',
    friendId: 'friend-1',
    friendName: 'Alex',
    friendTier: 'InnerCircle',
    category: 'maintain',
    generatorSource: 'maintenance-generator',
    urgency: 65,
    confidence: 0.85,
    effortLevel: 'moderate',
    estimatedDurationMinutes: 30,
    explanation: {
      whyNow: 'It has been a quiet stretch.',
      whyThisFriend: 'Alex matters and has drifted a little lately.',
      whyThisAction: 'A concrete plan is the easiest way to restore momentum.',
    },
    timeRelevance: {
      bestWindow: 'evening',
    },
    copyContext: {
      daysSinceLastInteraction: 12,
      recentInteractionCategory: 'text-call',
      vibeHint: 'warm',
    },
    createdAt: Date.UTC(2026, 2, 24, 12, 0, 0),
  };
}

function createSuggestion(): Suggestion {
  return {
    id: 'opportunity-1',
    friendId: 'friend-1',
    friendName: 'Alex',
    type: 'connect',
    title: 'Make time for Alex around warm',
    subtitle: 'It has been 12 days since you last connected.',
    icon: 'MessageCircle',
    score: 80,
    reason: 'It has been 12 days since you last connected.',
    priority: 'medium',
    action: {
      type: 'plan',
      prefilledCategory: 'text-call',
    },
    category: 'maintain',
    urgency: 'medium',
    actionLabel: 'Plan',
    dismissible: true,
    createdAt: new Date('2026-03-24T12:00:00.000Z'),
    contextSnippet: 'warm is a natural way to make this feel specific with Alex.',
    aiEnriched: true,
  } as Suggestion;
}

describe('OpportunityPremiumCopyService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAsyncStorage.getItem.mockResolvedValue(null);
    mockedAsyncStorage.setItem.mockResolvedValue(undefined);
    intelligenceCapabilitiesService.getCapabilitiesForCurrentProfile.mockResolvedValue({
      remoteEnrichmentEnabled: true,
    });
    llmService.isAvailable.mockReturnValue(true);
  });

  it('fails open when premium copy is unavailable', async () => {
    llmService.isAvailable.mockReturnValue(false);

    const [result] = await OpportunityPremiumCopyService.enhanceSuggestions([
      { opportunity: createOpportunity(), suggestion: createSuggestion() },
    ]);

    expect(result.title).toBe('Make time for Alex around warm');
    expect(llmService.completeStructuredFromRegistry).not.toHaveBeenCalled();
  });

  it('generates and caches premium copy when remote enrichment is available', async () => {
    llmService.completeStructuredFromRegistry.mockResolvedValue({
      data: {
        title: 'Catch Alex while the warmth is still there',
        subtitle: 'A timely plan would make this easier to follow through on.',
        contextSnippet: 'You still have a natural opening here, so a small plan could land well.',
        actionLabel: 'Lock It In',
        reason: 'You still have a natural opening here, so a small plan could land well.',
      },
    });

    const [result] = await OpportunityPremiumCopyService.enhanceSuggestions([
      { opportunity: createOpportunity(), suggestion: createSuggestion() },
    ]);

    expect(result.title).toBe('Catch Alex while the warmth is still there');
    expect(result.actionLabel).toBe('Lock It In');
    expect(result.contextSnippet).toContain('natural opening');
    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
      expect.stringContaining('@weave:opportunity_premium_copy:opportunity-1:hash-1:1.0.0'),
      expect.any(String)
    );
  });

  it('uses cached premium copy before calling the LLM again', async () => {
    mockedAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify({
      title: 'Cached title',
      subtitle: 'Cached subtitle',
      contextSnippet: 'Cached context',
      actionLabel: 'Cached action',
      reason: 'Cached reason',
      aiEnriched: true,
    }));

    const [result] = await OpportunityPremiumCopyService.enhanceSuggestions([
      { opportunity: createOpportunity(), suggestion: createSuggestion() },
    ]);

    expect(result.title).toBe('Cached title');
    expect(result.actionLabel).toBe('Cached action');
    expect(llmService.completeStructuredFromRegistry).not.toHaveBeenCalled();
  });
});
