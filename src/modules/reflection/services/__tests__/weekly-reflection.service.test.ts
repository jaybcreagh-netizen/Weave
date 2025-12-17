
import { isCurrentWeek, getWeekRange } from '../weekly-reflection.service';

describe('Weekly Reflection Service', () => {
    describe('isCurrentWeek', () => {
        it('should return true if current date is within range', () => {
            const now = Date.now();
            const mockReflection = {
                weekStartDate: now - 3600000,
                weekEndDate: now + 3600000,
            } as any;
            expect(isCurrentWeek(mockReflection)).toBe(true);
        });

        it('should return false if current date is outside range', () => {
            const now = Date.now();
            const mockReflection = {
                weekStartDate: now - 7200000,
                weekEndDate: now - 3600000,
            } as any;
            expect(isCurrentWeek(mockReflection)).toBe(false);
        });
    });

    describe('getWeekRange', () => {
        it('should format date range correctly', () => {
            const start = new Date('2023-01-01T12:00:00');
            const end = new Date('2023-01-07T12:00:00');
            const mockReflection = {
                weekStartDate: start.getTime(),
                weekEndDate: end.getTime(),
            } as any;

            const range = getWeekRange(mockReflection);
            // Expected format: "Jan 1 - Jan 7, 2023" (depending on locale/impl)
            // Implementation uses toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            expect(range).toContain('Jan 1 - Jan 7, 2023');
        });
    });
});
