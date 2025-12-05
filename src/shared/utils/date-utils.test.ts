import { parseFlexibleDate } from './date-utils';

describe('parseFlexibleDate', () => {
    // 1. Legacy MM-DD format
    it('parses valid MM-DD format', () => {
        expect(parseFlexibleDate('01-31')).toEqual({ month: 1, day: 31 });
        expect(parseFlexibleDate('12-25')).toEqual({ month: 12, day: 25 });
        expect(parseFlexibleDate('02-28')).toEqual({ month: 2, day: 28 });
        expect(parseFlexibleDate('5-5')).toEqual({ month: 5, day: 5 }); // Single digits
    });

    it('returns null for invalid MM-DD values', () => {
        expect(parseFlexibleDate('13-01')).toBeNull(); // Invalid month
        expect(parseFlexibleDate('12-32')).toBeNull(); // Invalid day
        expect(parseFlexibleDate('00-05')).toBeNull(); // Invalid month 0
        expect(parseFlexibleDate('05-00')).toBeNull(); // Invalid day 0
    });

    // 2. ISO 8601 Strings
    it('parses valid ISO date strings', () => {
        // 2023-01-31
        expect(parseFlexibleDate('2023-01-31T00:00:00.000Z')).toEqual({ month: 1, day: 31 });
        // 1990-12-25
        expect(parseFlexibleDate('1990-12-25T10:30:00.000Z')).toEqual({ month: 12, day: 25 });
    });

    // 3. Date Objects
    it('parses Date objects', () => {
        const date = new Date('2023-10-15T00:00:00.000Z');
        expect(parseFlexibleDate(date)).toEqual({ month: 10, day: 15 });
    });

    // 4. Edge Cases & Invalid Inputs
    it('returns null for null/undefined/empty', () => {
        expect(parseFlexibleDate(null)).toBeNull();
        expect(parseFlexibleDate(undefined)).toBeNull();
        expect(parseFlexibleDate('')).toBeNull();
    });

    it('returns null for truly invalid strings', () => {
        expect(parseFlexibleDate('not-a-date')).toBeNull();
        expect(parseFlexibleDate('invalid')).toBeNull();
    });
});
