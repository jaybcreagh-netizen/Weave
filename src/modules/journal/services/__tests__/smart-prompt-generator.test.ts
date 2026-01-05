/**
 * Tests for smart-prompt-generator.ts
 */

import { generateSmartPrompt, generateSmartPromptsWithAlternatives } from '../smart-prompt-generator'
import { PromptContext } from '../journal-prompts'
import { llmService } from '@/shared/services/llm'

// Mock the LLM service
jest.mock('@/shared/services/llm', () => ({
    llmService: {
        isAvailable: jest.fn(),
        complete: jest.fn(),
    },
}))

// Mock the prompt registry
jest.mock('@/shared/services/llm/prompt-registry', () => ({
    getPrompt: jest.fn().mockReturnValue({
        systemPrompt: 'You are a journal assistant',
        userPromptTemplate: 'Generate a prompt for {{friendName}}',
        defaultOptions: { maxTokens: 80, temperature: 0.8 },
    }),
    interpolatePrompt: jest.fn().mockReturnValue('Generated prompt'),
}))

describe('SmartPromptGenerator', () => {
    const mockLlmService = llmService as jest.Mocked<typeof llmService>

    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('generateSmartPrompt', () => {
        const generalContext: PromptContext = { type: 'general' }

        describe('when AI is disabled', () => {
            it('should use fallback immediately', async () => {
                const result = await generateSmartPrompt(generalContext, false)

                expect(result.source).toBe('fallback')
                expect(result.prompt).toBeDefined()
                expect(result.prompt.type).toBe('general')
                expect(mockLlmService.complete).not.toHaveBeenCalled()
            })
        })

        describe('when skipLLM is true', () => {
            it('should use fallback immediately', async () => {
                const result = await generateSmartPrompt(generalContext, true, { skipLLM: true })

                expect(result.source).toBe('fallback')
                expect(mockLlmService.complete).not.toHaveBeenCalled()
            })
        })

        describe('when LLM is not available', () => {
            it('should use fallback', async () => {
                mockLlmService.isAvailable.mockReturnValue(false)

                const result = await generateSmartPrompt(generalContext, true)

                expect(result.source).toBe('fallback')
                expect(mockLlmService.complete).not.toHaveBeenCalled()
            })
        })

        describe('when LLM is available', () => {
            beforeEach(() => {
                mockLlmService.isAvailable.mockReturnValue(true)
            })

            it('should call LLM and return result on success', async () => {
                mockLlmService.complete.mockResolvedValue({
                    text: 'What made today special with your friend?',
                    usage: { promptTokens: 50, completionTokens: 10, totalTokens: 60 },
                    metadata: { model: 'test', provider: 'test' },
                } as any)

                const result = await generateSmartPrompt(generalContext, true)

                expect(result.source).toBe('llm')
                expect(result.prompt.question).toBe('What made today special with your friend?')
                expect(result.generationTimeMs).toBeDefined()
                expect(mockLlmService.complete).toHaveBeenCalled()
            })

            it('should fall back on LLM error', async () => {
                mockLlmService.complete.mockRejectedValue(new Error('Network error'))

                const result = await generateSmartPrompt(generalContext, true)

                expect(result.source).toBe('fallback')
                expect(result.prompt).toBeDefined()
            })

            it('should fall back on empty LLM response', async () => {
                mockLlmService.complete.mockResolvedValue({
                    text: '',
                    usage: { promptTokens: 50, completionTokens: 0, totalTokens: 50 },
                    metadata: { model: 'test', provider: 'test' },
                } as any)

                const result = await generateSmartPrompt(generalContext, true)

                expect(result.source).toBe('fallback')
            })

            it('should truncate long prompts', async () => {
                const longPrompt = 'A'.repeat(200)
                mockLlmService.complete.mockResolvedValue({
                    text: longPrompt,
                    usage: { promptTokens: 50, completionTokens: 50, totalTokens: 100 },
                    metadata: { model: 'test', provider: 'test' },
                } as any)

                const result = await generateSmartPrompt(generalContext, true)

                expect(result.prompt.question.length).toBeLessThanOrEqual(150)
            })
        })
    })

    describe('generateSmartPromptsWithAlternatives', () => {
        it('should return primary prompt plus alternatives', async () => {
            mockLlmService.isAvailable.mockReturnValue(true)
            mockLlmService.complete.mockResolvedValue({
                text: 'LLM generated prompt',
                usage: { promptTokens: 50, completionTokens: 10, totalTokens: 60 },
                metadata: { model: 'test', provider: 'test' },
            } as any)

            const result = await generateSmartPromptsWithAlternatives(
                { type: 'general' },
                true
            )

            expect(result.primary).toBeDefined()
            expect(result.alternatives).toBeDefined()
            expect(Array.isArray(result.alternatives)).toBe(true)
        })

        it('should not include duplicates in alternatives', async () => {
            mockLlmService.isAvailable.mockReturnValue(false) // Force fallback

            const result = await generateSmartPromptsWithAlternatives(
                { type: 'general' },
                true
            )

            const allQuestions = [
                result.primary.prompt.question,
                ...result.alternatives.map(p => p.question)
            ]
            const uniqueQuestions = new Set(allQuestions)

            expect(uniqueQuestions.size).toBe(allQuestions.length)
        })
    })
})
