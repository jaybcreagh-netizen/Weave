import { HydratedFriend } from '@/types/hydrated';
import InteractionModel from '@/db/models/Interaction';
import { FriendshipPattern, getAllLearnedEffectiveness } from '@/modules/insights';
import { getCategoryLabel } from './utils';
import { RelationshipType } from '@/shared/types/common';

/**
 * Relationship-type-aware contextual suggestions.
 * These provide more appropriate copy based on the nature of the relationship.
 */
const relationshipContextualCopy: Record<RelationshipType, Record<string, string[]>> = {
    partner: {
        'text-call': [
            "Send them something sweet",
            "Check in on how their day is going",
        ],
        'deep-talk': [
            "Have a heart-to-heart",
            "Make time for just the two of you",
            "Check in on how they're really doing",
        ],
        'hangout': [
            "Plan a date night",
            "Do something just the two of you",
            "Quality time together",
        ],
        'meal-drink': [
            "Cook dinner together",
            "Go to your favorite spot",
            "Plan a nice meal together",
        ],
        'activity-hobby': [
            "Do something fun together",
            "Try that thing you've been meaning to",
        ],
        'favor-support': [
            "Show them you're there for them",
            "Do something thoughtful for them",
        ],
    },
    family: {
        'text-call': [
            "Give them a call - they'd love to hear from you",
            "Send a photo or update",
            "A quick call would mean a lot",
        ],
        'deep-talk': [
            "Have a proper catch-up",
            "Ask how they're really doing",
        ],
        'meal-drink': [
            "Plan a family dinner",
            "Visit for a meal",
        ],
        'celebration': [
            "Plan something for the next family occasion",
            "Mark the moment together",
        ],
        'favor-support': [
            "Check if they need anything",
            "Offer to help out",
        ],
        'hangout': [
            "Spend some quality time together",
            "Plan a visit",
        ],
    },
    colleague: {
        'text-call': [
            "Send a quick message",
            "Check in outside of work stuff",
        ],
        'meal-drink': [
            "Grab lunch this week",
            "Coffee catch-up between meetings",
            "Happy hour after work?",
        ],
        'activity-hobby': [
            "Do something outside of work",
            "Team activity beyond the office",
        ],
        'hangout': [
            "Hang out outside of work",
            "Get together casually",
        ],
        'event-party': [
            "Invite them to something fun",
            "Go to an event together",
        ],
    },
    mentor: {
        'text-call': [
            "Send an update on how things are going",
            "Share some good news with them",
        ],
        'deep-talk': [
            "Schedule a check-in",
            "Ask for their perspective on something",
            "Share an update on your progress",
        ],
        'meal-drink': [
            "Grab coffee and catch up",
            "Take them to lunch",
        ],
        'activity-hobby': [
            "Learn something together",
            "Collaborate on something",
        ],
    },
    neighbor: {
        'text-call': [
            "Drop them a message",
            "Send a friendly text",
        ],
        'hangout': [
            "Pop by and say hello",
            "Hang out in the neighborhood",
        ],
        'meal-drink': [
            "Invite them over for a drink",
            "Grab coffee nearby",
        ],
        'favor-support': [
            "See if they need anything",
            "Offer to help with something",
        ],
    },
    creative: {
        'text-call': [
            "Share an idea with them",
            "Send them something inspiring",
        ],
        'activity-hobby': [
            "Create something together",
            "Work on a project together",
            "Collaborate on something fun",
        ],
        'deep-talk': [
            "Brainstorm together",
            "Bounce ideas off each other",
        ],
        'hangout': [
            "Get together and make something",
            "Creative session together",
        ],
    },
    friend: {
        // Empty - falls through to default behavior
    },
};

/**
 * Gets a relationship-type-aware suggestion for a given category.
 * Returns null if no specific suggestion exists for this relationship type + category combo.
 */
function getRelationshipTypeSuggestion(
    relationshipType: RelationshipType | undefined,
    category: string
): string | null {
    if (!relationshipType || relationshipType === 'friend') {
        return null; // Fall through to default behavior
    }

    const typeSpecificCopy = relationshipContextualCopy[relationshipType];
    if (!typeSpecificCopy) return null;

    const options = typeSpecificCopy[category];
    if (!options || options.length === 0) return null;

    return options[Math.floor(Math.random() * options.length)];
}

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
    // Extract relationship type from friend if available
    const relationshipType = friend?.relationshipType as RelationshipType | undefined;

    // Use learned pattern preferences if available
    if (pattern && pattern.preferredCategories.length > 0) {
        const preferredCategory = pattern.preferredCategories[0];

        // Try relationship-type-specific copy first
        const relationshipSuggestion = getRelationshipTypeSuggestion(relationshipType, preferredCategory);
        if (relationshipSuggestion) {
            return relationshipSuggestion;
        }

        // Fall back to generic category suggestions
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
        const [category] = mostCommon;

        // Try relationship-type-specific copy first
        const relationshipSuggestion = getRelationshipTypeSuggestion(relationshipType, category);
        if (relationshipSuggestion) {
            return relationshipSuggestion;
        }

        const options = suggestions[category] || [];
        if (options.length > 0) {
            return options[Math.floor(Math.random() * options.length)];
        }
    }

    // Fallback to relationship type + tier appropriate suggestions
    let baseSuggestion: string;

    // Relationship-type-specific fallbacks (when no pattern/category data)
    const relationshipFallbacks: Record<RelationshipType, string[]> = {
        partner: [
            "Make time for just the two of you",
            "Plan some quality time together",
            "Check in with them",
        ],
        family: [
            "Give them a call",
            "Check in with them",
            "Plan a visit",
        ],
        colleague: [
            "Grab coffee or lunch",
            "Check in outside of work",
        ],
        mentor: [
            "Schedule a catch-up",
            "Send them an update",
        ],
        neighbor: [
            "Say hello",
            "Check in with them",
        ],
        creative: [
            "Collaborate on something",
            "Share an idea with them",
        ],
        friend: [], // Empty - use tier-based fallback
    };

    // Try relationship-type fallback first
    if (relationshipType && relationshipType !== 'friend') {
        const fallbackOptions = relationshipFallbacks[relationshipType];
        if (fallbackOptions && fallbackOptions.length > 0) {
            baseSuggestion = fallbackOptions[Math.floor(Math.random() * fallbackOptions.length)];
        }
    }

    // If no relationship-specific fallback, use tier-based
    if (!baseSuggestion) {
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
