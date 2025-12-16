import { Q } from '@nozbe/watermelondb';
import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import Interaction from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import { SuggestionCandidateService } from '../SuggestionCandidateService';

// Mock uuid to avoid ESM issues
jest.mock('uuid', () => ({
    v4: () => 'test-uuid-' + Math.random(),
}));

// Setup LokiJS Database Mock
import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import schema from '@/db/schema';
import migrations from '@/db/migrations';
import Friend from '@/db/models/Friend';

jest.mock('@/db', () => {
    const { Database } = require('@nozbe/watermelondb');
    const LokiJSAdapter = require('@nozbe/watermelondb/adapters/lokijs').default;
    const schema = require('@/db/schema').default;
    const migrations = require('@/db/migrations').default;
    const Friend = require('@/db/models/Friend').default;
    const Interaction = require('@/db/models/Interaction').default;
    const InteractionFriend = require('@/db/models/InteractionFriend').default;

    const adapter = new LokiJSAdapter({
        schema,
        migrations,
        useWebWorker: false,
        useIncrementalIndexedDB: false,
        dbName: 'test-db-echo',
    });

    const database = new Database({
        adapter,
        modelClasses: [
            Friend,
            Interaction,
            InteractionFriend,
            require('@/db/models/Intention').default,
            require('@/db/models/IntentionFriend').default,
            require('@/db/models/LifeEvent').default,
        ],
    });

    return { database };
});

describe('SuggestionCandidateService Echo Chamber', () => {
    beforeEach(async () => {
        await database.write(async () => {
            await database.unsafeResetDatabase();
        });
    });

    it('should reproduce echo chamber effect: active + drifting crowds out middle friends', async () => {
        const LIMIT = 50;

        // 1. Create 25 Drifting Friends (Score < 50) - Low score
        const driftingIds: string[] = [];
        await database.write(async () => {
            for (let i = 0; i < 25; i++) {
                const friend = await database.get<FriendModel>('friends').create(f => {
                    f.name = `Drifting Friend ${i}`;
                    f.weaveScore = 10;
                    f.lastUpdated = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Old
                });
                driftingIds.push(friend.id);
            }
        });

        // 2. Create 30 Active Friends (Recent Interactions) - High score
        // We create slightly more than needed to potentially fill the quota
        const activeIds: string[] = [];
        await database.write(async () => {
            for (let i = 0; i < 30; i++) {
                const friend = await database.get<FriendModel>('friends').create(f => {
                    f.name = `Active Friend ${i}`;
                    f.weaveScore = 80;
                    f.lastUpdated = new Date(); // Active means recently updated
                });
                activeIds.push(friend.id);

                // Create interaction 2 days ago
                const interaction = await database.get<Interaction>('interactions').create(int => {
                    int.interactionType = 'log';
                    int.status = 'completed';
                    int.interactionDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
                });

                await database.get<InteractionFriend>('interaction_friends').create(link => {
                    link.interactionId = interaction.id;
                    link.friendId = friend.id;
                });
            }
        });

        // 3. Create 10 "Middle" / Stale Friends (No recent interaction, Good score)
        // These are the ones we expect to be starved out
        const staleIds: string[] = [];
        await database.write(async () => {
            for (let i = 0; i < 10; i++) {
                const friend = await database.get<FriendModel>('friends').create(f => {
                    f.name = `Stale Friend ${i}`;
                    f.weaveScore = 60; // Just okay
                    f.lastUpdated = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // Very old
                });
                staleIds.push(friend.id);
                console.log(`[TEST SETUP] Created Stale ${friend.name} (${friend.id}) - LastUpdated: ${friend.lastUpdated?.toISOString()}`);
            }
        });

        // 4. Get Candidates
        const candidates = await SuggestionCandidateService.getCandidates(LIMIT);

        console.log(`Candidates count: ${candidates.length}`);

        // 5. Analyze Composition
        const foundDrifting = candidates.filter(id => driftingIds.includes(id)).length;
        const foundActive = candidates.filter(id => activeIds.includes(id)).length;
        const foundStale = candidates.filter(id => staleIds.includes(id)).length;

        console.log(`Found Drifting: ${foundDrifting}`);
        console.log(`Found Active: ${foundActive}`);
        console.log(`Found Stale: ${foundStale}`);

        // EXPECTATION (The Bug):
        // Current logic:
        // 1. Drifting: limit/2 = 25. All 25 drifting friends picked.
        // 2. Active: limit = 50. All 30 active friends might be picked (if unique).
        // Total = 25 + 30 = 55 (deduped). Set adds them. Size -> 55 (if unique).
        // Wait, if it exceeds limit?
        // Step 1: 25 drifting.
        // Step 2: 30 active. Total 55 unique IDs. 
        // Step 3: Stale. Only runs if size < 50.

        // Actually, Step 1 is limited to 25.
        // Step 2 is limited to 50.
        // So we get 25 drifting + up to 50 active.
        // If we have 25 drifting and 25 active, we hit 50.
        // Stale never gets a chance.

        // Assertion failing confirms the bug
        expect(foundStale).toBeGreaterThan(0);
        // ideally we want at least some reserved slots
        expect(foundStale).toBeGreaterThanOrEqual(5);
    });
});
