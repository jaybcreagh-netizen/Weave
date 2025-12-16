
// Mock uuid to avoid ESM issues
jest.mock('uuid', () => ({
    v4: () => 'test-uuid-' + Math.random(),
}));

// Mock the calendar service
jest.mock('@/modules/interactions/services/calendar.service', () => ({
    deleteWeaveCalendarEvent: jest.fn().mockResolvedValue(true),
}));

// Mock analytics
jest.mock('@/shared/services/analytics.service');

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

    const adapter = new LokiJSAdapter({
        schema,
        migrations,
        useWebWorker: false,
        useIncrementalIndexedDB: false,
        dbName: 'test-db-edge-cases',
    });

    const database = new Database({
        adapter,
        modelClasses: [
            Friend, Interaction, InteractionFriend
        ],
    });

    return { database };
});

import { database } from '@/db';
import { WeaveLoggingService } from '@/modules/interactions';
const { logWeave, deleteWeave } = WeaveLoggingService;
import { calculateCurrentScore, processWeaveScoring } from '@/modules/intelligence/services/orchestrator.service';
import FriendModel from '@/db/models/Friend';
import { InteractionFormData } from '@/modules/interactions/types';
import { addDays, subDays } from 'date-fns';

describe('Scoring Edge Cases', () => {
    let friend: FriendModel;
    const baseInteractionData: InteractionFormData = {
        friendIds: [],
        type: 'log',
        status: 'completed',
        mode: 'in-person',
        activity: 'Coffee',
        category: 'meal-drink',
        duration: 'Standard',
        vibe: 'FullMoon',
        notes: 'Test',
        date: new Date(),
    };

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

        // Update friendIds in base data
        baseInteractionData.friendIds = [friend.id];
    });

    // EDGE CASE 1: Momentum state corrupting deletion logic
    // If I delete an OLD interaction while Valid Momentum exists from a NEWER interaction,
    // The system currently calculates the "points to remove" using the CURRENT momentum state.
    // This erroneously subtracts a bonus from the friend that the OLD interaction likely never earned.
    it('should correctly handle momentum when deleting past interactions', async () => {
        // 1. Log Interaction A (Day 1) - Establishes Baseline. No Bonus.
        // Score should be Base (e.g. 15 * multipliers)
        const dateA = subDays(new Date(), 2);
        const dataA = { ...baseInteractionData, date: dateA, notes: 'A' };
        const interactionA = await logWeave(dataA);
        await processWeaveScoring([friend], dataA, database);

        let friendState = await database.get<FriendModel>('friends').find(friend.id);
        const scoreAfterA = friendState.weaveScore;
        console.log('Score After A:', scoreAfterA);

        // 2. Log Interaction B (Day 2) - Should get Momentum Bonus.
        // Score should increase by (Base * 1.15)
        const dateB = subDays(new Date(), 1);
        const dataB = { ...baseInteractionData, date: dateB, notes: 'B' };
        const interactionB = await logWeave(dataB);
        await processWeaveScoring([friend], dataB, database);

        friendState = await database.get<FriendModel>('friends').find(friend.id);
        const scoreAfterB = friendState.weaveScore;
        const pointsFromB = scoreAfterB - scoreAfterA; // Approximation (ignoring decay)
        console.log('Score After B:', scoreAfterB);
        console.log('Points from B:', pointsFromB);

        // 3. Delete Interaction A (Day 1)
        // We expect to remove roughly 'scoreAfterA'.
        // HOWEVER, if the bug exists, it will calculate points for A using CURRENT momentum (from B).
        // It will try to remove (Base * 1.15).
        // Result: Score will drop lower than pointsFromB.
        await deleteWeave(interactionA.id);

        friendState = await database.get<FriendModel>('friends').find(friend.id);
        const finalScore = friendState.weaveScore;
        console.log('Final Score:', finalScore);

        // Use a heuristic check. Logic implies:
        // Final Score should be roughly equal to pointsFromB (minus some decay perhaps).
        // If Final Score is significantly lower than pointsFromB, we subtracted too much.

        // Precise check:
        // If A added X points.
        // And B added Y points (where Y > X due to bonus).
        // Removing A should leave us with Y (roughly).
        // If we remove Y points (because we think A gets bonus now), we are left with 0.

        expect(finalScore).toBeGreaterThan(pointsFromB * 0.9); // Allow small margin for decay
    });

    // EDGE CASE 2: Future Date Lock
    // Logging an interaction in the future should NOT freeze the account for present-day interactions.
    it('should prevent future dates from locking scoring functionality', async () => {
        // 1. Log Interaction in Future (Year 2030)
        const futureDate = addDays(new Date(), 365 * 5);
        const dataFuture = { ...baseInteractionData, date: futureDate, notes: 'Future' };
        await logWeave(dataFuture);
        await processWeaveScoring([friend], dataFuture, database);

        let friendState = await database.get<FriendModel>('friends').find(friend.id);
        console.log('Last Updated (Future):', friendState.lastUpdated);
        // FIX: The system should CLAMP the date to now, so it should NOT be in the future.
        expect(friendState.lastUpdated.getTime()).toBeLessThan(futureDate.getTime());
        expect(friendState.lastUpdated.getTime()).toBeGreaterThan(new Date().getTime() - 10000); // Should be roughly now

        // 2. Log Interaction Today
        // Since lastUpdated is in 2030, this looks like a "past" interaction (backfill).
        // It will be heavily penalized for the "gap" between 2030 and Today.
        const todayData = { ...baseInteractionData, date: new Date(), notes: 'Today' };
        await logWeave(todayData);
        await processWeaveScoring([friend], todayData, database);

        friendState = await database.get<FriendModel>('friends').find(friend.id);
        const finalScore = friendState.weaveScore;
        console.log('Final Score (with Future lock):', finalScore);

        // If bug exists, score will be tiny or unchanged because of massive decay penalty from "backfilling" 5 years.
        // A normal interaction gives ~15-20 points.
        expect(finalScore).toBeGreaterThan(10);
    });
});
