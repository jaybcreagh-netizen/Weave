/**
 * Guaranteed Suggestions Service
 * 
 * Generates "always-on" suggestions to ensure users have meaningful options
 * even when their social network is healthy and no reactive triggers fire.
 * 
 * Three types of guaranteed suggestions:
 * 1. Daily Reflect - Journal/gratitude prompts that rotate daily
 * 2. Gentle Nudge - Low-pressure reach-out to a healthy friend
 * 3. Wildcard - Spontaneous, serendipitous exploration ideas
 */

import { Suggestion } from '@/shared/types/common';
import FriendModel from '@/db/models/Friend';
import { calculateCurrentScore } from '@/modules/intelligence';
import type { SocialSeason } from '@/db/models/UserProfile';

// ============================================================================
// DAILY REFLECT PROMPTS
// Rotate based on day of week for variety
// ============================================================================

interface ReflectPrompt {
    title: string;
    subtitle: string;
    icon: string;
}

const DAILY_REFLECT_PROMPTS: ReflectPrompt[] = [
    // Sunday - Gratitude
    { title: "Gratitude moment", subtitle: "Which friendship brought you unexpected joy this week?", icon: "Heart" },
    // Monday - New week intentions
    { title: "Weekly intention", subtitle: "Who would you love to connect with this week?", icon: "Target" },
    // Tuesday - Appreciation
    { title: "Appreciation note", subtitle: "Who deserves a thank-you that you haven't sent yet?", icon: "Send" },
    // Wednesday - Midweek check-in
    { title: "Connection pulse", subtitle: "How are you feeling about your social energy today?", icon: "Activity" },
    // Thursday - Memory
    { title: "Memory lane", subtitle: "What's a favorite memory with a friend you'd like to revisit?", icon: "Camera" },
    // Friday - Weekend planning
    { title: "Weekend spark", subtitle: "Who would make your weekend more meaningful?", icon: "Sun" },
    // Saturday - Reflection
    { title: "Meaningful moment", subtitle: "What connection this week lit you up the most?", icon: "Sparkles" },
];

// ============================================================================
// WILDCARD SUGGESTIONS
// Spontaneous ideas for exploration and serendipity
// ============================================================================

interface WildcardSuggestion {
    title: string;
    subtitle: string;
    icon: string;
    actionType: 'log' | 'plan';
    prefilledCategory?: string;
}

const WILDCARD_SUGGESTIONS: WildcardSuggestion[] = [
    { title: "Voice note surprise", subtitle: "Send a quick voice note to say you're thinking of them", icon: "Mic", actionType: 'log', prefilledCategory: 'voice-note' },
    { title: "Try something new", subtitle: "Invite a friend to an activity you've never done together", icon: "Compass", actionType: 'plan', prefilledCategory: 'activity-hobby' },
    { title: "Spontaneous check-in", subtitle: "Send a 'just thinking of you' text to brighten their day", icon: "MessageCircle", actionType: 'log', prefilledCategory: 'text-call' },
    { title: "Group spark", subtitle: "Plan a casual hangout with two friends who'd enjoy meeting", icon: "Users", actionType: 'plan', prefilledCategory: 'hangout' },
    { title: "Deep dive", subtitle: "Schedule a heart-to-heart with someone you haven't caught up with properly", icon: "Coffee", actionType: 'plan', prefilledCategory: 'deep-talk' },
    { title: "Celebration seed", subtitle: "Plan ahead for an upcoming friend milestone you can celebrate", icon: "PartyPopper", actionType: 'plan', prefilledCategory: 'celebration' },
    { title: "Walk & talk", subtitle: "Invite someone for a walk—connections flow easier in motion", icon: "Footprints", actionType: 'plan', prefilledCategory: 'activity-hobby' },
];

// ============================================================================
// GENTLE NUDGE TEMPLATES
// Low-pressure reach-out suggestions for healthy friends
// ============================================================================

const GENTLE_NUDGE_TEMPLATES = [
    { prefix: "Check in with", suffix: "—it's been a bit!", icon: "MessageCircle" },
    { prefix: "Say hi to", suffix: "—small gestures matter", icon: "Hand" },
    { prefix: "Drop a line to", suffix: "—keep the warmth alive", icon: "Send" },
    { prefix: "Think of", suffix: "?—a quick hello goes far", icon: "Heart" },
];

// ============================================================================
// MAIN GENERATOR FUNCTION
// ============================================================================

/**
 * Generates guaranteed daily suggestions to ensure users always have options
 * Called when friend-specific suggestions are sparse (< minimum threshold)
 * 
 * @param friends - All user's friends
 * @param existingSuggestions - Suggestions already generated from friend-specific logic
 * @param season - Current social season for filtering
 * @returns Array of guaranteed suggestions (up to 3)
 */
export function generateGuaranteedSuggestions(
    friends: FriendModel[],
    existingSuggestions: Suggestion[],
    season: SocialSeason | null | undefined
): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const existingFriendIds = new Set(existingSuggestions.map(s => s.friendId));
    const existingCategories = new Set(existingSuggestions.map(s => s.category));

    // 1. DAILY REFLECT - Always generate (unless one already exists)
    if (!existingCategories.has('reflect') && !existingCategories.has('daily-reflect')) {
        const reflectSuggestion = generateDailyReflect();
        if (reflectSuggestion) {
            suggestions.push(reflectSuggestion);
        }
    }

    // 2. GENTLE NUDGE - Pick a healthy friend who's not already suggested
    // Skip in resting season to reduce pressure
    if (season !== 'resting' && !existingCategories.has('gentle-nudge')) {
        const nudgeSuggestion = generateGentleNudge(friends, existingFriendIds);
        if (nudgeSuggestion) {
            suggestions.push(nudgeSuggestion);
        }
    }

    // 3. WILDCARD - Random spontaneous suggestion
    // Skip in resting season
    if (season !== 'resting' && !existingCategories.has('wildcard')) {
        const wildcardSuggestion = generateWildcard(friends, existingFriendIds);
        if (wildcardSuggestion) {
            suggestions.push(wildcardSuggestion);
        }
    }

    return suggestions;
}

// ============================================================================
// INDIVIDUAL GENERATORS
// ============================================================================

/**
 * Generate the daily reflect prompt based on day of week
 */
function generateDailyReflect(): Suggestion {
    const dayOfWeek = new Date().getDay(); // 0 = Sunday, 6 = Saturday
    const prompt = DAILY_REFLECT_PROMPTS[dayOfWeek];

    return {
        id: `daily-reflect-${dayOfWeek}-${new Date().toISOString().split('T')[0]}`,
        friendId: '', // No specific friend
        type: 'reflect',
        title: prompt.title,
        subtitle: prompt.subtitle,
        icon: prompt.icon,
        category: 'daily-reflect',
        urgency: 'low',
        actionLabel: 'Reflect',
        action: {
            type: 'reflect',
        },
        dismissible: true,
        createdAt: new Date(),
    };
}

/**
 * Generate a gentle nudge suggestion for a healthy friend
 * Targets friends with score 40-80 who haven't been contacted recently
 */
function generateGentleNudge(
    friends: FriendModel[],
    excludeFriendIds: Set<string>
): Suggestion | null {
    // Find eligible friends: healthy score, not already suggested
    const eligibleFriends = friends.filter(f => {
        if (f.isDormant) return false;
        if (excludeFriendIds.has(f.id)) return false;

        const score = calculateCurrentScore(f);
        // Target the "healthy but could use a touch" range
        return score >= 40 && score <= 80;
    });

    if (eligibleFriends.length === 0) return null;

    // Pick a random eligible friend (with some weighting toward lower scores)
    const sortedByScore = eligibleFriends
        .map(f => ({ friend: f, score: calculateCurrentScore(f) }))
        .sort((a, b) => a.score - b.score); // Lower scores first

    // Bias toward lower-scoring friends (more likely to pick from first half)
    const pickIndex = Math.floor(Math.random() * Math.min(sortedByScore.length, 5));
    const selectedFriend = sortedByScore[pickIndex].friend;

    // Pick a random template
    const template = GENTLE_NUDGE_TEMPLATES[Math.floor(Math.random() * GENTLE_NUDGE_TEMPLATES.length)];

    return {
        id: `gentle-nudge-${selectedFriend.id}-${new Date().toISOString().split('T')[0]}`,
        friendId: selectedFriend.id,
        friendName: selectedFriend.name,
        type: 'connect',
        title: `${template.prefix} ${selectedFriend.name}`,
        subtitle: template.suffix,
        icon: template.icon,
        category: 'gentle-nudge',
        urgency: 'low',
        actionLabel: 'Reach Out',
        action: {
            type: 'log',
            prefilledCategory: 'text-call',
        },
        dismissible: true,
        createdAt: new Date(),
    };
}

/**
 * Generate a wildcard spontaneous suggestion
 * Optionally targets a specific friend for friend-oriented wildcards
 */
function generateWildcard(
    friends: FriendModel[],
    excludeFriendIds: Set<string>
): Suggestion | null {
    // Pick a random wildcard template
    const template = WILDCARD_SUGGESTIONS[Math.floor(Math.random() * WILDCARD_SUGGESTIONS.length)];

    // Some wildcards work better with a specific friend
    const friendOrientedWildcards = ['Voice note surprise', 'Spontaneous check-in', 'Deep dive'];
    const needsFriend = friendOrientedWildcards.some(w => template.title.includes(w));

    let targetFriend: FriendModel | null = null;

    if (needsFriend) {
        // Find an eligible friend
        const eligibleFriends = friends.filter(f => {
            if (f.isDormant) return false;
            if (excludeFriendIds.has(f.id)) return false;
            return true;
        });

        if (eligibleFriends.length > 0) {
            targetFriend = eligibleFriends[Math.floor(Math.random() * eligibleFriends.length)];
        }
    }

    // Build the suggestion
    const subtitle = targetFriend
        ? template.subtitle.replace('them', targetFriend.name).replace('someone', targetFriend.name)
        : template.subtitle;

    return {
        id: `wildcard-${template.title.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}`,
        friendId: targetFriend?.id || '',
        friendName: targetFriend?.name,
        type: 'connect',
        title: template.title,
        subtitle,
        icon: template.icon,
        category: 'wildcard',
        urgency: 'low',
        actionLabel: template.actionType === 'plan' ? 'Plan' : 'Log',
        action: {
            type: template.actionType,
            prefilledCategory: template.prefilledCategory,
        },
        dismissible: true,
        createdAt: new Date(),
    };
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Get the current day's reflect prompt (for display elsewhere if needed)
 */
export function getDailyReflectPrompt(): ReflectPrompt {
    const dayOfWeek = new Date().getDay();
    return DAILY_REFLECT_PROMPTS[dayOfWeek];
}

/**
 * Get all wildcard options (for admin/debug purposes)
 */
export function getAllWildcardOptions(): WildcardSuggestion[] {
    return WILDCARD_SUGGESTIONS;
}
