import { Q } from '@nozbe/watermelondb';
import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import { generateSuggestion } from './suggestion-engine.service';
import * as SuggestionStorageService from './suggestion-storage.service';
import { Suggestion } from '@/shared/types/common';
import { calculateCurrentScore } from '@/modules/intelligence/services/orchestrator.service';
import Interaction from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import { filterSuggestionsByTime } from '@/shared/utils/time-aware-filter';
import {
    generatePortfolioInsights,
    analyzeArchetypeBalance,
    type PortfolioAnalysisStats
} from '@/modules/insights/services/portfolio.service';

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
    };

    const selected: Suggestion[] = [];

    // 1. ALWAYS include critical suggestions (non-dismissible emergencies)
    selected.push(...buckets.critical);

    if (selected.length >= maxCount) {
        return selected.slice(0, maxCount);
    }

    // 2. Build a diverse set from different buckets
    // Priority order: reflect -> lifeEvent -> drift -> portfolio -> deepen -> maintain -> insight
    const bucketOrder: Array<keyof typeof buckets> = ['reflect', 'lifeEvent', 'drift', 'portfolio', 'deepen', 'maintain', 'insight'];

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

export async function fetchSuggestions(limit: number = 3): Promise<Suggestion[]> {
    // Fetch all friends directly from DB
    const friends = await database.get<FriendModel>('friends').query().fetch();

    const dismissedMap = await SuggestionStorageService.getDismissedSuggestions();
    const allSuggestions: Suggestion[] = [];
    const friendStats: PortfolioAnalysisStats['friends'] = [];

    for (const friend of friends) {
        try {
            // Query friend's interactions through the junction table
            const interactionFriends = await database
                .get<InteractionFriend>('interaction_friends')
                .query(Q.where('friend_id', friend.id))
                .fetch();

            const interactionIds = interactionFriends.map(ifriend => ifriend.interactionId);

            let sortedInteractions: Interaction[] = [];
            if (interactionIds.length > 0) {
                const friendInteractions = await database
                    .get<Interaction>('interactions')
                    .query(
                        Q.where('id', Q.oneOf(interactionIds)),
                        Q.where('status', 'completed') // Only include completed interactions
                    )
                    .fetch();

                sortedInteractions = friendInteractions.sort(
                    (a, b) => {
                        const timeA = a.interactionDate instanceof Date ? a.interactionDate.getTime() : new Date(a.interactionDate || 0).getTime();
                        const timeB = b.interactionDate instanceof Date ? b.interactionDate.getTime() : new Date(b.interactionDate || 0).getTime();
                        return timeB - timeA;
                    }
                );
            }

            const lastInteraction = sortedInteractions[0];
            const currentScore = calculateCurrentScore(friend);

            // Calculate current momentum score (decays over time)
            const momentumLastUpdatedTime = friend.momentumLastUpdated instanceof Date ? friend.momentumLastUpdated.getTime() : new Date(friend.momentumLastUpdated || Date.now()).getTime();
            const daysSinceMomentumUpdate = (Date.now() - momentumLastUpdatedTime) / 86400000;
            const momentumScore = Math.max(0, friend.momentumScore - daysSinceMomentumUpdate);

            // Calculate days since last interaction
            const lastInteractionTime = lastInteraction && lastInteraction.interactionDate
                ? (lastInteraction.interactionDate instanceof Date ? lastInteraction.interactionDate.getTime() : new Date(lastInteraction.interactionDate).getTime())
                : 0;

            const daysSinceInteraction = lastInteraction
                ? (Date.now() - lastInteractionTime) / 86400000
                : 999;

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
                interactionCount: sortedInteractions.length,
                momentumScore,
                recentInteractions: sortedInteractions.slice(0, 5).map(i => ({
                    id: i.id,
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

    // Filter out dismissed (unless critical)
    const active = allSuggestions.filter(s => {
        if (s.urgency === 'critical') return true; // Critical always shows
        return !dismissedMap.has(s.id);
    });

    // Apply time-based filtering (e.g., don't show "plan dinner" at 11pm)
    const timeAppropriate = filterSuggestionsByTime(active);

    // Diversify suggestions to provide balanced "options menu" experience
    return selectDiverseSuggestions(timeAppropriate, limit);
}
