// src/modules/relationships/services/__tests__/lifecycle.service.test.ts
import { checkAndApplyDormancy, reactivateFriend } from '../lifecycle.service';
import { database } from '@/db';

// Mock the database to be more robust
jest.mock('@/db', () => ({
  database: {
    write: jest.fn(async (fn) => await fn()),
    get: jest.fn(() => ({
      find: jest.fn().mockImplementation((id) => Promise.resolve({
        id,
        update: jest.fn(),
      })),
      query: jest.fn(() => ({
        fetch: jest.fn().mockResolvedValue([
          // Ensure fetch returns an array of mock friends
          { id: 'friend-1', update: jest.fn() },
          { id: 'friend-2', update: jest.fn() },
        ]),
      })),
    })),
  },
}));

describe('lifecycle.service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should check for dormant friends and apply dormancy', async () => {
    await checkAndApplyDormancy();
    expect(database.get).toHaveBeenCalledWith('friends');
    const query = database.get('friends').query();
    expect(query.fetch).toHaveBeenCalled();
    const friends = await query.fetch();
    // Ensure that update was called for each friend in the mock array
    expect(friends[0].update).toHaveBeenCalled();
    expect(friends[1].update).toHaveBeenCalled();
  });

  it('should reactivate a dormant friend', async () => {
    await reactivateFriend('1');
    expect(database.get).toHaveBeenCalledWith('friends');
    expect(database.get('friends').find).toHaveBeenCalledWith('1');
    const friend = await database.get('friends').find('1');
    expect(friend.update).toHaveBeenCalled();
  });
});
