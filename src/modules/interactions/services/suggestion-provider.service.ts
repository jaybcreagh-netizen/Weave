
import { Q } from '@nozbe/watermelondb';
import Logger from '@/shared/utils/Logger';
import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import FriendMemory from '@/db/models/FriendMemory';
import SuggestionEvent from '@/db/models/SuggestionEvent';
import UserProfile from '@/db/models/UserProfile';
import { generateSuggestion } from './suggestion-engine';
import { generateGuaranteedSuggestions } from './guaranteed-suggestions.service';
import * as SuggestionStorageService from './suggestion-storage.service';
import { Suggestion, InteractionCategory, type Tier } from '@/shared/types/common';
import { calculateCurrentScore } from '@/modules/intelligence/services/orchestrator.service';
import {
    filterSuggestionsBySeason,
    getSeasonSuggestionConfig,
} from '@/modules/intelligence/services/social-season/season-suggestions.service';
import { SeasonAnalyticsService } from '@/modules/intelligence/services/social-season/season-analytics.service';
import type { SocialSeason } from '@/db/models/UserProfile';
import { filterSuggestionsByTime } from '@/shared/utils/time-aware-filter';
import {
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
import { buildProactiveSuggestion } from './suggestion-engine/generators/proactive.shared';
import {
    buildPortfolioAnalysis,
    buildPortfolioSuggestion,
} from './suggestion-engine/generators/portfolio.shared';
import { generateMemoryLifeEventOpportunities } from './suggestion-engine/generators/memory-life-event.shared';
import {
    evaluateLegacySuggestionShadow,
    type LegacySuggestionShadowResult,
} from './opportunity-system/LegacySuggestionShadowService';
import { resolvePreferredSuggestionWindows } from './opportunity-system/personal-timing';
import {
    isFocusSelectorEnabled,
    isOpportunityPoolEnabled,
    isOpportunitySystemShadowModeEnabled,
} from './opportunity-system/flags';
import { resolveSelectorOpportunities } from './opportunity-system/OpportunitySynthesisService';
import { SelectorTuningService } from './opportunity-system/SelectorTuningService';
import {
    SelectorExperimentService,
    applySelectorExperimentToOptions,
} from './opportunity-system/SelectorExperimentService';
import { OpportunityPremiumCopyService } from './opportunity-system/OpportunityPremiumCopyService';
import {
    SuggestionPacingService,
    type SuggestionPacingState,
    type SuggestionQuietReason,
} from './opportunity-system/SuggestionPacingService';
import type {
    SelectionResult,
    SelectorSurfaceRequestKind,
} from './opportunity-system/types';
import type { SelectorSignals } from './opportunity-system/scoring/score-types';
import { opportunityToSuggestion } from './opportunity-system/OpportunityAdapter';
import { getOptionalQueryCollection } from '@/shared/utils/optional-query-collection';

export interface SuggestionFetchResult {
    suggestions: Suggestion[];
    selectorSuggestions: Suggestion[];
    surfaceSource: 'legacy-list' | 'selector';
    selectionReason?: SelectionResult['reason'];
    selectorOpportunitySource?: 'synthesized' | 'pool';
    selectorSuggestionMetadata?: Record<string, SelectorSuggestionMetadata>;
    pacing?: SuggestionPacingState;
    quietReason?: SuggestionQuietReason;
    surfaceRequestKind?: SelectorSurfaceRequestKind;
}

export interface SelectorSuggestionMetadata {
    compositeScore: number;
    scoreBreakdown: Record<string, number>;
    surfaceSlot: 'primary' | 'secondary';
}

export interface SuggestionSurfaceOptions {
    forceSelector?: boolean;
    trackAnalytics?: boolean;
    respectPacing?: boolean;
    manualPull?: boolean;
}

function buildSelectorSuggestionMetadata(
    shadow: LegacySuggestionShadowResult
): Record<string, SelectorSuggestionMetadata> {
    const metadata: Record<string, SelectorSuggestionMetadata> = {};
    const slots: Array<['primary' | 'secondary', Suggestion | null, typeof shadow.evaluation.selection.primary]> = [
        ['primary', shadow.selectedSuggestions.primary, shadow.evaluation.selection.primary],
        ['secondary', shadow.selectedSuggestions.secondary, shadow.evaluation.selection.secondary],
    ];

    for (const [surfaceSlot, suggestion, scoredOpportunity] of slots) {
        if (!suggestion || !scoredOpportunity) {
            continue;
        }

        metadata[suggestion.id] = {
            compositeScore: scoredOpportunity.totalScore,
            scoreBreakdown: { ...scoredOpportunity.scoreBreakdown },
            surfaceSlot,
        };
    }

    return metadata;
}

async function maybeApplyPremiumSelectorCopy(
    shadow: LegacySuggestionShadowResult,
    selectorSuggestions: Suggestion[],
    copyVariant?: 'control' | 'concise' | 'why-now' | 'premium'
): Promise<Suggestion[]> {
    if (copyVariant !== 'premium' || selectorSuggestions.length === 0) {
        return selectorSuggestions;
    }

    const premiumInputs = [
        {
            opportunity: shadow.evaluation.selection.primary,
            suggestion: shadow.selectedSuggestions.primary,
        },
        {
            opportunity: shadow.evaluation.selection.secondary,
            suggestion: shadow.selectedSuggestions.secondary,
        },
    ].filter((
        entry
    ): entry is {
        opportunity: NonNullable<typeof shadow.evaluation.selection.primary>;
        suggestion: Suggestion;
    } => !!entry.opportunity && !!entry.suggestion);

    if (premiumInputs.length === 0) {
        return selectorSuggestions;
    }

    const premiumSuggestions = await OpportunityPremiumCopyService.enhanceSuggestions(
        premiumInputs
    );
    const premiumById = new Map(premiumSuggestions.map(suggestion => [suggestion.id, suggestion]));

    return selectorSuggestions.map(suggestion => premiumById.get(suggestion.id) || suggestion);
}

function doesSuggestionBypassAutomaticPacing(suggestion?: Suggestion | null): boolean {
    if (!suggestion) {
        return false;
    }

    return suggestion.urgency === 'critical'
        || suggestion.category === 'life-event'
        || suggestion.category === 'critical-drift';
}

async function loadSelectorSignalOverrides(_now: Date = new Date()): Promise<Partial<SelectorSignals>> {
    const userProfileCollection = getOptionalQueryCollection<UserProfile>('user_profile');
    if (!userProfileCollection) {
        return {};
    }

    const profiles = await userProfileCollection.query().fetch();
    const profile = profiles[0];

    if (!profile) {
        return {};
    }

    const batteryPercent = typeof profile.socialBatteryCurrent === 'number'
        ? Math.max(0, Math.min(100, ((profile.socialBatteryCurrent - 1) / 4) * 100))
        : undefined;

    return {
        calendarPermissionGranted: profile.calendarPermissionGranted ?? false,
        batteryPercent,
        preferredWindows: resolvePreferredSuggestionWindows(profile),
    };
}

const ADAPTIVE_WINDOW_DAYS = 30;
const FRIEND_SUPPRESSION_DISMISSAL_THRESHOLD = 3;
const TYPE_PENALTY_DISMISSAL_THRESHOLD = 3;

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

export async function loadFriendMemoryProfiles(friendIds: string[]): Promise<Map<string, FriendMemoryProfile>> {
    const profiles = new Map<string, FriendMemoryProfile>();
    if (friendIds.length === 0) return profiles;

    let memories: FriendMemory[] = [];
    try {
        const collection = getOptionalQueryCollection<FriendMemory>('friend_memories');
        if (!collection) {
            return profiles;
        }

        memories = await collection
            .query(
                Q.where('friend_id', Q.oneOf(friendIds)),
                Q.where('is_archived', false),
                Q.sortBy('updated_at', Q.desc)
            )
            .fetch();
    } catch (error) {
        Logger.warn('[Suggestions] Friend memory profiles unavailable, continuing without memory context', error);
        return profiles;
    }

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
    const eventsCollection = getOptionalQueryCollection<SuggestionEvent>('suggestion_events');
    if (!eventsCollection) {
        return {
            suppressedFriendIds: new Set<string>(),
            typeDismissalCounts: new Map<string, number>(),
        };
    }

    const recentDismissals = await eventsCollection
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
export async function fetchSuggestionSurface(
    limit: number = 3,
    season?: SocialSeason | null,
    userCap?: number,
    options: SuggestionSurfaceOptions = {}
): Promise<SuggestionFetchResult> {
    try {
        const forceSelector = options.forceSelector === true;
        const trackAnalytics = options.trackAnalytics === true;
        const respectPacing = options.respectPacing !== false;
        const manualPull = options.manualPull === true;
        const shadowModeEnabled = isOpportunitySystemShadowModeEnabled();
        const focusSelectorEnabled = forceSelector || isFocusSelectorEnabled();
        const opportunityPoolEnabled = isOpportunityPoolEnabled();
        const selectorNow = new Date();
        let pacing: SuggestionPacingState | undefined;
        let quietReason: SuggestionQuietReason | undefined;
        const surfaceRequestKind: SelectorSurfaceRequestKind = manualPull ? 'manual_pull' : 'automatic';


        // 1. Candidate Selection: Identify WHO needs suggestions (limit to Top 50 candidates)
        // This prevents loading all 1000+ friends into memory.
        const candidateIds = await SuggestionCandidateService.getCandidates(50);



        // 2. Data Loading: Fetch Context (Friend + Interactions) only for candidates
        const contextMap = await SuggestionDataLoader.loadContextForCandidates(candidateIds);
        const friends = Array.from(contextMap.values()).map(c => c.friend);
        let selectorSuggestions: Suggestion[] = [];
        let selectionReason: SuggestionFetchResult['selectionReason'];
        let surfaceSource: SuggestionFetchResult['surfaceSource'] = 'legacy-list';
        let selectorOpportunitySource: SuggestionFetchResult['selectorOpportunitySource'];
        let selectorSuggestionMetadata: SuggestionFetchResult['selectorSuggestionMetadata'];
        const needsSelectorSignals = focusSelectorEnabled || shadowModeEnabled;
        const selectorSignalOverrides = needsSelectorSignals
            ? await loadSelectorSignalOverrides(selectorNow)
            : {};
        const selectorExperimentConfig = needsSelectorSignals
            ? await SelectorExperimentService.getConfig()
            : undefined;
        const selectorOptions = needsSelectorSignals
            ? applySelectorExperimentToOptions(
                await SelectorTuningService.getSelectorOptions(selectorNow.getTime()),
                selectorExperimentConfig
            )
            : undefined;
        if (focusSelectorEnabled && respectPacing) {
            pacing = await SuggestionPacingService.getAutomaticPacing({
                now: selectorNow.getTime(),
                season,
            });
            quietReason = pacing.quietReason;
        }

        if (focusSelectorEnabled && opportunityPoolEnabled) {
            const resolvedSelectorSet = await resolveSelectorOpportunities({
                suggestions: [],
                friendIds: friends.map(friend => friend.id),
                contextMap,
                now: selectorNow,
                preferNative: true,
            });
            const shadow = evaluateLegacySuggestionShadow({
                opportunities: resolvedSelectorSet.opportunities,
                suggestions: [],
                contextMap,
                season,
                now: selectorNow.getTime(),
                signalOverrides: selectorSignalOverrides,
                selectorOptions,
                adapterOptions: {
                    copyVariant: selectorExperimentConfig?.copyVariant,
                },
            });

            selectorSuggestions = [
                shadow.selectedSuggestions.primary,
                shadow.selectedSuggestions.secondary,
            ].filter((suggestion): suggestion is Suggestion => !!suggestion);
            selectorSuggestions = await maybeApplyPremiumSelectorCopy(
                shadow,
                selectorSuggestions,
                selectorExperimentConfig?.copyVariant
            );
            selectionReason = shadow.selectedSuggestions.reason;
            surfaceSource = 'selector';
            selectorOpportunitySource = resolvedSelectorSet.source;
            selectorSuggestionMetadata = buildSelectorSuggestionMetadata(shadow);

            const primarySuggestion = selectorSuggestions[0];
            if (
                pacing
                && !manualPull
                && selectorSuggestions.length > 0
                && !doesSuggestionBypassAutomaticPacing(primarySuggestion)
                && !pacing.allowAutoSuggestions
            ) {
                selectorSuggestions = [];
                selectionReason = 'empty';
                selectorSuggestionMetadata = undefined;
            }

            if (shadowModeEnabled) {
                Logger.info('[OpportunityShadow] Native selector surface evaluation', {
                    candidateCount: resolvedSelectorSet.opportunities.length,
                    legacyCandidateCount: 0,
                    legacyTopIds: [],
                    selectorTopIds: selectorSuggestions.map(suggestion => suggestion.id),
                    selectorReason: shadow.selectedSuggestions.reason,
                    selectorOpportunitySource: resolvedSelectorSet.source,
                    suppressedCount: shadow.evaluation.suppressed.filter(result => result.reasons.length > 0).length,
                    focusSelectorEnabled,
                    opportunityPoolEnabled,
                });
            }

            if (trackAnalytics && selectorSuggestions.length > 0) {
                SeasonAnalyticsService.trackSuggestionsShown(selectorSuggestions.length).catch(e => {
                    Logger.error('[Analytics] Failed to track suggestions shown', e);
                });
            }

            return {
                suggestions: selectorSuggestions,
                selectorSuggestions,
                surfaceSource,
                selectionReason,
                selectorOpportunitySource,
                selectorSuggestionMetadata,
                pacing,
                quietReason,
                surfaceRequestKind,
            };
        }

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
                        initiationRatio: friend.initiationRatio,
                        consecutiveUserInitiations: friend.consecutiveUserInitiations,
                        totalUserInitiations: friend.totalUserInitiations,
                        totalFriendInitiations: friend.totalFriendInitiations,
                        tierFitScore: friend.tierFitScore,
                        suggestedTier: friend.suggestedTier,
                        tierSuggestionDismissedAt: friend.tierSuggestionDismissedAt,
                        outcomeCount: friend.outcomeCount,
                        categoryEffectiveness: friend.categoryEffectiveness,
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

                for (const p of proactive) {
                    if (proactiveSuggestions.length >= MAX_PROACTIVE) break;

                    proactiveSuggestions.push(buildProactiveSuggestion(p, {
                        friendId: friend.id,
                        friendName: friend.name,
                        friendTier: friend.dunbarTier as any,
                        currentScore: calculateCurrentScore(friend),
                        lastInteractionDate: context?.interactions[0]?.interactionDate || null,
                        now: new Date(),
                    }));
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
            const memoryLifeEventOpportunities = await generateMemoryLifeEventOpportunities(
                friends.map(friend => ({
                    id: friend.id,
                    name: friend.name,
                    dunbarTier: friend.dunbarTier as Tier,
                }))
            );
            allSuggestions.push(
                ...memoryLifeEventOpportunities.map(opportunity => opportunityToSuggestion(opportunity))
            );
        } catch (error) {
            Logger.error('[Suggestions] Error generating memory life-event suggestions', error);
        }

        // 6. Sunday Reflection
        const weeklyReflection = await WeeklyReflectionGenerator.generate();
        if (weeklyReflection) {
            allSuggestions.push(weeklyReflection);
        }

        // 6. Portfolio Insights
        const portfolioAnalysis = buildPortfolioAnalysis(friendStats);
        if (portfolioAnalysis) {
            const portfolioInsight = buildPortfolioSuggestion(portfolioAnalysis, new Date());
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
        const selectorSeasonFiltered = focusSelectorEnabled
            ? filterSuggestionsBySeason(active, season)
            : seasonFiltered;



        const MIN_SUGGESTIONS = 3;
        const selectorCandidatePool = await TriageGenerator.apply(
            applyDismissalLearning(selectorSeasonFiltered, dismissalLearningProfile)
        );
        let legacyPool = seasonFiltered;

        // 7. Guaranteed Suggestions (Wildcards, etc.)
        // CRITICAL FIX: Generate guaranteed suggestions even if friends array is empty.
        // Non-friend-dependent suggestions (daily-reflect, generic wildcards) should always be available.
        // This ensures users ALWAYS see at least some suggestions, even new users with no friends.
        const guaranteed = generateGuaranteedSuggestions(friends, legacyPool, season);
        const freshGuaranteed = guaranteed.filter(s => !dismissedMap.has(s.id));
        legacyPool = [...legacyPool, ...freshGuaranteed];

        // Adaptive filtering based on recent dismissal patterns:
        // - Suppress suggestions for friends dismissed repeatedly
        // - De-prioritize frequently dismissed suggestion types
        legacyPool = applyDismissalLearning(legacyPool, dismissalLearningProfile);



        // 8. Dormant / Triage Logic
        legacyPool = await TriageGenerator.apply(legacyPool);

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

        let finalSuggestions = selectDiverseSuggestions(legacyPool, effectiveLimit, {
            isLowEnergy,
            friendLookup,
        });

        const legacyTopIds = finalSuggestions.slice(0, 2).map(s => s.id);
        const shouldRunSelectorEvaluation = shadowModeEnabled || focusSelectorEnabled;
        if (shouldRunSelectorEvaluation) {
            try {
                const resolvedSelectorSet = await resolveSelectorOpportunities({
                    suggestions: selectorCandidatePool,
                    friendIds: friends.map(friend => friend.id),
                    contextMap,
                    now: selectorNow,
                });
                const shadow = evaluateLegacySuggestionShadow({
                    opportunities: resolvedSelectorSet.opportunities,
                    suggestions: selectorCandidatePool,
                    contextMap,
                    season,
                    now: selectorNow.getTime(),
                    signalOverrides: selectorSignalOverrides,
                    selectorOptions,
                    adapterOptions: {
                        copyVariant: selectorExperimentConfig?.copyVariant,
                    },
                });
                selectorSuggestions = [
                    shadow.selectedSuggestions.primary,
                    shadow.selectedSuggestions.secondary,
                ].filter((suggestion): suggestion is Suggestion => !!suggestion);
                selectorSuggestions = await maybeApplyPremiumSelectorCopy(
                    shadow,
                    selectorSuggestions,
                    selectorExperimentConfig?.copyVariant
                );
                selectionReason = shadow.selectedSuggestions.reason;
                selectorOpportunitySource = resolvedSelectorSet.source;
                selectorSuggestionMetadata = buildSelectorSuggestionMetadata(shadow);

                const primarySuggestion = selectorSuggestions[0];
                if (
                    pacing
                    && !manualPull
                    && selectorSuggestions.length > 0
                    && !doesSuggestionBypassAutomaticPacing(primarySuggestion)
                    && !pacing.allowAutoSuggestions
                ) {
                    selectorSuggestions = [];
                    selectionReason = 'empty';
                    selectorSuggestionMetadata = undefined;
                }

                if (focusSelectorEnabled) {
                    finalSuggestions = selectorSuggestions;
                    surfaceSource = 'selector';
                }

                if (shadowModeEnabled) {
                    Logger.info('[OpportunityShadow] Legacy vs selector comparison', {
                        candidateCount: selectorCandidatePool.length,
                        legacyCandidateCount: legacyPool.length,
                        legacyTopIds,
                        selectorTopIds: selectorSuggestions.map(s => s.id),
                        selectorReason: shadow.selectedSuggestions.reason,
                        selectorOpportunitySource: resolvedSelectorSet.source,
                        suppressedCount: shadow.evaluation.suppressed.filter(result => result.reasons.length > 0).length,
                        focusSelectorEnabled,
                        opportunityPoolEnabled,
                    });
                }
            } catch (error) {
                Logger.warn('[OpportunityShadow] Failed to evaluate selector shadow mode', error);
            }
        }



        // 10. EMERGENCY FALLBACK: Ensure users ALWAYS see at least one suggestion
        // This is the last line of defense against blank suggestion screens
        if (!focusSelectorEnabled && finalSuggestions.length === 0) {
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

        if (trackAnalytics && finalSuggestions.length > 0) {
            SeasonAnalyticsService.trackSuggestionsShown(finalSuggestions.length).catch(e => {
                Logger.error('[Analytics] Failed to track suggestions shown', e);
            });
        }

        return {
            suggestions: finalSuggestions,
            selectorSuggestions,
            surfaceSource,
            selectionReason,
            selectorOpportunitySource,
            selectorSuggestionMetadata,
            pacing,
            quietReason,
            surfaceRequestKind,
        };
    } catch (error) {
        // GLOBAL CATCH: This should catch ANY error in the entire pipeline
        Logger.error(`[Suggestions] FATAL ERROR in fetchSuggestions pipeline`, error);
        return {
            suggestions: [],
            selectorSuggestions: [],
            surfaceSource: 'legacy-list',
            surfaceRequestKind: options.manualPull === true ? 'manual_pull' : 'automatic',
        };
    }
}

export async function fetchSuggestions(
    limit: number = 3,
    season?: SocialSeason | null,
    userCap?: number,
    options?: SuggestionSurfaceOptions
): Promise<Suggestion[]> {
    const result = await fetchSuggestionSurface(limit, season, userCap, options);
    return result.suggestions;
}
