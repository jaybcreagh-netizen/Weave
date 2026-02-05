
import { Q } from '@nozbe/watermelondb';
import Logger from '@/shared/utils/Logger';
import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import FriendMemory from '@/db/models/FriendMemory';
import LifeEvent from '@/db/models/LifeEvent';
import SuggestionEvent from '@/db/models/SuggestionEvent';
import { generateSuggestion } from './suggestion-engine';
import { generateGuaranteedSuggestions } from './guaranteed-suggestions.service';
import * as SuggestionStorageService from './suggestion-storage.service';
import { Suggestion, InteractionCategory } from '@/shared/types/common';
import { calculateCurrentScore } from '@/modules/intelligence/services/orchestrator.service';
import {
    filterSuggestionsBySeason,
    getSeasonSuggestionConfig,
} from '@/modules/intelligence/services/social-season/season-suggestions.service';
import { SeasonAnalyticsService } from '@/modules/intelligence/services/social-season/season-analytics.service';
import type { SocialSeason } from '@/db/models/UserProfile';
import { filterSuggestionsByTime } from '@/shared/utils/time-aware-filter';
import {
    generatePortfolioInsights,
    analyzeArchetypeBalance,
    type PortfolioAnalysisStats,
} from '@/modules/insights/services/portfolio.service';
import { generateProactiveSuggestions } from '@/modules/insights/services/prediction.service';
import {
    isPatternReliable,
    analyzeInteractionPattern,
} from '@/modules/insights/services/pattern.service';

import { SuggestionCandidateService } from './suggestion-system/SuggestionCandidateService';
import { SuggestionDataLoader } from './suggestion-system/SuggestionDataLoader';
import { selectDiverseSuggestions } from './suggestion-system/SuggestionDiversifier';
import { TriageGenerator } from './suggestion-engine/generators/TriageGenerator';
import { WeeklyReflectionGenerator } from './suggestion-engine/generators/WeeklyReflectionGenerator';
import { SignalDrivenGenerator } from './suggestion-engine/generators/SignalDrivenGenerator';
import {
    archiveExpiredFriendMemories,
    buildLifeEventPrefillFromMemory,
} from '@/modules/relationships/services/memory-life-event.service';

/**
 * Maps proactive suggestion types to appropriate icons
 */
function getProactiveIcon(type: string): string {
    const icons: Record<string, string> = {
        'upcoming-drift': 'TrendingDown',
        'optimal-timing': 'Clock',
        'pattern-break': 'AlertCircle',
        'momentum-opportunity': 'Zap',
        'reciprocity-imbalance': 'Scale',
        'best-day-scheduling': 'Calendar',
    };
    return icons[type] || 'Sparkles';
}

const ADAPTIVE_WINDOW_DAYS = 30;
const FRIEND_SUPPRESSION_DISMISSAL_THRESHOLD = 3;
const TYPE_PENALTY_DISMISSAL_THRESHOLD = 3;
const LIFE_EVENT_DATE_DUPLICATE_WINDOW_DAYS = 14;

type SuggestionUrgency = NonNullable<Suggestion['urgency']>;

interface DismissalLearningProfile {
    suppressedFriendIds: Set<string>;
    typeDismissalCounts: Map<string, number>;
}

export interface FriendMemoryProfile {
    preferredCategories: Set<InteractionCategory>;
    avoidCategories: Set<InteractionCategory>;
    hasUpcoming: boolean;
    hasMilestone: boolean;
    topInterest?: string;
}

const CATEGORY_KEYWORDS: Record<InteractionCategory, string[]> = {
    'text-call': ['text', 'message', 'call', 'phone', 'reach out'],
    'voice-note': ['voice note', 'audio', 'voice memo'],
    'meal-drink': ['coffee', 'lunch', 'dinner', 'brunch', 'drink', 'meal', 'restaurant'],
    'hangout': ['hangout', 'chill', 'visit', 'walk', 'catch up', 'meet up'],
    'deep-talk': ['deep talk', 'heart to heart', 'open up', 'reflect', 'meaningful talk'],
    'event-party': ['party', 'event', 'concert', 'festival', 'show', 'gathering'],
    'activity-hobby': ['hike', 'run', 'gym', 'game', 'hobby', 'activity', 'class', 'sport'],
    'favor-support': ['support', 'help', 'favor', 'check in', 'be there'],
    'celebration': ['birthday', 'anniversary', 'celebrate', 'celebration', 'milestone', 'wedding'],
};

function downgradeUrgency(urgency?: SuggestionUrgency): SuggestionUrgency {
    if (urgency === 'critical') return 'high';
    if (urgency === 'high') return 'medium';
    if (urgency === 'medium') return 'low';
    return 'low';
}

function upgradeUrgency(urgency?: SuggestionUrgency): SuggestionUrgency {
    if (urgency === 'low') return 'medium';
    if (urgency === 'medium') return 'high';
    if (urgency === 'high') return 'critical';
    return 'critical';
}

function extractCategoriesFromMemory(memory: FriendMemory): InteractionCategory[] {
    const searchable = `${memory.title} ${memory.content} ${memory.tags.join(' ')}`.toLowerCase();
    const matches: InteractionCategory[] = [];

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as Array<[InteractionCategory, string[]]>) {
        if (keywords.some(keyword => searchable.includes(keyword))) {
            matches.push(category);
        }
    }

    return matches;
}

function appendSubtitle(base: string, addition: string): string {
    if (!addition) return base;
    if (!base) return addition;
    const combined = `${base} ${addition}`.trim();
    return combined.length > 180 ? `${combined.slice(0, 177)}...` : combined;
}

function normalizeText(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenSimilarity(a: string, b: string): number {
    const aTokens = new Set(normalizeText(a).split(' ').filter(Boolean));
    const bTokens = new Set(normalizeText(b).split(' ').filter(Boolean));
    if (aTokens.size === 0 || bTokens.size === 0) return 0;

    let overlap = 0;
    aTokens.forEach(token => {
        if (bTokens.has(token)) overlap += 1;
    });

    return overlap / Math.max(aTokens.size, bTokens.size);
}

export async function loadFriendMemoryProfiles(friendIds: string[]): Promise<Map<string, FriendMemoryProfile>> {
    const profiles = new Map<string, FriendMemoryProfile>();
    if (friendIds.length === 0) return profiles;

    const memories = await database.get<FriendMemory>('friend_memories')
        .query(
            Q.where('friend_id', Q.oneOf(friendIds)),
            Q.where('is_archived', false),
            Q.sortBy('updated_at', Q.desc)
        )
        .fetch();

    for (const memory of memories) {
        const profile = profiles.get(memory.friendId) || {
            preferredCategories: new Set<InteractionCategory>(),
            avoidCategories: new Set<InteractionCategory>(),
            hasUpcoming: false,
            hasMilestone: false,
            topInterest: undefined,
        };

        const categories = extractCategoriesFromMemory(memory);

        if (memory.type === 'upcoming') {
            profile.hasUpcoming = true;
        }
        if (memory.type === 'milestone') {
            profile.hasMilestone = true;
        }
        if (!profile.topInterest && (memory.type === 'interest' || memory.type === 'activity_win' || memory.type === 'preference')) {
            profile.topInterest = memory.title;
        }

        if (memory.type === 'avoid') {
            categories.forEach(category => profile.avoidCategories.add(category));
        }

        if (memory.type === 'interest' || memory.type === 'activity_win' || memory.type === 'preference') {
            categories.forEach(category => profile.preferredCategories.add(category));
        }

        profiles.set(memory.friendId, profile);
    }

    return profiles;
}

export function applyMemoryAwareScoring(
    suggestions: Suggestion[],
    profiles: Map<string, FriendMemoryProfile>
): Suggestion[] {
    return suggestions.map(suggestion => {
        if (!suggestion.friendId) return suggestion;
        const profile = profiles.get(suggestion.friendId);
        if (!profile) return suggestion;

        const adjusted: Suggestion = {
            ...suggestion,
            action: {
                ...suggestion.action,
            },
        };

        const preferredCategories = Array.from(profile.preferredCategories);
        const prefilledCategory = adjusted.action.prefilledCategory as InteractionCategory | undefined;

        if (!prefilledCategory && adjusted.action.type === 'plan' && preferredCategories.length > 0) {
            adjusted.action.prefilledCategory = preferredCategories[0];
        }

        const resolvedCategory = (adjusted.action.prefilledCategory as InteractionCategory | undefined) || prefilledCategory;

        if (resolvedCategory && profile.avoidCategories.has(resolvedCategory)) {
            adjusted.urgency = downgradeUrgency(downgradeUrgency(adjusted.urgency || 'medium'));
            adjusted.subtitle = appendSubtitle(adjusted.subtitle, 'Your notes suggest avoiding this format right now.');
        } else if (resolvedCategory && profile.preferredCategories.has(resolvedCategory) && adjusted.urgency !== 'critical') {
            adjusted.urgency = upgradeUrgency(adjusted.urgency || 'medium');
        }

        if ((profile.hasUpcoming || profile.hasMilestone) && adjusted.urgency !== 'critical') {
            adjusted.urgency = upgradeUrgency(adjusted.urgency || 'medium');
            adjusted.subtitle = appendSubtitle(
                adjusted.subtitle,
                profile.hasMilestone
                    ? 'You tagged a milestone here, this is a good time to show up.'
                    : 'You logged something upcoming, a check-in now could help.'
            );
            if (!adjusted.category || adjusted.category === 'maintain') {
                adjusted.category = 'life-event';
            }
        }

        if (profile.topInterest && (adjusted.action.type === 'plan' || adjusted.action.type === 'log')) {
            adjusted.subtitle = appendSubtitle(adjusted.subtitle, `Based on your notes: ${profile.topInterest}.`);
        }

        return adjusted;
    });
}

function getLifeEventUrgency(eventDate?: string): SuggestionUrgency {
    if (!eventDate) return 'medium';
    const parsed = new Date(eventDate);
    if (Number.isNaN(parsed.getTime())) return 'medium';

    const daysUntil = Math.floor((parsed.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntil <= 1) return 'high';
    if (daysUntil <= 10) return 'medium';
    return 'low';
}

function buildLifeEventPrompt(friendName: string, prefill: ReturnType<typeof buildLifeEventPrefillFromMemory>): string {
    if (!prefill) return `Help me add a life event for ${friendName}.`;
    const parts = [
        `Help me add a life event for ${friendName}.`,
        prefill.title ? `Title: ${prefill.title}.` : '',
        prefill.notes ? `Notes: ${prefill.notes}.` : '',
        prefill.eventDate ? `Date: ${prefill.eventDate}.` : '',
    ].filter(Boolean);
    return parts.join(' ');
}

async function generateMemoryLifeEventSuggestions(friends: FriendModel[]): Promise<Suggestion[]> {
    if (!friends.length) return [];

    const friendIds = friends.map(friend => friend.id);
    const friendLookup = new Map(friends.map(friend => [friend.id, friend]));
    const [memories, existingLifeEvents] = await Promise.all([
        database.get<FriendMemory>('friend_memories')
            .query(
                Q.where('friend_id', Q.oneOf(friendIds)),
                Q.where('is_archived', false),
                Q.where('type', Q.oneOf(['upcoming', 'milestone'])),
                Q.sortBy('updated_at', Q.desc),
            )
            .fetch(),
        database.get<LifeEvent>('life_events')
            .query(
                Q.where('friend_id', Q.oneOf(friendIds)),
                Q.sortBy('event_date', Q.desc),
                Q.take(400),
            )
            .fetch(),
    ]);

    const existingLifeEventsByFriend = new Map<string, LifeEvent[]>();
    existingLifeEvents.forEach(event => {
        const friendEvents = existingLifeEventsByFriend.get(event.friendId) || [];
        friendEvents.push(event);
        existingLifeEventsByFriend.set(event.friendId, friendEvents);
    });

    const suggestions: Suggestion[] = [];
    const seenFriendIds = new Set<string>();

    for (const memory of memories) {
        if (seenFriendIds.has(memory.friendId)) continue;

        const friend = friendLookup.get(memory.friendId);
        if (!friend) continue;

        const prefill = buildLifeEventPrefillFromMemory({
            type: memory.type,
            title: memory.title,
            content: memory.content,
            effectiveDate: memory.effectiveDate,
        });
        if (!prefill) continue;

        const candidateDateMs = prefill.eventDate ? new Date(prefill.eventDate).getTime() : NaN;
        const friendLifeEvents = existingLifeEventsByFriend.get(memory.friendId) || [];
        const duplicateLifeEvent = friendLifeEvents.find(existing => {
            const typeMatch = !prefill.eventType || existing.eventType === prefill.eventType;
            if (!typeMatch) return false;

            const titleSimilarity = tokenSimilarity(existing.title || '', prefill.title || memory.title || '');
            const notesSimilarity = tokenSimilarity(existing.notes || '', prefill.notes || memory.content || '');

            if (!Number.isNaN(candidateDateMs)) {
                const existingDateMs = existing.eventDate?.getTime?.() || NaN;
                if (!Number.isNaN(existingDateMs)) {
                    const deltaDays = Math.abs(existingDateMs - candidateDateMs) / (1000 * 60 * 60 * 24);
                    if (deltaDays <= LIFE_EVENT_DATE_DUPLICATE_WINDOW_DAYS && (titleSimilarity >= 0.55 || notesSimilarity >= 0.62)) {
                        return true;
                    }
                }
            }

            return titleSimilarity >= 0.82 || (titleSimilarity >= 0.55 && notesSimilarity >= 0.7);
        });
        if (duplicateLifeEvent) {
            suggestions.push({
                id: `memory-life-event-review-${memory.id}-${duplicateLifeEvent.id}`,
                type: 'celebrate',
                friendId: friend.id,
                friendName: friend.name,
                title: `Review ${friend.name}'s life event`,
                subtitle: `You already logged "${duplicateLifeEvent.title}". Update it if this note adds new details.`,
                icon: 'ClipboardCheck',
                category: 'life-event',
                urgency: getLifeEventUrgency(
                    duplicateLifeEvent.eventDate ? duplicateLifeEvent.eventDate.toISOString() : undefined,
                ),
                actionLabel: 'Review Life Event',
                action: {
                    type: 'life-event',
                    prefillPrompt: `Review the life event for ${friend.name} and update anything that changed.`,
                    lifeEventId: duplicateLifeEvent.id,
                    lifeEventType: duplicateLifeEvent.eventType,
                    lifeEventTitle: duplicateLifeEvent.title,
                    lifeEventNotes: duplicateLifeEvent.notes || prefill.notes,
                    lifeEventDate: duplicateLifeEvent.eventDate
                        ? duplicateLifeEvent.eventDate.toISOString()
                        : prefill.eventDate,
                },
                dismissible: true,
                createdAt: new Date(),
            });

            seenFriendIds.add(friend.id);
            if (suggestions.length >= 2) break;
            continue;
        }

        const dateLabel = prefill.eventDate
            ? new Date(prefill.eventDate).toLocaleDateString()
            : null;
        const subtitle = dateLabel
            ? `You noted "${memory.title}" for ${dateLabel}. Save it as a life event so it stays visible.`
            : `You noted "${memory.title}". Save it as a life event so it stays visible.`;

        suggestions.push({
            id: `memory-life-event-${memory.id}`,
            type: 'celebrate',
            friendId: friend.id,
            friendName: friend.name,
            title: `Capture a milestone for ${friend.name}`,
            subtitle,
            icon: 'Gift',
            category: 'life-event',
            urgency: getLifeEventUrgency(prefill.eventDate),
            actionLabel: 'Add Life Event',
            action: {
                type: 'life-event',
                prefillPrompt: buildLifeEventPrompt(friend.name, prefill),
                lifeEventType: prefill.eventType,
                lifeEventTitle: prefill.title,
                lifeEventNotes: prefill.notes,
                lifeEventDate: prefill.eventDate,
            },
            dismissible: true,
            createdAt: new Date(),
        });

        seenFriendIds.add(friend.id);
        if (suggestions.length >= 2) break;
    }

    return suggestions;
}

function getSuggestionTypeKey(suggestion: Suggestion): string {
    return suggestion.category || suggestion.type || 'Connection';
}

function getTypePenaltySteps(count: number): number {
    if (count >= 6) return 2;
    if (count >= TYPE_PENALTY_DISMISSAL_THRESHOLD) return 1;
    return 0;
}

async function buildDismissalLearningProfile(): Promise<DismissalLearningProfile> {
    const windowStart = Date.now() - ADAPTIVE_WINDOW_DAYS * 86400000;

    const recentDismissals = await database
        .get<SuggestionEvent>('suggestion_events')
        .query(
            Q.where('event_type', 'dismissed'),
            Q.where('event_timestamp', Q.gte(windowStart)),
            Q.sortBy('event_timestamp', Q.desc),
            Q.take(500)
        )
        .fetch();

    const typeDismissalCounts = new Map<string, number>();
    const friendDismissalCounts = new Map<string, number>();

    for (const event of recentDismissals) {
        if (event.suggestionType) {
            typeDismissalCounts.set(
                event.suggestionType,
                (typeDismissalCounts.get(event.suggestionType) || 0) + 1
            );
        }

        if (event.friendId) {
            friendDismissalCounts.set(
                event.friendId,
                (friendDismissalCounts.get(event.friendId) || 0) + 1
            );
        }
    }

    const suppressedFriendIds = new Set<string>();
    for (const [friendId, count] of friendDismissalCounts.entries()) {
        if (count >= FRIEND_SUPPRESSION_DISMISSAL_THRESHOLD) {
            suppressedFriendIds.add(friendId);
        }
    }

    return {
        suppressedFriendIds,
        typeDismissalCounts,
    };
}

function applyDismissalLearning(
    suggestions: Suggestion[],
    profile: DismissalLearningProfile
): Suggestion[] {
    return suggestions
        .filter(suggestion => {
            if (suggestion.urgency === 'critical') return true;
            if (!suggestion.friendId) return true;
            return !profile.suppressedFriendIds.has(suggestion.friendId);
        })
        .map(suggestion => {
            if (suggestion.urgency === 'critical') return suggestion;

            const key = getSuggestionTypeKey(suggestion);
            const dismissalCount = profile.typeDismissalCounts.get(key) || 0;
            const penaltySteps = getTypePenaltySteps(dismissalCount);

            if (penaltySteps === 0) return suggestion;

            let adjustedUrgency: SuggestionUrgency = suggestion.urgency || 'medium';
            for (let i = 0; i < penaltySteps; i++) {
                adjustedUrgency = downgradeUrgency(adjustedUrgency);
            }

            return {
                ...suggestion,
                urgency: adjustedUrgency,
            };
        });
}

/**
 * Fetches and filters suggestions based on friend data and user's current season
 * Refactored to use Scalable Suggestion System (Candidate -> Load -> Data -> Diversify)
 *
 * @param limit - Maximum number of suggestions to return
 * @param season - Current social season for season-aware filtering (optional)
 * @returns Filtered, diversified list of suggestions
 */
export async function fetchSuggestions(
    limit: number = 3,
    season?: SocialSeason | null,
    userCap?: number
): Promise<Suggestion[]> {
    try {


        // 1. Candidate Selection: Identify WHO needs suggestions (limit to Top 50 candidates)
        // This prevents loading all 1000+ friends into memory.
        const candidateIds = await SuggestionCandidateService.getCandidates(50);



        // 2. Data Loading: Fetch Context (Friend + Interactions) only for candidates
        const contextMap = await SuggestionDataLoader.loadContextForCandidates(candidateIds);
        const friends = Array.from(contextMap.values()).map(c => c.friend);
        await archiveExpiredFriendMemories();
        const memoryProfiles = await loadFriendMemoryProfiles(friends.map(friend => friend.id));



        const dismissedMap = await SuggestionStorageService.getDismissedSuggestions();
        const dismissalLearningProfile = await buildDismissalLearningProfile();



        let allSuggestions: Suggestion[] = [];
        const friendStats: PortfolioAnalysisStats['friends'] = [];

        // 3. Generation Loop
        for (const friend of friends) {
            try {
                const context = contextMap.get(friend.id);
                if (!context) continue;

                const currentScore = calculateCurrentScore(friend);

                // Calculate current momentum score
                const momentumLastUpdatedTime = friend.momentumLastUpdated instanceof Date ? friend.momentumLastUpdated.getTime() : new Date(friend.momentumLastUpdated || Date.now()).getTime();
                const daysSinceMomentumUpdate = (Date.now() - momentumLastUpdatedTime) / 86400000;
                const momentumScore = Math.max(0, friend.momentumScore - daysSinceMomentumUpdate);

                // Calculate days since last interaction
                let daysSinceInteraction = 999;
                if (context.lastDate) {
                    daysSinceInteraction = (Date.now() - context.lastDate) / 86400000;
                }

                // Collect stats for portfolio analysis
                friendStats.push({
                    id: friend.id,
                    name: friend.name,
                    tier: friend.dunbarTier as any,
                    archetype: friend.archetype,
                    score: currentScore,
                    daysSinceInteraction: Math.round(daysSinceInteraction),
                });

                // Generate "Engine" Suggestion
                const suggestion = await generateSuggestion({
                    friend: {
                        id: friend.id,
                        name: friend.name,
                        archetype: friend.archetype,
                        dunbarTier: friend.dunbarTier,
                        createdAt: friend.createdAt,
                        birthday: friend.birthday,
                        anniversary: friend.anniversary,
                        relationshipType: friend.relationshipType,
                    } as any,
                    currentScore,
                    lastInteractionDate: context.interactions[0]?.interactionDate, // Data Loader sorts this
                    interactionCount: context.count,
                    momentumScore,
                    recentInteractions: context.interactions.map(i => ({
                        id: i.id,
                        category: i.interactionCategory as any,
                        interactionDate: i.interactionDate,
                        vibe: i.vibe,
                        notes: i.note,
                    } as any)),
                    plannedInteractions: context.plannedInteractions,
                });

                if (suggestion) {
                    // Attach pre-computed tracking context to avoid duplicate queries in useSuggestions
                    suggestion.trackingContext = {
                        friendScore: currentScore,
                        daysSinceLastInteraction: Math.round(daysSinceInteraction),
                    };
                    allSuggestions.push(suggestion);
                }
            } catch (error) {
                Logger.error(`Error generating suggestion for friend ${friend.id}`, error);
            }
        }

        // Safety fallback: if the generator pipeline produced no critical drifts but we have
        // clearly at-risk Inner Circle relationships, synthesize critical drift suggestions.
        const existingCriticalDrifts = allSuggestions.filter(
            s => s.urgency === 'critical' && (s.category === 'drift' || s.category === 'critical-drift')
        );
        if (existingCriticalDrifts.length === 0) {
            const fallbackCriticalFriends = friends
                .map(friend => ({ friend, score: calculateCurrentScore(friend) }))
                .filter(({ friend, score }) => friend.dunbarTier === 'InnerCircle' && score < 30)
                .sort((a, b) => a.score - b.score);

            for (const { friend } of fallbackCriticalFriends) {
                allSuggestions.push({
                    id: `critical-drift-${friend.id}`,
                    friendId: friend.id,
                    friendName: friend.name,
                    urgency: 'critical',
                    category: 'critical-drift',
                    title: `Reconnect with ${friend.name}`,
                    subtitle: 'This core relationship may be drifting. A small reach-out can help.',
                    actionLabel: 'Reach Out',
                    icon: 'Wind',
                    action: { type: 'log', prefilledCategory: 'text-call' },
                    dismissible: false,
                    createdAt: new Date(),
                    type: 'reconnect',
                });
            }
        }



        // 4. Proactive Suggestions (Pattern Analysis)
        const proactiveSuggestions: Suggestion[] = [];
        const MAX_PROACTIVE = 2; // Cap proactive suggestions per session

        for (const friend of friends) {
            if (proactiveSuggestions.length >= MAX_PROACTIVE) break;

            const context = contextMap.get(friend.id);
            const interactions = context?.interactions || [];

            // Analyze pattern for this friend
            const pattern = analyzeInteractionPattern(
                interactions.map(i => ({
                    id: i.id,
                    interactionDate: i.interactionDate,
                    status: 'completed',
                    category: i.interactionCategory,
                }))
            );

            if (!isPatternReliable(pattern)) continue;

            try {
                const proactive = generateProactiveSuggestions(friend, pattern, {
                    includeReciprocity: true,
                    includeSmartScheduling: false,
                });

                // Calculate tracking context for proactive suggestions
                const proactiveScore = calculateCurrentScore(friend);
                const proactiveDaysSince = context?.lastDate
                    ? Math.round((Date.now() - context.lastDate) / 86400000)
                    : 999;

                for (const p of proactive) {
                    if (proactiveSuggestions.length >= MAX_PROACTIVE) break;

                    proactiveSuggestions.push({
                        id: `proactive-${p.type}-${p.friendId}`,
                        friendId: p.friendId,
                        friendName: p.friendName,
                        urgency: p.urgency as 'low' | 'medium' | 'high' | 'critical',
                        category: p.type === 'reciprocity-imbalance' ? 'insight' : 'maintain',
                        title: p.title,
                        subtitle: p.message,
                        actionLabel: p.type.includes('reciprocity') ? 'Consider' : 'Plan',
                        icon: getProactiveIcon(p.type),
                        action: { type: 'plan' as const },
                        dismissible: true,
                        createdAt: new Date(),
                        type: p.type.includes('momentum') ? 'deepen' : 'connect',
                        trackingContext: {
                            friendScore: proactiveScore,
                            daysSinceLastInteraction: proactiveDaysSince,
                        },
                    });
                }
            } catch (error) {
                Logger.error(`Error generating proactive suggestions for friend ${friend.id}`, error);
            }
        }
        allSuggestions.push(...proactiveSuggestions);

        // 5. Signal-Driven Suggestions (Journal/Thread Context)
        // Uses conversation threads, journal signals, and value alignment to generate
        // contextual "relationship moment" suggestions
        try {
            const signalSuggestions = await SignalDrivenGenerator.generate(friends, contextMap, {
                maxSuggestions: 2,
            });
            allSuggestions.push(...signalSuggestions);
        } catch (error) {
            Logger.error('[Suggestions] Error generating signal-driven suggestions', error);
        }

        try {
            const memoryLifeEventSuggestions = await generateMemoryLifeEventSuggestions(friends);
            allSuggestions.push(...memoryLifeEventSuggestions);
        } catch (error) {
            Logger.error('[Suggestions] Error generating memory life-event suggestions', error);
        }

        // 6. Sunday Reflection
        const weeklyReflection = await WeeklyReflectionGenerator.generate();
        if (weeklyReflection) {
            allSuggestions.push(weeklyReflection);
        }

        // 6. Portfolio Insights
        const uniqueFriendStats = Array.from(new Map(friendStats.map(f => [f.id, f])).values());
        if (uniqueFriendStats.length >= 3) {
            // ... (Existing Portfolio Calculation Logic can remain essentially same, but operating on candidates)
            // Limitation: Portfolio stats are now only drawn from "Candidates", not ALL friends.
            // This is a trade-off for performance. Ideally Portfolio Analysis should have its own dedicated "Stats Loader" 
            // that aggregates efficiently without loading models, but for now working on the active set is acceptable 
            // or we accept it catches drift among the "active/drifting" population we just queried.

            const tierScores = {
                inner: {
                    avg: uniqueFriendStats.filter(f => f.tier === 'InnerCircle').reduce((sum, f, _, arr) => sum + f.score / arr.length, 0) || 0,
                    count: uniqueFriendStats.filter(f => f.tier === 'InnerCircle').length,
                    drifting: uniqueFriendStats.filter(f => f.tier === 'InnerCircle' && f.score < 50).length,
                },
                close: {
                    avg: uniqueFriendStats.filter(f => f.tier === 'CloseFriends').reduce((sum, f, _, arr) => sum + f.score / arr.length, 0) || 0,
                    count: uniqueFriendStats.filter(f => f.tier === 'CloseFriends').length,
                    drifting: uniqueFriendStats.filter(f => f.tier === 'CloseFriends' && f.score < 40).length,
                },
                community: {
                    avg: uniqueFriendStats.filter(f => f.tier === 'Community').reduce((sum, f, _, arr) => sum + f.score / arr.length, 0) || 0,
                    count: uniqueFriendStats.filter(f => f.tier === 'Community').length,
                    drifting: uniqueFriendStats.filter(f => f.tier === 'Community' && f.score < 30).length,
                },
            };

            const portfolioInsight = generatePortfolioInsights({
                friends: uniqueFriendStats,
                tierScores,
                archetypeBalance: analyzeArchetypeBalance(uniqueFriendStats),
            });

            if (portfolioInsight) {
                allSuggestions.push(portfolioInsight);
            }
        }

        allSuggestions = applyMemoryAwareScoring(allSuggestions, memoryProfiles);

        // Filter out dismissed (unless critical)
        const active = allSuggestions.filter(s => {
            if (s.urgency === 'critical') return true;
            return !dismissedMap.has(s.id);
        });

        const timeAppropriate = filterSuggestionsByTime(active);
        const seasonFiltered = filterSuggestionsBySeason(timeAppropriate, season);



        const MIN_SUGGESTIONS = 3;
        let finalPool = seasonFiltered;

        // 7. Guaranteed Suggestions (Wildcards, etc.)
        // CRITICAL FIX: Generate guaranteed suggestions even if friends array is empty.
        // Non-friend-dependent suggestions (daily-reflect, generic wildcards) should always be available.
        // This ensures users ALWAYS see at least some suggestions, even new users with no friends.
        const guaranteed = generateGuaranteedSuggestions(friends, finalPool, season);
        const freshGuaranteed = guaranteed.filter(s => !dismissedMap.has(s.id));
        finalPool = [...finalPool, ...freshGuaranteed];

        // Adaptive filtering based on recent dismissal patterns:
        // - Suppress suggestions for friends dismissed repeatedly
        // - De-prioritize frequently dismissed suggestion types
        finalPool = applyDismissalLearning(finalPool, dismissalLearningProfile);



        // 8. Dormant / Triage Logic
        finalPool = await TriageGenerator.apply(finalPool);

        // 9. Diversify
        // If userCap is set, use it. Otherwise fallback to limit.
        // The season config usually sets a "maxDaily", but if the user explicitly asks for more/less, we respect it.
        // However, we still consult the season config for OTHER things (like filtering categories), but not the count if userCap is present.

        let effectiveLimit = limit;
        if (userCap !== undefined) {
            effectiveLimit = userCap;
        } else if (season) {
            effectiveLimit = Math.max(limit, getSeasonSuggestionConfig(season).maxDaily);
        }

        const friendLookup = new Map(friends.map(f => [f.id, f]));
        const isLowEnergy = season === 'resting';

        let finalSuggestions = selectDiverseSuggestions(finalPool, effectiveLimit, {
            isLowEnergy,
            friendLookup,
        });



        // 10. EMERGENCY FALLBACK: Ensure users ALWAYS see at least one suggestion
        // This is the last line of defense against blank suggestion screens
        if (finalSuggestions.length === 0) {
            Logger.warn('[Suggestions] Emergency fallback triggered - generating fallback suggestions');

            const today = new Date().toISOString().split('T')[0];

            // Emergency daily reflect - always works, no dependencies
            const emergencyReflect: Suggestion = {
                id: `emergency-reflect-${today}`,
                friendId: '',
                type: 'reflect',
                title: 'Take a moment to reflect',
                subtitle: 'How are your relationships feeling today?',
                icon: 'Heart',
                category: 'daily-reflect',
                urgency: 'low',
                actionLabel: 'Reflect',
                action: { type: 'reflect' },
                dismissible: true,
                createdAt: new Date(),
            };

            // Emergency wildcard - generic, no friend required
            const emergencyWildcard: Suggestion = {
                id: `emergency-wildcard-${today}`,
                friendId: '',
                type: 'connect',
                title: 'Reach out to someone',
                subtitle: 'A simple message can brighten someone\'s day',
                icon: 'MessageCircle',
                category: 'wildcard',
                urgency: 'low',
                actionLabel: 'Connect',
                action: { type: 'log', prefilledCategory: 'text-call' },
                dismissible: true,
                createdAt: new Date(),
            };

            // Only add if not dismissed
            if (!dismissedMap.has(emergencyReflect.id)) {
                finalSuggestions.push(emergencyReflect);
            }
            if (!dismissedMap.has(emergencyWildcard.id)) {
                finalSuggestions.push(emergencyWildcard);
            }
        }

        if (finalSuggestions.length > 0) {
            SeasonAnalyticsService.trackSuggestionsShown(finalSuggestions.length).catch(e => {
                Logger.error('[Analytics] Failed to track suggestions shown', e);
            });
        }

        return finalSuggestions;
    } catch (error) {
        // GLOBAL CATCH: This should catch ANY error in the entire pipeline
        Logger.error(`[Suggestions] FATAL ERROR in fetchSuggestions pipeline`, error);
        return []; // Return empty array so UI doesn't break
    }
}
