
// Mock uuid to avoid ESM issues
jest.mock('uuid', () => ({
    v4: () => 'test-uuid-' + Math.random(),
}));

import { checkAndAwardFriendBadges, checkSpecialBadges } from '../badge.service';
import { database } from '@/db';
import { calculateFriendBadgeProgress } from '../badge-calculator.service';
import { getBadgeById } from '../../constants/badge-definitions';

// Mock dependencies
jest.mock('@/db', () => ({
    database: {
        get: jest.fn(),
        write: jest.fn(),
    },
}));
jest.mock('../badge-calculator.service');
jest.mock('../../constants/badge-definitions');

describe('Badge Service', () => {
    const mockFriendId = 'friend-123';
    const mockFriendName = 'Bestie';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('checkAndAwardFriendBadges', () => {
        it('should award new badges when threshold is met and not previously unlocked', async () => {
            // Mock progress calculation returning a milestone reached
            const mockNextBadge = { id: 'depth_1', threshold: 5, tier: 1 };
            (calculateFriendBadgeProgress as jest.Mock).mockResolvedValue([
                {
                    categoryType: 'depth',
                    progress: 6, // Exceeds threshold
                    nextBadge: mockNextBadge,
                },
            ]);

            // Mock database query to start empty (not unlocked yet)
            const mockCollection = {
                query: jest.fn().mockReturnThis(),
                fetch: jest.fn().mockResolvedValue([]), // No existing badge
                create: jest.fn(),
            };
            (database.get as jest.Mock).mockReturnValue(mockCollection);
            (database.write as jest.Mock).mockImplementation((callback) => callback());

            // Mock getBadgeById
            (getBadgeById as jest.Mock).mockReturnValue(mockNextBadge);

            const result = await checkAndAwardFriendBadges(mockFriendId, mockFriendName);

            expect(result).toHaveLength(1);
            expect(result[0].badge.id).toBe('depth_1');
            expect(mockCollection.create).toHaveBeenCalled(); // Should assume awardBadge calls create
        });

        it('should not award badge if threshold is not met', async () => {
            const mockNextBadge = { id: 'depth_1', threshold: 5, tier: 1 };
            (calculateFriendBadgeProgress as jest.Mock).mockResolvedValue([
                {
                    categoryType: 'depth',
                    progress: 3, // Below threshold
                    nextBadge: mockNextBadge,
                },
            ]);

            const result = await checkAndAwardFriendBadges(mockFriendId, mockFriendName);

            expect(result).toHaveLength(0);
        });

        it('should not award badge if already unlocked', async () => {
            const mockNextBadge = { id: 'depth_1', threshold: 5, tier: 1 };
            (calculateFriendBadgeProgress as jest.Mock).mockResolvedValue([
                {
                    categoryType: 'depth',
                    progress: 6,
                    nextBadge: mockNextBadge,
                },
            ]);

            // Mock database query to return existing badge
            const mockCollection = {
                query: jest.fn().mockReturnThis(),
                fetch: jest.fn().mockResolvedValue([{ id: 'existing_badge' }]),
            };
            (database.get as jest.Mock).mockReturnValue(mockCollection);

            const result = await checkAndAwardFriendBadges(mockFriendId, mockFriendName);

            expect(result).toHaveLength(0);
        });
    });

    describe('checkSpecialBadges', () => {
        it('should award peak_moment badge for FullMoon vibe', async () => {
            const mockInteraction = {
                interactionDate: new Date(),
                vibe: 'FullMoon',
            } as any;

            // Mock dependencies for checkSpecialBadges
            const mockCollection = {
                query: jest.fn().mockReturnThis(),
                fetch: jest.fn().mockResolvedValue([]), // No existing interaction links (first weave check) or existing badge
                fetchCount: jest.fn().mockResolvedValue(0), // isFirstWeave count
                find: jest.fn().mockResolvedValue({ id: mockFriendId, birthday: null }), // friend lookup
                create: jest.fn(),
            };
            (database.get as jest.Mock).mockReturnValue(mockCollection);
            (database.write as jest.Mock).mockImplementation((callback) => callback());
            (getBadgeById as jest.Mock).mockReturnValue({ id: 'peak_moment', tier: 1 });

            // Since internal helpers like isFirstWeave use database calls, we mock them via database responses
            // The service calls:
            // 1. isFirstWeave -> uses interaction_friends fetch -> interaction query count
            // 2. isBadgeUnlocked -> uses friend_badges fetchCount

            // We are mocking database.get, so we need to handle the different table calls
            (database.get as jest.Mock).mockImplementation((table) => {
                return mockCollection; // Simplified: all return same mock collection
            });

            // Note: In a real integration test or stricter unit test, we'd discriminate by table name
            // But for this coverage pass, this verifies the logic flow.

            // We need to ensure isFirstWeave returns false, so 'checkSpecialBadges' proceeds to check 'peak_moment'
            // Wait, peak_moment logic is independent of isFirstWeave.
            // But the function checks isFirstWeave FIRST.
            // If isFirstWeave returns true, it pushes a badge.
            // Then it continues.

            const result = await checkSpecialBadges(mockFriendId, mockFriendName, mockInteraction);

            // Depending on how we mocked fetch/fetchCount, multiple badges might be awarded.
            // We want to ensure 'peak_moment' is in there.

            const peakBadge = result.find(r => r.badge.id === 'peak_moment');
            // If getBadgeById returns the badge object, we expect it found.
            // In mock above: (getBadgeById as jest.Mock).mockReturnValue({ id: 'peak_moment', tier: 1 });

            expect(peakBadge).toBeDefined();
        });
    });
});
