import type { Opportunity } from '../types';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: {
    SHA256: 'SHA256',
  },
  digestStringAsync: jest.fn(async (_algorithm: string, value: string) => `mock-hash:${value}`),
}));

import { buildOpportunityContextHash } from '../context-hash';

function createOpportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: 'opportunity-1',
    friendId: 'friend-1',
    friendName: 'Alex',
    friendTier: 'InnerCircle',
    category: 'maintain',
    generatorSource: 'maintenance-generator',
    urgency: 42,
    confidence: 0.8,
    effortLevel: 'moderate',
    estimatedDurationMinutes: 30,
    explanation: {
      whyNow: 'It has been a while.',
      whyThisFriend: 'Alex is due for a check-in.',
      whyThisAction: 'A simple note keeps the thread warm.',
    },
    timeRelevance: {
      bestWindow: 'evening',
      validDaysOfWeek: [1, 3, 5],
    } as Opportunity['timeRelevance'] & { validDaysOfWeek?: number[] },
    copyContext: {
      suggestedTone: 'warm',
      topInterest: 'project update',
      locationHint: 'local cafe',
    } as Opportunity['copyContext'] & { suggestedTone?: string },
    createdAt: new Date('2026-03-23T10:00:00.000Z').getTime(),
    ...overrides,
  };
}

describe('buildOpportunityContextHash', () => {
  it('is stable across object key ordering differences', async () => {
    const first = createOpportunity({
      timeRelevance: {
        expiresAt: 123,
        bestWindow: 'evening',
      },
      copyContext: {
        locationHint: 'local cafe',
        topInterest: 'project update',
      },
    });
    const second = createOpportunity({
      timeRelevance: {
        bestWindow: 'evening',
        expiresAt: 123,
      },
      copyContext: {
        topInterest: 'project update',
        locationHint: 'local cafe',
      },
    });

    await expect(buildOpportunityContextHash(first)).resolves.toBe(
      await buildOpportunityContextHash(second)
    );
  });

  it('changes when a surfaced field like friend name changes', async () => {
    const baseHash = await buildOpportunityContextHash(createOpportunity());
    const renamedHash = await buildOpportunityContextHash(
      createOpportunity({ friendName: 'Alexandra' })
    );

    expect(renamedHash).not.toBe(baseHash);
  });
});
