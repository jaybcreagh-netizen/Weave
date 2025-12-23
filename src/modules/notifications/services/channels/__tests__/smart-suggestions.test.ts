
import * as Notifications from 'expo-notifications';
import { SmartSuggestionsChannel } from '../smart-suggestions';
import { notificationStore } from '../../notification-store';
import { notificationAnalytics } from '../../notification-analytics';
import { NOTIFICATION_CONFIG, NOTIFICATION_TIMING } from '../../../notification.config';

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
    applySeasonLimit: jest.fn((limit) => limit),
}));
jest.mock('@/modules/interactions', () => ({
    generateSuggestion: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/modules/intelligence', () => ({
    calculateCurrentScore: jest.fn().mockReturnValue(50),
}));
jest.mock('@/shared/utils/Logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
}));

describe('SmartSuggestionsChannel', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('suggestion-id');
        (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockResolvedValue(undefined);
        (notificationStore.getLastSmartNotificationTime as jest.Mock).mockResolvedValue(null);
        (notificationStore.getPreferences as jest.Mock).mockResolvedValue({
            frequency: 'moderate',
            quietHoursStart: 22,
            quietHoursEnd: 8,
            respectBattery: true,
        });
        (notificationStore.getSmartNotificationCount as jest.Mock).mockResolvedValue(null);
        (notificationStore.getScheduledSmartNotifications as jest.Mock).mockResolvedValue(null);
    });

    describe('evaluateAndSchedule', () => {
        it('should skip when config is disabled', async () => {
            const originalEnabled = NOTIFICATION_CONFIG['smart-suggestions'].enabled;
            NOTIFICATION_CONFIG['smart-suggestions'].enabled = false;

            await SmartSuggestionsChannel.evaluateAndSchedule();

            expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

            NOTIFICATION_CONFIG['smart-suggestions'].enabled = originalEnabled;
        });

        it('should skip during cooldown period', async () => {
            // Last notification was 1 hour ago (cooldown is 2 hours)
            (notificationStore.getLastSmartNotificationTime as jest.Mock).mockResolvedValue(
                Date.now() - 1 * 60 * 60 * 1000
            );

            await SmartSuggestionsChannel.evaluateAndSchedule();

            expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
        });

        it('should skip during quiet hours', async () => {
            // Mock quiet hours preferences
            (notificationStore.getPreferences as jest.Mock).mockResolvedValue({
                frequency: 'moderate',
                quietHoursStart: 0, // Midnight
                quietHoursEnd: 23, // 11 PM - effectively always quiet
                respectBattery: true,
            });

            await SmartSuggestionsChannel.evaluateAndSchedule();

            expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
        });
    });

    describe('cancel', () => {
        it('should cancel all smart suggestion notifications', async () => {
            (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([
                { identifier: 'smart-suggestion-1', content: { data: { type: 'friend-suggestion' } } },
                { identifier: 'smart-suggestion-2', content: { data: { type: 'friend-suggestion' } } },
            ]);

            await SmartSuggestionsChannel.cancel();

            expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('smart-suggestion-1');
            expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('smart-suggestion-2');
        });

        it('should cancel specific notification by ID', async () => {
            await SmartSuggestionsChannel.cancel('smart-suggestion-123');

            expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('smart-suggestion-123');
        });
    });

    describe('handleTap', () => {
        it('should navigate to friend profile when friendId present', () => {
            const mockRouter = { push: jest.fn(), replace: jest.fn() };
            const data = { friendId: 'friend-123' };

            SmartSuggestionsChannel.handleTap(data, mockRouter);

            expect(mockRouter.push).toHaveBeenCalledWith({
                pathname: '/friend-profile',
                params: { id: 'friend-123' },
            });
        });

        it('should navigate to dashboard when no friendId', () => {
            const mockRouter = { push: jest.fn(), replace: jest.fn() };
            const data = {};

            SmartSuggestionsChannel.handleTap(data, mockRouter);

            expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard');
        });
    });

    describe('timing configuration', () => {
        it('should use centralized NOTIFICATION_TIMING values', () => {
            expect(NOTIFICATION_TIMING.smartSuggestions.minHoursBetween).toBe(2);
            expect(NOTIFICATION_TIMING.smartSuggestions.recentInteractionCooldownMs).toBe(24 * 60 * 60 * 1000);
            expect(NOTIFICATION_TIMING.smartSuggestions.plannedWeaveWindowMs).toBe(7 * 24 * 60 * 60 * 1000);
        });
    });
});
