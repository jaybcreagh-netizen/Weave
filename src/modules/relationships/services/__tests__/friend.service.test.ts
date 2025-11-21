// src/modules/relationships/services/__tests__/friend.service.test.ts
import { createFriend, updateFriend, deleteFriend, batchAddFriends } from '../friend.service';
import { database } from '@/db';
import { FriendFormData } from '@/modules/relationships/types';

const mockUserProgress = {
  id: 'progress-1',
  update: jest.fn(),
};

const mockFriend = {
  id: '1',
  update: jest.fn(),
  destroyPermanently: jest.fn(),
  photoUrl: 'test.jpg',
};

const mockFriendsCollection = {
  create: jest.fn(),
  find: jest.fn().mockResolvedValue(mockFriend),
  query: jest.fn().mockReturnValue({
    fetch: jest.fn().mockResolvedValue([]),
  }),
};

const mockUserProgressCollection = {
  query: jest.fn().mockReturnValue({
    fetch: jest.fn().mockResolvedValue([mockUserProgress]),
  }),
};

// A more robust mock for WatermelonDB
jest.mock('@/db', () => ({
  database: {
    write: jest.fn(async (fn) => await fn()), // Ensure the passed function is awaited
    get: jest.fn((model) => {
      if (model === 'user_progress') {
        return mockUserProgressCollection;
      }
      if (model === 'friends') {
        return mockFriendsCollection;
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
jest.mock('@/shared/services/analytics.service', () => ({
  trackEvent: jest.fn(),
  AnalyticsEvents: {
    FRIEND_ADDED: 'FRIEND_ADDED',
    FRIEND_UPDATED: 'FRIEND_UPDATED',
    FRIEND_DELETED: 'FRIEND_DELETED',
    FRIEND_BATCH_ADDED: 'FRIEND_BATCH_ADDED',
  },
}));

// Mock image-service
jest.mock('@/modules/relationships/services/image.service', () => ({
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
    expect(mockFriendsCollection.create).toHaveBeenCalled();
    expect(database.get).toHaveBeenCalledWith('user_progress');
    expect(mockUserProgress.update).toHaveBeenCalled();
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
    expect(mockFriendsCollection.find).toHaveBeenCalledWith('1');
    expect(mockFriend.update).toHaveBeenCalled();
  });

  it('should delete a friend and their photo', async () => {
    await deleteFriend('1');
    expect(database.get).toHaveBeenCalledWith('friends');
    expect(mockFriendsCollection.find).toHaveBeenCalledWith('1');
    expect(mockFriend.destroyPermanently).toHaveBeenCalled();
    expect(require('@/modules/relationships/services/image.service').deleteImage).toHaveBeenCalledWith({
      imageId: '1',
      type: 'profilePicture',
    });
  });

  it('should batch add friends', async () => {
    const contacts = [{ name: 'John Doe' }, { name: 'Jane Doe' }];
    await batchAddFriends(contacts, 'CloseFriends');
    expect(database.get).toHaveBeenCalledWith('friends');
    expect(mockFriendsCollection.create).toHaveBeenCalledTimes(2);
  });
});
