// src/modules/relationships/services/__tests__/lifecycle.service.test.ts
import { checkAndApplyDormancy, reactivateFriend } from '../lifecycle.service';
import { database } from '@/db';

const mockFriend = {
  id: '1',
  update: jest.fn(),
};

const mockFriends = [
  { id: 'friend-1', update: jest.fn() },
  { id: 'friend-2', update: jest.fn() },
];

const mockFriendsCollection = {
  find: jest.fn().mockResolvedValue(mockFriend),
  query: jest.fn().mockReturnValue({
    fetch: jest.fn().mockResolvedValue(mockFriends),
  }),
};

// Mock the database to be more robust
jest.mock('@/db', () => ({
  database: {
    write: jest.fn(async (fn) => await fn()),
    get: jest.fn((model) => {
      if (model === 'friends') {
        return mockFriendsCollection;
      }
    }),
  },
}));

describe('lifecycle.service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should check for dormant friends and apply dormancy', async () => {
    await checkAndApplyDormancy();
    expect(database.get).toHaveBeenCalledWith('friends');
    expect(mockFriendsCollection.query).toHaveBeenCalled();
    expect(mockFriendsCollection.query().fetch).toHaveBeenCalled();
    // Ensure that update was called for each friend in the mock array
    expect(mockFriends[0].update).toHaveBeenCalled();
    expect(mockFriends[1].update).toHaveBeenCalled();
  });

  it('should reactivate a dormant friend', async () => {
    await reactivateFriend('1');
    expect(database.get).toHaveBeenCalledWith('friends');
    expect(mockFriendsCollection.find).toHaveBeenCalledWith('1');
    expect(mockFriend.update).toHaveBeenCalled();
  });
});
