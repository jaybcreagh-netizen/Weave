
import { useInteractionsStore } from '../../store/interaction.store';
import { recalculateScoreOnDelete, processWeaveScoring, recalculateScoreOnEdit } from '@/modules/intelligence/services/orchestrator.service';
import { database } from '@/db';

// 1. Setup Mocks
jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));
jest.mock('@/modules/intelligence/services/orchestrator.service', () => ({
    recalculateScoreOnEdit: jest.fn(),
    recalculateScoreOnDelete: jest.fn(),
    processWeaveScoring: jest.fn(),
}));
jest.mock('../calendar.service', () => ({ deleteWeaveCalendarEvent: jest.fn().mockResolvedValue(true) }));
jest.mock('@/shared/services/analytics.service');
jest.mock('@/shared/events/event-bus', () => ({ eventBus: { emit: jest.fn(), on: jest.fn() } }));

// 2. Setup DB Mock
jest.mock('@/db', () => {
    // Define mocks locally to avoid hoisting issues
    const mockDb = {
        get: jest.fn(),
        write: jest.fn((cb) => cb()),
        batch: jest.fn(),
        // Hidden spy accessor for test verification
        _spies: {}
    };
    return { database: mockDb };
});


describe('Edit Weave Participants', () => {
    // Re-acquire spies from the mocked module
    // We cast to any because _spies is a custom property we added
    const db = require('@/db').database;

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup specific DB behavior for this test file
        // Mock friends collection
        const mockFriends = [
            { id: 'friend-a', name: 'Friend A' },
            { id: 'friend-b', name: 'Friend B' },
            { id: 'friend-c', name: 'Friend C' }
        ];

        const mockInteraction = {
            id: 'interaction-1',
            status: 'completed',
            friendIds: ['friend-a', 'friend-b'],
            vibe: 'FullMoon',
            interactionFriends: {
                fetch: jest.fn().mockResolvedValue([
                    { friendId: 'friend-a', prepareDestroyPermanently: jest.fn() },
                    { friendId: 'friend-b', prepareDestroyPermanently: jest.fn() },
                ])
            },
            update: jest.fn(), // Interaction update method
            interactionDate: new Date(),
        };

        db.get.mockImplementation((table: string) => {
            if (table === 'friends') {
                return {
                    query: jest.fn(() => ({
                        fetch: jest.fn().mockResolvedValue(mockFriends)
                    })),
                    find: jest.fn(), // Not used yet
                };
            }
            if (table === 'interactions') {
                return {
                    find: jest.fn().mockResolvedValue(mockInteraction)
                };
            }
            if (table === 'interaction_friends') {
                return {
                    prepareCreate: jest.fn()
                };
            }
            return { query: jest.fn() };
        });
    });

    it('should call recalculateScoreOnDelete when a friend is removed', async () => {
        const store = useInteractionsStore.getState();
        // Remove A, Add C
        await store.updateInteraction('interaction-1', {
            friendIds: ['friend-b', 'friend-c']
        });

        expect(recalculateScoreOnDelete).toHaveBeenCalled();
    });

    it('should call processWeaveScoring when a friend is added', async () => {
        const store = useInteractionsStore.getState();
        // Remove A, Add C
        await store.updateInteraction('interaction-1', {
            friendIds: ['friend-b', 'friend-c']
        });

        expect(processWeaveScoring).toHaveBeenCalled();
    });

    it('should call recalculateScoreOnEdit for remaining friends', async () => {
        // Mock recalculateScoreOnEdit to verify calls
        const store = useInteractionsStore.getState();
        await store.updateInteraction('interaction-1', {
            friendIds: ['friend-b', 'friend-c'],
            vibe: 'NewMoon'
        });

        // Friend B (remaining) -> Should update
        expect(recalculateScoreOnEdit).toHaveBeenCalledWith('friend-b', expect.anything(), expect.anything(), expect.anything());
        // Friend A (removed) -> Should NOT
        expect(recalculateScoreOnEdit).not.toHaveBeenCalledWith('friend-a', expect.anything(), expect.anything(), expect.anything());
        // Friend C (added) -> Should NOT (handled by processWeaveScoring)
        expect(recalculateScoreOnEdit).not.toHaveBeenCalledWith('friend-c', expect.anything(), expect.anything(), expect.anything());
    });
});
