import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import Interaction from '@/db/models/Interaction';
import Friend from '@/db/models/Friend';
import { llmService, extractJson } from '@/shared/services/llm';
import { logger } from '@/shared/services/logger.service';

/**
 * Service to synthesize network observations for Weekly Reflections.
 * Uses Oracle (LLM) to analyze the week's interactions and generate insights.
 */
class ReflectionSynthesizerService {
    /**
     * Generate 3-4 bullet point observations about the user's social week.
     * @param userId User's ID
     * @param weekStart Timestamp (ms)
     * @param weekEnd Timestamp (ms)
     * @returns Array of observation strings
     */
    async generateWeeklyObservations(
        userId: string | undefined, // For future multi-user support, currently optional
        weekStart: number,
        weekEnd: number
    ): Promise<string[]> {
        try {
            // 1. Fetch data for the week
            const interactions = await database.get<Interaction>('interactions').query(
                Q.where('interaction_date', Q.between(weekStart, weekEnd)),
                Q.where('status', 'completed') // Only completed interactions
            ).fetch();

            if (interactions.length === 0) {
                return [
                    "It looks like a quiet week for your social weave.",
                    "Rest is just as important as connection.",
                    "Consider reaching out to one person next week to spark the momentum."
                ];
            }

            // 2. Prepare context for LLM
            const friendIdsSet = new Set<string>();

            const interactionSummaries = await Promise.all(interactions.map(async (i) => {
                const iFriends = await i.interactionFriends.fetch();
                const names = iFriends.map(f => {
                    friendIdsSet.add(f.friendId);
                    return f.friendId;
                });

                return {
                    date: new Date(i.interactionDate).toLocaleDateString(),
                    type: i.interactionType,
                    friendIds: names,
                    duration: i.duration || 'unknown',
                    note: i.note || 'none',
                    category: i.interactionCategory || 'N/A'
                };
            }));

            // Bulk fetch friends for names
            const friends = await database.get<Friend>('friends').query(Q.where('id', Q.oneOf(Array.from(friendIdsSet)))).fetch();
            const friendMap = new Map(friends.map(f => [f.id, f.name]));

            // Format summaries with names
            const formattedSummaries = interactionSummaries.map(s => {
                const names = s.friendIds.map(id => friendMap.get(id) || 'Unknown').join(', ');
                return `- ${s.date}: ${s.type} with ${names} (${s.duration}). Note: ${s.note}. Category: ${s.category}.`;
            });

            // 3. Construct Prompt
            const prompt = `
You are the Oracle, a mindful relationship companion.
Analyze the user's social interactions for this week and generate 3-4 short, insightful observations (Network Observations).

Context:
- The user is reflecting on their week.
- Focus on patterns, balance, effort, or lack thereof.
- Be gentle, grounded, and observant. Not judgmental.
- If they saw many people, note the energy. If few, note the depth or rest.

Interactions this week:
${formattedSummaries.join('\n')}

Output format:
JSON array of strings. Example: ["You focused heavily on inner circle friends this week.", "Sunday's brunch with Sarah seemd like a highlight."]
Do not include markdown formatting. Just the raw JSON.
`;

            // 4. Call LLM
            const response = await llmService.complete({
                system: 'You are the Oracle, a mindful relationship companion.',
                user: prompt
            }, {
                temperature: 0.7
            });

            // 5. Parse and Return
            // Check if response has text or content
            const content = response.text || (response as any).content || JSON.stringify(response);
            const jsonStr = extractJson(content);
            const observations = JSON.parse(jsonStr);

            if (Array.isArray(observations) && observations.every(o => typeof o === 'string')) {
                return observations.slice(0, 4); // Limit to 4
            } else {
                logger.warn('ReflectionSynthesizer', 'LLM returned invalid format', observations);
                return ["Your weave was active this week.", "Take a moment to cherish these connections."]; // Fallback
            }

        } catch (error) {
            logger.error('ReflectionSynthesizer', 'Failed to generate observations', error);
            return []; // Return empty on error to handle gracefully in UI
        }
    }
}

export const reflectionSynthesizer = new ReflectionSynthesizerService();
