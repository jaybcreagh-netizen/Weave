
import { extractSignals, SignalExtractionResult } from '../signal-extractor';
import { llmService } from '@/shared/services/llm';
import { getPrompt } from '@/shared/services/llm/prompt-registry';

// Mock dependencies
jest.mock('@/shared/services/llm', () => ({
    llmService: {
        isAvailable: jest.fn(),
        complete: jest.fn()
    }
}));

jest.mock('@/shared/services/llm/prompt-registry', () => ({
    getPrompt: jest.fn(),
    interpolatePrompt: jest.fn()
}));

jest.mock('@/shared/utils/Logger', () => ({
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn()
}));

describe('SignalExtractor', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (llmService.isAvailable as jest.Mock).mockReturnValue(true);
    });

    it('should use LLM when available and enabled', async () => {
        const mockPromptDef = {
            id: 'signal_extraction',
            version: '1.0.0',
            systemPrompt: 'System prompt'
        };
        (getPrompt as jest.Mock).mockReturnValue(mockPromptDef);

        const mockLLMResponse = {
            text: JSON.stringify({
                sentiment: 1,
                core_themes: ['gratitude'],
                emergent_themes: ['fun'],
                dynamics: { reciprocitySignal: 'balanced' }
            })
        };
        (llmService.complete as jest.Mock).mockResolvedValue(mockLLMResponse);

        const result = await extractSignals('I had a great time with Sarah today!', true);

        expect(llmService.complete).toHaveBeenCalled();
        expect(result.sentiment).toBe(1);
        expect(result.sentimentLabel).toBe('positive');
        expect(result.coreThemes).toContain('gratitude');
        expect(result.extractorVersion).toContain('llm-');
    });

    it('should fall back to rules if LLM throws', async () => {
        (getPrompt as jest.Mock).mockReturnValue({}); // Mock return
        (llmService.complete as jest.Mock).mockRejectedValue(new Error('API failure'));

        const result = await extractSignals('I hate this argmuent, I am so sad and angry.', true);

        expect(result.extractorVersion).toContain('rule-');
        expect(result.sentiment).toBe(-2); // "hate", "sad", "angry" -> negative
    });

    it('should use rules if AI is disabled', async () => {
        const result = await extractSignals('Best day ever!', false);

        expect(llmService.complete).not.toHaveBeenCalled();
        expect(result.extractorVersion).toContain('rule-');
    });

    it('should extract correct sentiment via rules', async () => {
        const positive = await extractSignals('Great fun love happy', false);
        expect(positive.sentiment).toBeGreaterThan(0);

        const negative = await extractSignals('Sad angry hate bad', false);
        expect(negative.sentiment).toBeLessThan(0);
    });

    it('should extract themes via rules', async () => {
        const result = await extractSignals('Thanks for the birthday party!', false);
        expect(result.coreThemes).toContain('gratitude');
        expect(result.coreThemes).toContain('celebration');
    });
});
