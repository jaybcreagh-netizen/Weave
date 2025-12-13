import { Q } from '@nozbe/watermelondb';
import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import { generateSuggestion } from './suggestion-engine.service';
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
import Interaction from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import { filterSuggestionsByTime } from '@/shared/utils/time-aware-filter';
import {
    generatePortfolioInsights,
    analyzeArchetypeBalance,
    type PortfolioAnalysisStats
} from '@/modules/insights';

/**
 * Selects diverse suggestions to provide a balanced "options menu" experience.
 * Ensures variety across different action types: reflect, drift/reconnect, deepen/momentum.
 */
export function selectDiverseSuggestions(suggestions: Suggestion[], maxCount: number): Suggestion[] {
    if (suggestions.length === 0) return [];

    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };

    // Safe urgency access
    const getUrgencyScore = (u?: string) => urgencyOrder[u as keyof typeof urgencyOrder] ?? 3;

    // Group suggestions by their action category
    const buckets = {
        critical: suggestions.filter(s => s.urgency === 'critical'),
        reflect: suggestions.filter(s => s.category === 'reflect'),
        lifeEvent: suggestions.filter(s => s.category === 'life-event'),
        drift: suggestions.filter(s => s.category === 'drift'),
        deepen: suggestions.filter(s => s.category === 'deepen' || s.category === 'celebrate'),
        maintain: suggestions.filter(s => s.category === 'maintain'),
        insight: suggestions.filter(s => s.category === 'insight'),
        portfolio: suggestions.filter(s => s.category === 'portfolio'),
        dailyReflect: suggestions.filter(s => s.category === 'daily-reflect'),
        gentleNudge: suggestions.filter(s => s.category === 'gentle-nudge'),
        wildcard: suggestions.filter(s => s.category === 'wildcard'),
    };

    const selected: Suggestion[] = [];

    // 1. ALWAYS include critical suggestions (non-dismissible emergencies)
    selected.push(...buckets.critical);

    if (selected.length >= maxCount) {
        return selected.slice(0, maxCount);
    }

    // 2. Build a diverse set from different buckets
    // Priority order: reflect -> lifeEvent -> drift -> portfolio -> deepen -> maintain -> insight -> guaranteed types
    const bucketOrder: Array<keyof typeof buckets> = [
        'reflect', 'lifeEvent', 'drift', 'portfolio', 'deepen', 'maintain', 'insight',
        'dailyReflect', 'gentleNudge', 'wildcard'
    ];

    // Round-robin selection: pick best from each bucket
    for (const bucketName of bucketOrder) {
        if (selected.length >= maxCount) break;

        const bucket = buckets[bucketName];
        if (bucket.length === 0) continue;

        // Sort bucket by urgency, then pick the top one
        const sorted = bucket.sort((a, b) => getUrgencyScore(a.urgency) - getUrgencyScore(b.urgency));
        selected.push(sorted[0]);
    }

    // 3. If we still have room, fill with highest urgency remaining
    if (selected.length < maxCount) {
        const selectedIds = new Set(selected.map(s => s.id));
        const remaining = suggestions
            .filter(s => !selectedIds.has(s.id))
            .sort((a, b) => getUrgencyScore(a.urgency) - getUrgencyScore(b.urgency));

        while (selected.length < maxCount && remaining.length > 0) {
            selected.push(remaining.shift()!);
        }
    }

    // Final sort: critical first, then by original urgency
    return selected.sort((a, b) => getUrgencyScore(a.urgency) - getUrgencyScore(b.urgency));
}

/**
 * Fetches and filters suggestions based on friend data and user's current season
 *
 * @param limit - Maximum number of suggestions to return
 * @param season - Current social season for season-aware filtering (optional)
 * @returns Filtered, diversified list of suggestions
 */
export async function fetchSuggestions(
    limit: number = 3,
    season?: SocialSeason | null
): Promise<Suggestion[]> {
    console.time('fetchSuggestions:batch_load');

    // Fetch all friends from DB
    const friends = await database.get<FriendModel>('friends').query().fetch();

    // OPTIMIZED: Use a single raw SQL query to get latest interaction date + count per friend
    // This replaces the previous 3-query approach (friends + interaction_friends + interactions)
    const sql = `
        SELECT 
            ifr.friend_id,
            MAX(i.interaction_date) as last_interaction_date,
            COUNT(i.id) as interaction_count
        FROM interaction_friends ifr
        INNER JOIN interactions i ON ifr.interaction_id = i.id AND i.status = 'completed'
        GROUP BY ifr.friend_id
    `;

    // Build lookup map from raw SQL results
    const interactionsByFriendId = new Map<string, { lastDate: number | null; count: number; interactions: Interaction[] }>();

    try {
        const adapter = database.adapter as any;
        const result = await adapter.unsafeExecute({
            sqls: [[sql, []]],
        });

        // Parse raw SQL results
        if (result && Array.isArray(result) && result[0] && Array.isArray(result[0])) {
            for (const row of result[0]) {
                interactionsByFriendId.set(row.friend_id, {
                    lastDate: row.last_interaction_date,
                    count: row.interaction_count || 0,
                    interactions: [], // Will be populated below for friends needing recent interactions
                });
            }
        }
    } catch (error) {
        console.warn('[fetchSuggestions] Raw SQL failed, using fallback:', error);
    }

    // For friends that need recent interactions for suggestion generation,
    // fetch them in a secondary optimized batch (only for friends with interactions)
    const friendIdsWithInteractions = [...interactionsByFriendId.keys()];

    if (friendIdsWithInteractions.length > 0) {
        // Fetch recent interactions for suggestion context (top 5 per friend)
        const recentInteractionsQuery = await database
            .get<InteractionFriend>('interaction_friends')
            .query(Q.where('friend_id', Q.oneOf(friendIdsWithInteractions)))
            .fetch();

        const interactionIds = [...new Set(recentInteractionsQuery.map(ifr => ifr.interactionId))];

        if (interactionIds.length > 0) {
            const allInteractions = await database
                .get<Interaction>('interactions')
                .query(
                    Q.where('id', Q.oneOf(interactionIds)),
                    Q.where('status', 'completed'),
                    Q.sortBy('interaction_date', Q.desc)
                )
                .fetch();

            // Build interaction map
            const interactionMap = new Map<string, Interaction>(allInteractions.map(i => [i.id, i]));

            // Populate interactions for each friend
            for (const link of recentInteractionsQuery) {
                const interaction = interactionMap.get(link.interactionId);
                if (interaction) {
                    const entry = interactionsByFriendId.get(link.friendId);
                    if (entry && entry.interactions.length < 5) {
                        entry.interactions.push(interaction);
                    }
                }
            }
        }
    }

    console.timeEnd('fetchSuggestions:batch_load');


    const dismissedMap = await SuggestionStorageService.getDismissedSuggestions();
    const allSuggestions: Suggestion[] = [];
    const friendStats: PortfolioAnalysisStats['friends'] = [];

    for (const friend of friends) {
        try {
            // Get interactions data from our optimized lookup map
            const friendData = interactionsByFriendId.get(friend.id);
            const friendInteractions = friendData?.interactions || [];

            // Sort interactions (newest first) - already partially sorted from query
            const sortedInteractions = friendInteractions.sort(
                (a, b) => {
                    const timeA = a.interactionDate instanceof Date ? a.interactionDate.getTime() : new Date(a.interactionDate || 0).getTime();
                    const timeB = b.interactionDate instanceof Date ? b.interactionDate.getTime() : new Date(b.interactionDate || 0).getTime();
                    return timeB - timeA;
                }
            );

            const lastInteraction = sortedInteractions[0];
            const currentScore = calculateCurrentScore(friend);

            // Calculate current momentum score (decays over time)
            const momentumLastUpdatedTime = friend.momentumLastUpdated instanceof Date ? friend.momentumLastUpdated.getTime() : new Date(friend.momentumLastUpdated || Date.now()).getTime();
            const daysSinceMomentumUpdate = (Date.now() - momentumLastUpdatedTime) / 86400000;
            const momentumScore = Math.max(0, friend.momentumScore - daysSinceMomentumUpdate);

            // Calculate days since last interaction (using optimized lastDate from raw SQL when available)
            let daysSinceInteraction = 999;
            if (friendData?.lastDate) {
                daysSinceInteraction = (Date.now() - friendData.lastDate) / 86400000;
            } else if (lastInteraction?.interactionDate) {
                const lastInteractionTime = lastInteraction.interactionDate instanceof Date
                    ? lastInteraction.interactionDate.getTime()
                    : new Date(lastInteraction.interactionDate).getTime();
                daysSinceInteraction = (Date.now() - lastInteractionTime) / 86400000;
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
                lastInteractionDate: lastInteraction?.interactionDate,
                interactionCount: friendData?.count ?? sortedInteractions.length,
                momentumScore,
                recentInteractions: sortedInteractions.slice(0, 5).map(i => ({
                    id: i.id, // Fixed: use 'id' instead of 'uuid' which doesn't exist on Interaction model
                    category: i.interactionCategory as any,
                    interactionDate: i.interactionDate,
                    vibe: i.vibe,
                    notes: i.note,
                } as any)),
            });

            if (suggestion) {
                allSuggestions.push(suggestion);
            }
        } catch (error) {
            console.error(`Error generating suggestion for friend ${friend.id}:`, error);
        }
    }

    // Generate portfolio-level insights
    // Deduplicate friend stats by ID (in case of duplicates in DB)
    const uniqueFriendStats = Array.from(
        new Map(friendStats.map(f => [f.id, f])).values()
    );

    if (uniqueFriendStats.length >= 3) {
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

        const portfolioAnalysis: PortfolioAnalysisStats = {
            friends: uniqueFriendStats,
            tierScores,
            archetypeBalance: analyzeArchetypeBalance(uniqueFriendStats),
        };

        const portfolioInsight = generatePortfolioInsights(portfolioAnalysis);

        if (portfolioInsight) {
            allSuggestions.push(portfolioInsight);
        }
    }

    // MINIMUM SUGGESTIONS: Add guaranteed suggestions if we're below threshold
    // This ensures users always have meaningful options even when network is healthy
    const MIN_SUGGESTIONS = 3;
    if (allSuggestions.length < MIN_SUGGESTIONS && friends.length > 0) {
        const guaranteed = generateGuaranteedSuggestions(friends, allSuggestions, season);
        allSuggestions.push(...guaranteed);
    }

    // Filter out dismissed (unless critical)
    const active = allSuggestions.filter(s => {
        if (s.urgency === 'critical') return true; // Critical always shows
        return !dismissedMap.has(s.id);
    });

    // Apply time-based filtering (e.g., don't show "plan dinner" at 11pm)
    const timeAppropriate = filterSuggestionsByTime(active);

    // Apply season-aware filtering (caps, category restrictions, life event bypass)
    const seasonFiltered = filterSuggestionsBySeason(timeAppropriate, season);

    // Get season-appropriate limit (use season config if provided)
    const effectiveLimit = season
        ? Math.max(limit, getSeasonSuggestionConfig(season).maxDaily)
        : limit;

    // Diversify suggestions to provide balanced "options menu" experience
    const finalSuggestions = selectDiverseSuggestions(seasonFiltered, effectiveLimit);

    // ANALYTICS: Track how many suggestions are being shown
    if (finalSuggestions.length > 0) {
        SeasonAnalyticsService.trackSuggestionsShown(finalSuggestions.length).catch(e => {
            console.error('[Analytics] Failed to track suggestions shown:', e);
        });
    }

    return finalSuggestions;
}
