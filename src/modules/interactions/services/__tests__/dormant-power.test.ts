// Mock uuid to avoid ESM issues
jest.mock('uuid', () => ({
    v4: () => 'test-uuid-' + Math.random(),
}));

// Mock services that might cause side effects
jest.mock('@/shared/services/analytics.service');

// Mock competing generators to ensure we test Optimization logic in isolation
jest.mock('../suggestion-engine/generators/ReflectionGenerator', () => ({
    ReflectionGenerator: jest.fn().mockImplementation(() => ({
        generate: jest.fn().mockResolvedValue(null),
        name: 'ReflectionGenerator'
    }))
}));
jest.mock('../suggestion-engine/generators/DeepenGenerator', () => ({
    DeepenGenerator: jest.fn().mockImplementation(() => ({
        generate: jest.fn().mockResolvedValue(null),
        name: 'DeepenGenerator'
    }))
}));
// Mock SeasonAnalyticsService via the intelligence module or its direct path if found
jest.mock('@/modules/intelligence', () => ({
    calculateCurrentScore: jest.fn((friend) => friend.weaveScore || 0),
    filterSuggestionsBySeason: jest.fn((suggestions) => suggestions),
    getSeasonSuggestionConfig: jest.fn(() => ({ maxDaily: 3 })),
    SeasonAnalyticsService: {
        trackSuggestionsShown: jest.fn().mockResolvedValue(undefined),
    },
}));

// Also mock orchestrator directly in case it's imported from there
jest.mock('@/modules/intelligence/services/orchestrator.service', () => ({
    calculateCurrentScore: jest.fn((friend) => friend.weaveScore || 0),
}));

// Mock SuggestionStorageService
jest.mock('../suggestion-storage.service', () => ({
    getDismissedSuggestions: jest.fn().mockResolvedValue(new Map()),
}));

// Mock guaranteed suggestions to avoid noise
jest.mock('../guaranteed-suggestions.service', () => ({
    generateGuaranteedSuggestions: jest.fn().mockReturnValue([]),
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
        dbName: 'test-db',
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

describe('Suggestion Engine Integrated Tests', () => {
    beforeEach(async () => {
        await database.write(async () => {
            await database.unsafeResetDatabase();
            // Double check clear
            const existing = await database.get<FriendModel>('friends').query().fetch();
            if (existing.length > 0) {
                console.error('[TEST SETUP] UnsafeReset failed, manually destroying ' + existing.length + ' friends');
                for (const f of existing) {
                    await f.destroyPermanently();
                }
            }
        });
    });

    describe('Dormant User Strategy', () => {
        it('should triage critical drifts when user is overwhelmed (>5 criticals)', async () => {
            // 1. Create 6 Inner Circle friends with low scores (Critical Drift)
            await database.write(async () => {
                for (let i = 0; i < 6; i++) {
                    await database.get<FriendModel>('friends').create(f => {
                        f.name = `Drifting Friend ${i}`;
                        f.dunbarTier = 'InnerCircle';
                        f.weaveScore = 10; // Critical Drift (< 30)
                        f.archetype = 'Magician';
                    });
                }
            });

            // 2. Fetch suggestions
            const suggestions = await fetchSuggestions(20);

            // 3. Verify Triage Logic
            const triageInfo = suggestions.find(s => s.id === 'dormant-triage-info');
            expect(triageInfo).toBeDefined();

            const criticalDrifts = suggestions.filter(s => s.urgency === 'critical' && s.category === 'drift');
            // Expected: 3 displayed (sliced from 6)
            // If this fails, show IDs
            if (criticalDrifts.length !== 3) {
                console.error('FAILED DRIFTS:', criticalDrifts.map(s => `${s.id} (${s.friendName})`));
            }
            expect(criticalDrifts.length).toBe(3);
        });

        it('should NOT triage if critical drifts are few (<5)', async () => {
            // 1. Create 3 Inner Circle friends with low scores
            await database.write(async () => {
                for (let i = 0; i < 3; i++) {
                    await database.get<FriendModel>('friends').create(f => {
                        f.name = `Drifting Friend ${i}`;
                        f.dunbarTier = 'InnerCircle';
                        f.weaveScore = 10;
                        f.archetype = 'Magician';
                    });
                }
            });

            // 2. Fetch suggestions
            const suggestions = await fetchSuggestions(20);

            // 3. Verify normal behavior
            // Should NOT have triage info
            const triageInfo = suggestions.find(s => s.id === 'dormant-triage-info');
            expect(triageInfo).toBeUndefined();

            // Should have 3 actual drifts
            const criticalDrifts = suggestions.filter(s => s.urgency === 'critical' && s.category === 'drift');
            expect(criticalDrifts.length).toBe(3);
        });
    });

    describe('Power User Strategy', () => {
        it('should suggest Optimization/Novelty for high score friend', async () => {
            // 1. Create a high score friend
            const friend = await database.write(async () => {
                return await database.get<FriendModel>('friends').create(f => {
                    f.name = 'Power Friend';
                    f.dunbarTier = 'InnerCircle';
                    f.weaveScore = 95; // High score
                    f.archetype = 'Emperor';
                    // @ts-ignore
                    f.lastInteractionDate = new Date(); // Update field directly
                });
            });

            // ADD RECENT INTERACTION to satisfy MaintenanceGenerator (so it doesn't block)
            await database.write(async () => {
                await database.get<Interaction>('interactions').create(i => {
                    i.interactionType = 'log'; // Required field
                    i.status = 'completed';
                    i.interactionDate = new Date(); // TODAY
                    i.interactionCategory = 'text-call';
                    i.duration = 'Standard';
                }).then(async interaction => {
                    // Link it
                    await database.get<InteractionFriend>('interaction_friends').create(link => {
                        link.interactionId = interaction.id;
                        link.friendId = friend.id;
                    });
                });
            });

            // 2. Fetch suggestions
            const suggestions = await fetchSuggestions(5);

            // 3. Verify Optimization suggestion
            // Look for category 'variety' or id starting with 'optimization-novelty'
            const optimizationSuggestion = suggestions.find(s => s.id.startsWith('optimization-novelty'));

            try {
                expect(optimizationSuggestion).toBeDefined();
                expect(optimizationSuggestion?.category).toBe('variety');
                expect(optimizationSuggestion?.subtitle).toContain('switch it up');
            } catch (e) {
                console.error('FAILED POWER USER SUGGESTIONS:', suggestions.map(s => `${s.id} (${s.category})`));
                throw e;
            }
        });
    });
});

