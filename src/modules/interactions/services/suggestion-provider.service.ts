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
    type PortfolioAnalysisStats,
    generateProactiveSuggestions,
    isPatternReliable,
    analyzeInteractionPattern,
} from '@/modules/insights';
import { InteractionCategory } from '@/shared/types/common';

// Low-energy archetypes that work well for quieter, less draining connections
const LOW_ENERGY_ARCHETYPES = ['Hermit', 'HighPriestess', 'Empress'];

// Low-energy activity types that require less social bandwidth
const LOW_ENERGY_CATEGORIES: InteractionCategory[] = ['text-call', 'voice-note', 'hangout'];

/**
 * Options for diverse suggestion selection
 */
interface SelectDiverseOptions {
    /** When true, boosts friends with low-energy archetypes and low-energy activity types */
    isLowEnergy?: boolean;
    /** Friend lookup for archetype checking (needed for low-energy boost) */
    friendLookup?: Map<string, FriendModel>;
}

/**
 * Selects diverse suggestions to provide a balanced "options menu" experience.
 * Ensures variety across different action types: reflect, drift/reconnect, deepen/momentum.
 * In low-energy mode, boosts suggestions for Hermit/Empress archetypes and text/call activities.
 */
export function selectDiverseSuggestions(
    suggestions: Suggestion[],
    maxCount: number,
    options?: SelectDiverseOptions
): Suggestion[] {
    if (suggestions.length === 0) return [];

    let workingSuggestions = [...suggestions];

    // Apply low-energy boosting if enabled
    if (options?.isLowEnergy && options?.friendLookup) {
        workingSuggestions = workingSuggestions.map(s => {
            const friend = options.friendLookup?.get(s.friendId);
            const isLowEnergyArchetype = friend && LOW_ENERGY_ARCHETYPES.includes(friend.archetype || '');
            const isLowEnergyCategory = LOW_ENERGY_CATEGORIES.includes(
                s.action?.prefilledCategory as InteractionCategory
            );

            // Assign boost score for sorting
            return {
                ...s,
                _lowEnergyBoost: (isLowEnergyArchetype ? 2 : 0) + (isLowEnergyCategory ? 1 : 0),
            };
        }).sort((a, b) => {
            // First sort by low-energy boost (descending)
            const boostDiff = ((b as any)._lowEnergyBoost || 0) - ((a as any)._lowEnergyBoost || 0);
            if (boostDiff !== 0) return boostDiff;
            // Then fall through to normal urgency sorting
            return 0;
        });
    }

    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };

    // Safe urgency access
    const getUrgencyScore = (u?: string) => urgencyOrder[u as keyof typeof urgencyOrder] ?? 3;

    // Group suggestions by their action category
    const buckets = {
        critical: workingSuggestions.filter(s => s.urgency === 'critical'),
        reflect: workingSuggestions.filter(s => s.category === 'reflect'),
        lifeEvent: workingSuggestions.filter(s => s.category === 'life-event'),
        drift: workingSuggestions.filter(s => s.category === 'drift'),
        deepen: workingSuggestions.filter(s => s.category === 'deepen' || s.category === 'celebrate'),
        maintain: workingSuggestions.filter(s => s.category === 'maintain'),
        insight: workingSuggestions.filter(s => s.category === 'insight'),
        portfolio: workingSuggestions.filter(s => s.category === 'portfolio'),
        dailyReflect: workingSuggestions.filter(s => s.category === 'daily-reflect'),
        gentleNudge: workingSuggestions.filter(s => s.category === 'gentle-nudge'),
        wildcard: workingSuggestions.filter(s => s.category === 'wildcard'),
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
        const remaining = workingSuggestions
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

    // Build lookup map for interaction data per friend
    const interactionsByFriendId = new Map<string, { lastDate: number | null; count: number; interactions: Interaction[]; plannedInteractions: Interaction[] }>();

    // Initialize empty entries for all friends
    for (const friend of friends) {
        interactionsByFriendId.set(friend.id, {
            lastDate: null,
            count: 0,
            interactions: [],
            plannedInteractions: [],
        });
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
                    Q.where('status', Q.oneOf(['completed', 'planned'])),
                    Q.sortBy('interaction_date', Q.desc)
                )
                .fetch();

            // Build interaction map
            const interactionMap = new Map<string, Interaction>(allInteractions.map(i => [i.id, i]));

            // Build a map to track interactions per friend
            const friendInteractionsTemp = new Map<string, Interaction[]>();

            // Populate interactions for each friend
            for (const link of recentInteractionsQuery) {
                const interaction = interactionMap.get(link.interactionId);
                if (interaction) {
                    if (!friendInteractionsTemp.has(link.friendId)) {
                        friendInteractionsTemp.set(link.friendId, []);
                    }
                    friendInteractionsTemp.get(link.friendId)!.push(interaction);
                }
            }

            // Update the lookup map with computed values
            for (const [friendId, interactions] of friendInteractionsTemp) {
                const entry = interactionsByFriendId.get(friendId);
                if (entry) {
                    // Sort by date descending, keep up to 5
                    const sorted = interactions.sort((a, b) => {
                        const timeA = a.interactionDate instanceof Date ? a.interactionDate.getTime() : new Date(a.interactionDate || 0).getTime();
                        const timeB = b.interactionDate instanceof Date ? b.interactionDate.getTime() : new Date(b.interactionDate || 0).getTime();
                        return timeB - timeA;
                    });

                    // Separate completed vs planned
                    const completed = sorted.filter(i => i.status === 'completed');
                    const planned = sorted.filter(i => i.status === 'planned');

                    entry.interactions = completed.slice(0, 5);
                    entry.plannedInteractions = planned; // Keep all planned? Or limit?
                    entry.count = completed.length;

                    // Get the latest interaction date (from completed only)
                    if (completed.length > 0 && completed[0].interactionDate) {
                        const lastDate = completed[0].interactionDate;
                        entry.lastDate = lastDate instanceof Date ? lastDate.getTime() : new Date(lastDate).getTime();
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
            const plannedInteractions = friendData?.plannedInteractions || [];

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
                plannedInteractions: plannedInteractions,
            });

            if (suggestion) {
                allSuggestions.push(suggestion);
            }
        } catch (error) {
            console.error(`Error generating suggestion for friend ${friend.id}:`, error);
        }
    }

    // Generate proactive suggestions for friends with reliable patterns
    const proactiveSuggestions: Suggestion[] = [];
    const MAX_PROACTIVE = 2; // Cap proactive suggestions per session

    for (const friend of friends) {
        if (proactiveSuggestions.length >= MAX_PROACTIVE) break;

        const friendData = interactionsByFriendId.get(friend.id);
        const interactions = friendData?.interactions || [];

        // Analyze pattern for this friend
        const pattern = analyzeInteractionPattern(
            interactions.map(i => ({
                id: i.id,
                interactionDate: i.interactionDate,
                status: 'completed',
                category: i.interactionCategory,
            }))
        );

        // Only generate proactive suggestions for friends with reliable patterns
        if (!isPatternReliable(pattern)) continue;

        try {
            const proactive = generateProactiveSuggestions(friend, pattern, {
                includeReciprocity: true,
                includeSmartScheduling: false, // Phase 3
            });

            // Convert ProactiveSuggestion to Suggestion format
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

    // Add proactive suggestions to the pool
    allSuggestions.push(...proactiveSuggestions);

    // Sunday Reflection Logic
    const today = new Date();
    if (today.getDay() === 0) { // Sunday
        const startOfToday = new Date(today);
        startOfToday.setHours(0, 0, 0, 0);

        // Check if reflection exists for this week (created today or later)
        const weeklyReflectionsCount = await database.get('weekly_reflections').query(
            Q.where('created_at', Q.gte(startOfToday.getTime()))
        ).fetchCount();

        if (weeklyReflectionsCount === 0) {
            allSuggestions.push({
                id: 'weekly-reflection-sunday',
                friendId: '',
                friendName: 'Yourself',
                urgency: 'high',
                category: 'insight',
                title: 'Sunday Reflection',
                subtitle: 'Take a moment to look back on your week.',
                actionLabel: 'Reflect',
                icon: 'BookOpen',
                action: { type: 'reflect' },
                dismissible: true,
                createdAt: new Date(),
                type: 'reflect'
            });
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

    // NOTE: Guaranteed suggestions are now added AFTER filtering (see below)
    // This ensures users always have options even when filters remove regular suggestions

    // Filter out dismissed (unless critical)
    const active = allSuggestions.filter(s => {
        if (s.urgency === 'critical') return true; // Critical always shows
        return !dismissedMap.has(s.id);
    });

    // Apply time-based filtering (e.g., don't show "plan dinner" at 11pm)
    const timeAppropriate = filterSuggestionsByTime(active);

    // Apply season-aware filtering (caps, category restrictions, life event bypass)
    const seasonFiltered = filterSuggestionsBySeason(timeAppropriate, season);

    // POST-FILTER GUARANTEED: Ensure minimum suggestions after all filters
    // This fixes the issue where guaranteed suggestions were being filtered out
    const MIN_SUGGESTIONS = 3;
    let finalPool = seasonFiltered;

    if (finalPool.length < MIN_SUGGESTIONS && friends.length > 0) {
        const guaranteed = generateGuaranteedSuggestions(friends, finalPool, season);

        // Filter guaranteed suggestions by dismissal only (not time/season)
        // Guaranteed suggestions are designed to be low-pressure and always appropriate
        const freshGuaranteed = guaranteed.filter(s => !dismissedMap.has(s.id));

        finalPool = [...finalPool, ...freshGuaranteed];
    }

    // Get season-appropriate limit (use season config if provided)
    const effectiveLimit = season
        ? Math.max(limit, getSeasonSuggestionConfig(season).maxDaily)
        : limit;

    // Build friend lookup for low-energy mode
    const friendLookup = new Map(friends.map(f => [f.id, f]));

    // Determine if user is in low-energy mode (resting season)
    const isLowEnergy = season === 'resting';

    // Diversify suggestions to provide balanced "options menu" experience
    // In low-energy mode, boost Hermit/Empress friends and text/call activities
    const finalSuggestions = selectDiverseSuggestions(finalPool, effectiveLimit, {
        isLowEnergy,
        friendLookup,
    });

    // ANALYTICS: Track how many suggestions are being shown
    if (finalSuggestions.length > 0) {
        SeasonAnalyticsService.trackSuggestionsShown(finalSuggestions.length).catch(e => {
            console.error('[Analytics] Failed to track suggestions shown:', e);
        });
    }

    return finalSuggestions;
}

