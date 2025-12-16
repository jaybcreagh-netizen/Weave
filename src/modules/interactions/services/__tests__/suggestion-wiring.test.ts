// Mock uuid to avoid ESM issues
jest.mock('uuid', () => ({
    v4: () => 'test-uuid-' + Math.random(),
}));

// Mock services
jest.mock('@/shared/services/analytics.service');
jest.mock('@/modules/intelligence', () => ({
    calculateCurrentScore: jest.fn((friend) => friend.weaveScore || 0),
    // Simulate the REAL filterSuggestionsBySeason logic to catch the category mismatch bug
    filterSuggestionsBySeason: jest.fn((suggestions: any[]) => {
        // "Balanced" season allowed categories (from season-suggestions.service.ts)
        const allowed = [
            'critical-drift', 'high-drift', 'life-event', 'first-weave',
            'intention-reminder', 'archetype-mismatch', 'momentum', 'maintain',
            'deepen', 'reflect', 'celebrate', 'daily-reflect', 'gentle-nudge',
            'wildcard', 'community-checkin', 'variety', 'set-intention'
        ];
        return suggestions.filter(s => allowed.includes(s.category));
    }),
    getSeasonSuggestionConfig: jest.fn(() => ({ maxDaily: 10 })),
    SeasonAnalyticsService: {
        trackSuggestionsShown: jest.fn().mockResolvedValue(undefined),
    },
}));

jest.mock('@/modules/intelligence/services/orchestrator.service', () => ({
    calculateCurrentScore: jest.fn((friend) => friend.weaveScore || 0),
}));

jest.mock('../suggestion-storage.service', () => ({
    getDismissedSuggestions: jest.fn().mockResolvedValue(new Map()),
}));

jest.mock('../guaranteed-suggestions.service', () => ({
    generateGuaranteedSuggestions: jest.fn().mockReturnValue([{
        id: 'guaranteed-wildcard',
        friendId: 'wildcard-friend',
        friendName: 'Wildcard Friend',
        urgency: 'low',
        category: 'wildcard',
        title: 'Wildcard Suggestion',
        subtitle: 'Should show at night',
        actionLabel: 'View',
        icon: 'Sparkles',
        action: { type: 'connect' },
        dismissible: true,
        createdAt: new Date(),
        type: 'connect'
    }]),
}));

// Setup LokiJS Database Mock
import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import schema from '@/db/schema';
import migrations from '@/db/migrations';
import Friend from '@/db/models/Friend';
import Interaction from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';

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
        dbName: 'test-db-wiring',
    });

    const database = new Database({
        adapter,
        modelClasses: [
            Friend,
            Interaction,
            InteractionFriend,
            require('@/db/models/Intention').default,
            require('@/db/models/LifeEvent').default,
        ],
    });

    return { database };
});

import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import { fetchSuggestions } from '../suggestion-provider.service';

describe('Suggestion Wiring & Time Filtering', () => {
    beforeEach(async () => {
        await database.write(async () => {
            await database.unsafeResetDatabase();
        });
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should show High Drift suggestions during the DAY (14:00)', async () => {
        // Set time to 14:00 (2 PM)
        const date = new Date('2024-01-01T14:00:00');
        jest.setSystemTime(date);

        // Create a friend with High Drift (InnerCircle, score 40)
        // High Drift Logic: InnerCircle && < 50
        await database.write(async () => {
            await database.get<FriendModel>('friends').create(f => {
                f.name = 'Drifting Day Friend';
                f.dunbarTier = 'InnerCircle';
                f.weaveScore = 40;
                f.archetype = 'Emperor';
            });
        });

        const suggestions = await fetchSuggestions(5);
        const drift = suggestions.find(s => s.category === 'high-drift' && s.friendName === 'Drifting Day Friend');

        expect(drift).toBeDefined();
        expect(drift?.urgency).toBe('high');
    });

    it('should show High Drift suggestions during the DAY (14:00) with Season Filter', async () => {
        // Set time to 14:00
        const date = new Date('2024-01-01T14:00:00');
        jest.setSystemTime(date);

        // Create a friend with High Drift
        await database.write(async () => {
            await database.get<FriendModel>('friends').create(f => {
                f.name = 'Drifting Day Friend';
                f.dunbarTier = 'InnerCircle';
                f.weaveScore = 40;
                f.archetype = 'Emperor';
            });
        });

        const suggestions = await fetchSuggestions(5);
        const drift = suggestions.find(s => s.category === 'high-drift');

        // IF THE BUG EXISTS, THIS WILL FAIL (it will be undefined)
        if (!drift) {
            console.log('BUG CONFIRMED: High Drift filtered out by season logic because category "drift" is not in allowed list');
        }

        expect(drift).toBeDefined(); // This expectation should fail if the bug is real
    });

    it('should SHOW High Drift suggestions during NIGHT (23:00)', async () => {
        // Set time to 23:00 (11 PM) - "Night" mode
        const date = new Date('2024-01-01T23:00:00');
        jest.setSystemTime(date);

        // Create a friend with High Drift
        await database.write(async () => {
            await database.get<FriendModel>('friends').create(f => {
                f.name = 'Drifting Night Friend';
                f.dunbarTier = 'InnerCircle';
                f.weaveScore = 40;
                f.archetype = 'Emperor';
            });
        });

        const suggestions = await fetchSuggestions(5);
        const drift = suggestions.find(s => s.category === 'high-drift');

        // Logic Check: 
        // We relaxed night filtering per user feedback.
        // It SHOULD be defined now.

        expect(drift).toBeDefined();
    });

    it('should SHOW Critical Drift suggestions even at NIGHT', async () => {
        // Set time to 23:00
        const date = new Date('2024-01-01T23:00:00');
        jest.setSystemTime(date);

        // Create a friend with Critical Drift (InnerCircle, score 10)
        await database.write(async () => {
            await database.get<FriendModel>('friends').create(f => {
                f.name = 'Critical Night Friend';
                f.dunbarTier = 'InnerCircle';
                f.weaveScore = 10;
                f.archetype = 'Emperor';
            });
        });

        const suggestions = await fetchSuggestions(5);
        const drift = suggestions.find(s => s.category === 'critical-drift' && s.friendName === 'Critical Night Friend');

        expect(drift).toBeDefined();
        expect(drift?.urgency).toBe('critical');
    });

    it('should SHOW Guaranteed suggestions (Wildcards) at NIGHT', async () => {
        // Set time to 23:00
        const date = new Date('2024-01-01T23:00:00');
        jest.setSystemTime(date);

        // Create a friend so guaranteed logic triggers
        await database.write(async () => {
            await database.get<FriendModel>('friends').create(f => {
                f.name = 'Any Friend';
                f.dunbarTier = 'Community';
                f.weaveScore = 50;
                f.archetype = 'Magician';
            });
        });

        const suggestions = await fetchSuggestions(5);
        const wildcard = suggestions.find(s => s.id === 'guaranteed-wildcard');

        expect(wildcard).toBeDefined();
        expect(wildcard?.title).toBe('Wildcard Suggestion');
    });
});
