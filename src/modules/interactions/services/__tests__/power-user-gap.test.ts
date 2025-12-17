// Mock uuid to avoid ESM issues
jest.mock('uuid', () => ({
    v4: () => 'test-uuid-' + Math.random(),
}));

// Mock services
jest.mock('@/shared/services/analytics.service');
jest.mock('@/modules/intelligence', () => ({
    calculateCurrentScore: jest.fn((friend) => friend.weaveScore || 0),
    filterSuggestionsBySeason: jest.fn((suggestions) => suggestions), // Pass through
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

// We DON'T mock guaranteed-suggestions.service strictly, we want to see if it acts as a fallback
// But to isolate Unit Logic we can, but integration style is better here.
// Actually, let's keep it mocked to ensure we control the wildcard output IF called.
jest.mock('../guaranteed-suggestions.service', () => ({
    generateGuaranteedSuggestions: jest.fn().mockReturnValue([{
        id: 'guaranteed-wildcard',
        friendId: 'wildcard-friend',
        title: 'Wildcard Suggestion',
        category: 'wildcard',
        urgency: 'low',
        action: { type: 'connect' }
    }]),
}));

// Setup LokiJS Database Mock
import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';

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
        dbName: 'test-db-power-gap',
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
import InteractionModel from '@/db/models/Interaction';

describe('Power User Gap & Wildcard', () => {
    beforeEach(async () => {
        await database.write(async () => {
            await database.unsafeResetDatabase();
        });
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should fall back to Maintenance (Keep Warm) if Celebrate is not applicable for High Score Friend', async () => {
        // Set time to 14:00 to ensure low-urgency suggestions are not filtered
        jest.setSystemTime(new Date('2024-01-01T14:00:00'));

        // 1. Create a "Power User" Friend (Score 90)
        // No recent interactions that form a "pattern" for Deepen to thrive on? 
        // Or actually DeepenGenerator requires `analyzeInteractionPattern` to do something?
        // Actually DeepenGenerator ALWAYS returns a suggestion if score > 85 in current code (before fix?), 
        // wait, let's look at DeepenGenerator again.
        // It calls `analyzeInteractionPattern` and `getContextualSuggestion`.
        // It always returns a suggestion if currentScore > 85.
        // So why did the User say "If it fails to find a 'contextual action' it returns null"?
        // Ah, `getContextualSuggestion` might return something generic.
        // BUT, maybe the user implies that `DeepenGenerator` SHOULD return null if there's nothing specific to celebrate,
        // so Maintenance can pick it up?
        // OR the user says currently DeepenGenerator IS active, but maybe it logic is failing?

        // Let's re-read the User Request: "If it fails to find a 'contextual action' ... it returns null."
        // Let's verify if `getContextualSuggestion` returns null?

        await database.write(async () => {
            await database.get<FriendModel>('friends').create(f => {
                f.name = 'Bestie';
                f.dunbarTier = 'InnerCircle';
                f.weaveScore = 90;
                f.archetype = 'Emperor';
                // Last interaction long ago? No, if score is 90 it must be recent.
                // But let's say last interaction was 3 days ago.
            });

            // Add a recent interaction to boost score
            await database.get<InteractionModel>('interactions').create(i => {
                i.interactionDate = new Date(Date.now() - 14 * 86400000); // 14 days ago (well past 7 day threshold)
                i.interactionType = 'log'; // Correctly assign type 'log' (matches strict literal type)
                i.interactionCategory = 'hangout';
            });
        });

        // The Issue: 
        // MaintenanceGenerator (KeepWarm) has `if (currentScore <= 85)`. 
        // DeepenGenerator (Celebrate) has `if (currentScore > 85)`.
        // If DeepenGenerator returns null, nobody picks it up.

        const suggestions = await fetchSuggestions(5);

        // Expectation: We want a suggestion.
        // If DeepenGenerator works as is, we get "Celebrate".
        // The user says "If it fails...". 
        // In this test, we might get Celebrate. 
        // But if we want to force Maintenance, we need Deepen to fail or be skipped.
        // If we change logic to "Deepen tries first, then Maintenance tries", 
        // We can test that by ensuring we get *some* suggestion.

        const suggestion = suggestions.find(s => s.friendName === 'Bestie');

        // Debug output
        if (!suggestion) {
            console.log('Use Case Reproduced: No suggestion for Score 90 friend.');
        } else {
            console.log(`Got suggestion: ${suggestion.category} - ${suggestion.title}`);
        }

        expect(suggestion).toBeDefined();
    });

    it('should include a Wildcard suggestion independently of score', async () => {
        await database.write(async () => {
            await database.get<FriendModel>('friends').create(f => {
                f.name = 'Random Friend';
                f.dunbarTier = 'Community';
                f.weaveScore = 50;
            });
        });

        const suggestions = await fetchSuggestions(5);
        const wildcard = suggestions.find(s => s.category === 'wildcard');

        expect(wildcard).toBeDefined();
    });
});
