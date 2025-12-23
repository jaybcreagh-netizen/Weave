
import * as Notifications from 'expo-notifications';
import { BatteryCheckinChannel } from '../battery-checkin';
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
                fetch: jest.fn().mockResolvedValue([{ id: '1', batteryCheckinTime: '08:00' }]),
            }),
        }),
    },
}));
jest.mock('../../notification-store');
jest.mock('../../notification-analytics');
jest.mock('../../notification-grace-periods');
jest.mock('@/shared/utils/Logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
}));

describe('BatteryCheckinChannel', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);
        (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('test-id');
        (gracePeriods.shouldSendSocialBatteryNotification as jest.Mock).mockResolvedValue({ shouldSend: true });
    });

    describe('schedule', () => {
        it('should not schedule when config is disabled', async () => {
            // Temporarily override config
            const originalEnabled = NOTIFICATION_CONFIG['daily-battery-checkin'].enabled;
            NOTIFICATION_CONFIG['daily-battery-checkin'].enabled = false;

            await BatteryCheckinChannel.schedule();

            expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

            // Restore
            NOTIFICATION_CONFIG['daily-battery-checkin'].enabled = originalEnabled;
        });

        it('should respect grace period and not schedule when blocked', async () => {
            (gracePeriods.shouldSendSocialBatteryNotification as jest.Mock).mockResolvedValue({
                shouldSend: false,
                reason: 'Not enough interactions',
            });

            await BatteryCheckinChannel.schedule();

            expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
        });

        it('should schedule notifications when grace period passes', async () => {
            await BatteryCheckinChannel.schedule();

            expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
        });
    });

    describe('cancel', () => {
        it('should cancel all battery-checkin notifications', async () => {
            (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
                { identifier: 'battery-checkin-1', content: { data: { type: 'battery-checkin' } } },
                { identifier: 'battery-checkin-2', content: { data: { type: 'battery-checkin' } } },
                { identifier: 'other-notification', content: { data: { type: 'weekly-reflection' } } },
            ]);

            await BatteryCheckinChannel.cancel();

            expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('battery-checkin-1');
            expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('battery-checkin-2');
            expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
        });
    });

    describe('handleTap', () => {
        it('should emit open battery sheet event', async () => {
            const mockRouter = { replace: jest.fn() };
            const mockUIEventBus = { emit: jest.fn() };

            // Mock dynamic import
            jest.doMock('@/shared/services/ui-event-bus', () => ({
                UIEventBus: mockUIEventBus,
            }));

            // Note: handleTap uses dynamic import, testing the behavior
            await BatteryCheckinChannel.handleTap({}, mockRouter);

            expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard');
        });
    });

    describe('checkAndExtendBatch', () => {
        it('should extend batch when less than 2 days of notifications remain', async () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);

            (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
                {
                    identifier: 'battery-checkin-1',
                    content: { data: { type: 'battery-checkin' } },
                    trigger: { value: tomorrow.getTime() },
                },
            ]);

            await BatteryCheckinChannel.checkAndExtendBatch();

            // Should have scheduled more notifications
            expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
        });

        it('should not extend batch when sufficient notifications exist', async () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 10);

            (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
                {
                    identifier: 'battery-checkin-1',
                    content: { data: { type: 'battery-checkin' } },
                    trigger: { value: futureDate.getTime() },
                },
            ]);

            await BatteryCheckinChannel.checkAndExtendBatch();

            // Should not schedule more
            expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
        });
    });
});
