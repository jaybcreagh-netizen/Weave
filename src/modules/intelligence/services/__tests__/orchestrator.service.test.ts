import FriendModel from '@/db/models/Friend';
import { calculateWeaveScoring } from '../orchestrator.service';

function buildMockDatabase() {
  return {
    get: jest.fn().mockReturnValue({
      query: jest.fn().mockReturnValue({
        fetch: jest.fn().mockResolvedValue([]),
      }),
    }),
  } as any;
}

describe('orchestrator.service - season-aware gap handling', () => {
  it('applies backfill penalty using provided gap days and season', async () => {
    const friend = {
      id: 'friend-1',
      name: 'Alex',
      weaveScore: 60,
      dunbarTier: 'CloseFriends',
      archetype: 'Unknown',
      lastUpdated: new Date('2026-02-04T00:00:00.000Z'),
      momentumScore: 0,
      momentumLastUpdated: new Date('2026-02-04T00:00:00.000Z'),
      outcomeCount: 0,
      resilience: 1,
      ratedWeavesCount: 0,
    } as FriendModel;

    const interactionData = {
      category: 'meal-drink',
      activity: 'Coffee',
      duration: 'Standard',
      vibe: 'WaxingCrescent',
      notes: 'Backfilled interaction',
      date: new Date('2026-01-25T00:00:00.000Z'), // 10-day backfill gap
    } as any;

    const database = buildMockDatabase();

    const balancedResult = await calculateWeaveScoring([friend], interactionData, database, 'balanced');
    const restingResult = await calculateWeaveScoring([friend], interactionData, database, 'resting');

    const balancedUpdate = balancedResult.updates.get(friend.id);
    const restingUpdate = restingResult.updates.get(friend.id);

    expect(balancedUpdate).toBeDefined();
    expect(restingUpdate).toBeDefined();

    // Resting season should impose a smaller decay penalty, leaving more effective points.
    expect(restingUpdate.pointsEarned).toBeGreaterThan(balancedUpdate.pointsEarned);

    // Gap penalty should actually apply (not accidentally skipped by "days since now" behavior).
    expect(balancedUpdate.pointsEarned).toBeLessThan(balancedResult.scoreUpdates[0].pointsEarned);
  });
});
