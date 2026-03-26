jest.mock('uuid', () => ({
  v4: () => `test-uuid-${Math.random()}`,
}));

import { database } from '@/db';
import UserProfile from '@/db/models/UserProfile';
import OpportunityPoolModel from '@/db/models/OpportunityPool';
import SurfacingLogModel from '@/db/models/SurfacingLog';
import { OpportunityPoolService } from '../OpportunityPoolService';
import { SuggestionPacingService } from '../SuggestionPacingService';
import type { Opportunity } from '../types';

function createOpportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: 'opportunity-1',
    friendId: 'friend-1',
    friendName: 'Alex',
    friendTier: 'InnerCircle',
    category: 'maintain',
    generatorSource: 'maintenance-generator',
    urgency: 50,
    confidence: 0.8,
    effortLevel: 'moderate',
    estimatedDurationMinutes: 30,
    momentumScore: 18,
    explanation: {
      whyNow: 'It has been a while.',
      whyThisFriend: 'Alex is due for a check-in.',
      whyThisAction: 'A plan keeps things warm.',
    },
    timeRelevance: {
      bestWindow: 'evening',
    },
    createdAt: new Date('2026-03-25T09:00:00.000Z').getTime(),
    ...overrides,
  };
}

describe('SuggestionPacingService', () => {
  beforeEach(async () => {
    await database.write(async () => {
      await database.unsafeResetDatabase();
    });
  });

  async function createProfile(
    overrides: {
      currentSocialSeason?: 'resting' | 'balanced' | 'blooming';
      suggestionFrequency?: 'quiet' | 'balanced' | 'proactive';
      socialBatteryCurrent?: number;
    } = {}
  ) {
    await database.write(async () => {
      await database.get<UserProfile>('user_profile').create(profile => {
        profile.currentSocialSeason = overrides.currentSocialSeason || 'balanced';
        profile.suggestionFrequency = overrides.suggestionFrequency || 'balanced';
        profile.socialBatteryCurrent = overrides.socialBatteryCurrent ?? 3;
      });
    });
  }

  async function createPoolRowId() {
    await OpportunityPoolService.upsertRefreshedFriendSet(
      ['friend-1'],
      [createOpportunity()]
    );
    const [poolRow] = await database.get<OpportunityPoolModel>('opportunity_pool').query().fetch();
    return poolRow.id;
  }

  it('derives a daily budget from season, frequency, and battery', async () => {
    await createProfile({
      currentSocialSeason: 'blooming',
      suggestionFrequency: 'proactive',
      socialBatteryCurrent: 5,
    });

    const pacing = await SuggestionPacingService.getAutomaticPacing({
      now: new Date('2026-03-25T12:00:00.000Z').getTime(),
    });

    expect(pacing.dailyFreshBudget).toBe(3);
    expect(pacing.budgetRemaining).toBe(3);
    expect(pacing.allowAutoSuggestions).toBe(true);
    expect(pacing.quietReason).toBeUndefined();
  });

  it('stays quiet after a very recent handled suggestion even when the selector could refill', async () => {
    const now = new Date('2026-03-25T12:00:00.000Z').getTime();

    await createProfile({
      currentSocialSeason: 'balanced',
      suggestionFrequency: 'proactive',
      socialBatteryCurrent: 4,
    });

    await OpportunityPoolService.upsertRefreshedFriendSet(
      ['friend-1'],
      [createOpportunity()]
    );
    const [poolRow] = await database.get<OpportunityPoolModel>('opportunity_pool').query().fetch();
    const surfacingCollection = database.get<SurfacingLogModel>('surfacing_log');

    await database.write(async () => {
      await surfacingCollection.create(log => {
        log.opportunityPoolId = poolRow.id;
        log.eventType = 'surfaced';
        log.timestamp = now - (30 * 60 * 1000);
        log.window = 'morning';
        log.surfaceSource = 'selector';
        log.surfaceSlot = 'primary';
        log.selectionReason = 'selected';
      });

      await surfacingCollection.create(log => {
        log.opportunityPoolId = poolRow.id;
        log.eventType = 'acted';
        log.timestamp = now - (15 * 60 * 1000);
        log.window = 'morning';
      });
    });

    const pacing = await SuggestionPacingService.getAutomaticPacing({ now });

    expect(pacing.dailyFreshBudget).toBe(2);
    expect(pacing.surfacedPrimaryToday).toBe(1);
    expect(pacing.actedToday).toBe(1);
    expect(pacing.allowAutoSuggestions).toBe(false);
    expect(pacing.quietReason).toBe('recently_handled');
  });

  it('drops automatic suggestions to zero when battery is very low in a resting season', async () => {
    await createProfile({
      currentSocialSeason: 'resting',
      suggestionFrequency: 'balanced',
      socialBatteryCurrent: 1,
    });

    const pacing = await SuggestionPacingService.getAutomaticPacing({
      now: new Date('2026-03-25T12:00:00.000Z').getTime(),
    });

    expect(pacing.dailyFreshBudget).toBe(0);
    expect(pacing.allowAutoSuggestions).toBe(false);
    expect(pacing.quietReason).toBe('low_battery_pause');
    expect(pacing.allowManualMore).toBe(false);
  });

  it('reduces the fresh daily budget after repeated automatic budget-exhausted quiet states', async () => {
    const now = new Date('2026-03-25T12:00:00.000Z').getTime();

    await createProfile({
      currentSocialSeason: 'balanced',
      suggestionFrequency: 'proactive',
      socialBatteryCurrent: 4,
    });

    const surfacingCollection = database.get<SurfacingLogModel>('surfacing_log');
    await database.write(async () => {
      for (let index = 0; index < 3; index += 1) {
        await surfacingCollection.create(log => {
          log.opportunityPoolId = 'system:selector';
          log.eventType = 'quiet';
          log.timestamp = now - ((index + 1) * 24 * 60 * 60 * 1000);
          log.surfaceSource = 'selector';
          log.selectionReason = 'empty';
          log.surfaceRequestKind = 'automatic';
          log.quietReason = 'budget_exhausted';
        });
      }
    });

    const pacing = await SuggestionPacingService.getAutomaticPacing({ now });

    expect(pacing.dailyFreshBudget).toBe(1);
    expect(pacing.budgetRemaining).toBe(1);
    expect(pacing.adaptiveBudgetAdjustment).toBe(-1);
    expect(pacing.adaptiveReasons).toContain('frequent_budget_exhausted');
  });

  it('does not reduce the fresh daily budget when the user frequently manual-pulls more suggestions', async () => {
    const now = new Date('2026-03-25T12:00:00.000Z').getTime();

    await createProfile({
      currentSocialSeason: 'balanced',
      suggestionFrequency: 'proactive',
      socialBatteryCurrent: 4,
    });

    const poolRowId = await createPoolRowId();
    const surfacingCollection = database.get<SurfacingLogModel>('surfacing_log');
    await database.write(async () => {
      for (let index = 0; index < 3; index += 1) {
        await surfacingCollection.create(log => {
          log.opportunityPoolId = 'system:selector';
          log.eventType = 'quiet';
          log.timestamp = now - ((index + 1) * 24 * 60 * 60 * 1000);
          log.surfaceSource = 'selector';
          log.selectionReason = 'empty';
          log.surfaceRequestKind = 'automatic';
          log.quietReason = 'budget_exhausted';
        });
      }

      for (let index = 0; index < 2; index += 1) {
        await surfacingCollection.create(log => {
          log.opportunityPoolId = poolRowId;
          log.eventType = 'surfaced';
          log.timestamp = now - ((index + 1) * 6 * 60 * 60 * 1000);
          log.surfaceSource = 'selector';
          log.surfaceSlot = 'primary';
          log.selectionReason = 'selected';
          log.surfaceRequestKind = 'manual_pull';
        });
      }
    });

    const pacing = await SuggestionPacingService.getAutomaticPacing({ now });

    expect(pacing.dailyFreshBudget).toBe(2);
    expect(pacing.adaptiveBudgetAdjustment).toBe(0);
    expect(pacing.adaptiveReasons).not.toContain('frequent_budget_exhausted');
  });

  it('extends replacement delay after repeated recently-handled quiet states', async () => {
    const now = new Date('2026-03-25T12:00:00.000Z').getTime();

    await createProfile({
      currentSocialSeason: 'balanced',
      suggestionFrequency: 'balanced',
      socialBatteryCurrent: 4,
    });

    const poolRowId = await createPoolRowId();
    const surfacingCollection = database.get<SurfacingLogModel>('surfacing_log');
    await database.write(async () => {
      for (let index = 0; index < 3; index += 1) {
        await surfacingCollection.create(log => {
          log.opportunityPoolId = 'system:selector';
          log.eventType = 'quiet';
          log.timestamp = now - ((index + 1) * 24 * 60 * 60 * 1000);
          log.surfaceSource = 'selector';
          log.selectionReason = 'empty';
          log.surfaceRequestKind = 'automatic';
          log.quietReason = 'recently_handled';
        });
      }

      await surfacingCollection.create(log => {
        log.opportunityPoolId = poolRowId;
        log.eventType = 'acted';
        log.timestamp = now - (5 * 60 * 60 * 1000);
        log.window = 'morning';
      });
    });

    const pacing = await SuggestionPacingService.getAutomaticPacing({ now });

    expect(pacing.replacementDelayMinutes).toBe(6 * 60);
    expect(pacing.adaptiveReplacementDelayMinutes).toBe(2 * 60);
    expect(pacing.allowAutoSuggestions).toBe(false);
    expect(pacing.quietReason).toBe('recently_handled');
    expect(pacing.adaptiveReasons).toContain('frequent_recently_handled');
  });
});
