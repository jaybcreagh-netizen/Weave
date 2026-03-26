import { database } from '@/db';
import Friend from '@/db/models/Friend';
import UserProfile from '@/db/models/UserProfile';
import OpportunityPoolModel from '@/db/models/OpportunityPool';
import { OpportunityRefreshService } from '../OpportunityRefreshService';
import { SuggestionCandidateService } from '../../suggestion-system/SuggestionCandidateService';
import { SuggestionDataLoader } from '../../suggestion-system/SuggestionDataLoader';
import { synthesizeNativeOpportunities } from '../OpportunitySynthesisService';
import { TimingProfileService } from '../TimingProfileService';
import type { Opportunity } from '../types';

jest.mock('../../suggestion-system/SuggestionCandidateService', () => ({
  SuggestionCandidateService: {
    getCandidates: jest.fn(),
  },
}));

jest.mock('../../suggestion-system/SuggestionDataLoader', () => ({
  SuggestionDataLoader: {
    loadContextForCandidates: jest.fn(),
  },
}));

jest.mock('../OpportunitySynthesisService', () => ({
  synthesizeNativeOpportunities: jest.fn(),
}));

function createOpportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: 'opportunity-1',
    friendId: 'friend-1',
    friendName: 'Alex',
    friendTier: 'InnerCircle',
    category: 'maintain',
    generatorSource: 'maintenance-generator',
    urgency: 48,
    confidence: 0.8,
    effortLevel: 'moderate',
    estimatedDurationMinutes: 30,
    explanation: {
      whyNow: 'Check in soon.',
      whyThisFriend: 'Alex is due.',
      whyThisAction: 'A plan would help.',
    },
    timeRelevance: { bestWindow: 'evening' },
    createdAt: new Date('2026-03-23T10:00:00.000Z').getTime(),
    ...overrides,
  };
}

describe('OpportunityRefreshService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    OpportunityRefreshService.stopInvalidationSubscriptions();
    await database.write(async () => {
      await database.unsafeResetDatabase();
      await database.get<UserProfile>('user_profile').create(profile => {
        profile.updatedAt = new Date('2026-03-23T09:00:00.000Z');
      });
    });
  });

  afterEach(() => {
    OpportunityRefreshService.stopInvalidationSubscriptions();
    jest.useRealTimers();
  });

  it('refreshes the pool and updates user profile refresh metadata', async () => {
    (SuggestionCandidateService.getCandidates as jest.Mock).mockResolvedValue(['friend-1']);
    (SuggestionDataLoader.loadContextForCandidates as jest.Mock).mockResolvedValue(new Map());
    (synthesizeNativeOpportunities as jest.Mock).mockResolvedValue([createOpportunity()]);

    const count = await OpportunityRefreshService.refreshAll('test_refresh');

    const poolRows = await database.get<OpportunityPoolModel>('opportunity_pool').query().fetch();
    const profiles = await database.get<UserProfile>('user_profile').query().fetch();

    expect(count).toBe(1);
    expect(poolRows).toHaveLength(1);
    expect(poolRows[0].opportunityId).toBe('opportunity-1');
    expect(profiles[0].lastPoolRefresh).toBeDefined();
    expect(profiles[0].poolRefreshState?.lastReason).toBe('test_refresh');
    expect(profiles[0].poolRefreshState?.createdCount).toBe(1);
    expect(profiles[0].poolRefreshState?.updatedCount).toBe(0);
    expect(profiles[0].poolRefreshState?.unchangedCount).toBe(0);
  });

  it('schedules a friend-scoped refresh when a friend changes', async () => {
    jest.useFakeTimers();
    const refreshSpy = jest.spyOn(OpportunityRefreshService, 'refreshForFriends').mockResolvedValue(0);
    const unsubscribe = OpportunityRefreshService.startInvalidationSubscriptions();
    let createdFriendId = '';

    await database.write(async () => {
      const friend = await database.get<Friend>('friends').create(friend => {
        friend.name = 'Alex';
        friend.dunbarTier = 'InnerCircle';
        friend.archetype = 'Unknown';
        friend.weaveScore = 50;
        friend.lastUpdated = new Date('2026-03-23T09:00:00.000Z');
        friend.resilience = 0;
        friend.ratedWeavesCount = 0;
        friend.momentumScore = 0;
        friend.momentumLastUpdated = new Date('2026-03-23T09:00:00.000Z');
        friend.isDormant = false;
        friend.outcomeCount = 0;
        friend.initiationRatio = 0.5;
        friend.consecutiveUserInitiations = 0;
        friend.totalUserInitiations = 0;
        friend.totalFriendInitiations = 0;
      });
      createdFriendId = friend.id;
    });

    await jest.advanceTimersByTimeAsync(1600);

    expect(refreshSpy).toHaveBeenCalledWith([createdFriendId], 'friends_changed');

    unsubscribe();
    refreshSpy.mockRestore();
  });

  it('records app foreground telemetry and recomputes timing profiles when needed', async () => {
    const recordSpy = jest.spyOn(TimingProfileService, 'recordAppOpen').mockResolvedValue(undefined);
    const recomputeSpy = jest.spyOn(TimingProfileService, 'recomputeIfStale').mockResolvedValue(null);
    const timestamp = Date.UTC(2026, 2, 23, 18, 0, 0);

    await OpportunityRefreshService.recordAppForeground(timestamp);

    const profiles = await database.get<UserProfile>('user_profile').query().fetch();

    expect(profiles[0].lastAppOpen).toBe(timestamp);
    expect(recordSpy).toHaveBeenCalledWith(timestamp);
    expect(recomputeSpy).toHaveBeenCalledWith(timestamp);

    recordSpy.mockRestore();
    recomputeSpy.mockRestore();
  });
});
