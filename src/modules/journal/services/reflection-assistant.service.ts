import { llmService } from '@/shared/services/llm';
import { getPrompt, interpolatePrompt } from '@/shared/services/llm/prompt-registry';
import { logger } from '@/shared/services/logger.service';
import { PromptEngineInput } from '@/modules/reflection/services/prompt-engine';

const PROMPT_ID = 'weekly_reflection_draft';

export interface ReflectionAssistantOptions {
    timeoutMs?: number;
    signal?: AbortSignal;
}

export const ReflectionAssistant = {
    /**
     * Generate a draft reflection based on the week's stats.
     */
    async generateDraft(
        input: PromptEngineInput,
        promptQuestion: string,
        options: ReflectionAssistantOptions = {}
    ): Promise<string> {
        if (!llmService.isAvailable()) {
            throw new Error('LLM service not available');
        }

        const { timeoutMs = 10000, signal } = options;

        try {
            const promptDef = getPrompt(PROMPT_ID);
            if (!promptDef) {
                // Fallback if prompt not flagged in registry yet
                // In production this should be in registry
                return this.generateFallbackDraft(input);
            }

            // Format input for the prompt
            const context = {
                totalWeaves: input.totalWeaves,
                friendsContacted: input.friendsContacted,
                topFriend: input.topFriend ? `${input.topFriend.name} (${input.topFriend.weaveCount} times)` : 'None',
                reconnected: input.reconnectedFriend ? input.reconnectedFriend.name : 'None',
                promptQuestion: promptQuestion,
            };

            const userPrompt = interpolatePrompt(promptDef.userPromptTemplate, context);

            const response = await llmService.complete(
                {
                    system: promptDef.systemPrompt,
                    user: userPrompt,
                },
                {
                    temperature: 0.7,
                    maxTokens: 150,
                    timeoutMs,
                    signal,
                }
            );

            return response.text.trim().replace(/^["']|["']$/g, ''); // Remove quotes if any
        } catch (error) {
            logger.error('ReflectionAssistant', 'Error generating draft:', error);
            throw error;
        }
    },
    /**
     * Generate a draft reflection for a specific interaction.
     */
    async generateInteractionDraft(
        friendName: string,
        activity: string,
        vibe: string | null,
        options: ReflectionAssistantOptions = {}
    ): Promise<string> {
        if (!llmService.isAvailable()) {
            throw new Error('LLM service not available');
        }

        const { timeoutMs = 10000, signal } = options;
        const PROMPT_ID = 'interaction_reflection_draft';

        try {
            const promptDef = getPrompt(PROMPT_ID);
            if (!promptDef) {
                // Fallback
                return `Caught up with ${friendName} for ${activity}. It was good to connect.`;
            }

            const context = {
                friendName,
                activity,
                vibe: vibe || 'Neutral',
            };

            const userPrompt = interpolatePrompt(promptDef.userPromptTemplate, context);

            const response = await llmService.complete(
                {
                    system: promptDef.systemPrompt,
                    user: userPrompt,
                },
                {
                    temperature: 0.7,
                    maxTokens: 100,
                    timeoutMs,
                    signal,
                }
            );

            return response.text.trim().replace(/^["']|["']$/g, '');
        } catch (error) {
            logger.error('ReflectionAssistant', 'Error generating interaction draft:', error);
            throw error;
        }
    },

    /**
     * Simple rule-based fallback if LLM fails
     */
    generateFallbackDraft(input: PromptEngineInput): string {
        if (input.totalWeaves === 0) {
            return "It was a quiet week, which I probably needed. I'm looking forward to reconnecting with friends next week.";
        }

        if (input.topFriend) {
            return `I'm really glad I got to spend so much time with ${input.topFriend.name} this week. It made me feel more connected.`;
        }

        return `I'm grateful for the ${input.totalWeaves} connections I had this week. It feels good to stay in touch.`;
    }
};
