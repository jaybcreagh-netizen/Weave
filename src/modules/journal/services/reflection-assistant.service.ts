import { llmService } from '@/shared/services/llm';
import { getPrompt, interpolatePrompt } from '@/shared/services/llm/prompt-registry';
import { logger } from '@/shared/services/logger.service';
import { PromptEngineInput } from '@/modules/reflection/services/prompt-engine';
import { intelligenceCapabilitiesService } from '@/modules/intelligence/services/intelligence-capabilities.service';

const PROMPT_ID = 'weekly_reflection_draft';

export interface ReflectionAssistantOptions {
    timeoutMs?: number;
    signal?: AbortSignal;
}

export interface WeekContext {
    observations?: string[];
    narrative?: string;
}

export const ReflectionAssistant = {
    /**
     * Generate a draft reflection based on the week's stats and Oracle context.
     */
    async generateDraft(
        input: PromptEngineInput,
        promptQuestion: string,
        weekContext: WeekContext = {},
        options: ReflectionAssistantOptions = {}
    ): Promise<string> {
        const { timeoutMs = 45000, signal } = options;
        const capabilities = await intelligenceCapabilitiesService.getCapabilitiesForCurrentProfile();

        if (!capabilities.guidedReflectionEnabled || !llmService.isAvailable()) {
            return this.generateFallbackDraft(input, promptQuestion, weekContext);
        }

        try {
            const promptDef = getPrompt(PROMPT_ID);
            if (!promptDef) {
                return this.generateFallbackDraft(input, promptQuestion, weekContext);
            }

            const context = {
                totalWeaves: input.totalWeaves,
                friendsContacted: input.friendsContacted,
                topFriend: input.topFriend ? `${input.topFriend.name} (${input.topFriend.weaveCount} times)` : 'None',
                reconnected: input.reconnectedFriend ? input.reconnectedFriend.name : 'None',
                topActivity: input.topActivity || 'mixed activities',
                weekStreak: input.weekStreak || 0,
                promptQuestion: promptQuestion,
                observations: weekContext.observations?.length
                    ? weekContext.observations.join('\n- ')
                    : '',
                narrative: weekContext.narrative || '',
            };

            const userPrompt = interpolatePrompt(promptDef.userPromptTemplate, context);

            const response = await llmService.complete(
                {
                    system: promptDef.systemPrompt,
                    user: userPrompt,
                },
                {
                    temperature: 0.7,
                    maxTokens: 1000,
                    timeoutMs,
                    signal,
                }
            );

            return response.text.trim().replace(/^["']|["']$/g, '');
        } catch (error) {
            logger.error('ReflectionAssistant', 'Error generating draft:', error);
            return this.generateFallbackDraft(input, promptQuestion, weekContext);
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
        const { timeoutMs = 30000, signal } = options;
        const PROMPT_ID = 'interaction_reflection_draft';
        const capabilities = await intelligenceCapabilitiesService.getCapabilitiesForCurrentProfile();

        if (!capabilities.guidedReflectionEnabled || !llmService.isAvailable()) {
            return this.generateInteractionFallbackDraft(friendName, activity, vibe);
        }

        try {
            const promptDef = getPrompt(PROMPT_ID);
            if (!promptDef) {
                return this.generateInteractionFallbackDraft(friendName, activity, vibe);
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
                    maxTokens: 250,
                    timeoutMs,
                    signal,
                }
            );

            return response.text.trim().replace(/^["']|["']$/g, '');
        } catch (error) {
            logger.error('ReflectionAssistant', 'Error generating interaction draft:', error);
            return this.generateInteractionFallbackDraft(friendName, activity, vibe);
        }
    },

    /**
     * Simple rule-based fallback if LLM fails
     */
    generateFallbackDraft(
        input: PromptEngineInput,
        promptQuestion?: string,
        weekContext: WeekContext = {}
    ): string {
        if (input.totalWeaves === 0) {
            return "This week felt quieter on the surface, and I think I may have needed some of that space. I'm noticing who I've been missing and what kind of connection I want to make room for next.";
        }

        if (input.reconnectedFriend) {
            return `Reconnecting with ${input.reconnectedFriend.name} reminded me that even a small reach-out can reopen something meaningful. I want to hold onto that feeling as I move into next week.`;
        }

        if (input.topFriend) {
            return `Spending time with ${input.topFriend.name} reminded me how grounding it feels to return to certain people. Those moments helped me feel more connected and present this week.`;
        }

        if (weekContext.observations?.length) {
            return `I'm noticing a pattern in how this week unfolded: ${weekContext.observations[0].replace(/\.$/, '')}. I want to stay curious about what that says about the kind of connection I need right now.`;
        }

        if (promptQuestion) {
            return `When I sit with this question, ${promptQuestion.toLowerCase()} feels less like something to solve and more like something to notice. There was at least one real moment of connection here, even if it was easy to miss at the time.`;
        }

        return `I'm grateful for the ${input.totalWeaves} connections I had this week. It feels good to stay in touch.`;
    },

    generateInteractionFallbackDraft(
        friendName: string,
        activity: string,
        vibe: string | null
    ): string {
        if (vibe === 'great' || vibe === 'energized' || vibe === 'joyful') {
            return `Spending time with ${friendName} through ${activity} left me feeling genuinely lifted. It reminded me why this connection matters to me.`;
        }

        if (vibe === 'heavy' || vibe === 'tense' || vibe === 'drained') {
            return `${activity} with ${friendName} brought up more for me than I expected. I want to be honest about what felt hard while also paying attention to what the moment was asking of me.`;
        }

        return `I spent time with ${friendName} through ${activity}, and it gave me a chance to notice how this connection feels right now. Even a simple moment can tell me something about what I want more of.`;
    },
};
