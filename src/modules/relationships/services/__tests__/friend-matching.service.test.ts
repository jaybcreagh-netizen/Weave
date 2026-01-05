/**
 * Friend Matching Service Tests
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock the database
const mockFriends = [
    {
        id: 'friend-1',
        name: 'John Smith',
        phoneNumber: '+14155551234',
        linkStatus: null,
        tier: 'CloseFriends',
        photoUrl: null,
    },
    {
        id: 'friend-2',
        name: 'Jane Doe',
        phoneNumber: null,
        linkStatus: null,
        tier: 'InnerCircle',
        photoUrl: 'https://example.com/photo.jpg',
    },
    {
        id: 'friend-3',
        name: 'Bob Johnson',
        phoneNumber: '+14155559999',
        linkStatus: 'linked', // Already linked, should be excluded
        tier: 'Community',
        photoUrl: null,
    },
];

jest.mock('@/db', () => ({
    database: {
        get: jest.fn(() => ({
            query: jest.fn().mockReturnValue({
                fetch: jest.fn().mockResolvedValue(
                    mockFriends.filter(f => !f.linkStatus || f.linkStatus === '')
                ),
            }),
        })),
    },
}));

// Import after mocking
import { findPotentialMatches, findBestMatch } from '../friend-matching.service';

describe('friend-matching.service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('findPotentialMatches', () => {
        it('should return exact name match with high confidence', async () => {
            const matches = await findPotentialMatches('John Smith');

            expect(matches.length).toBeGreaterThan(0);
            expect(matches[0].friend.name).toBe('John Smith');
            expect(matches[0].confidence).toBeGreaterThanOrEqual(0.9);
            expect(matches[0].matchReason).toBe('exact_name');
        });

        it('should return case-insensitive name match', async () => {
            const matches = await findPotentialMatches('john smith');

            expect(matches.length).toBeGreaterThan(0);
            expect(matches[0].friend.name).toBe('John Smith');
        });

        it('should return partial name match', async () => {
            const matches = await findPotentialMatches('John');

            expect(matches.length).toBeGreaterThan(0);
            const johnMatch = matches.find(m => m.friend.name === 'John Smith');
            expect(johnMatch).toBeDefined();
            expect(johnMatch!.matchReason).toBe('similar_name');
        });

        it('should return phone match with highest confidence', async () => {
            const matches = await findPotentialMatches('Johnny', '+14155551234');

            expect(matches.length).toBeGreaterThan(0);
            expect(matches[0].friend.name).toBe('John Smith');
            expect(matches[0].matchReason).toBe('phone_match');
            expect(matches[0].confidence).toBeGreaterThanOrEqual(0.95);
        });

        it('should return empty array when no matches', async () => {
            const matches = await findPotentialMatches('Completely Unknown Person');

            expect(matches).toEqual([]);
        });

        it('should not return already linked friends', async () => {
            const matches = await findPotentialMatches('Bob Johnson');

            // Bob is already linked, should not appear
            const bobMatch = matches.find(m => m.friend.name === 'Bob Johnson');
            expect(bobMatch).toBeUndefined();
        });
    });

    describe('findBestMatch', () => {
        it('should return best match when confidence is high', async () => {
            const match = await findBestMatch('John Smith');

            expect(match).not.toBeNull();
            expect(match?.friend.name).toBe('John Smith');
        });

        it('should return null when no high-confidence match', async () => {
            const match = await findBestMatch('Unknown Person');

            expect(match).toBeNull();
        });
    });
});
