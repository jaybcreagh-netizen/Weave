import { ReflectionAssistant } from '../reflection-assistant.service';
import { llmService } from '@/shared/services/llm';
import { intelligenceCapabilitiesService } from '@/modules/intelligence/services/intelligence-capabilities.service';

jest.mock('@/shared/services/llm', () => ({
    llmService: {
        complete: jest.fn(),
        isAvailable: jest.fn(() => true),
    },
}));

jest.mock('@/shared/services/llm/prompt-registry', () => ({
    getPrompt: jest.fn(() => null),
    interpolatePrompt: jest.fn(),
}));

jest.mock('@/modules/intelligence/services/intelligence-capabilities.service', () => ({
    intelligenceCapabilitiesService: {
        getCapabilitiesForCurrentProfile: jest.fn(),
    },
}));

describe('ReflectionAssistant', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns a local weekly draft when guided AI is disabled', async () => {
        (intelligenceCapabilitiesService.getCapabilitiesForCurrentProfile as jest.Mock).mockResolvedValue({
            guidedReflectionEnabled: false,
        });

        const draft = await ReflectionAssistant.generateDraft(
            {
                totalWeaves: 4,
                friendsContacted: 2,
                topFriend: { id: 'f1', name: 'Alice', weaveCount: 2 },
                isQuietWeek: false,
                weekStreak: 3,
            },
            'What stood out this week?'
        );

        expect(llmService.complete).not.toHaveBeenCalled();
        expect(draft).toContain('Alice');
    });

    it('returns a local interaction draft when guided AI is disabled', async () => {
        (intelligenceCapabilitiesService.getCapabilitiesForCurrentProfile as jest.Mock).mockResolvedValue({
            guidedReflectionEnabled: false,
        });

        const draft = await ReflectionAssistant.generateInteractionDraft(
            'Alice',
            'coffee',
            'great'
        );

        expect(llmService.complete).not.toHaveBeenCalled();
        expect(draft).toContain('Alice');
    });
});
