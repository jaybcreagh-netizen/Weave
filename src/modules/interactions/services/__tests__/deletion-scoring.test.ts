// Mock uuid to avoid ESM issues
jest.mock('uuid', () => ({
    v4: () => 'test-uuid-' + Math.random(),
}));

// Mock the calendar service
jest.mock('../calendar.service', () => ({
    deleteWeaveCalendarEvent: jest.fn().mockResolvedValue(true),
}));

// Mock analytics
jest.mock('@/shared/services/analytics.service');

// Mock event bus but allow it to work effectively if needed, or we manually trigger callbacks
// For this integration test, we want the real side effects to happen if possible,
// but since `logWeave` emits an event and `setupIntelligenceListeners` listens to it,
// we might need to manually trigger the listener or verify the orchestrator calls.
// ACTUALLY: The scoring happens via event bus in `logWeave`.
// To make this test integration-style, we need to manually invoke the scoring logic or mock the bus to call the handler.
// Easier: Just import `processWeaveScoring` and call it manually in the test if the listener isn't wired up.
// OR: allow event bus to work. Let's start by mocking it to just run callbacks immediately?
// No, the simplest way is to manually call `processWeaveScoring` in the test to simulate the event listener
// if we can't easily wire up the full app event system in a unit test.

// Let's use a real DB with LokiJS
import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import schema from '@/db/schema';
import migrations from '@/db/migrations';
import Friend from '@/db/models/Friend';
import Interaction from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';

// Mock the database module to return our Loki-backed instance
jest.mock('@/db', () => {
    const { Database } = require('@nozbe/watermelondb');
    const LokiJSAdapter = require('@nozbe/watermelondb/adapters/lokijs').default;
    const schema = require('@/db/schema').default;
    const migrations = require('@/db/migrations').default;
    const Friend = require('@/db/models/Friend').default;
    const Interaction = require('@/db/models/Interaction').default;
    const InteractionFriend = require('@/db/models/InteractionFriend').default;

    // We need all models to avoid "Model not found" errors
    // Ideally we import them all, but for this test we might get away with the core ones if we are careful.
    // However, `logWeave` uses `interaction_friends`.

    // Quick fix: generic mock for other models not used here
    // But `database` instantiation requires all models in the project usually. 
    // Let's rely on the fact that `src/db/index.ts` exports `database` and we are replacing it.

    const adapter = new LokiJSAdapter({
        schema,
        migrations,
        useWebWorker: false,
        useIncrementalIndexedDB: false,
        dbName: 'test-db',
    });

    // We only load the models we know we need
    const database = new Database({
        adapter,
        modelClasses: [
            Friend, Interaction, InteractionFriend
            // We omit others for simplicity. If `logWeave` triggers something touching others, it might crash.
        ],
    });

    return { database };
});

import { database } from '@/db';
import { logWeave, deleteWeave } from '../weave-logging.service';
import { calculateCurrentScore, processWeaveScoring } from '@/modules/intelligence/services/orchestrator.service';
import FriendModel from '@/db/models/Friend';
import { InteractionFormData } from '../types';

describe('Interaction Deletion Scoring', () => {
    let friend: FriendModel;

    beforeEach(async () => {
        // Reset database
        await database.write(async () => {
            await database.unsafeResetDatabase();
        });

        // Create a test friend
        friend = await database.write(async () => {
            return await database.get<FriendModel>('friends').create(f => {
                f.name = 'Test Friend';
                f.weaveScore = 0;
            });
        });
    });

    it('should revert score when interaction is deleted', async () => {
        // 1. Log an interaction
        const interactionData: InteractionFormData = {
            friendIds: [friend.id],
            type: 'log',
            status: 'completed',
            mode: 'in-person', // Schema likely expects 'in-person' or 'virtual'
            date: new Date(),
            activity: 'Coffee',
            category: 'meal-drink', // Valid category from error message
            duration: 'Standard', // Valid duration from error message
            vibe: 'FullMoon',
            notes: 'Great time',
        };

        const interaction = await logWeave(interactionData);

        // MANUALLY TRIGGER SCORING
        // In the real app, `logWeave` emits 'interaction:created', and `intelligence.listener` calls `processWeaveScoring`.
        await processWeaveScoring([friend], interactionData, database);

        // Verify score increased
        const friendCheck1 = await database.get<FriendModel>('friends').find(friend.id);
        const scoreAfterLog = calculateCurrentScore(friendCheck1);
        console.log('Score after log:', scoreAfterLog);
        expect(scoreAfterLog).toBeGreaterThan(0);

        // 2. Delete the interaction
        await deleteWeave(interaction.id);

        // 3. Verify score reverted
        const friendCheck2 = await database.get<FriendModel>('friends').find(friend.id);
        const scoreAfterDelete = calculateCurrentScore(friendCheck2);
        console.log('Score after delete:', scoreAfterDelete);

        // EXPECTATION: This should fail currently
        expect(scoreAfterDelete).toBeLessThan(scoreAfterLog);
        expect(scoreAfterDelete).toBe(0);
    });
});

