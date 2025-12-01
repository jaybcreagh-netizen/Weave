import { database } from '@/db';
import { logWeave, planWeave, deleteWeave } from '../weave-logging.service';
import { InteractionFormData } from '@/modules/interactions';
import { processWeaveScoring } from '@/modules/intelligence';
import { checkAndAwardFriendBadges, checkAndAwardGlobalAchievements, recordPractice } from '@/modules/gamification';
import { trackEvent, AnalyticsEvents, updateLastInteractionTimestamp } from '@/shared/services/analytics.service';
import { analyzeAndTagLifeEvents } from '@/modules/relationships';
import { deleteWeaveCalendarEvent } from '../calendar.service';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('../../../../../__mocks__/async-storage-mock.js')
);

jest.mock('@/db', () => ({
  database: {
    get: jest.fn().mockReturnValue({
      query: jest.fn().mockReturnThis(),
      fetch: jest.fn(),
      create: jest.fn(),
      prepareCreate: jest.fn(),
      find: jest.fn(),
      prepareDestroyPermanently: jest.fn(),
    }),
    query: jest.fn().mockReturnThis(),
    fetch: jest.fn(),
    find: jest.fn(),
    write: jest.fn(async (fn) => fn()),
    batch: jest.fn(),
    create: jest.fn(),
    prepareDestroyPermanently: jest.fn(),
  },
}));

jest.mock('@/modules/intelligence', () => ({
  processWeaveScoring: jest.fn(),
}));

jest.mock('@/modules/gamification', () => ({
  checkAndAwardFriendBadges: jest.fn(),
  checkAndAwardGlobalAchievements: jest.fn(),
  recordPractice: jest.fn(),
}));

jest.mock('@/shared/services/analytics.service', () => ({
  trackEvent: jest.fn(),
  AnalyticsEvents: {
    INTERACTION_LOGGED: 'INTERACTION_LOGGED',
    INTERACTION_PLANNED: 'INTERACTION_PLANNED',
  },
  updateLastInteractionTimestamp: jest.fn(),
}));

jest.mock('@/modules/relationships', () => ({
  analyzeAndTagLifeEvents: jest.fn(),
}));

jest.mock('../calendar.service', () => ({
  deleteWeaveCalendarEvent: jest.fn().mockResolvedValue(undefined),
}));

describe('WeaveLoggingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should log a new weave and call related services', async () => {
    const mockFriend = { id: 'friend1', name: 'Test Friend' };
    const mockInteraction = { id: 'interaction1', activity: 'Test Activity' };

    (database.get as jest.Mock).mockReturnValue({
      query: jest.fn().mockReturnThis(),
      fetch: jest.fn().mockResolvedValue([mockFriend]),
      find: jest.fn().mockResolvedValue({ ...mockFriend, ratedWeavesCount: 2 }), // Mock find for side effects
      create: jest.fn().mockResolvedValue(mockInteraction),
      prepareCreate: jest.fn().mockImplementation((fn) => {
        const mockObj = {
          ...mockInteraction,
          interaction: { set: jest.fn() },
          friend: { set: jest.fn() },
        };
        fn(mockObj);
        return mockObj;
      }),
    });

    const formData: InteractionFormData = {
      friendIds: [mockFriend.id],
      activity: 'Test Activity',
      date: new Date(),
      type: 'log',
      status: 'completed',
      mode: 'one-on-one',
    };

    const interaction = await logWeave(formData);

    expect(interaction).toMatchObject(mockInteraction);
    expect(database.write).toHaveBeenCalled();
    expect(database.get).toHaveBeenCalledWith('friends');
    expect(database.get).toHaveBeenCalledWith('interactions');
    expect(processWeaveScoring).toHaveBeenCalledWith([mockFriend], formData, expect.anything());
    expect(checkAndAwardFriendBadges).toHaveBeenCalledWith(mockFriend.id, mockFriend.name);
    expect(checkAndAwardGlobalAchievements).toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith('INTERACTION_LOGGED', expect.any(Object));
    expect(updateLastInteractionTimestamp).toHaveBeenCalled();
    expect(recordPractice).toHaveBeenCalledWith('log_weave', mockInteraction.id);
  });

  it('should throw validation error if data is invalid', async () => {
    const invalidData: any = {
      friendIds: [], // Invalid: min(1)
      activity: '', // Invalid: min(1)
      date: new Date(),
      type: 'log',
      status: 'completed',
      mode: 'one-on-one',
    };

    await expect(logWeave(invalidData)).rejects.toThrow(/Invalid weave data/);
  });

  it('should plan a new weave', async () => {
    const mockFriend = { id: 'friend1', name: 'Test Friend' };
    const mockInteraction = { id: 'interaction1', activity: 'Test Plan', status: 'planned' };

    (database.get as jest.Mock).mockReturnValue({
      query: jest.fn().mockReturnThis(),
      fetch: jest.fn().mockResolvedValue([mockFriend]),
      create: jest.fn().mockResolvedValue(mockInteraction),
      prepareCreate: jest.fn().mockImplementation((fn) => {
        const mockObj = {
          ...mockInteraction,
          interaction: { set: jest.fn() },
          friend: { set: jest.fn() },
        };
        fn(mockObj);
        return mockObj;
      }),
    });

    const formData: InteractionFormData = {
      friendIds: [mockFriend.id],
      activity: 'Test Plan',
      date: new Date(),
      type: 'plan',
      status: 'planned',
      mode: 'one-on-one',
    };

    const interaction = await planWeave(formData);

    expect(interaction).toMatchObject(mockInteraction);
    expect(database.write).toHaveBeenCalled();
    expect(database.get).toHaveBeenCalledWith('friends');
    expect(database.get).toHaveBeenCalledWith('interactions');
    expect(trackEvent).toHaveBeenCalledWith('INTERACTION_PLANNED', expect.any(Object));
  });

  it('should delete a weave and its calendar event', async () => {
    const mockInteraction = {
      id: 'interaction1',
      calendarEventId: 'cal123',
      prepareDestroyPermanently: jest.fn(),
    };
    const mockInteractionFriend = { prepareDestroyPermanently: jest.fn() };

    (database.get as jest.Mock).mockReturnValue({
      find: jest.fn().mockResolvedValue(mockInteraction),
      query: jest.fn().mockReturnThis(),
      fetch: jest.fn().mockResolvedValue([mockInteractionFriend]),
    });

    await deleteWeave(mockInteraction.id);

    expect(database.get).toHaveBeenCalledWith('interactions');
    expect(database.get).toHaveBeenCalledWith('interaction_friends');
    expect(database.write).toHaveBeenCalled();
    expect(database.batch).toHaveBeenCalledWith(
      mockInteractionFriend.prepareDestroyPermanently(),
      mockInteraction.prepareDestroyPermanently()
    );
    expect(deleteWeaveCalendarEvent).toHaveBeenCalledWith('cal123');
  });
});
