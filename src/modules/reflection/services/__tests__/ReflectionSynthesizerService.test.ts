import { reflectionSynthesizer } from '../ReflectionSynthesizerService';
import { database } from '@/db';
import { llmService } from '@/shared/services/llm';
import { Q } from '@nozbe/watermelondb';

// Mock dependencies
jest.mock('@/db', () => ({
    database: {
        get: jest.fn(),
    },
}));

jest.mock('@/shared/services/llm', () => ({
    llmService: {
        complete: jest.fn(),
    },
    extractJson: (str: string) => str,
}));

// Mock Q
jest.mock('@nozbe/watermelondb', () => ({
    Q: {
        where: jest.fn(),
        between: jest.fn(),
        oneOf: jest.fn(),
    },
}));

describe('ReflectionSynthesizerService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should generate observations correctly', async () => {
        // Mock Interactions fetch
        const mockInteractions = [
            {
                interactionDate: new Date().getTime(),
                interactionType: 'hangout',
                duration: '2h',
                note: 'Fun time',
                interactionCategory: 'social',
                interactionFriends: {
                    fetch: jest.fn().mockResolvedValue([{ friendId: 'f1' }]),
                },
            },
        ];

        const mockFriends = [
            { id: 'f1', name: 'Alice' },
        ];

        (database.get as jest.Mock).mockReturnValue({
            query: jest.fn().mockReturnValue({
                fetch: jest.fn()
                    .mockResolvedValueOnce(mockInteractions) // First call: interactions
                    .mockResolvedValueOnce(mockFriends),     // Second call: friends
            }),
        });

        (llmService.complete as jest.Mock).mockResolvedValue({
            text: '["Observation 1", "Observation 2"]',
        });

        const result = await reflectionSynthesizer.generateWeeklyObservations(undefined, 0, 100);

        expect(result).toEqual(['Observation 1', 'Observation 2']);
        expect(llmService.complete).toHaveBeenCalled();
    });

    it('should handle empty week gracefully', async () => {
        (database.get as jest.Mock).mockReturnValue({
            query: jest.fn().mockReturnValue({
                fetch: jest.fn().mockResolvedValue([]),
            }),
        });

        const result = await reflectionSynthesizer.generateWeeklyObservations(undefined, 0, 100);

        expect(result.length).toBe(3); // Returns 3 fallback strings
        expect(result[0]).toContain("It looks like a quiet week");
    });
});
