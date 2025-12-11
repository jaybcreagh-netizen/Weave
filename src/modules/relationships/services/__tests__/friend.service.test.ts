// src/modules/relationships/services/__tests__/friend.service.test.ts
import { createFriend, updateFriend, deleteFriend, batchAddFriends } from '../friend.service';
import { database } from '@/db';
import { FriendFormData } from '@/modules/relationships';

const mockUserProgress: any = {
  id: 'progress-1',
  update: jest.fn(),
};

mockUserProgress.prepareUpdate = jest.fn((fn: any) => {
  fn(mockUserProgress);
  return mockUserProgress;
});

const mockFriend = {
  id: '1',
  update: jest.fn(),
  destroyPermanently: jest.fn(),
  photoUrl: 'test.jpg',
};

const mockFriendsCollection = {
  create: jest.fn(),
  prepareCreate: jest.fn((fn) => {
    const friend = { ...mockFriend };
    fn(friend);
    return friend;
  }),
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
        prepareCreate: jest.fn(),
        find: jest.fn(),
        query: jest.fn().mockReturnValue({ fetch: jest.fn().mockResolvedValue([]) }),
      };
    }),
    batch: jest.fn(async (...ops) => {
      // Execute each operation if it's a promise or function
      for (const op of ops) {
        if (typeof op === 'function') await op();
        else await op;
      }
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
    expect(mockFriendsCollection.prepareCreate).toHaveBeenCalled();
    expect(database.get).toHaveBeenCalledWith('user_progress');
    expect(mockUserProgress.prepareUpdate).toHaveBeenCalled();
  });

  it('should track friend creation with custom source', async () => {
    const friendData: FriendFormData = {
      photoUrl: 'https://example.com/photo.jpg',
      name: 'Jane Doe',
      tier: 'InnerCircle',
      archetype: 'Emperor',
      notes: '',
    };

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const analyticsService = require('@/shared/services/analytics.service');

    await createFriend(friendData, 'onboarding');

    expect(analyticsService.trackEvent).toHaveBeenCalledWith(
      analyticsService.AnalyticsEvents.FRIEND_ADDED,
      expect.objectContaining({
        source: 'onboarding'
      })
    );
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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(require('@/modules/relationships/services/image.service').deleteImage).toHaveBeenCalledWith({
      imageId: '1',
      type: 'profilePicture',
    });
  });

  it('should batch add friends', async () => {
    const contacts = [{ name: 'John Doe' }, { name: 'Jane Doe' }];
    await batchAddFriends(contacts, 'CloseFriends');
    expect(database.get).toHaveBeenCalledWith('friends');
    expect(mockFriendsCollection.prepareCreate).toHaveBeenCalledTimes(2);
  });
});
