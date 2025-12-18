
import { SocialBatteryService } from '@/modules/auth/services/social-battery.service';
import { getYearMoonData } from '@/modules/reflection/services/year-in-moons-data';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';

// Mock dependencies
jest.mock('@/db', () => ({
    database: {
        get: jest.fn(),
        write: jest.fn(),
        batch: jest.fn(),
    },
}));

// Mock notifications to avoid import errors
jest.mock('@/modules/notifications', () => ({
    SmartSuggestionsChannel: {
        evaluateAndSchedule: jest.fn(),
    },
    BatteryCheckinChannel: {
        rescheduleForTomorrow: jest.fn(),
        schedule: jest.fn(),
        cancel: jest.fn(),
    },
}));

describe('SocialBatteryService - YearInMoons Verification', () => {
    const mockUserId = 'user-123';
    let mockProfileCollection: any;
    let mockLogsCollection: any;
    let mockProfile: any;

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup mock profile
        mockProfile = {
            id: mockUserId,
            update: jest.fn((callback) => callback(mockProfile)),
            prepareUpdate: jest.fn((callback) => { callback(mockProfile); return 'profile_update_op'; }),
            socialBatteryCurrent: 0,
            socialBatteryLastCheckin: 0,
            batteryCheckinTime: '20:00',
        };

        // Setup mock collections
        mockProfileCollection = {
            find: jest.fn().mockResolvedValue(mockProfile),
            query: jest.fn().mockReturnThis(),
            fetch: jest.fn().mockResolvedValue([mockProfile]),
        };

        mockLogsCollection = {
            query: jest.fn().mockReturnThis(),
            fetch: jest.fn().mockResolvedValue([]),
            create: jest.fn(),
            prepareCreate: jest.fn((callback) => {
                const log: any = {};
                callback(log);
                return { ...log, _op: 'create_log_op' };
            }),
        };

        (database.get as jest.Mock).mockImplementation((table) => {
            if (table === 'user_profile') return mockProfileCollection;
            if (table === 'social_battery_logs') return mockLogsCollection;
            return { query: jest.fn().mockReturnThis(), fetch: jest.fn().mockResolvedValue([]) };
        });

        (database.write as jest.Mock).mockImplementation(async (callback) => await callback());
    });

    it('should correctly save a past check-in with correct timestamp', async () => {
        // Arrange
        // Simulate "tap and hold" date: 2 days ago
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 2);
        pastDate.setHours(0, 0, 0, 0); // As it comes from calendar

        const expectedTimestamp = new Date(pastDate);
        expectedTimestamp.setHours(12, 0, 0, 0); // As set in YearInMoonsModal

        const checkinValue = 4;

        // Act
        // This mirrors the call in YearInMoonsModal
        await SocialBatteryService.submitCheckin(
            mockUserId,
            checkinValue,
            undefined,
            expectedTimestamp.getTime(),
            true
        );

        // Assert
        // 1. Verify DB write was called
        expect(database.write).toHaveBeenCalled();
        expect(database.batch).toHaveBeenCalled();

        // 2. Verify log was created via prepareCreate and added to batch
        expect(mockLogsCollection.prepareCreate).toHaveBeenCalled();

        // Capture the log creation callback
        const createCallback = mockLogsCollection.prepareCreate.mock.calls[0][0];
        const mockLog: any = {};
        createCallback(mockLog);

        expect(mockLog.userId).toBe(mockUserId);
        expect(mockLog.value).toBe(checkinValue);
        expect(mockLog.timestamp).toBe(expectedTimestamp.getTime());

        // 3. Verify it's NOT just "now"
        const now = Date.now();
        expect(Math.abs(mockLog.timestamp - now)).toBeGreaterThan(86400000); // At least 24h diff
    });

    it('should delete existing logs for that specific day when overwriting', async () => {
        // Arrange
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 5);
        pastDate.setHours(12, 0, 0, 0);

        const existingLogMock = {
            markAsDeleted: jest.fn(),
            prepareMarkAsDeleted: jest.fn().mockReturnValue('delete_op')
        };
        mockLogsCollection.fetch.mockResolvedValue([existingLogMock]);

        // Act
        await SocialBatteryService.submitCheckin(mockUserId, 3, undefined, pastDate.getTime(), true);

        // Assert
        // Verify query was for the correct range (start of day to end of day of the custom timestamp)
        expect(mockLogsCollection.query).toHaveBeenCalled();
        const queryCalls = mockLogsCollection.query.mock.calls;

        // We expect one query call with 3 args (user_id, gte start, lte end)
        // Hard to inspect exact Q.where arguments without deep matching,
        // but we can verify markAsDeleted was called on the result
        expect(existingLogMock.prepareMarkAsDeleted).toHaveBeenCalled();

        // Verify batch was called with delete op
        const batchArgs = (database.batch as jest.Mock).mock.calls[0];
        expect(batchArgs).toContain('delete_op');
    });

    it('should retrieve the backfilled data correctly via getYearMoonData', async () => {
        // Arrange
        const year = 2024;
        const month = 5; // June (0-indexed)
        const day = 15;

        const targetDate = new Date(year, month, day);
        targetDate.setHours(12, 0, 0, 0); // Noon check-in

        const mockLog = {
            value: 4,
            timestamp: targetDate.getTime(),
            userId: mockUserId,
        };

        // Mock database to return this log
        mockLogsCollection.query.mockReturnThis();
        mockLogsCollection.fetch.mockResolvedValue([mockLog]);

        // Act
        const yearData = await getYearMoonData(year);

        // Assert
        const monthData = yearData[month];
        const dayData = monthData.days[day - 1]; // Days are 1-indexed in array but 0-indexed in Date usually? No, days array is 1..N

        // MonthData.days array is generated:
        // for (let day = 1; day <= daysInMonth; day++) ... days.push(...)
        // So index 0 is day 1. Index 14 is day 15.

        expect(dayData.date.getDate()).toBe(day);
        expect(dayData.hasCheckin).toBe(true);
        expect(dayData.batteryLevel).toBe(4);
    });
});
