
// Mock uuid to avoid ESM issues
jest.mock('uuid', () => ({
    v4: () => 'test-uuid-' + Math.random(),
}));

import { calculateWeeklySummary } from '../weekly-stats.service';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';

// Mock dependencies
jest.mock('@/db', () => ({
    database: {
        get: jest.fn(),
        write: jest.fn(),
    },
}));
// Mock archetype actions to avoid importing from there if not needed, or let it run
jest.mock('../archetype-actions.service', () => ({
    getRandomActionForArchetype: jest.fn().mockReturnValue('Call them'),
    getArchetypeValue: jest.fn().mockReturnValue('Connection'),
}));

describe('Weekly Stats Service', () => {
    describe('calculateWeeklySummary', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('should calculate basic stats correctly', async () => {
            // Mock Data
            const mockInteractions = [
                { id: 'i1', interactionDate: Date.now(), status: 'completed', interactionCategory: 'catchup' },
                { id: 'i2', interactionDate: Date.now(), status: 'completed', interactionCategory: 'catchup' },
            ];
            const mockLinks = [
                { interactionId: 'i1', friendId: 'f1' },
                { interactionId: 'i2', friendId: 'f2' },
            ];

            // Mock DB calls sequence
            // 1. Fetch interactions (current week)
            const interactionCollection = {
                query: jest.fn().mockReturnThis(),
                fetch: jest.fn().mockResolvedValue(mockInteractions),
            };

            // 2. Fetch friend links
            const linkCollection = {
                query: jest.fn().mockReturnThis(),
                fetch: jest.fn().mockResolvedValue(mockLinks),
            };

            // 3. Fetch allImportantFriends (for missed friends check)
            const friendCollection = {
                query: jest.fn().mockReturnThis(),
                fetch: jest.fn().mockResolvedValue([]), // No missed friends for simplicity
            };

            // 4. Fetch intentions
            const intentionCollection = {
                query: jest.fn().mockReturnThis(),
                fetch: jest.fn().mockResolvedValue([]),
            };

            (database.get as jest.Mock).mockImplementation((table) => {
                if (table === 'interactions') return interactionCollection;
                if (table === 'interaction_friends') return linkCollection;
                if (table === 'friends') return friendCollection;
                if (table === 'intentions') return intentionCollection;
                return { query: jest.fn().mockReturnThis(), fetch: jest.fn().mockResolvedValue([]) };
            });

            const summary = await calculateWeeklySummary();

            expect(summary.totalWeaves).toBe(2);
            expect(summary.friendsContacted).toBe(2); // f1 and f2
            expect(summary.topActivity).toBe('catchup'); // Or formatted version if formatActivityName transforms it
            expect(summary.topActivityCount).toBe(2);
        });

        it('should identify missed friends', async () => {
            // Mock NO interactions this week
            const interactionCollection = {
                query: jest.fn().mockReturnThis(),
                fetch: jest.fn().mockResolvedValue([]),
            };
            const linkCollection = {
                query: jest.fn().mockReturnThis(),
                fetch: jest.fn().mockResolvedValue([]),
            };

            // Mock an important friend who is low score
            const mockMissedFriend = {
                id: 'missed1',
                name: 'Missed Guy',
                dunbarTier: 'InnerCircle',
                isDormant: false,
                weaveScore: 40, // < 60
                archetype: 'The Sun'
            };

            const friendCollection = {
                query: jest.fn().mockReturnThis(),
                fetch: jest.fn().mockResolvedValue([mockMissedFriend]),
            };

            // Intentions
            const intentionCollection = {
                query: jest.fn().mockReturnThis(),
                fetch: jest.fn().mockResolvedValue([]),
            };

            (database.get as jest.Mock).mockImplementation((table) => {
                if (table === 'interactions') return interactionCollection;
                if (table === 'interaction_friends') return linkCollection;
                if (table === 'friends') return friendCollection;
                if (table === 'intentions') return intentionCollection;
                return { query: jest.fn().mockReturnThis(), fetch: jest.fn().mockResolvedValue([]) };
            });

            const summary = await calculateWeeklySummary();

            expect(summary.missedFriends).toHaveLength(1);
            expect(summary.missedFriends[0].friend.id).toBe('missed1');
        });
    });
});
