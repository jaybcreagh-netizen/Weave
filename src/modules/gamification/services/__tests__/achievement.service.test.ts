
// Mock uuid to avoid ESM issues
jest.mock('uuid', () => ({
    v4: () => 'test-uuid-' + Math.random(),
}));

import { checkAndAwardGlobalAchievements, checkHiddenAchievements } from '../achievement.service';
import { database } from '@/db';
import { getAchievementById, GLOBAL_ACHIEVEMENTS } from '../../constants/achievement-definitions';

// Mock dependencies
jest.mock('@/db', () => ({
    database: {
        get: jest.fn(),
        write: jest.fn(),
    },
}));
jest.mock('../../constants/achievement-definitions', () => ({
    GLOBAL_ACHIEVEMENTS: [
        { id: 'global_1', threshold: 10, calculateProgress: jest.fn() },
    ],
    getAchievementById: jest.fn(),
    HIDDEN_ACHIEVEMENTS: [],
}));

describe('Achievement Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('checkAndAwardGlobalAchievements', () => {
        it('should award new global achievements when threshold is met', async () => {
            // Mock user progress
            const mockUserProgress = {
                globalAchievements: [], // None unlocked
                update: jest.fn(),
            };
            const mockCollection = {
                query: jest.fn().mockReturnThis(),
                fetch: jest.fn().mockResolvedValue([mockUserProgress]),
                create: jest.fn(),
            };
            (database.get as jest.Mock).mockReturnValue(mockCollection);
            (database.write as jest.Mock).mockImplementation((callback) => callback());

            // Mock calculation to return sufficient progress
            const mockAchievement = GLOBAL_ACHIEVEMENTS[0];
            (mockAchievement.calculateProgress as jest.Mock).mockResolvedValue(15); // Threshold is 10

            const result = await checkAndAwardGlobalAchievements();

            expect(result).toHaveLength(1);
            expect(result[0].achievement.id).toBe('global_1');
            expect(mockUserProgress.update).toHaveBeenCalled();
        });

        it('should ignore already unlocked achievements', async () => {
            // Mock user progress with achievement already unlocked
            const mockUserProgress = {
                globalAchievements: ['global_1'],
                update: jest.fn(),
            };
            const mockCollection = {
                query: jest.fn().mockReturnThis(),
                fetch: jest.fn().mockResolvedValue([mockUserProgress]),
            };
            (database.get as jest.Mock).mockReturnValue(mockCollection);

            const result = await checkAndAwardGlobalAchievements();

            expect(result).toHaveLength(0);
        });
    });

    describe('checkHiddenAchievements', () => {
        it('should award night_owl for interaction at 2 AM', async () => {
            const mockUserProgress = {
                hiddenAchievements: [],
                update: jest.fn(),
            };
            const mockCollection = {
                query: jest.fn().mockReturnThis(),
                fetch: jest.fn().mockResolvedValue([mockUserProgress]),
                create: jest.fn(),
            };
            (database.get as jest.Mock).mockReturnValue(mockCollection);
            (database.write as jest.Mock).mockImplementation((callback) => callback());
            (getAchievementById as jest.Mock).mockReturnValue({ id: 'night_owl' });

            const mockInteraction = {
                interactionDate: new Date('2023-01-01T02:30:00'), // 2:30 AM
                duration: 'Short',
            } as any;

            const result = await checkHiddenAchievements({
                type: 'interaction_logged',
                interaction: mockInteraction,
            });

            expect(result).toHaveLength(1);
            expect(result[0].achievement.id).toBe('night_owl');
        });
    });
});
