
import { oracleService } from '../services/oracle-service.ts';
import { database } from '../../../db/index.ts';
import { InsightSignal } from '../services/types.ts';
import ProactiveInsight from '../../../db/models/ProactiveInsight.ts';
import Friend from '../../../db/models/Friend.ts';

async function verifyInferredEvents() {
    console.log('--- Verifying Inferred Life Events ---');

    const mockSignal: InsightSignal = {
        type: 'journal_signal',
        friendId: undefined, // Simulating a general or loose signal first, or we can mock a friend ID if needed. 
        // Ideally we pick a real friend ID from DB to test full flow
        data: {
            coreThemes: ['celebration', 'growth'],
            content: "Sarah got promoted today! We celebrated with champagne."
        },
        priority: 1
    };

    // Quick fetch of a friend to make it real
    const friends = await database.get<Friend>('friends').query().fetch();
    if (friends.length > 0) {
        mockSignal.friendId = friends[0].id;
        console.log(`Using friend: ${friends[0].name}`);
    } else {
        console.warn('No friends found, test might be limited');
    }

    console.log('1. Processing Signal...');
    await oracleService.processSignals([mockSignal]);

    console.log('2. checking ProactiveInsights...');
    const insights = await database.get<ProactiveInsight>('proactive_insights').query().fetch();
    const latest = insights.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    if (latest && latest.ruleId === 'signal_journal_signal') {
        console.log('✅ Insight Created!');
        console.log('Headline:', latest.headline);
        console.log('Body:', latest.body);
        console.log('Action Type:', latest.actionType); // Should be add_life_event
        console.log('Action Label:', latest.actionLabel); // Should be Add Event

        if (latest.actionType === 'add_life_event') {
            console.log('✅ Action Type Correct');
        } else {
            console.error('❌ Action Type Incorrect:', latest.actionType);
        }
    } else {
        console.error('❌ No Inferred Event Insight found.');
    }

    console.log('--- Verification Complete ---');
}

verifyInferredEvents().catch(console.error);
