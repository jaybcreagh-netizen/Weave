// src/modules/relationships/services/__tests__/friend.service.test.ts
import { createFriend, updateFriend, deleteFriend, batchAddFriends } from '../friend.service';
import { database } from '@/db';
import { FriendFormData } from '../../types';

// A more robust mock for WatermelonDB
jest.mock('@/db', () => ({
  database: {
    write: jest.fn(async (fn) => await fn()), // Ensure the passed function is awaited
    get: jest.fn((model) => {
      if (model === 'user_progress') {
        return {
          query: jest.fn().mockReturnValue({
            fetch: jest.fn().mockResolvedValue([
              {
                id: 'progress-1',
                update: jest.fn(),
              },
            ]),
          }),
        };
      }
      if (model === 'friends') {
        return {
          create: jest.fn(),
          find: jest.fn().mockImplementation((id) => Promise.resolve({
            id,
            update: jest.fn(),
            destroyPermanently: jest.fn(),
            photoUrl: 'test.jpg',
          })),
          query: jest.fn().mockReturnValue({
            fetch: jest.fn().mockResolvedValue([]),
          }),
        };
      }
      return {
        create: jest.fn(),
        find: jest.fn(),
        query: jest.fn().mockReturnValue({ fetch: jest.fn().mockResolvedValue([]) }),
      };
    }),
  },
}));

// Mock analytics
jest.mock('@/lib/analytics', () => ({
  trackEvent: jest.fn(),
  AnalyticsEvents: {
    FRIEND_ADDED: 'FRIEND_ADDED',
    FRIEND_UPDATED: 'FRIEND_UPDATED',
    FRIEND_DELETED: 'FRIEND_DELETED',
    FRIEND_BATCH_ADDED: 'FRIEND_BATCH_ADDED',
  },
}));

// Mock image-service
jest.mock('@/lib/image-service', () => ({
  deleteImage: jest.fn(),
}));

describe('friend.service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create a new friend and update user progress', async () => {
    const friendData: FriendFormData = {
      name: 'John Doe',
      tier: 'CloseFriends',
      archetype: 'Magician',
      notes: 'Test note',
      photoUrl: 'test.jpg',
    };
    await createFriend(friendData);
    expect(database.get).toHaveBeenCalledWith('friends');
    expect(database.get('friends').create).toHaveBeenCalled();
    expect(database.get).toHaveBeenCalledWith('user_progress');
    const progressFetch = await database.get('user_progress').query().fetch();
    expect(progressFetch[0].update).toHaveBeenCalled();
  });

  it('should update a friend', async () => {
    const friendData: FriendFormData = {
      name: 'John Doe',
      tier: 'CloseFriends',
      archetype: 'Magician',
      notes: 'Test note',
      photoUrl: 'test.jpg',
    };
    await updateFriend('1', friendData);
    expect(database.get).toHaveBeenCalledWith('friends');
    expect(database.get('friends').find).toHaveBeenCalledWith('1');
    const friend = await database.get('friends').find('1');
    expect(friend.update).toHaveBeenCalled();
  });

  it('should delete a friend and their photo', async () => {
    await deleteFriend('1');
    expect(database.get).toHaveBeenCalledWith('friends');
    expect(database.get('friends').find).toHaveBeenCalledWith('1');
    const friend = await database.get('friends').find('1');
    expect(friend.destroyPermanently).toHaveBeenCalled();
    expect(require('@/lib/image-service').deleteImage).toHaveBeenCalledWith({
      imageId: '1',
      type: 'profilePicture',
    });
  });

  it('should batch add friends', async () => {
    const contacts = [{ name: 'John Doe' }, { name: 'Jane Doe' }];
    await batchAddFriends(contacts, 'CloseFriends');
    expect(database.get).toHaveBeenCalledWith('friends');
    expect(database.get('friends').create).toHaveBeenCalledTimes(2);
  });
});
