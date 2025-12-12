import { FriendRepository } from '../friend.repository';
import { database } from '@/db';

jest.mock('@/db', () => ({
    database: {
        get: jest.fn(),
        write: jest.fn(cb => cb()),
    },
}));

describe('FriendRepository', () => {
    let repository: FriendRepository;
    const mockCollection = {
        query: jest.fn().mockReturnThis(),
        fetch: jest.fn(),
        find: jest.fn(),
        create: jest.fn(),
        prepareCreate: jest.fn(),
        prepareUpdate: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockCollection.query.mockReturnThis(); // Reset chainable
        (database.get as jest.Mock).mockReturnValue(mockCollection);
        repository = new FriendRepository();
    });

    it('getAllFriends should fetch friends', async () => {
        mockCollection.fetch.mockResolvedValue(['friend1', 'friend2']);
        const friends = await repository.getAllFriends();
        expect(friends).toEqual(['friend1', 'friend2']);
        expect(mockCollection.query).toHaveBeenCalled();
        expect(mockCollection.fetch).toHaveBeenCalled();
    });

    it('getFriendById should return friend if found', async () => {
        const mockFriend = { id: '1', name: 'Test' };
        mockCollection.find.mockResolvedValue(mockFriend);
        const friend = await repository.getFriendById('1');
        expect(friend).toEqual(mockFriend);
        expect(mockCollection.find).toHaveBeenCalledWith('1');
    });

    it('getFriendById should return undefined if not found', async () => {
        mockCollection.find.mockRejectedValue(new Error('Record not found'));
        const friend = await repository.getFriendById('999');
        expect(friend).toBeUndefined();
    });

    it('getFriendsByTierQuery should return a query', () => {
        const queryResult = {};
        mockCollection.query.mockReturnValue(queryResult);
        const query = repository.getFriendsByTierQuery('InnerCircle');
        expect(query).toBe(queryResult);
        expect(mockCollection.query).toHaveBeenCalled();
    });
});
