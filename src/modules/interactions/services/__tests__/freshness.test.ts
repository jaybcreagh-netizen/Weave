
// Mock uuid to avoid ESM issues
jest.mock('uuid', () => ({
    v4: () => 'test-uuid-' + Math.random(),
}));

// Mock services that might cause side effects
jest.mock('@/shared/services/analytics.service');

// Mock SeasonAnalyticsService
jest.mock('@/modules/intelligence', () => ({
    calculateCurrentScore: jest.fn((friend) => friend.weaveScore || 0),
    filterSuggestionsBySeason: jest.fn((suggestions) => suggestions),
    getSeasonSuggestionConfig: jest.fn(() => ({ maxDaily: 10 })), // Allow enough to see variety
    SeasonAnalyticsService: {
        trackSuggestionsShown: jest.fn().mockResolvedValue(undefined),
    },
}));

// Mock Generators
jest.mock('../suggestion-engine/generators/MomentumGenerator', () => ({
    MomentumGenerator: jest.fn().mockImplementation(() => ({
        generate: jest.fn().mockResolvedValue({
            id: 'momentum-mock',
            friendId: 'mock-friend',
            urgency: 'medium',
            category: 'deepen',
            title: 'Keep it up',
            action: { type: 'plan' }
        }),
        name: 'MomentumGenerator',
        priority: 30
    }))
}));
jest.mock('../suggestion-engine/generators/ReciprocityGenerator', () => ({ ReciprocityGenerator: jest.fn().mockImplementation(() => ({ generate: jest.fn(), name: 'Reciprocity' })) }));
jest.mock('../suggestion-engine/generators/DriftGenerator', () => ({ DriftGenerator: jest.fn().mockImplementation(() => ({ generate: jest.fn(), name: 'Drift' })) }));
jest.mock('../suggestion-engine/generators/MaintenanceGenerator', () => ({ MaintenanceGenerator: jest.fn().mockImplementation(() => ({ generate: jest.fn(), name: 'Maintenance' })) }));

// Mock Time Aware Filter
jest.mock('@/shared/utils/time-aware-filter', () => ({
    filterSuggestionsByTime: jest.fn((suggestions) => suggestions),
}));

// Mock SuggestionStorageService
jest.mock('../suggestion-storage.service', () => ({
    getDismissedSuggestions: jest.fn().mockResolvedValue(new Map()),
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
        dbName: 'test-db-freshness',
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
import * as GuaranteedService from '../guaranteed-suggestions.service';

describe('Suggestion Engine Freshness Tests', () => {
    beforeEach(async () => {
        await database.write(async () => {
            await database.unsafeResetDatabase();
        });
        jest.clearAllMocks();
    });

    it('should include guaranteed suggestions (wildcards) even when plenty of momentum suggestions exist', async () => {
        // 1. Spy on generateGuaranteedSuggestions
        const guaranteedSpy = jest.spyOn(GuaranteedService, 'generateGuaranteedSuggestions');

        // Mock it to return a distinct wildcard suggestion
        guaranteedSpy.mockReturnValue([{
            id: 'wildcard-test',
            friendId: 'some-id',
            friendName: 'Wildcard Friend',
            urgency: 'low',
            category: 'wildcard',
            title: 'Test Wildcard',
            subtitle: 'This should appear!',
            actionLabel: 'Test',
            icon: 'Sparkles',
            action: { type: 'plan' },
            dismissible: true,
            createdAt: new Date(),
            type: 'connect'
        }]);

        // 2. Create 5 "Momentum" candidates (Healthy score, recent interaction)
        // This ensures the "finalPool" is full (> 3) before hitting the guaranteed block logic
        await database.write(async () => {
            for (let i = 0; i < 5; i++) {
                const friend = await database.get<FriendModel>('friends').create(f => {
                    f.name = `Momentum Friend ${i}`;
                    f.dunbarTier = 'InnerCircle';
                    f.weaveScore = 75; // Healthy
                    f.momentumScore = 50; // High momentum
                    f.archetype = 'Sun';
                    // @ts-ignore
                    f.lastInteractionDate = new Date();
                });

                // No need for interactions since we mocked the generator!
            }
        });

        // 3. Fetch suggestions (requesting 5)
        const suggestions = await fetchSuggestions(5);

        // 4. Verify results
        // PRE-FIX EXPECTATION: guaranteedSpy is NOT called, 'wildcard-test' is MISSING.
        // POST-FIX EXPECTATION: guaranteedSpy IS called, 'wildcard-test' is PRESENT.

        const hasWildcard = suggestions.some(s => s.id === 'wildcard-test');


        expect(guaranteedSpy).toHaveBeenCalled();
        expect(hasWildcard).toBe(true);
    });
});
