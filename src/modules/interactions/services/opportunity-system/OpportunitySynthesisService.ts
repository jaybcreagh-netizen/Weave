import { calculateCurrentScore } from '@/modules/intelligence/services/orchestrator.service';
import type { Suggestion } from '@/shared/types/common';
import type { HydratedFriend } from '@/types/hydrated';
import type { FriendContextData } from '../suggestion-system/SuggestionDataLoader';
import type { SuggestionContext } from '../suggestion-engine/types';
import {
  buildIntentionReminderOpportunity,
  findAgingIntentionReminder,
} from '../suggestion-engine/generators/intention-reminder.shared';
import { buildDriftOpportunity } from '../suggestion-engine/generators/drift.shared';
import { buildPlannedWeaveOpportunity } from '../suggestion-engine/generators/planned-weave.shared';
import { buildReflectionOpportunity } from '../suggestion-engine/generators/reflection.shared';
import { buildMomentumOpportunity } from '../suggestion-engine/generators/momentum.shared';
import { buildMaintenanceOpportunity } from '../suggestion-engine/generators/maintenance.shared';
import { buildDeepenOpportunity } from '../suggestion-engine/generators/deepen.shared';
import { buildReciprocityOpportunity } from '../suggestion-engine/generators/reciprocity.shared';
import { buildInsightOpportunity } from '../suggestion-engine/generators/insight.shared';
import { buildOptimizationOpportunity } from '../suggestion-engine/generators/optimization.shared';
import { buildHolidaySeasonOpportunity } from '../suggestion-engine/generators/holiday-season.shared';
import { buildSignalDrivenOpportunity } from '../suggestion-engine/generators/signal-driven.shared';
import {
  buildLifeEventOpportunity,
  findUpcomingLifeEvent,
} from '../suggestion-engine/generators/life-event.shared';
import { buildProactiveOpportunity } from '../suggestion-engine/generators/proactive.shared';
import {
  buildPortfolioAnalysis,
  buildPortfolioOpportunity,
} from '../suggestion-engine/generators/portfolio.shared';
import { generateMemoryLifeEventOpportunities } from '../suggestion-engine/generators/memory-life-event.shared';
import { WeeklyReflectionGenerator } from '../suggestion-engine/generators/WeeklyReflectionGenerator';
import { SignalDrivenGenerator } from '../suggestion-engine/generators/SignalDrivenGenerator';
import { generateProactiveSuggestions } from '@/modules/insights/services/prediction.service';
import {
  analyzeInteractionPattern,
  isPatternReliable,
} from '@/modules/insights/services/pattern.service';
import { adaptSuggestionsToOpportunities } from './OpportunityAdapter';
import type { Opportunity } from './types';
import type { Tier } from '@/shared/types/common';
import { OpportunityPoolService } from './OpportunityPoolService';
import { isOpportunityPoolEnabled } from './flags';
import Logger from '@/shared/utils/Logger';

export interface OpportunitySynthesisInput {
  suggestions: Suggestion[];
  contextMap?: Map<string, FriendContextData>;
  now?: Date;
  preferNative?: boolean;
}

export interface ResolvedSelectorOpportunitySet {
  opportunities: Opportunity[];
  source: 'synthesized' | 'pool';
}

function buildSuggestionContext(context: FriendContextData, now: Date): SuggestionContext {
  const friend = context.friend;
  const momentumLastUpdatedTime = friend.momentumLastUpdated instanceof Date
    ? friend.momentumLastUpdated.getTime()
    : new Date(friend.momentumLastUpdated || Date.now()).getTime();
  const daysSinceMomentumUpdate = (now.getTime() - momentumLastUpdatedTime) / 86400000;
  const momentumScore = Math.max(0, friend.momentumScore - daysSinceMomentumUpdate);

  return {
    friend: {
      id: friend.id,
      name: friend.name,
      archetype: friend.archetype,
      dunbarTier: friend.dunbarTier as Tier,
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
    } as HydratedFriend,
    currentScore: calculateCurrentScore(friend as any),
    lastInteractionDate: context.interactions[0]?.interactionDate || null,
    interactionCount: context.count,
    momentumScore,
    recentInteractions: context.interactions,
    plannedInteractions: context.plannedInteractions,
    now,
  };
}

export interface NativeOpportunitySynthesisInput {
  contextMap?: Map<string, FriendContextData>;
  now?: Date;
}

export async function synthesizeNativeOpportunities(
  input: NativeOpportunitySynthesisInput = {}
): Promise<Opportunity[]> {
  const { contextMap, now = new Date() } = input;
  const friendContexts = contextMap ? Array.from(contextMap.values()) : [];

  const friendOpportunities = await Promise.all(
    friendContexts.map(async context => {
      const suggestionContext = buildSuggestionContext(context, now);
      const agingIntention = await findAgingIntentionReminder(context.friend.id, now);
      const lifeEvent = await findUpcomingLifeEvent(suggestionContext.friend, now);

      const nativeOpportunities: Opportunity[] = [];
      const plannedWeaveOpportunity = buildPlannedWeaveOpportunity(suggestionContext);
      if (plannedWeaveOpportunity) {
        nativeOpportunities.push(plannedWeaveOpportunity);
      }

      const reflectionOpportunity = buildReflectionOpportunity(suggestionContext);
      if (reflectionOpportunity) {
        nativeOpportunities.push(reflectionOpportunity);
      }

      const driftOpportunity = buildDriftOpportunity(suggestionContext);
      if (driftOpportunity) {
        nativeOpportunities.push(driftOpportunity);
      }

      if (agingIntention) {
        nativeOpportunities.push(
          buildIntentionReminderOpportunity(suggestionContext, agingIntention)
        );
      }

      if (lifeEvent) {
        nativeOpportunities.push(
          buildLifeEventOpportunity(suggestionContext, lifeEvent)
        );
      }

      const momentumOpportunity = buildMomentumOpportunity(suggestionContext);
      if (momentumOpportunity) {
        nativeOpportunities.push(momentumOpportunity);
      }

      const maintenanceOpportunity = buildMaintenanceOpportunity(suggestionContext);
      if (maintenanceOpportunity) {
        nativeOpportunities.push(maintenanceOpportunity);
      }

      const deepenOpportunity = buildDeepenOpportunity(suggestionContext);
      if (deepenOpportunity) {
        nativeOpportunities.push(deepenOpportunity);
      }

      const optimizationOpportunity = buildOptimizationOpportunity(suggestionContext);
      if (optimizationOpportunity) {
        nativeOpportunities.push(optimizationOpportunity);
      }

      const reciprocityOpportunity = buildReciprocityOpportunity(suggestionContext);
      if (reciprocityOpportunity) {
        nativeOpportunities.push(reciprocityOpportunity);
      }

      const insightOpportunity = buildInsightOpportunity(suggestionContext);
      if (insightOpportunity) {
        nativeOpportunities.push(insightOpportunity);
      }

      const holidayOpportunity = buildHolidaySeasonOpportunity(suggestionContext);
      if (holidayOpportunity) {
        nativeOpportunities.push(holidayOpportunity);
      }

      return nativeOpportunities;
    })
  );

  const proactiveOpportunities: Opportunity[] = [];
  const MAX_PROACTIVE_OPPORTUNITIES = 2;

  for (const context of friendContexts) {
    if (proactiveOpportunities.length >= MAX_PROACTIVE_OPPORTUNITIES) {
      break;
    }

    const pattern = analyzeInteractionPattern(
      context.interactions.map(interaction => ({
        id: interaction.id,
        interactionDate: interaction.interactionDate,
        status: 'completed',
        category: interaction.interactionCategory,
      }))
    );

    if (!isPatternReliable(pattern)) {
      continue;
    }

    const proactiveSuggestions = generateProactiveSuggestions(context.friend, pattern, {
      includeReciprocity: true,
      includeSmartScheduling: false,
    });

    for (const proactiveSuggestion of proactiveSuggestions) {
      if (proactiveOpportunities.length >= MAX_PROACTIVE_OPPORTUNITIES) {
        break;
      }

      proactiveOpportunities.push(
        buildProactiveOpportunity(proactiveSuggestion, {
          friendId: context.friend.id,
          friendName: context.friend.name,
          friendTier: context.friend.dunbarTier as Tier,
          currentScore: calculateCurrentScore(context.friend as any),
          lastInteractionDate: context.interactions[0]?.interactionDate || null,
          now,
        })
      );
    }
  }

  const portfolioAnalysis = buildPortfolioAnalysis(
    friendContexts.map(context => ({
      id: context.friend.id,
      name: context.friend.name,
      tier: context.friend.dunbarTier as Tier,
      archetype: context.friend.archetype,
      score: calculateCurrentScore(context.friend as any),
      daysSinceInteraction: context.lastDate
        ? Math.max(0, Math.round((now.getTime() - context.lastDate) / 86400000))
        : 999,
    }))
  );
  const portfolioOpportunity = portfolioAnalysis
    ? buildPortfolioOpportunity(portfolioAnalysis, now)
    : null;

  const signalSuggestions = contextMap && contextMap.size > 0
    ? await SignalDrivenGenerator.generate(
        friendContexts.map(context => context.friend),
        contextMap,
        { maxSuggestions: 2 }
      )
    : [];
  const signalOpportunities = signalSuggestions
    .map(suggestion => buildSignalDrivenOpportunity(suggestion, {
      friendTier: resolveFriendTier(suggestion, contextMap),
    }))
    .filter((opportunity): opportunity is Opportunity => opportunity !== null);
  const memoryLifeEventOpportunities = await generateMemoryLifeEventOpportunities(
    friendContexts.map(context => ({
      id: context.friend.id,
      name: context.friend.name,
      dunbarTier: context.friend.dunbarTier as Tier,
    }))
  );

  const globalOpportunities = await Promise.all([
    WeeklyReflectionGenerator.generateOpportunity(now),
  ]);

  const merged = new Map<string, Opportunity>();

  for (const opportunity of [
    ...friendOpportunities.flat(),
    ...proactiveOpportunities,
    ...signalOpportunities,
    ...memoryLifeEventOpportunities,
    portfolioOpportunity,
    ...globalOpportunities,
  ]) {
    if (opportunity) {
      merged.set(opportunity.id, opportunity);
    }
  }

  return Array.from(merged.values());
}

function resolveFriendTier(
  suggestion: Suggestion,
  contextMap?: Map<string, FriendContextData>
): Tier | undefined {
  if (!suggestion.friendId) {
    return undefined;
  }

  return contextMap?.get(suggestion.friendId)?.friend.dunbarTier as Tier | undefined;
}

function mergeOpportunitySets(
  nativeOpportunities: Opportunity[],
  legacySuggestions: Suggestion[],
  contextMap?: Map<string, FriendContextData>
): Opportunity[] {
  const merged = new Map<string, Opportunity>();

  for (const legacyOpportunity of adaptSuggestionsToOpportunities(
    legacySuggestions,
    suggestion => ({
      friendTier: resolveFriendTier(suggestion, contextMap),
    })
  )) {
    merged.set(legacyOpportunity.id, legacyOpportunity);
  }

  for (const nativeOpportunity of nativeOpportunities) {
    merged.set(nativeOpportunity.id, nativeOpportunity);
  }

  return Array.from(merged.values());
}

export async function synthesizeSelectorOpportunities(
  input: OpportunitySynthesisInput
): Promise<Opportunity[]> {
  const now = input.now || new Date();
  const nativeOpportunities = await synthesizeNativeOpportunities({
    contextMap: input.contextMap,
    now,
  });
  const selectorSuggestionIds = new Set(input.suggestions.map(suggestion => suggestion.id));
  const selectorBaseNativeOpportunities = input.preferNative
    ? nativeOpportunities
    : nativeOpportunities.filter(opportunity => selectorSuggestionIds.has(opportunity.id));

  return mergeOpportunitySets(selectorBaseNativeOpportunities, input.suggestions, input.contextMap);
}

export interface SelectorOpportunityResolutionInput extends OpportunitySynthesisInput {
  friendIds?: string[];
}

export async function resolveSelectorOpportunities(
  input: SelectorOpportunityResolutionInput
): Promise<ResolvedSelectorOpportunitySet> {
  const synthesized = await synthesizeSelectorOpportunities(input);

  if (!isOpportunityPoolEnabled()) {
    return {
      opportunities: synthesized,
      source: 'synthesized',
    };
  }

  try {
    const poolOpportunities = await OpportunityPoolService.getActiveOpportunities(input.friendIds);
    const merged = new Map<string, Opportunity>();

    for (const opportunity of synthesized) {
      merged.set(opportunity.id, opportunity);
    }

    for (const opportunity of poolOpportunities) {
      merged.set(opportunity.id, opportunity);
    }

    if (poolOpportunities.length === 0) {
      return {
        opportunities: synthesized,
        source: 'synthesized',
      };
    }

    return {
      opportunities: Array.from(merged.values()),
      source: 'pool',
    };
  } catch (error) {
    Logger.warn('[OpportunitySelector] Failed to read opportunity pool, falling back to synthesis', error);
    return {
      opportunities: synthesized,
      source: 'synthesized',
    };
  }
}
