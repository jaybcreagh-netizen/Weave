
import * as Notifications from 'expo-notifications';
import { database } from '@/db';
import { SmartSuggestionsChannel } from '../smart-suggestions';
import { notificationStore } from '../../notification-store';
import { notificationAnalytics } from '../../notification-analytics';
import { NOTIFICATION_CONFIG, NOTIFICATION_TIMING } from '../../../notification.config';
import { fetchSuggestionSurface } from '@/modules/interactions/services/SuggestionFacade';
import { isOpportunityNotificationsEnabled } from '@/modules/interactions/services/opportunity-system/flags';
import { getLastAppOpenTimestamp } from '@/shared/services/analytics.service';
import { getRecentlySurfacedFocusSuggestionIds } from '@/modules/home/services/focus-suggestion-telemetry.service';

// Mocks
jest.mock('expo-notifications');
jest.mock('@/db', () => ({
    database: {
        get: jest.fn((table: string) => ({
            query: jest.fn().mockReturnValue({
                fetch: jest.fn().mockResolvedValue(table === 'user_profile' ? [{
                    suggestionFrequency: 'balanced',
                    preferredSuggestionWindows: ['morning', 'evening'],
                    currentSocialSeason: 'balanced',
                    socialBatteryCurrent: 3,
                }] : []),
            }),
        })),
    },
}));
jest.mock('../../notification-store');
jest.mock('../../notification-analytics');
jest.mock('../../season-notifications.service', () => ({
    shouldSendNotification: jest.fn().mockReturnValue(true),
    applySeasonLimit: jest.fn((limit) => limit),
}));
jest.mock('@/modules/interactions/services/SuggestionFacade', () => ({
    fetchSuggestionSurface: jest.fn(),
}));
jest.mock('@/modules/interactions/services/opportunity-system/flags', () => ({
    isOpportunityNotificationsEnabled: jest.fn(),
}));
jest.mock('@/shared/services/analytics.service', () => {
    const actual = jest.requireActual('@/shared/services/analytics.service');
    return {
        ...actual,
        getLastAppOpenTimestamp: jest.fn(),
    };
});
jest.mock('@/modules/home/services/focus-suggestion-telemetry.service', () => ({
    getRecentlySurfacedFocusSuggestionIds: jest.fn(),
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
        jest.useRealTimers();
        (database.get as jest.Mock).mockImplementation((table: string) => ({
            query: jest.fn().mockReturnValue({
                fetch: jest.fn().mockResolvedValue(table === 'user_profile' ? [{
                    suggestionFrequency: 'balanced',
                    preferredSuggestionWindows: ['morning', 'midday', 'afternoon', 'evening', 'night'],
                    currentSocialSeason: 'balanced',
                    socialBatteryCurrent: 3,
                }] : []),
            }),
        }));
        (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('suggestion-id');
        (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockResolvedValue(undefined);
        (notificationStore.isSmartNotificationsEnabled as jest.Mock).mockResolvedValue(true);
        (notificationStore.isTypeSuppressed as jest.Mock).mockResolvedValue(false);
        (notificationStore.getDailyBudget as jest.Mock).mockResolvedValue({
            date: new Date().toDateString(),
            used: 0,
            limit: 5,
        });
        (notificationStore.getLastSmartNotificationTime as jest.Mock).mockResolvedValue(null);
        (notificationStore.getPreferences as jest.Mock).mockResolvedValue({
            quietHoursStart: 23,
            quietHoursEnd: 23,
            respectBattery: true,
            digestEnabled: true,
            digestTime: '19:00',
        });
        (notificationStore.getLegacySmartSuggestionFrequency as jest.Mock).mockResolvedValue(null);
        (notificationStore.getSmartNotificationCount as jest.Mock).mockResolvedValue(null);
        (notificationStore.getScheduledSmartNotifications as jest.Mock).mockResolvedValue(null);
        (notificationStore.checkAndIncrementBudget as jest.Mock).mockResolvedValue(true);
        (notificationStore.setScheduledSmartNotifications as jest.Mock).mockResolvedValue(undefined);
        (notificationStore.setSmartNotificationCount as jest.Mock).mockResolvedValue(undefined);
        (notificationStore.setLastSmartNotificationTime as jest.Mock).mockResolvedValue(undefined);
        (notificationAnalytics.trackScheduled as jest.Mock).mockResolvedValue(undefined);
        (fetchSuggestionSurface as jest.Mock).mockResolvedValue({
            suggestions: [],
            selectorSuggestions: [],
            surfaceSource: 'selector',
            selectionReason: 'empty',
        });
        (isOpportunityNotificationsEnabled as jest.Mock).mockReturnValue(false);
        (getLastAppOpenTimestamp as jest.Mock).mockResolvedValue(null);
        (getRecentlySurfacedFocusSuggestionIds as jest.Mock).mockResolvedValue(new Set());
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
                quietHoursStart: 0, // Midnight
                quietHoursEnd: 23, // 11 PM - effectively always quiet
                respectBattery: true,
                digestEnabled: true,
                digestTime: '19:00',
            });

            await SmartSuggestionsChannel.evaluateAndSchedule();

            expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
        });

        it('should skip when the app was opened recently', async () => {
            (getLastAppOpenTimestamp as jest.Mock).mockResolvedValue(
                Date.now() - 5 * 60 * 1000
            );
            const enabledConfig = {
                ...NOTIFICATION_CONFIG['smart-suggestions'],
                enabled: true,
            };

            await SmartSuggestionsChannel.evaluateAndSchedule(enabledConfig);

            expect(fetchSuggestionSurface).not.toHaveBeenCalled();
            expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
            expect(notificationStore.setLastSmartNotificationTime).not.toHaveBeenCalled();
        });

        it('should skip outside the preferred suggestion window', async () => {
            jest.useFakeTimers();
            jest.setSystemTime(new Date('2026-03-23T14:30:00.000Z'));
            (database.get as jest.Mock).mockImplementation((table: string) => ({
                query: jest.fn().mockReturnValue({
                    fetch: jest.fn().mockResolvedValue(table === 'user_profile' ? [{
                        suggestionFrequency: 'balanced',
                        preferredSuggestionWindows: ['morning', 'evening'],
                        currentSocialSeason: 'balanced',
                        socialBatteryCurrent: 3,
                    }] : []),
                }),
            }));

            await SmartSuggestionsChannel.evaluateAndSchedule({
                ...NOTIFICATION_CONFIG['smart-suggestions'],
                enabled: true,
            });

            expect(fetchSuggestionSurface).not.toHaveBeenCalled();
            expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

            jest.useRealTimers();
        });

        it('should schedule selector-backed smart suggestions when notification unification is enabled', async () => {
            (isOpportunityNotificationsEnabled as jest.Mock).mockReturnValue(true);
            (fetchSuggestionSurface as jest.Mock).mockResolvedValue({
                suggestions: [{
                    id: 'selector-suggestion-1',
                    friendId: 'friend-123',
                    friendName: 'Casey',
                    type: 'connect',
                    title: 'Reach out to Casey',
                    subtitle: 'They have been on your mind lately.',
                    icon: 'MessageCircle',
                    action: { type: 'connect' },
                    actionLabel: 'Reach out',
                    urgency: 'high',
                    category: 'maintain',
                    score: 88,
                }],
                selectorSuggestions: [],
                surfaceSource: 'selector',
                selectionReason: 'selected',
                selectorSuggestionMetadata: {
                    'selector-suggestion-1': {
                        compositeScore: 82,
                        scoreBreakdown: {
                            urgency: 24,
                            scheduleFit: 16,
                            batterySeasonFit: 12,
                            intentionAlignment: 10,
                            whyNowStrength: 10,
                            noveltyDiversity: 5,
                            confidence: 5,
                        },
                        surfaceSlot: 'primary',
                    },
                },
            });
            const enabledConfig = {
                ...NOTIFICATION_CONFIG['smart-suggestions'],
                enabled: true,
            };

            await SmartSuggestionsChannel.evaluateAndSchedule(enabledConfig);

            expect(fetchSuggestionSurface).toHaveBeenCalledWith(
                2,
                'balanced',
                undefined,
                { forceSelector: true, trackAnalytics: false, respectPacing: true }
            );
            expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
            expect(notificationAnalytics.trackScheduled).toHaveBeenCalledWith(
                'friend-suggestion',
                expect.stringContaining('smart-suggestion-selector-suggestion-1'),
                expect.objectContaining({
                    friendId: 'friend-123',
                    source: 'selector',
                    selectionReason: 'selected',
                })
            );
        });

        it('should skip selector notifications below the score threshold', async () => {
            (isOpportunityNotificationsEnabled as jest.Mock).mockReturnValue(true);
            (fetchSuggestionSurface as jest.Mock).mockResolvedValue({
                suggestions: [{
                    id: 'selector-suggestion-1',
                    friendId: 'friend-123',
                    friendName: 'Casey',
                    type: 'connect',
                    title: 'Reach out to Casey',
                    subtitle: 'They have been on your mind lately.',
                    icon: 'MessageCircle',
                    action: { type: 'connect' },
                    actionLabel: 'Reach out',
                    urgency: 'high',
                    category: 'maintain',
                    score: 88,
                }],
                selectorSuggestions: [],
                surfaceSource: 'selector',
                selectionReason: 'selected',
                selectorSuggestionMetadata: {
                    'selector-suggestion-1': {
                        compositeScore: 54,
                        scoreBreakdown: {
                            urgency: 20,
                            scheduleFit: 10,
                            batterySeasonFit: 10,
                            intentionAlignment: 5,
                            whyNowStrength: 4,
                            noveltyDiversity: 3,
                            confidence: 2,
                        },
                        surfaceSlot: 'primary',
                    },
                },
            });

            await SmartSuggestionsChannel.evaluateAndSchedule({
                ...NOTIFICATION_CONFIG['smart-suggestions'],
                enabled: true,
            });

            expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
            expect(notificationStore.setLastSmartNotificationTime).not.toHaveBeenCalled();
        });

        it('should not set cooldown state when selector mode finds nothing to schedule', async () => {
            (isOpportunityNotificationsEnabled as jest.Mock).mockReturnValue(true);
            (fetchSuggestionSurface as jest.Mock).mockResolvedValue({
                suggestions: [],
                selectorSuggestions: [],
                surfaceSource: 'selector',
                selectionReason: 'empty',
            });
            const enabledConfig = {
                ...NOTIFICATION_CONFIG['smart-suggestions'],
                enabled: true,
            };

            await SmartSuggestionsChannel.evaluateAndSchedule(enabledConfig);

            expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
            expect(notificationStore.setLastSmartNotificationTime).not.toHaveBeenCalled();
            expect(notificationStore.setScheduledSmartNotifications).not.toHaveBeenCalled();
        });

        it('should stay quiet when selector pacing returns an explicit quiet reason', async () => {
            (isOpportunityNotificationsEnabled as jest.Mock).mockReturnValue(true);
            (fetchSuggestionSurface as jest.Mock).mockResolvedValue({
                suggestions: [],
                selectorSuggestions: [],
                surfaceSource: 'selector',
                selectionReason: 'empty',
                quietReason: 'recently_handled',
            });

            await SmartSuggestionsChannel.evaluateAndSchedule({
                ...NOTIFICATION_CONFIG['smart-suggestions'],
                enabled: true,
            });

            expect(fetchSuggestionSurface).toHaveBeenCalledWith(
                2,
                'balanced',
                undefined,
                { forceSelector: true, trackAnalytics: false, respectPacing: true }
            );
            expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
            expect(notificationStore.setLastSmartNotificationTime).not.toHaveBeenCalled();
            expect(notificationStore.setScheduledSmartNotifications).not.toHaveBeenCalled();
        });

        it('should skip suggestions that were surfaced in Focus recently', async () => {
            (isOpportunityNotificationsEnabled as jest.Mock).mockReturnValue(true);
            (getRecentlySurfacedFocusSuggestionIds as jest.Mock).mockResolvedValue(
                new Set(['selector-suggestion-1'])
            );
            (fetchSuggestionSurface as jest.Mock).mockResolvedValue({
                suggestions: [{
                    id: 'selector-suggestion-1',
                    friendId: 'friend-123',
                    friendName: 'Casey',
                    type: 'connect',
                    title: 'Reach out to Casey',
                    subtitle: 'They have been on your mind lately.',
                    icon: 'MessageCircle',
                    action: { type: 'connect' },
                    actionLabel: 'Reach out',
                    urgency: 'high',
                    category: 'maintain',
                    score: 88,
                }],
                selectorSuggestions: [],
                surfaceSource: 'selector',
                selectionReason: 'selected',
            });

            await SmartSuggestionsChannel.evaluateAndSchedule({
                ...NOTIFICATION_CONFIG['smart-suggestions'],
                enabled: true,
            });

            expect(getRecentlySurfacedFocusSuggestionIds).toHaveBeenCalledWith(
                NOTIFICATION_TIMING.smartSuggestions.recentFocusSuggestionSurfaceCooldownMs
            );
            expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
            expect(notificationStore.setLastSmartNotificationTime).not.toHaveBeenCalled();
        });

        it('should respect legacy cadence until the profile frequency is set', async () => {
            (isOpportunityNotificationsEnabled as jest.Mock).mockReturnValue(true);
            (notificationStore.getLegacySmartSuggestionFrequency as jest.Mock).mockResolvedValue('light');
            (fetchSuggestionSurface as jest.Mock).mockResolvedValue({
                suggestions: [
                    {
                        id: 'selector-suggestion-1',
                        friendId: 'friend-123',
                        friendName: 'Casey',
                        type: 'connect',
                        title: 'Reach out to Casey',
                        subtitle: 'They have been on your mind lately.',
                        icon: 'MessageCircle',
                        action: { type: 'connect' },
                        actionLabel: 'Reach out',
                        urgency: 'high',
                        category: 'maintain',
                        score: 88,
                    },
                    {
                        id: 'selector-suggestion-2',
                        friendId: 'friend-456',
                        friendName: 'Jordan',
                        type: 'connect',
                        title: 'Reach out to Jordan',
                        subtitle: 'They have been on your mind lately.',
                        icon: 'MessageCircle',
                        action: { type: 'connect' },
                        actionLabel: 'Reach out',
                        urgency: 'medium',
                        category: 'maintain',
                        score: 76,
                    },
                ],
                selectorSuggestions: [],
                surfaceSource: 'selector',
                selectionReason: 'selected',
                selectorSuggestionMetadata: {
                    'selector-suggestion-1': {
                        compositeScore: 82,
                        scoreBreakdown: {
                            urgency: 24,
                            scheduleFit: 16,
                            batterySeasonFit: 12,
                            intentionAlignment: 10,
                            whyNowStrength: 10,
                            noveltyDiversity: 5,
                            confidence: 5,
                        },
                        surfaceSlot: 'primary',
                    },
                },
            });

            await SmartSuggestionsChannel.evaluateAndSchedule({
                ...NOTIFICATION_CONFIG['smart-suggestions'],
                enabled: true,
            });

            expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
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
                params: { friendId: 'friend-123' },
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
            expect(NOTIFICATION_TIMING.smartSuggestions.recentAppOpenCooldownMs).toBe(30 * 60 * 1000);
            expect(NOTIFICATION_TIMING.smartSuggestions.recentFocusSuggestionSurfaceCooldownMs).toBe(6 * 60 * 60 * 1000);
            expect(NOTIFICATION_TIMING.smartSuggestions.recentInteractionCooldownMs).toBe(24 * 60 * 60 * 1000);
            expect(NOTIFICATION_TIMING.smartSuggestions.plannedWeaveWindowMs).toBe(7 * 24 * 60 * 60 * 1000);
        });
    });
});
