
// Mock uuid to avoid ESM issues
jest.mock('uuid', () => ({
    v4: () => 'test-uuid-' + Math.random(),
}));

import { getRecentMeaningfulWeaves } from '../journal-context-engine';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';

// Mock dependencies
jest.mock('@/db', () => ({
    database: {
        get: jest.fn(),
        write: jest.fn(),
    },
}));

describe('Journal Context Engine', () => {
    describe('getRecentMeaningfulWeaves', () => {
        it('should return interactions with high meaningfulness scores', async () => {
            const mockInteraction = {
                id: 'i1',
                interactionDate: Date.now() - 1000,
                status: 'completed',
                note: 'This aligns with meaningfulness threshold because it is long enough.', // > 20 chars
                vibe: 'FullMoon', // +25 points
                interactionCategory: 'deep-talk', // +20 points
                duration: 'Extended', // +15 points
            };

            const mockFriend = { id: 'f1', name: 'Alice' };

            // Mock database calls
            // 1. Fetch interactions
            const interactionCollection = {
                query: jest.fn().mockReturnThis(),
                fetch: jest.fn().mockResolvedValue([mockInteraction]),
            };

            // 2. Fetch joins (interaction_friends)
            const joinCollection = {
                query: jest.fn().mockReturnThis(),
                fetch: jest.fn().mockResolvedValue([{ interactionId: 'i1', friendId: 'f1' }]),
            };

            // 3. Fetch friends
            const friendCollection = {
                query: jest.fn().mockReturnThis(),
                fetch: jest.fn().mockResolvedValue([mockFriend]),
            };

            (database.get as jest.Mock).mockImplementation((table) => {
                if (table === 'interactions') return interactionCollection;
                if (table === 'interaction_friends') return joinCollection;
                if (table === 'friends') return friendCollection;
                return { query: jest.fn().mockReturnThis(), fetch: jest.fn().mockResolvedValue([]) };
            });

            const meaningfulWeaves = await getRecentMeaningfulWeaves();

            expect(meaningfulWeaves).toHaveLength(1);
            expect(meaningfulWeaves[0].interaction.id).toBe('i1');
            expect(meaningfulWeaves[0].meaningfulnessScore).toBeGreaterThan(30);
            expect(meaningfulWeaves[0].friends[0].name).toBe('Alice');
        });

        it('should filter out interactions with low scores', async () => {
            const mockLowScoreInteraction = {
                id: 'i2',
                interactionDate: Date.now() - 1000,
                status: 'completed',
                note: 'Short',
                vibe: 'Neutral',
                interactionCategory: 'quick-chat',
                duration: 'Short',
            };

            // Mock database calls
            const interactionCollection = {
                query: jest.fn().mockReturnThis(),
                fetch: jest.fn().mockResolvedValue([mockLowScoreInteraction]),
            };
            const joinCollection = {
                query: jest.fn().mockReturnThis(),
                fetch: jest.fn().mockResolvedValue([]),
            };
            const friendCollection = {
                query: jest.fn().mockReturnThis(),
                fetch: jest.fn().mockResolvedValue([]),
            };


            (database.get as jest.Mock).mockImplementation((table) => {
                if (table === 'interactions') return interactionCollection;
                if (table === 'interaction_friends') return joinCollection;
                if (table === 'friends') return friendCollection;
                return { query: jest.fn().mockReturnThis(), fetch: jest.fn().mockResolvedValue([]) };
            });

            const meaningfulWeaves = await getRecentMeaningfulWeaves();
            expect(meaningfulWeaves).toHaveLength(0);
        });
    });
});
