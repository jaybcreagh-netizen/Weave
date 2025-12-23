
import * as Notifications from 'expo-notifications';
import { WeeklyReflectionChannel } from '../weekly-reflection';
import { notificationStore } from '../../notification-store';
import { notificationAnalytics } from '../../notification-analytics';
import * as gracePeriods from '../../notification-grace-periods';
import { NOTIFICATION_CONFIG } from '../../../notification.config';

// Mocks
jest.mock('expo-notifications');
jest.mock('@/db', () => ({
    database: {
        get: jest.fn().mockReturnValue({
            query: jest.fn().mockReturnValue({
                fetch: jest.fn().mockResolvedValue([{ seasonLastCalculated: new Date() }]),
            }),
        }),
    },
}));
jest.mock('../../notification-store');
jest.mock('../../notification-analytics');
jest.mock('../../notification-grace-periods');
jest.mock('@/modules/reflection/services/weekly-reflection.service', () => ({
    hasCompletedReflectionForCurrentWeek: jest.fn().mockResolvedValue(false),
}));
jest.mock('@/shared/utils/Logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
}));

describe('WeeklyReflectionChannel', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('reflection-id');
        (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);
        (gracePeriods.shouldSendWeeklyReflectionNotification as jest.Mock).mockResolvedValue({
            shouldSend: true,
        });
    });

    describe('schedule', () => {
        it('should not schedule when config is disabled', async () => {
            const originalEnabled = NOTIFICATION_CONFIG['weekly-reflection'].enabled;
            NOTIFICATION_CONFIG['weekly-reflection'].enabled = false;

            await WeeklyReflectionChannel.schedule();

            expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

            NOTIFICATION_CONFIG['weekly-reflection'].enabled = originalEnabled;
        });

        it('should not schedule when grace period blocks', async () => {
            (gracePeriods.shouldSendWeeklyReflectionNotification as jest.Mock).mockResolvedValue({
                shouldSend: false,
                reason: 'Not enough interactions',
            });

            await WeeklyReflectionChannel.schedule();

            expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
        });

        it('should schedule weekly notification when conditions met', async () => {
            await WeeklyReflectionChannel.schedule();

            expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('weekly-reflection');
            expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
            expect(notificationAnalytics.trackScheduled).toHaveBeenCalledWith(
                'weekly-reflection',
                'weekly-reflection',
                expect.any(Object)
            );
        });
    });

    describe('cancel', () => {
        it('should cancel notification by default ID', async () => {
            await WeeklyReflectionChannel.cancel();

            expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('weekly-reflection');
        });

        it('should cancel notification by custom ID', async () => {
            await WeeklyReflectionChannel.cancel('custom-id');

            expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('custom-id');
        });
    });

    describe('handleTap', () => {
        it('should navigate to dashboard and emit weekly reflection event', async () => {
            const mockRouter = {
                replace: jest.fn(),
                canGoBack: jest.fn().mockReturnValue(false),
                dismissAll: jest.fn(),
            };

            await WeeklyReflectionChannel.handleTap({}, mockRouter);

            expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard');
        });
    });

    describe('ensureScheduled', () => {
        it('should schedule when no reflection notification exists', async () => {
            (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);

            await WeeklyReflectionChannel.ensureScheduled?.();

            expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
        });

        it('should clean up ghost notifications', async () => {
            (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
                { identifier: 'weekly-reflection', content: { data: { type: 'weekly-reflection' } } },
                { identifier: 'ghost-123', content: { data: { type: 'weekly-reflection' } } },
            ]);

            await WeeklyReflectionChannel.ensureScheduled?.();

            expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('ghost-123');
        });
    });
});
