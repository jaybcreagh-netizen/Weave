import { narrativeService } from '../NarrativeService';
import { database } from '@/db';
import NarrativeMoment from '@/db/models/NarrativeMoment';
import FriendshipNarrative from '@/db/models/FriendshipNarrative';
import Friend from '@/db/models/Friend';

// Mock dependencies
jest.mock('@/db', () => ({
    database: {
        get: jest.fn(),
        write: jest.fn(async (cb) => await cb()),
    },
}));

jest.mock('@/modules/oracle/services/oracle-service', () => ({
    oracleService: {
        generateFriendshipNarrative: jest.fn().mockResolvedValue('Generated narrative text'),
    },
}));

describe('NarrativeService', () => {
    const mockFriendId = 'friend_123';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('recordMoment', () => {
        it('should create a new moment if unique', async () => {
            // Mock existing moments query to return empty
            const mockCollection = {
                query: jest.fn().mockReturnThis(),
                fetch: jest.fn().mockResolvedValue([]),
                create: jest.fn(),
            };
            (database.get as jest.Mock).mockReturnValue(mockCollection);

            // Mock narrative retrieval for transition check
            jest.spyOn(narrativeService, 'getNarrative').mockResolvedValue(null);
            // Mock create narrative during transition check
            const mockNarrativeCollection = {
                create: jest.fn().mockResolvedValue({ currentChapter: 'spark', friendshipStartDate: new Date() }),
                query: jest.fn().mockReturnThis(),
                fetch: jest.fn().mockResolvedValue([]),
            };
            (database.get as jest.Mock).mockImplementation((table) => {
                if (table === 'narrative_moments') return mockCollection;
                if (table === 'friendship_narratives') return mockNarrativeCollection;
                if (table === 'friends') return { find: jest.fn().mockResolvedValue({ tier: 'Community' }) };
                return mockCollection;
            });

            await narrativeService.recordMoment(mockFriendId, 'first_weave');

            expect(mockCollection.create).toHaveBeenCalled();
        });

        it('should not duplicate unique moments', async () => {
            // Mock existing moments query to return one
            const mockCollection = {
                query: jest.fn().mockReturnThis(),
                fetch: jest.fn().mockResolvedValue([{ momentType: 'first_weave' }]),
                create: jest.fn(),
            };
            (database.get as jest.Mock).mockReturnValue(mockCollection);

            await narrativeService.recordMoment(mockFriendId, 'first_weave');

            expect(mockCollection.create).not.toHaveBeenCalled();
        });
    });

    describe('evaluateChapterTransition', () => {
        it('should initialize narrative if missing', async () => {
            const mockNarrativeCollection = {
                create: jest.fn().mockResolvedValue({ currentChapter: 'spark', friendshipStartDate: new Date() }),
                query: jest.fn().mockReturnThis(),
                fetch: jest.fn().mockResolvedValue([]), // Empty for getNarrative
            };
            const mockFriendCollection = {
                find: jest.fn().mockResolvedValue({ tier: 'Community' }),
            };

            (database.get as jest.Mock).mockImplementation((table) => {
                if (table === 'friendship_narratives') return mockNarrativeCollection;
                if (table === 'friends') return mockFriendCollection;
                if (table === 'narrative_moments') return { query: jest.fn().mockReturnThis(), fetch: jest.fn().mockResolvedValue([]) };
                return {};
            });

            await narrativeService.evaluateChapterTransition(mockFriendId);

            expect(mockNarrativeCollection.create).toHaveBeenCalled();
        });
    });
});
