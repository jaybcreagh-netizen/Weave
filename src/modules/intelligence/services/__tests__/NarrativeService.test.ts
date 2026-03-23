import { narrativeService } from '../NarrativeService';
import { database } from '@/db';
import NarrativeMoment from '@/db/models/NarrativeMoment';
import FriendshipNarrative from '@/db/models/FriendshipNarrative';
import Friend from '@/db/models/Friend';
import { intelligenceCapabilitiesService } from '../intelligence-capabilities.service';
import { oracleService } from '@/modules/oracle/services/oracle-service';

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

jest.mock('../intelligence-capabilities.service', () => ({
    intelligenceCapabilitiesService: {
        getCapabilitiesForCurrentProfile: jest.fn(),
    },
}));

describe('NarrativeService', () => {
    const mockFriendId = 'friend_123';

    beforeEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
        (intelligenceCapabilitiesService.getCapabilitiesForCurrentProfile as jest.Mock).mockResolvedValue({
            oracleChatEnabled: true,
        });
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

    describe('ensureNarrative', () => {
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

            await narrativeService.ensureNarrative(mockFriendId);

            expect(mockNarrativeCollection.create).toHaveBeenCalled();
        });
    });

    describe('generateNarrativeText', () => {
        it('should fall back to a local narrative when Oracle is disabled', async () => {
            const update = jest.fn();
            const narrativeRecord = { currentChapter: 'default', update };
            const friendshipNarrativesCollection = {
                query: jest.fn().mockReturnThis(),
                fetch: jest.fn().mockResolvedValue([narrativeRecord]),
                create: jest.fn().mockResolvedValue(narrativeRecord),
            };

            (database.get as jest.Mock).mockImplementation((table) => {
                if (table === 'friendship_narratives') {
                    return friendshipNarrativesCollection;
                }

                if (table === 'friends') {
                    return {
                        find: jest.fn().mockResolvedValue({
                            id: mockFriendId,
                            name: 'Alice',
                            tier: 'InnerCircle',
                            archetype: 'Sun',
                            createdAt: new Date('2023-01-01'),
                        }),
                    };
                }

                if (table === 'narrative_moments') {
                    return {
                        query: jest.fn().mockReturnThis(),
                        fetch: jest.fn().mockResolvedValue([{ momentType: 'first_weave' }]),
                    };
                }

                if (table === 'interaction_friends') {
                    return {
                        query: jest.fn().mockReturnThis(),
                        fetch: jest.fn().mockResolvedValue([
                            { interactionId: 'i1' },
                            { interactionId: 'i2' },
                        ]),
                    };
                }

                if (table === 'interactions') {
                    return {
                        query: jest.fn().mockReturnThis(),
                        fetch: jest.fn().mockResolvedValue([
                            {
                                activity: 'coffee',
                                vibe: 'warm',
                                duration: '60',
                                interactionDate: new Date('2026-03-20'),
                            },
                            {
                                activity: 'walk',
                                vibe: 'easy',
                                duration: '45',
                                interactionDate: new Date('2026-03-10'),
                            },
                        ]),
                    };
                }

                if (table === 'journal_entries') {
                    return {
                        query: jest.fn().mockReturnThis(),
                        fetch: jest.fn().mockResolvedValue([]),
                    };
                }

                if (table === 'journal_entry_friends') {
                    return {
                        query: jest.fn().mockReturnThis(),
                        fetch: jest.fn().mockResolvedValue([]),
                    };
                }

                return {};
            });

            (intelligenceCapabilitiesService.getCapabilitiesForCurrentProfile as jest.Mock).mockResolvedValue({
                oracleChatEnabled: false,
            });

            const result = await narrativeService.generateNarrativeText(mockFriendId);

            expect(oracleService.generateFriendshipNarrative).not.toHaveBeenCalled();
            expect(result).toContain('Alice');
            expect(friendshipNarrativesCollection.fetch).toHaveBeenCalled();
        });
    });
});
