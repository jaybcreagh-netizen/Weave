
import { Q } from '@nozbe/watermelondb';
import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import { generateSuggestion } from './suggestion-engine';
import { generateGuaranteedSuggestions } from './guaranteed-suggestions.service';
import * as SuggestionStorageService from './suggestion-storage.service';
import { Suggestion } from '@/shared/types/common';
import {
    calculateCurrentScore,
    filterSuggestionsBySeason,
    getSeasonSuggestionConfig,
    SeasonAnalyticsService
} from '@/modules/intelligence';
import type { SocialSeason } from '@/db/models/UserProfile';
import { filterSuggestionsByTime } from '@/shared/utils/time-aware-filter';
import {
    generatePortfolioInsights,
    analyzeArchetypeBalance,
    type PortfolioAnalysisStats,
    generateProactiveSuggestions,
    isPatternReliable,
    analyzeInteractionPattern,
} from '@/modules/insights';

import { SuggestionCandidateService } from './suggestion-system/SuggestionCandidateService';
import { SuggestionDataLoader } from './suggestion-system/SuggestionDataLoader';
import { selectDiverseSuggestions } from './suggestion-system/SuggestionDiversifier';
import { TriageGenerator } from './suggestion-engine/generators/TriageGenerator';
import { WeeklyReflectionGenerator } from './suggestion-engine/generators/WeeklyReflectionGenerator';

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
    console.time('fetchSuggestions:modular_pipeline');

    // 1. Candidate Selection: Identify WHO needs suggestions (limit to Top 50 candidates)
    // This prevents loading all 1000+ friends into memory.
    const candidateIds = await SuggestionCandidateService.getCandidates(50);

    // 2. Data Loading: Fetch Context (Friend + Interactions) only for candidates
    const contextMap = await SuggestionDataLoader.loadContextForCandidates(candidateIds);
    const friends = Array.from(contextMap.values()).map(c => c.friend);

    console.timeEnd('fetchSuggestions:modular_pipeline');

    const dismissedMap = await SuggestionStorageService.getDismissedSuggestions();
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
                allSuggestions.push(suggestion);
            }
        } catch (error) {
            console.error(`Error generating suggestion for friend ${friend.id}:`, error);
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
                });
            }
        } catch (error) {
            console.error(`Error generating proactive suggestions for friend ${friend.id}:`, error);
        }
    }
    allSuggestions.push(...proactiveSuggestions);

    // 5. Sunday Reflection
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
        console.warn('[Suggestions] Emergency fallback triggered - generating fallback suggestions');

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
            console.error('[Analytics] Failed to track suggestions shown:', e);
        });
    }

    return finalSuggestions;
}


