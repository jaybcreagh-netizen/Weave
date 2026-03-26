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

jest.mock('@/modules/intelligence/services/social-season/season-analytics.service', () => ({
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

jest.mock('../opportunity-system/OpportunityPoolService', () => ({
    OpportunityPoolService: {
        getActiveOpportunities: jest.fn().mockResolvedValue([]),
        recordOpportunityEventByIds: jest.fn().mockResolvedValue(undefined),
    },
}));

jest.mock('../opportunity-system/SelectorTuningService', () => ({
    SelectorTuningService: {
        getSelectorOptions: jest.fn().mockResolvedValue(undefined),
        clearCache: jest.fn(),
    },
}));

jest.mock('../opportunity-system/SelectorExperimentService', () => ({
    SelectorExperimentService: {
        getConfig: jest.fn().mockResolvedValue({
            thresholdVariant: 'control',
            copyVariant: 'control',
            updatedAt: 0,
        }),
    },
    applySelectorExperimentToOptions: jest.fn((options) => options),
}));

jest.mock('../opportunity-system/OpportunityPremiumCopyService', () => ({
    OpportunityPremiumCopyService: {
        enhanceSuggestions: jest.fn(async (inputs: Array<{ suggestion: any }>) => (
            inputs.map(entry => ({
                ...entry.suggestion,
                title: `[Premium] ${entry.suggestion.title}`,
            }))
        )),
    },
}));

jest.mock('../opportunity-system/SuggestionPacingService', () => ({
    SuggestionPacingService: {
        getAutomaticPacing: jest.fn().mockResolvedValue({
            season: 'balanced',
            suggestionFrequency: 'balanced',
            dailyFreshBudget: 1,
            budgetRemaining: 1,
            replacementDelayMinutes: 240,
            surfacedPrimaryToday: 0,
            actedToday: 0,
            allowAutoSuggestions: true,
            allowManualMore: true,
        }),
    },
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
    const SuggestionEvent = require('@/db/models/SuggestionEvent').default;

    const adapter = new LokiJSAdapter({
        schema,
        migrations,
        useWebWorker: false,
        useIncrementalIndexedDB: false,
        dbName: 'test-db-wiring',
        extraLokiOptions: {
            autosave: false,
        },
    });

    const database = new Database({
        adapter,
        modelClasses: [
            Friend,
            Interaction,
            InteractionFriend,
            SuggestionEvent,
            require('@/db/models/Intention').default,
            require('@/db/models/LifeEvent').default,
        ],
    });

    return { database };
});

import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import { fetchSuggestionSurface, fetchSuggestions } from '../suggestion-provider.service';

describe('Suggestion Wiring & Time Filtering', () => {
    const originalFocusSelectorFlag = process.env.EXPO_PUBLIC_FOCUS_SELECTOR_ENABLED;
    const originalShadowFlag = process.env.EXPO_PUBLIC_OPPORTUNITY_SYSTEM_SHADOW_MODE;
    const originalOpportunityPoolFlag = process.env.EXPO_PUBLIC_OPPORTUNITY_POOL_ENABLED;

    beforeEach(async () => {
        await database.write(async () => {
            await database.unsafeResetDatabase();
        });
        jest.useFakeTimers();
        delete process.env.EXPO_PUBLIC_FOCUS_SELECTOR_ENABLED;
        delete process.env.EXPO_PUBLIC_OPPORTUNITY_SYSTEM_SHADOW_MODE;
        delete process.env.EXPO_PUBLIC_OPPORTUNITY_POOL_ENABLED;
        const { SelectorTuningService } = require('../opportunity-system/SelectorTuningService');
        (SelectorTuningService.getSelectorOptions as jest.Mock).mockResolvedValue(undefined);
        const { SelectorExperimentService } = require('../opportunity-system/SelectorExperimentService');
        (SelectorExperimentService.getConfig as jest.Mock).mockResolvedValue({
            thresholdVariant: 'control',
            copyVariant: 'control',
            updatedAt: 0,
        });
        const { SuggestionPacingService } = require('../opportunity-system/SuggestionPacingService');
        (SuggestionPacingService.getAutomaticPacing as jest.Mock).mockResolvedValue({
            season: 'balanced',
            suggestionFrequency: 'balanced',
            dailyFreshBudget: 1,
            budgetRemaining: 1,
            replacementDelayMinutes: 240,
            surfacedPrimaryToday: 0,
            actedToday: 0,
            allowAutoSuggestions: true,
            allowManualMore: true,
        });
    });

    afterEach(() => {
        jest.useRealTimers();
        if (originalFocusSelectorFlag === undefined) {
            delete process.env.EXPO_PUBLIC_FOCUS_SELECTOR_ENABLED;
        } else {
            process.env.EXPO_PUBLIC_FOCUS_SELECTOR_ENABLED = originalFocusSelectorFlag;
        }
        if (originalShadowFlag === undefined) {
            delete process.env.EXPO_PUBLIC_OPPORTUNITY_SYSTEM_SHADOW_MODE;
        } else {
            process.env.EXPO_PUBLIC_OPPORTUNITY_SYSTEM_SHADOW_MODE = originalShadowFlag;
        }
        if (originalOpportunityPoolFlag === undefined) {
            delete process.env.EXPO_PUBLIC_OPPORTUNITY_POOL_ENABLED;
        } else {
            process.env.EXPO_PUBLIC_OPPORTUNITY_POOL_ENABLED = originalOpportunityPoolFlag;
        }
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

    it('should return selector-backed primary and secondary suggestions when focus selector is enabled', async () => {
        process.env.EXPO_PUBLIC_FOCUS_SELECTOR_ENABLED = 'true';

        const date = new Date('2024-01-01T14:00:00');
        jest.setSystemTime(date);

        await database.write(async () => {
            await database.get<FriendModel>('friends').create(f => {
                f.name = 'Critical Friend';
                f.dunbarTier = 'InnerCircle';
                f.weaveScore = 10;
                f.archetype = 'Emperor';
            });
            await database.get<FriendModel>('friends').create(f => {
                f.name = 'Drifting Friend';
                f.dunbarTier = 'InnerCircle';
                f.weaveScore = 40;
                f.archetype = 'Magician';
            });
            await database.get<FriendModel>('friends').create(f => {
                f.name = 'Community Friend';
                f.dunbarTier = 'Community';
                f.weaveScore = 55;
                f.archetype = 'Sun';
            });
        });

        const suggestions = await fetchSuggestions(5);

        expect(suggestions.length).toBeLessThanOrEqual(2);
        expect(suggestions.some(s => s.category === 'critical-drift')).toBe(true);
    });

    it('should expose selector metadata in shadow mode without changing the returned list', async () => {
        process.env.EXPO_PUBLIC_OPPORTUNITY_SYSTEM_SHADOW_MODE = 'true';

        const date = new Date('2024-01-01T14:00:00');
        jest.setSystemTime(date);

        await database.write(async () => {
            await database.get<FriendModel>('friends').create(f => {
                f.name = 'Critical Friend';
                f.dunbarTier = 'InnerCircle';
                f.weaveScore = 10;
                f.archetype = 'Emperor';
            });
            await database.get<FriendModel>('friends').create(f => {
                f.name = 'Drifting Friend';
                f.dunbarTier = 'InnerCircle';
                f.weaveScore = 40;
                f.archetype = 'Magician';
            });
            await database.get<FriendModel>('friends').create(f => {
                f.name = 'Community Friend';
                f.dunbarTier = 'Community';
                f.weaveScore = 55;
                f.archetype = 'Sun';
            });
        });

        const result = await fetchSuggestionSurface(5);

        expect(result.surfaceSource).toBe('legacy-list');
        expect(result.suggestions.length).toBeGreaterThan(2);
        expect(result.selectorSuggestions.length).toBeLessThanOrEqual(2);
        expect(result.selectionReason).toBe('selected');
    });

    it('should expose selector metadata when focus selector is enabled', async () => {
        process.env.EXPO_PUBLIC_FOCUS_SELECTOR_ENABLED = 'true';

        const date = new Date('2024-01-01T14:00:00');
        jest.setSystemTime(date);

        await database.write(async () => {
            await database.get<FriendModel>('friends').create(f => {
                f.name = 'Critical Friend';
                f.dunbarTier = 'InnerCircle';
                f.weaveScore = 10;
                f.archetype = 'Emperor';
            });
            await database.get<FriendModel>('friends').create(f => {
                f.name = 'Drifting Friend';
                f.dunbarTier = 'InnerCircle';
                f.weaveScore = 40;
                f.archetype = 'Magician';
            });
        });

        const result = await fetchSuggestionSurface(5);

        expect(result.surfaceSource).toBe('selector');
        expect(result.selectorSuggestions.map(s => s.id)).toEqual(result.suggestions.map(s => s.id));
        expect(result.suggestions.length).toBeLessThanOrEqual(2);
    });

    it('should apply premium selector copy when the premium copy experiment is active', async () => {
        process.env.EXPO_PUBLIC_FOCUS_SELECTOR_ENABLED = 'true';

        const { SelectorExperimentService } = require('../opportunity-system/SelectorExperimentService');
        const { OpportunityPremiumCopyService } = require('../opportunity-system/OpportunityPremiumCopyService');
        (SelectorExperimentService.getConfig as jest.Mock).mockResolvedValue({
            thresholdVariant: 'control',
            copyVariant: 'premium',
            updatedAt: 0,
        });

        const date = new Date('2024-01-01T14:00:00');
        jest.setSystemTime(date);

        await database.write(async () => {
            await database.get<FriendModel>('friends').create(f => {
                f.name = 'Drifting Friend';
                f.dunbarTier = 'InnerCircle';
                f.weaveScore = 40;
                f.archetype = 'Emperor';
            });
        });

        const result = await fetchSuggestionSurface(5);

        expect(OpportunityPremiumCopyService.enhanceSuggestions).toHaveBeenCalled();
        expect(result.suggestions[0]?.title.startsWith('[Premium]')).toBe(true);
    });

    it('should consult the persisted opportunity pool when selector mode and pool mode are enabled', async () => {
        process.env.EXPO_PUBLIC_FOCUS_SELECTOR_ENABLED = 'true';
        process.env.EXPO_PUBLIC_OPPORTUNITY_POOL_ENABLED = 'true';

        const { OpportunityPoolService } = require('../opportunity-system/OpportunityPoolService');
        (OpportunityPoolService.getActiveOpportunities as jest.Mock).mockResolvedValue([]);

        const date = new Date('2024-01-01T14:00:00');
        jest.setSystemTime(date);

        await database.write(async () => {
            await database.get<FriendModel>('friends').create(f => {
                f.name = 'Drifting Friend';
                f.dunbarTier = 'InnerCircle';
                f.weaveScore = 40;
                f.archetype = 'Emperor';
            });
        });

        await fetchSuggestionSurface(5);

        expect(OpportunityPoolService.getActiveOpportunities).toHaveBeenCalled();
    });

    it('should surface a pool-only selector opportunity when the pool provides a better candidate', async () => {
        process.env.EXPO_PUBLIC_FOCUS_SELECTOR_ENABLED = 'true';
        process.env.EXPO_PUBLIC_OPPORTUNITY_POOL_ENABLED = 'true';

        const { OpportunityPoolService } = require('../opportunity-system/OpportunityPoolService');
        const date = new Date('2024-01-01T14:00:00');
        jest.setSystemTime(date);
        let friendId = '';

        await database.write(async () => {
            const friend = await database.get<FriendModel>('friends').create(f => {
                f.name = 'Critical Friend';
                f.dunbarTier = 'InnerCircle';
                f.weaveScore = 10;
                f.archetype = 'Emperor';
            });
            friendId = friend.id;
        });

        (OpportunityPoolService.getActiveOpportunities as jest.Mock).mockResolvedValue([
            {
                id: 'pool-only-1',
                friendId,
                friendName: 'Critical Friend',
                friendTier: 'InnerCircle',
                category: 'critical-drift',
                generatorSource: 'opportunity-pool',
                urgency: 96,
                confidence: 0.95,
                effortLevel: 'minimal',
                estimatedDurationMinutes: 10,
                explanation: {
                    whyNow: 'Persisted urgency says this needs immediate attention.',
                    whyThisFriend: 'Critical Friend is drifting quickly.',
                    whyThisAction: 'A lightweight reach-out is the best next move.',
                },
                timeRelevance: {
                    bestWindow: 'midday',
                },
                createdAt: new Date('2024-01-01T14:00:00').getTime(),
            },
        ]);

        const result = await fetchSuggestionSurface(5);

        expect(result.surfaceSource).toBe('selector');
        expect(result.suggestions[0]?.id).toBe('pool-only-1');
        expect(result.suggestions[0]?.type).toBe('reconnect');
    });

    it('should bypass the legacy generator loop when selector and pool mode are enabled', async () => {
        process.env.EXPO_PUBLIC_FOCUS_SELECTOR_ENABLED = 'true';
        process.env.EXPO_PUBLIC_OPPORTUNITY_POOL_ENABLED = 'true';

        const { OpportunityPoolService } = require('../opportunity-system/OpportunityPoolService');
        (OpportunityPoolService.getActiveOpportunities as jest.Mock).mockResolvedValue([]);

        const suggestionEngine = require('../suggestion-engine');
        const generateSuggestionSpy = jest.spyOn(suggestionEngine, 'generateSuggestion');

        const date = new Date('2024-01-01T14:00:00');
        jest.setSystemTime(date);

        await database.write(async () => {
            await database.get<FriendModel>('friends').create(f => {
                f.name = 'Drifting Friend';
                f.dunbarTier = 'InnerCircle';
                f.weaveScore = 40;
                f.archetype = 'Emperor';
            });
        });

        const result = await fetchSuggestionSurface(5);

        expect(result.surfaceSource).toBe('selector');
        expect(result.suggestions.length).toBeGreaterThan(0);
        expect(generateSuggestionSpy).not.toHaveBeenCalled();

        generateSuggestionSpy.mockRestore();
    });

    it('should allow an empty selector result without guaranteed fallback when focus selector is enabled', async () => {
        process.env.EXPO_PUBLIC_FOCUS_SELECTOR_ENABLED = 'true';

        const date = new Date('2024-01-01T14:00:00');
        jest.setSystemTime(date);

        const result = await fetchSuggestionSurface(5);

        expect(result.surfaceSource).toBe('selector');
        expect(result.selectionReason).toBe('empty');
        expect(result.selectorSuggestions).toEqual([]);
        expect(result.suggestions).toEqual([]);
    });

    it('should stay quiet instead of auto-refilling when pacing blocks another automatic suggestion', async () => {
        process.env.EXPO_PUBLIC_FOCUS_SELECTOR_ENABLED = 'true';

        const { SuggestionPacingService } = require('../opportunity-system/SuggestionPacingService');
        (SuggestionPacingService.getAutomaticPacing as jest.Mock).mockResolvedValue({
            season: 'balanced',
            suggestionFrequency: 'balanced',
            dailyFreshBudget: 1,
            budgetRemaining: 0,
            replacementDelayMinutes: 240,
            surfacedPrimaryToday: 1,
            actedToday: 1,
            allowAutoSuggestions: false,
            allowManualMore: true,
            quietReason: 'recently_handled',
        });

        const date = new Date('2024-01-01T14:00:00');
        jest.setSystemTime(date);

        await database.write(async () => {
            await database.get<FriendModel>('friends').create(f => {
                f.name = 'Drifting Friend';
                f.dunbarTier = 'InnerCircle';
                f.weaveScore = 40;
                f.archetype = 'Emperor';
            });
        });

        const result = await fetchSuggestionSurface(5);

        expect(result.surfaceSource).toBe('selector');
        expect(result.selectionReason).toBe('empty');
        expect(result.quietReason).toBe('recently_handled');
        expect(result.suggestions).toEqual([]);
    });

    it('should allow a manual pull to bypass the automatic pacing pause', async () => {
        process.env.EXPO_PUBLIC_FOCUS_SELECTOR_ENABLED = 'true';

        const { SuggestionPacingService } = require('../opportunity-system/SuggestionPacingService');
        (SuggestionPacingService.getAutomaticPacing as jest.Mock).mockResolvedValue({
            season: 'balanced',
            suggestionFrequency: 'balanced',
            dailyFreshBudget: 1,
            budgetRemaining: 0,
            replacementDelayMinutes: 240,
            surfacedPrimaryToday: 1,
            actedToday: 1,
            allowAutoSuggestions: false,
            allowManualMore: true,
            quietReason: 'recently_handled',
        });

        const date = new Date('2024-01-01T14:00:00');
        jest.setSystemTime(date);

        await database.write(async () => {
            await database.get<FriendModel>('friends').create(f => {
                f.name = 'Drifting Friend';
                f.dunbarTier = 'InnerCircle';
                f.weaveScore = 40;
                f.archetype = 'Emperor';
            });
        });

        const result = await fetchSuggestionSurface(5, undefined, undefined, {
            manualPull: true,
        });

        expect(result.surfaceSource).toBe('selector');
        expect(result.selectionReason).toBe('selected');
        expect(result.quietReason).toBe('recently_handled');
        expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should not track shown analytics on fetch by default', async () => {
        const { SeasonAnalyticsService } = require('@/modules/intelligence/services/social-season/season-analytics.service');
        (SeasonAnalyticsService.trackSuggestionsShown as jest.Mock).mockClear();

        const date = new Date('2024-01-01T14:00:00');
        jest.setSystemTime(date);

        await database.write(async () => {
            await database.get<FriendModel>('friends').create(f => {
                f.name = 'Critical Friend';
                f.dunbarTier = 'InnerCircle';
                f.weaveScore = 10;
                f.archetype = 'Emperor';
            });
        });

        const result = await fetchSuggestionSurface(5);

        expect(result.suggestions.length).toBeGreaterThan(0);
        expect(SeasonAnalyticsService.trackSuggestionsShown).not.toHaveBeenCalled();
    });

    it('should allow callers to force selector mode without tracking surfaced analytics', async () => {
        const { SeasonAnalyticsService } = require('@/modules/intelligence/services/social-season/season-analytics.service');
        (SeasonAnalyticsService.trackSuggestionsShown as jest.Mock).mockClear();

        const date = new Date('2024-01-01T14:00:00');
        jest.setSystemTime(date);

        await database.write(async () => {
            await database.get<FriendModel>('friends').create(f => {
                f.name = 'Critical Friend';
                f.dunbarTier = 'InnerCircle';
                f.weaveScore = 10;
                f.archetype = 'Emperor';
            });
            await database.get<FriendModel>('friends').create(f => {
                f.name = 'Drifting Friend';
                f.dunbarTier = 'InnerCircle';
                f.weaveScore = 40;
                f.archetype = 'Magician';
            });
        });

        const result = await fetchSuggestionSurface(5, undefined, undefined, {
            forceSelector: true,
            trackAnalytics: false,
        });

        expect(result.surfaceSource).toBe('selector');
        expect(result.suggestions.length).toBeLessThanOrEqual(2);
        expect(SeasonAnalyticsService.trackSuggestionsShown).not.toHaveBeenCalled();
    });

    it('should bypass coarse time filtering when selector mode is enabled', async () => {
        process.env.EXPO_PUBLIC_FOCUS_SELECTOR_ENABLED = 'true';

        const timeAwareFilter = require('@/shared/utils/time-aware-filter');
        const filterSpy = jest.spyOn(timeAwareFilter, 'filterSuggestionsByTime').mockReturnValue([]);

        const date = new Date('2024-01-01T20:00:00');
        jest.setSystemTime(date);

        await database.write(async () => {
            await database.get<FriendModel>('friends').create(f => {
                f.name = 'Evening Drift Friend';
                f.dunbarTier = 'InnerCircle';
                f.weaveScore = 40;
                f.archetype = 'Emperor';
            });
        });

        const result = await fetchSuggestionSurface(5);

        expect(filterSpy).toHaveBeenCalled();
        expect(result.surfaceSource).toBe('selector');
        expect(result.suggestions.some(suggestion => suggestion.category === 'high-drift')).toBe(true);

        filterSpy.mockRestore();
    });

    it('should only track shown analytics when explicitly requested', async () => {
        const { SeasonAnalyticsService } = require('@/modules/intelligence/services/social-season/season-analytics.service');
        (SeasonAnalyticsService.trackSuggestionsShown as jest.Mock).mockClear();

        const date = new Date('2024-01-01T14:00:00');
        jest.setSystemTime(date);

        await database.write(async () => {
            await database.get<FriendModel>('friends').create(f => {
                f.name = 'Critical Friend';
                f.dunbarTier = 'InnerCircle';
                f.weaveScore = 10;
                f.archetype = 'Emperor';
            });
        });

        const result = await fetchSuggestionSurface(5, undefined, undefined, {
            trackAnalytics: true,
        });

        expect(result.suggestions.length).toBeGreaterThan(0);
        expect(SeasonAnalyticsService.trackSuggestionsShown).toHaveBeenCalledWith(
            result.suggestions.length
        );
    });

    it('should apply selector tuning overrides when they are available', async () => {
        process.env.EXPO_PUBLIC_FOCUS_SELECTOR_ENABLED = 'true';

        const { SelectorTuningService } = require('../opportunity-system/SelectorTuningService');
        (SelectorTuningService.getSelectorOptions as jest.Mock).mockResolvedValue({
            selectionConfig: {
                minThreshold: 999,
                secondaryRatio: 0.6,
            },
        });

        const date = new Date('2024-01-01T14:00:00');
        jest.setSystemTime(date);

        await database.write(async () => {
            await database.get<FriendModel>('friends').create(f => {
                f.name = 'Critical Friend';
                f.dunbarTier = 'InnerCircle';
                f.weaveScore = 10;
                f.archetype = 'Emperor';
            });
        });

        const result = await fetchSuggestionSurface(5);

        expect(SelectorTuningService.getSelectorOptions).toHaveBeenCalled();
        expect(result.surfaceSource).toBe('selector');
        expect(result.selectionReason).toBe('below_threshold');
        expect(result.suggestions).toEqual([]);
    });
});
