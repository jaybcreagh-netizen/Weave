import { HydratedFriend } from '@/types/hydrated';
import InteractionModel from '@/db/models/Interaction';
import { FriendshipPattern, getAllLearnedEffectiveness } from '@/modules/insights';
import { getCategoryLabel } from './utils';

function getEffectivenessHint(friend: HydratedFriend): string | null {
    const friendModel = friend as any; // Cast to access synthetic props if needed
    if ((friendModel.outcomeCount || 0) < 5) return null;

    const effectiveness = getAllLearnedEffectiveness(friendModel);
    const entries = Object.entries(effectiveness)
        .filter(([_, ratio]) => ratio >= 1.25) // 25%+ better than average
        .sort(([, a], [, b]) => b - a);

    if (entries.length > 0) {
        const [bestCategory, ratio] = entries[0];
        const label = getCategoryLabel(bestCategory);
        const percentBetter = Math.round((ratio - 1) * 100);
        return `(${label}s work ${percentBetter} % better)`;
    }

    return null;
}

export function getContextualSuggestion(
    recentInteractions: InteractionModel[],
    archetype: string,
    tier: string,
    pattern?: FriendshipPattern,
    friend?: HydratedFriend
): string {
    // Use learned pattern preferences if available
    if (pattern && pattern.preferredCategories.length > 0) {
        const preferredCategory = pattern.preferredCategories[0];
        const suggestions: Record<string, string[]> = {
            'text-call': [
                "Send them a quick text like you used to",
                "Give them a call to catch up",
                "Drop them a voice note",
                "Send a funny meme or memory",
            ],
            'meal-drink': [
                "Grab coffee at your usual spot",
                "Plan dinner like old times",
                "Meet for drinks and catch up",
                "Grab lunch together this week",
            ],
            'hangout': [
                "Hang out like you used to",
                "Plan a chill hangout session",
                "Meet up for quality time",
                "Do something spontaneous together",
            ],
            'deep-talk': [
                "Have a heart-to-heart conversation",
                "Set aside time for a deep catch-up",
                "Schedule a meaningful conversation",
                "Create space for vulnerable sharing",
            ],
            'activity-hobby': [
                "Do that activity you both love",
                "Revisit your shared hobby together",
                "Plan an adventure like you used to",
                "Get active together again",
            ],
            'event-party': [
                "Invite them to something fun",
                "Plan a celebration together",
                "Organize a group hangout",
                "Go to an event together",
            ],
        };

        const options = suggestions[preferredCategory] || [];
        if (options.length > 0) {
            return options[Math.floor(Math.random() * options.length)];
        }
    }

    // Count interaction types to find patterns (fallback)
    const categoryCounts: Record<string, number> = {};
    recentInteractions.forEach(i => {
        if (i.interactionCategory) {
            categoryCounts[i.interactionCategory] = (categoryCounts[i.interactionCategory] || 0) + 1;
        }
    });

    // Get most common interaction type
    const mostCommon = Object.entries(categoryCounts).sort(([, a], [, b]) => b - a)[0];

    // Contextual suggestions based on their history + archetype
    const suggestions: Record<string, string[]> = {
        'text-call': [
            "Send them a quick text like you used to",
            "Give them a call to catch up",
            "Drop them a voice note",
            "Send a funny meme or memory",
        ],
        'meal-drink': [
            "Grab coffee at your usual spot",
            "Plan dinner like old times",
            "Meet for drinks and catch up",
            "Grab lunch together this week",
        ],
        'hangout': [
            "Hang out like you used to",
            "Plan a chill hangout session",
            "Meet up for quality time",
            "Do something spontaneous together",
        ],
        'deep-talk': [
            "Have a heart-to-heart conversation",
            "Set aside time for a deep catch-up",
            "Schedule a meaningful conversation",
            "Create space for vulnerable sharing",
        ],
        'activity-hobby': [
            "Do that activity you both love",
            "Revisit your shared hobby together",
            "Plan an adventure like you used to",
            "Get active together again",
        ],
        'event-party': [
            "Invite them to something fun",
            "Plan a celebration together",
            "Organize a group hangout",
            "Go to an event together",
        ],
    };

    // If they have a pattern, suggest continuing it
    if (mostCommon && mostCommon[1] >= 2) {
        const [category, count] = mostCommon;
        const options = suggestions[category] || [];
        if (options.length > 0) {
            return options[Math.floor(Math.random() * options.length)];
        }
    }

    // Fallback to archetype + tier appropriate suggestions
    let baseSuggestion: string;

    if (tier === 'InnerCircle') {
        const innerCircleSuggestions = [
            "Set aside quality time",
            "Plan something meaningful",
            "Have a proper catch-up",
            "Make time for connection",
        ];
        baseSuggestion = innerCircleSuggestions[Math.floor(Math.random() * innerCircleSuggestions.length)];
    } else if (tier === 'CloseFriends') {
        const closeFriendSuggestions = [
            "Send a thoughtful text",
            "Plan a casual meet-up",
            "Grab coffee or a bite",
            "Check in with them",
        ];
        baseSuggestion = closeFriendSuggestions[Math.floor(Math.random() * closeFriendSuggestions.length)];
    } else {
        baseSuggestion = "Send a friendly message";
    }

    // Add effectiveness hint if we have strong data
    if (friend) {
        const hint = getEffectivenessHint(friend);
        if (hint) {
            return `${baseSuggestion} ${hint} `;
        }
    }

    return baseSuggestion;
}
