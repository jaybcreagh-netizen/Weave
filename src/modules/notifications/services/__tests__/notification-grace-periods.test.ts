
import { database } from '@/db';
import * as gracePeriods from '../notification-grace-periods';

// Mock database
jest.mock('@/db', () => ({
    database: {
        get: jest.fn(),
    },
}));

describe('Notification Grace Periods', () => {
    let mockFetch: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        mockFetch = jest.fn();
        (database.get as jest.Mock).mockReturnValue({
            query: jest.fn().mockReturnValue({
                fetch: mockFetch,
            }),
        });
    });

    describe('shouldSendWeeklyReflectionNotification', () => {
        it('should return false if interaction count is < 3', async () => {
            mockFetch.mockResolvedValue([
                { status: 'completed' },
                { status: 'completed' },
            ]);
            const result = await gracePeriods.shouldSendWeeklyReflectionNotification();
            expect(result.shouldSend).toBe(false);
            expect(result.reason).toContain('User has only 2 interactions');
        });

        it('should return true if interaction count is >= 3', async () => {
            mockFetch.mockResolvedValue([
                { status: 'completed' },
                { status: 'completed' },
                { status: 'completed' },
            ]);
            const result = await gracePeriods.shouldSendWeeklyReflectionNotification();
            expect(result.shouldSend).toBe(true);
        });
    });

    describe('shouldSendSocialBatteryNotification', () => {
        it('should return false if interaction count is < 3', async () => {
            mockFetch.mockResolvedValue([
                { status: 'completed' },
            ]);
            const result = await gracePeriods.shouldSendSocialBatteryNotification();
            expect(result.shouldSend).toBe(false);
            expect(result.reason).toContain('User has only 1 interactions');
        });

        it('should return true if interaction count is >= 3', async () => {
            mockFetch.mockResolvedValue([
                { status: 'completed' },
                { status: 'completed' },
                { status: 'completed' },
            ]);
            const result = await gracePeriods.shouldSendSocialBatteryNotification();
            expect(result.shouldSend).toBe(true);
        });
    });

    describe('shouldSendAmbientLoggingNotification', () => {
        it('should return false if friend count is < 2', async () => {
            mockFetch.mockResolvedValue([
                { id: '1' },
            ]);
            const result = await gracePeriods.shouldSendAmbientLoggingNotification();
            expect(result.shouldSend).toBe(false);
            expect(result.reason).toContain('User has only 1 friends');
        });

        it('should return true if friend count is >= 2', async () => {
            mockFetch.mockResolvedValue([
                { id: '1' },
                { id: '2' },
            ]);
            const result = await gracePeriods.shouldSendAmbientLoggingNotification();
            expect(result.shouldSend).toBe(true);
        });
    });

    describe('shouldSendGeneralNotification', () => {
        it('should return false if interaction count is < 1', async () => {
            mockFetch.mockResolvedValue([]);
            const result = await gracePeriods.shouldSendGeneralNotification();
            expect(result.shouldSend).toBe(false);
            expect(result.reason).toContain('User has only 0 interactions');
        });

        it('should return true if interaction count is >= 1', async () => {
            mockFetch.mockResolvedValue([
                { status: 'completed' },
            ]);
            const result = await gracePeriods.shouldSendGeneralNotification();
            expect(result.shouldSend).toBe(true);
        });
    });
});
