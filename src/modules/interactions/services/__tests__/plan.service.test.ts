import { database } from '@/db';
import { completePlan, cancelPlan, checkPendingPlans, checkMissedPlans } from '../plan.service';
import { processWeaveScoring } from '@/modules/intelligence';
import { recordPractice } from '@/modules/gamification';
import { deleteWeaveCalendarEvent } from '../calendar.service';

jest.mock('@/db', () => ({
  database: {
    get: jest.fn().mockReturnThis(),
    query: jest.fn().mockReturnThis(),
    fetch: jest.fn(),
    find: jest.fn(),
    write: jest.fn(async (fn) => fn()),
    update: jest.fn(),
  },
}));

jest.mock('@/modules/intelligence', () => ({
  processWeaveScoring: jest.fn(),
}));

jest.mock('@/modules/gamification', () => ({
  recordPractice: jest.fn(),
}));

jest.mock('../calendar.service', () => ({
  deleteWeaveCalendarEvent: jest.fn().mockResolvedValue(undefined),
}));

describe('PlanService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should complete a plan', async () => {
    const mockInteraction = {
      id: 'interaction1',
      status: 'planned',
      update: jest.fn(),
    };
    const mockInteractionFriend = { friendId: 'friend1' };
    const mockFriend = { id: 'friend1' };

    (database.get as jest.Mock).mockReturnValue({
      find: jest.fn().mockResolvedValue(mockInteraction),
      query: jest.fn().mockReturnThis(),
      fetch: jest.fn().mockResolvedValueOnce([mockInteractionFriend]).mockResolvedValueOnce([mockFriend]),
    });

    await completePlan(mockInteraction.id);

    expect(database.write).toHaveBeenCalled();
    expect(mockInteraction.update).toHaveBeenCalledWith(expect.any(Function));
    expect(processWeaveScoring).toHaveBeenCalled();
    expect(recordPractice).toHaveBeenCalledWith('log_weave');
  });

  it('should cancel a plan', async () => {
    const mockInteraction = {
      id: 'interaction1',
      calendarEventId: 'cal123',
      update: jest.fn(),
    };

    (database.get as jest.Mock).mockReturnValue({
      find: jest.fn().mockResolvedValue(mockInteraction),
    });

    await cancelPlan(mockInteraction.id);

    expect(database.write).toHaveBeenCalled();
    expect(mockInteraction.update).toHaveBeenCalledWith(expect.any(Function));
    expect(deleteWeaveCalendarEvent).toHaveBeenCalledWith('cal123');
  });

  it('should check for pending plans and update their status', async () => {
    const mockPlan = {
      id: 'plan1',
      update: jest.fn(),
      interactionFriends: {
        fetch: jest.fn().mockResolvedValue([{ friendId: 'friend1' }])
      },
      activity: 'test-activity',
      note: 'test-note',
      interactionDate: new Date(),
      mode: 'test-mode',
      duration: 'Standard',
      interactionCategory: 'test-category'
    };
    const mockFriend = { id: 'friend1' };

    (database.get as jest.Mock).mockReturnValue({
      query: jest.fn().mockReturnThis(),
      fetch: jest.fn().mockResolvedValueOnce([mockPlan]).mockResolvedValue([mockFriend]),
      find: jest.fn(),
    });

    await checkPendingPlans();

    expect(database.write).toHaveBeenCalled();
    expect(mockPlan.update).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should check for missed plans and update their status', async () => {
    const mockPlan = { id: 'plan1', update: jest.fn() };
    (database.get as jest.Mock).mockReturnValue({
      query: jest.fn().mockReturnThis(),
      fetch: jest.fn().mockResolvedValue([mockPlan]),
    });

    await checkMissedPlans();

    expect(database.write).toHaveBeenCalled();
    expect(mockPlan.update).toHaveBeenCalledWith(expect.any(Function));
  });
});
