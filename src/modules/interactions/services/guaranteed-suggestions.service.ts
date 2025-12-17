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
// TIME-AWARE WILDCARDS
// Context-sensitive suggestions based on time of day
// ============================================================================

type TimeOfDay = 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';

const TIME_AWARE_WILDCARDS: Partial<Record<TimeOfDay, WildcardSuggestion[]>> = {
    morning: [
        { title: "Morning check-in", subtitle: "Send a good morning to someone you're thinking of", icon: "Sun", actionType: 'log', prefilledCategory: 'text-call' },
        { title: "Coffee date?", subtitle: "Invite someone for a quick coffee chat", icon: "Coffee", actionType: 'plan', prefilledCategory: 'meal-drink' },
    ],
    midday: [
        { title: "Lunch hangout", subtitle: "Make midday more meaningful—invite someone to join", icon: "UtensilsCrossed", actionType: 'plan', prefilledCategory: 'meal-drink' },
    ],
    afternoon: [
        { title: "Afternoon walk", subtitle: "Fresh air and good company—invite a friend for a walk", icon: "Footprints", actionType: 'plan', prefilledCategory: 'activity-hobby' },
        { title: "Weekend plans?", subtitle: "Start thinking about who to see this weekend", icon: "Calendar", actionType: 'plan', prefilledCategory: 'hangout' },
    ],
    evening: [
        { title: "Evening catch-up", subtitle: "Share what's on your mind with someone close", icon: "Moon", actionType: 'log', prefilledCategory: 'text-call' },
        { title: "Tomorrow's plans", subtitle: "Who would make tomorrow more meaningful?", icon: "Calendar", actionType: 'plan', prefilledCategory: 'hangout' },
    ],
};

// ============================================================================
// DAY-SPECIFIC WILDCARDS
// Special suggestions for certain days of the week
// ============================================================================

const DAY_SPECIFIC_WILDCARDS: Partial<Record<number, WildcardSuggestion[]>> = {
    0: [ // Sunday
        { title: "Sunday coffee", subtitle: "It's Sunday—grab a coffee with someone special", icon: "Coffee", actionType: 'plan', prefilledCategory: 'meal-drink' },
        { title: "Slow Sunday", subtitle: "Sundays are for catching up—who's on your mind?", icon: "Heart", actionType: 'log', prefilledCategory: 'text-call' },
    ],
    5: [ // Friday
        { title: "Friday plans?", subtitle: "The weekend is coming—who do you want to see?", icon: "PartyPopper", actionType: 'plan', prefilledCategory: 'hangout' },
        { title: "Weekend kick-off", subtitle: "Start the weekend right—reach out to a friend", icon: "Sparkles", actionType: 'log', prefilledCategory: 'text-call' },
    ],
    6: [ // Saturday
        { title: "Saturday adventure", subtitle: "Try something new with a friend today", icon: "Compass", actionType: 'plan', prefilledCategory: 'activity-hobby' },
        { title: "Weekend vibes", subtitle: "Who would make today even better?", icon: "Sun", actionType: 'plan', prefilledCategory: 'hangout' },
    ],
};

// ============================================================================
// "WHY NOT REACH OUT" TEMPLATES
// Low-pressure suggestions for slightly overdue friends
// ============================================================================

const WHY_NOT_REACH_OUT_TEMPLATES = [
    { prefix: "Why not reach out to", suffix: "?", icon: "MessageCircle" },
    { prefix: "Hey, it's been a while—say hi to", suffix: "", icon: "Hand" },
    { prefix: "Thinking of", suffix: "? Drop them a line!", icon: "Heart" },
    { prefix: "Missing", suffix: "? A quick hello goes a long way", icon: "Send" },
];

/**
 * Get current time of day bucket
 */
function getTimeOfDay(): TimeOfDay {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 11) return 'morning';
    if (hour >= 11 && hour < 14) return 'midday';
    if (hour >= 14 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'night';
}

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

    // Track friend IDs we've already added suggestions for
    const usedFriendIds = new Set(existingFriendIds);

    // 1. DAILY REFLECT - Always generate (unless one already exists)
    if (!existingCategories.has('reflect') && !existingCategories.has('daily-reflect')) {
        const reflectSuggestion = generateDailyReflect();
        if (reflectSuggestion) {
            suggestions.push(reflectSuggestion);
        }
    }

    // 2. GENTLE NUDGE - Pick a healthy friend who's not already suggested
    // In resting season, use softer language but still provide the option
    if (!existingCategories.has('gentle-nudge')) {
        const nudgeSuggestion = generateGentleNudge(friends, usedFriendIds, season === 'resting');
        if (nudgeSuggestion) {
            suggestions.push(nudgeSuggestion);
            if (nudgeSuggestion.friendId) usedFriendIds.add(nudgeSuggestion.friendId);
        }
    }

    // 3. WILDCARD - Context-aware spontaneous suggestion
    // In resting season, prefer low-energy wildcards
    if (!existingCategories.has('wildcard')) {
        const wildcardSuggestion = generateWildcard(friends, usedFriendIds, season === 'resting');
        if (wildcardSuggestion) {
            suggestions.push(wildcardSuggestion);
            if (wildcardSuggestion.friendId) usedFriendIds.add(wildcardSuggestion.friendId);
        }
    }

    // 4. COMMUNITY CHECK-IN - Encourage connection with community tier
    if (!existingCategories.has('community-checkin') && suggestions.length < 3) {
        const communityCheckIn = generateCommunityCheckIn(friends, usedFriendIds);
        if (communityCheckIn) {
            suggestions.push(communityCheckIn);
            if (communityCheckIn.friendId) usedFriendIds.add(communityCheckIn.friendId);
        }
    }

    // 5. SET INTENTION - Proactive intention-setting for healthy relationships
    if (!existingCategories.has('set-intention') && suggestions.length < 3) {
        const intentionSuggestion = generateSetIntention(friends, usedFriendIds);
        if (intentionSuggestion) {
            suggestions.push(intentionSuggestion);
            if (intentionSuggestion.friendId) usedFriendIds.add(intentionSuggestion.friendId);
        }
    }

    // 6. VARIETY CHECK - Encourage connecting with different people
    if (!existingCategories.has('variety') && suggestions.length < 3) {
        const varietySuggestion = generateVarietyCheck(friends, usedFriendIds);
        if (varietySuggestion) {
            suggestions.push(varietySuggestion);
        }
    }

    // 7. WHY NOT REACH OUT - For slightly overdue friends (30-60% score)
    // Fallback option when network is mostly healthy
    if (suggestions.length < 3) {
        const whyNotSuggestion = generateWhyNotReachOut(friends, usedFriendIds);
        if (whyNotSuggestion) {
            suggestions.push(whyNotSuggestion);
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

// Softer templates for resting season
const RESTING_GENTLE_NUDGE_TEMPLATES = [
    { prefix: "When you're ready, say hi to", suffix: "", icon: "MessageCircle" },
    { prefix: "No rush—", suffix: "might enjoy hearing from you", icon: "Heart" },
    { prefix: "A thought:", suffix: "came to mind", icon: "Lightbulb" },
];

/**
 * Generate a gentle nudge suggestion for a healthy friend
 * EXPANDED: Now targets ALL non-dormant friends to ensure users with healthy networks
 * still get suggestions. Prioritizes lower-scoring friends but includes everyone.
 */
function generateGentleNudge(
    friends: FriendModel[],
    excludeFriendIds: Set<string>,
    isResting: boolean = false
): Suggestion | null {
    // CRITICAL FIX: Removed restrictive maxScore cap that excluded users with healthy networks.
    // Previously capped at 80/90, but users with all friends >80 got no suggestions.
    // Now includes ALL non-dormant friends, with bias toward lower scores.
    const minScore = isResting ? 30 : 20; // Lowered minimum to catch more friends

    const eligibleFriends = friends.filter(f => {
        if (f.isDormant) return false;
        if (excludeFriendIds.has(f.id)) return false;

        const score = calculateCurrentScore(f);
        // Accept ANY friend with score above minimum (no upper cap)
        return score >= minScore;
    });

    if (eligibleFriends.length === 0) return null;

    // Pick a random eligible friend (with some weighting toward lower scores)
    const sortedByScore = eligibleFriends
        .map(f => ({ friend: f, score: calculateCurrentScore(f) }))
        .sort((a, b) => a.score - b.score); // Lower scores first

    // Bias toward lower-scoring friends (more likely to pick from first half)
    const pickIndex = Math.floor(Math.random() * Math.min(sortedByScore.length, 5));
    const selectedFriend = sortedByScore[pickIndex].friend;

    // Pick a template based on season
    const templates = isResting ? RESTING_GENTLE_NUDGE_TEMPLATES : GENTLE_NUDGE_TEMPLATES;
    const template = templates[Math.floor(Math.random() * templates.length)];

    // Build title based on template structure
    const title = template.suffix.includes('came to mind') || template.suffix.includes('might enjoy')
        ? `${template.prefix} ${selectedFriend.name} ${template.suffix}`
        : `${template.prefix} ${selectedFriend.name}`;

    return {
        id: `gentle-nudge-${selectedFriend.id}-${new Date().toISOString().split('T')[0]}`,
        friendId: selectedFriend.id,
        friendName: selectedFriend.name,
        type: 'connect',
        title,
        subtitle: template.suffix.includes('came to mind') ? '' : template.suffix,
        icon: template.icon,
        category: 'gentle-nudge',
        urgency: 'low',
        actionLabel: isResting ? 'Maybe Later' : 'Reach Out',
        action: {
            type: 'log',
            prefilledCategory: 'text-call',
        },
        dismissible: true,
        createdAt: new Date(),
    };
}

// Low-energy wildcards for resting season
const RESTING_WILDCARDS: WildcardSuggestion[] = [
    { title: "Thinking of you text", subtitle: "A simple message can mean a lot", icon: "MessageCircle", actionType: 'log', prefilledCategory: 'text-call' },
    { title: "Quick voice note", subtitle: "Share a thought without the pressure of a call", icon: "Mic", actionType: 'log', prefilledCategory: 'voice-note' },
    { title: "Send a memory", subtitle: "Share a photo or memory from your camera roll", icon: "Image", actionType: 'log', prefilledCategory: 'text-call' },
    { title: "Low-key catch-up", subtitle: "No agenda, just saying hi", icon: "Coffee", actionType: 'log', prefilledCategory: 'text-call' },
];

/**
 * Generate a wildcard spontaneous suggestion
 * Now context-aware: uses time of day and day of week for relevant suggestions
 */
function generateWildcard(
    friends: FriendModel[],
    excludeFriendIds: Set<string>,
    isResting: boolean = false
): Suggestion | null {
    const timeOfDay = getTimeOfDay();
    const dayOfWeek = new Date().getDay();

    // Select template with context-awareness
    let template: WildcardSuggestion;

    // In resting mode, prefer low-energy wildcards
    if (isResting) {
        template = RESTING_WILDCARDS[Math.floor(Math.random() * RESTING_WILDCARDS.length)];
    }
    // 60% chance to use context-aware template (if available)
    else if (Math.random() < 0.6) {
        // Try day-specific first (30% of context-aware)
        const dayTemplates = DAY_SPECIFIC_WILDCARDS[dayOfWeek];
        const timeTemplates = TIME_AWARE_WILDCARDS[timeOfDay];

        if (dayTemplates && dayTemplates.length > 0 && Math.random() < 0.3) {
            template = dayTemplates[Math.floor(Math.random() * dayTemplates.length)];
        } else if (timeTemplates && timeTemplates.length > 0) {
            template = timeTemplates[Math.floor(Math.random() * timeTemplates.length)];
        } else {
            // Fall back to generic wildcards
            template = WILDCARD_SUGGESTIONS[Math.floor(Math.random() * WILDCARD_SUGGESTIONS.length)];
        }
    } else {
        // Use generic wildcards
        template = WILDCARD_SUGGESTIONS[Math.floor(Math.random() * WILDCARD_SUGGESTIONS.length)];
    }

    // Some wildcards work better with a specific friend
    const friendOrientedWildcards = [
        'Voice note surprise', 'Spontaneous check-in', 'Deep dive',
        'Morning check-in', 'Evening catch-up', 'Slow Sunday'
    ];
    const needsFriend = friendOrientedWildcards.some(w => template.title.includes(w));

    let targetFriend: FriendModel | null = null;

    if (needsFriend) {
        // Find an eligible friend, prefer those with lower scores (slightly overdue)
        const eligibleFriends = friends.filter(f => {
            if (f.isDormant) return false;
            if (excludeFriendIds.has(f.id)) return false;
            return true;
        });

        if (eligibleFriends.length > 0) {
            // Bias toward friends with lower scores (30-70 range)
            const sortedByScore = eligibleFriends
                .map(f => ({ friend: f, score: calculateCurrentScore(f) }))
                .sort((a, b) => a.score - b.score);

            // Pick from bottom half preferentially
            const pickIndex = Math.floor(Math.random() * Math.min(sortedByScore.length, Math.ceil(sortedByScore.length / 2) + 2));
            targetFriend = sortedByScore[pickIndex].friend;
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

/**
 * Generate a "Why not reach out to X?" suggestion for friends
 * EXPANDED: Now targets ALL non-dormant friends to ensure users with healthy networks
 * still get suggestions. This is a fallback when other generators fail.
 */
function generateWhyNotReachOut(
    friends: FriendModel[],
    excludeFriendIds: Set<string>
): Suggestion | null {
    // CRITICAL FIX: Removed restrictive score cap (30-60) that excluded healthy networks.
    // Now accepts ANY non-dormant friend, prioritizes those with lower scores.
    const eligibleFriends = friends.filter(f => {
        if (f.isDormant) return false;
        if (excludeFriendIds.has(f.id)) return false;
        return true; // Accept any friend
    });

    if (eligibleFriends.length === 0) return null;

    // Pick random eligible friend, bias toward lower scores
    const sorted = eligibleFriends
        .map(f => ({ friend: f, score: calculateCurrentScore(f) }))
        .sort((a, b) => a.score - b.score);

    const pickIndex = Math.floor(Math.random() * Math.min(sorted.length, 5));
    const selectedFriend = sorted[pickIndex].friend;
    const template = WHY_NOT_REACH_OUT_TEMPLATES[Math.floor(Math.random() * WHY_NOT_REACH_OUT_TEMPLATES.length)];

    return {
        id: `why-not-${selectedFriend.id}-${new Date().toISOString().split('T')[0]}`,
        friendId: selectedFriend.id,
        friendName: selectedFriend.name,
        type: 'connect',
        title: `${template.prefix} ${selectedFriend.name}${template.suffix}`,
        subtitle: "Small gestures keep friendships warm",
        icon: template.icon,
        category: 'wildcard', // Use wildcard category so it bypasses season filtering
        urgency: 'low',
        actionLabel: 'Reach Out',
        action: { type: 'log', prefilledCategory: 'text-call' },
        dismissible: true,
        createdAt: new Date(),
    };
}

// ============================================================================
// NEW SUGGESTION GENERATORS (for healthy networks)
// ============================================================================

/**
 * Community check-in templates
 */
const COMMUNITY_CHECKIN_TEMPLATES = [
    { prefix: "Reconnect with", suffix: "from your wider circle", icon: "Users" },
    { prefix: "Check in on", suffix: "—community connections matter too", icon: "Heart" },
    { prefix: "Say hi to", suffix: "—it's been a while", icon: "Hand" },
    { prefix: "Drop a line to", suffix: "in your community", icon: "MessageCircle" },
];

/**
 * Generate a community check-in suggestion for community tier members
 * EXPANDED: Now targets ALL Community tier friends regardless of score.
 */
function generateCommunityCheckIn(
    friends: FriendModel[],
    excludeFriendIds: Set<string>
): Suggestion | null {
    // CRITICAL FIX: Removed restrictive score cap (20-70) that excluded healthy community friends.
    // Now accepts ANY non-dormant Community tier friend.
    const communityFriends = friends.filter(f => {
        if (f.isDormant) return false;
        if (excludeFriendIds.has(f.id)) return false;
        if (f.dunbarTier !== 'Community') return false;
        return true; // Accept any Community tier friend
    });

    if (communityFriends.length === 0) return null;

    // Sort by score (lower first, they need more attention)
    const sorted = communityFriends
        .map(f => ({ friend: f, score: calculateCurrentScore(f) }))
        .sort((a, b) => a.score - b.score);

    // Pick from the lower-scoring community members
    const pickIndex = Math.floor(Math.random() * Math.min(sorted.length, 5));
    const selectedFriend = sorted[pickIndex].friend;
    const template = COMMUNITY_CHECKIN_TEMPLATES[Math.floor(Math.random() * COMMUNITY_CHECKIN_TEMPLATES.length)];

    return {
        id: `community-checkin-${selectedFriend.id}-${new Date().toISOString().split('T')[0]}`,
        friendId: selectedFriend.id,
        friendName: selectedFriend.name,
        type: 'connect',
        title: `${template.prefix} ${selectedFriend.name}`,
        subtitle: template.suffix,
        icon: template.icon,
        category: 'community-checkin',
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
 * Set intention templates
 */
const SET_INTENTION_TEMPLATES = [
    { title: "Set an intention for", subtitle: "What would you like to do together?", icon: "Target" },
    { title: "Plan something with", subtitle: "Intentions help turn thoughts into action", icon: "Lightbulb" },
    { title: "Dream up something for", subtitle: "What's on your wishlist for this friendship?", icon: "Sparkles" },
];

/**
 * Generate a set-intention suggestion for proactive relationship planning
 * EXPANDED: Now targets ALL Inner/Close tier friends regardless of score.
 */
function generateSetIntention(
    friends: FriendModel[],
    excludeFriendIds: Set<string>
): Suggestion | null {
    // CRITICAL FIX: Removed score requirement. All Inner/Close tier friends are good candidates.
    const eligibleFriends = friends.filter(f => {
        if (f.isDormant) return false;
        if (excludeFriendIds.has(f.id)) return false;
        // Target Inner Circle and Close Friends tiers (not Community)
        return f.dunbarTier !== 'Community';
    });

    if (eligibleFriends.length === 0) return null;

    // Pick a random eligible friend
    const pickIndex = Math.floor(Math.random() * eligibleFriends.length);
    const selectedFriend = eligibleFriends[pickIndex];
    const template = SET_INTENTION_TEMPLATES[Math.floor(Math.random() * SET_INTENTION_TEMPLATES.length)];

    return {
        id: `set-intention-${selectedFriend.id}-${new Date().toISOString().split('T')[0]}`,
        friendId: selectedFriend.id,
        friendName: selectedFriend.name,
        type: 'connect',
        title: `${template.title} ${selectedFriend.name}`,
        subtitle: template.subtitle,
        icon: template.icon,
        category: 'set-intention',
        urgency: 'low',
        actionLabel: 'Set Intention',
        action: {
            type: 'intention',
        },
        dismissible: true,
        createdAt: new Date(),
    };
}

/**
 * Variety check templates
 */
const VARIETY_CHECK_TEMPLATES = [
    { title: "Mix it up", subtitle: "You've been connecting with the same people lately", icon: "Shuffle" },
    { title: "Expand your connections", subtitle: "Consider reaching out to someone different", icon: "Users" },
    { title: "Try a new connection", subtitle: "Variety keeps your social life fresh", icon: "Compass" },
];

/**
 * Generate a variety check suggestion when user has been seeing the same people
 * EXPANDED: Now targets ALL non-dormant friends regardless of score.
 */
function generateVarietyCheck(
    friends: FriendModel[],
    excludeFriendIds: Set<string>
): Suggestion | null {
    // CRITICAL FIX: Removed restrictive score cap (40-75) that excluded healthy networks.
    // Now accepts ANY non-dormant friend, sorts by score to find "overlooked" ones.
    const neglectedFriends = friends.filter(f => {
        if (f.isDormant) return false;
        if (excludeFriendIds.has(f.id)) return false;
        return true; // Accept any friend
    });

    if (neglectedFriends.length < 2) return null;

    // Sort by a combination of score and randomness
    const sorted = neglectedFriends
        .map(f => ({
            friend: f,
            score: calculateCurrentScore(f),
            // Add some randomness to avoid always picking the same person
            sortKey: calculateCurrentScore(f) + (Math.random() * 20)
        }))
        .sort((a, b) => a.sortKey - b.sortKey);

    // Pick from the sorted list
    const selectedFriend = sorted[0].friend;
    const template = VARIETY_CHECK_TEMPLATES[Math.floor(Math.random() * VARIETY_CHECK_TEMPLATES.length)];

    return {
        id: `variety-check-${new Date().toISOString().split('T')[0]}`,
        friendId: selectedFriend.id,
        friendName: selectedFriend.name,
        type: 'connect',
        title: template.title,
        subtitle: `${template.subtitle}. How about ${selectedFriend.name}?`,
        icon: template.icon,
        category: 'variety',
        urgency: 'low',
        actionLabel: 'Connect',
        action: {
            type: 'plan',
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

