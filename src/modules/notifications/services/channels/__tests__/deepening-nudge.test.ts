
import * as Notifications from 'expo-notifications';
import { DeepeningNudgeChannel } from '../deepening-nudge';
import { notificationStore } from '../../notification-store';
import { notificationAnalytics } from '../../notification-analytics';
import { NOTIFICATION_TIMING } from '../../../notification.config';

// Mocks
jest.mock('expo-notifications');
jest.mock('@/db', () => ({
    database: {
        get: jest.fn().mockReturnValue({
            query: jest.fn().mockReturnValue({
                fetch: jest.fn().mockResolvedValue([]),
            }),
        }),
    },
}));
jest.mock('../../notification-store');
jest.mock('../../notification-analytics');
jest.mock('../../season-notifications.service', () => ({
    shouldSendNotification: jest.fn().mockReturnValue(true),
}));
jest.mock('@/shared/utils/Logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
}));

// Mock Interaction model
const createMockInteraction = (overrides = {}) => ({
    id: 'interaction-1',
    status: 'completed',
    interactionDate: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    ...overrides,
});

describe('DeepeningNudgeChannel', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('nudge-id');
        (notificationStore.isTypeSuppressed as jest.Mock).mockResolvedValue(false);
        (notificationStore.getDailyBudget as jest.Mock).mockResolvedValue({ used: 0, limit: 5 });
        (notificationStore.getDeepeningNudges as jest.Mock).mockResolvedValue([]);
        (notificationStore.checkAndIncrementBudget as jest.Mock).mockResolvedValue(true);
    });

    describe('schedule', () => {
        it('should not schedule for non-completed interactions', async () => {
            const interaction = createMockInteraction({ status: 'planned' });

            await DeepeningNudgeChannel.schedule(interaction as any);

            expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
        });

        it('should not schedule when type is suppressed (ignored 3+ times)', async () => {
            (notificationStore.isTypeSuppressed as jest.Mock).mockResolvedValue(true);
            const interaction = createMockInteraction();

            await DeepeningNudgeChannel.schedule(interaction as any);

            expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
        });

        it('should not schedule when daily budget is exhausted', async () => {
            (notificationStore.getDailyBudget as jest.Mock).mockResolvedValue({ used: 5, limit: 5 });
            const interaction = createMockInteraction();

            await DeepeningNudgeChannel.schedule(interaction as any);

            expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
        });

        it('should not schedule if interaction is older than max hours', async () => {
            const oldInteraction = createMockInteraction({
                interactionDate: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
            });

            await DeepeningNudgeChannel.schedule(oldInteraction as any);

            expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
        });

        it('should not schedule if max nudges per day reached', async () => {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            (notificationStore.getDeepeningNudges as jest.Mock).mockResolvedValue([
                { scheduledAt: startOfDay.getTime() + 1000, interactionId: 'a', notificationId: 'n1' },
                { scheduledAt: startOfDay.getTime() + 2000, interactionId: 'b', notificationId: 'n2' },
            ]);

            const interaction = createMockInteraction();
            await DeepeningNudgeChannel.schedule(interaction as any);

            expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
        });

        it('should schedule nudge for valid completed interaction', async () => {
            const interaction = createMockInteraction();

            await DeepeningNudgeChannel.schedule(interaction as any);

            expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
            expect(notificationStore.checkAndIncrementBudget).toHaveBeenCalled();
            expect(notificationStore.setDeepeningNudges).toHaveBeenCalled();
        });
    });

    describe('cancel', () => {
        it('should cancel notification by ID', async () => {
            await DeepeningNudgeChannel.cancel('nudge-123');

            expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('nudge-123');
        });

        it('should not cancel if no ID provided', async () => {
            await DeepeningNudgeChannel.cancel();

            expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
        });
    });

    describe('handleTap', () => {
        it('should navigate to journal with guided mode when interactionId present', () => {
            const mockRouter = { push: jest.fn(), replace: jest.fn() };
            const data = { interactionId: 'int-123' };

            DeepeningNudgeChannel.handleTap(data, mockRouter);

            expect(mockRouter.push).toHaveBeenCalledWith({
                pathname: '/journal',
                params: { mode: 'guided', weaveId: 'int-123' },
            });
        });

        it('should fallback to dashboard when no interactionId', () => {
            const mockRouter = { push: jest.fn(), replace: jest.fn() };
            const data = {};

            DeepeningNudgeChannel.handleTap(data, mockRouter);

            expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard');
        });
    });

    describe('timing configuration', () => {
        it('should use NOTIFICATION_TIMING values', () => {
            expect(NOTIFICATION_TIMING.deepeningNudge.maxPerDay).toBe(2);
            expect(NOTIFICATION_TIMING.deepeningNudge.minDelayHours).toBe(3);
            expect(NOTIFICATION_TIMING.deepeningNudge.maxDelayHours).toBe(6);
            expect(NOTIFICATION_TIMING.deepeningNudge.maxHoursAfterInteraction).toBe(24);
        });
    });
});
