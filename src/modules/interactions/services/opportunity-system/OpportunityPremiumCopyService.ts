import AsyncStorage from '@react-native-async-storage/async-storage';
import { intelligenceCapabilitiesService } from '@/modules/intelligence/services/intelligence-capabilities.service';
import { getPromptVersion, llmService } from '@/shared/services/llm';
import { logger } from '@/shared/services/logger.service';
import type { Suggestion } from '@/shared/types/common';
import { buildOpportunityContextHash } from './context-hash';
import type { Opportunity, OpportunityPresentationCopy } from './types';

const PREMIUM_COPY_PROMPT_ID = 'opportunity_premium_copy';
const PREMIUM_COPY_CACHE_PREFIX = '@weave:opportunity_premium_copy';
const PREMIUM_COPY_TIMEOUT_MS = 2500;

interface PremiumCopyResponse {
  title: string;
  subtitle: string;
  contextSnippet?: string;
  actionLabel?: string;
  reason?: string;
}

export interface PremiumCopyInput {
  opportunity: Opportunity;
  suggestion: Suggestion;
}

function truncate(value: string | undefined, maxLength: number): string | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function buildFallbackCopy(suggestion: Suggestion): OpportunityPresentationCopy {
  return {
    title: suggestion.title,
    subtitle: suggestion.subtitle,
    contextSnippet: suggestion.contextSnippet,
    actionLabel: suggestion.actionLabel,
    reason: suggestion.reason,
    aiEnriched: suggestion.aiEnriched,
  };
}

function normalizePremiumCopyResponse(
  response: Partial<PremiumCopyResponse> | null | undefined,
  fallback: OpportunityPresentationCopy
): OpportunityPresentationCopy {
  return {
    title: truncate(response?.title, 80) || fallback.title,
    subtitle: truncate(response?.subtitle, 140) || fallback.subtitle,
    contextSnippet: truncate(response?.contextSnippet, 170) || fallback.contextSnippet,
    actionLabel: truncate(response?.actionLabel, 24) || fallback.actionLabel,
    reason: truncate(response?.reason, 170) || fallback.reason,
    aiEnriched: true,
  };
}

async function buildCacheKey(opportunity: Opportunity): Promise<string> {
  const contextHash = await buildOpportunityContextHash(opportunity);
  const promptVersion = getPromptVersion(PREMIUM_COPY_PROMPT_ID);
  return `${PREMIUM_COPY_CACHE_PREFIX}:${opportunity.id}:${contextHash}:${promptVersion}`;
}

async function loadCachedPremiumCopy(cacheKey: string): Promise<OpportunityPresentationCopy | null> {
  try {
    const rawValue = await AsyncStorage.getItem(cacheKey);
    if (!rawValue) return null;
    return JSON.parse(rawValue) as OpportunityPresentationCopy;
  } catch {
    return null;
  }
}

async function saveCachedPremiumCopy(
  cacheKey: string,
  presentationCopy: OpportunityPresentationCopy
): Promise<void> {
  try {
    await AsyncStorage.setItem(cacheKey, JSON.stringify(presentationCopy));
  } catch {
    // Non-fatal cache write
  }
}

async function canUsePremiumCopy(): Promise<boolean> {
  if (!llmService.isAvailable()) {
    return false;
  }

  try {
    const capabilities = await intelligenceCapabilitiesService.getCapabilitiesForCurrentProfile();
    return capabilities.remoteEnrichmentEnabled;
  } catch {
    return false;
  }
}

async function generatePremiumCopy(
  opportunity: Opportunity,
  suggestion: Suggestion
): Promise<OpportunityPresentationCopy | null> {
  const fallback = buildFallbackCopy(suggestion);
  const cacheKey = await buildCacheKey(opportunity);
  const cachedCopy = await loadCachedPremiumCopy(cacheKey);
  if (cachedCopy) {
    return cachedCopy;
  }

  try {
    const response = await llmService.completeStructuredFromRegistry<PremiumCopyResponse>(
      PREMIUM_COPY_PROMPT_ID,
      {
        friendName: opportunity.friendName || suggestion.friendName || '',
        category: opportunity.category,
        generatorSource: opportunity.generatorSource,
        urgency: opportunity.urgency,
        confidence: opportunity.confidence,
        bestWindow: opportunity.timeRelevance.bestWindow || '',
        whyNow: opportunity.explanation.whyNow,
        whyThisFriend: opportunity.explanation.whyThisFriend,
        whyThisAction: opportunity.explanation.whyThisAction,
        daysSinceLastInteraction: opportunity.copyContext?.daysSinceLastInteraction ?? '',
        recentInteractionCategory: opportunity.copyContext?.recentInteractionCategory || '',
        topicHint: opportunity.copyContext?.topInterest
          || opportunity.copyContext?.vibeHint
          || opportunity.copyContext?.locationHint
          || '',
        currentTitle: suggestion.title,
        currentSubtitle: suggestion.subtitle,
        currentContextSnippet: suggestion.contextSnippet || '',
        currentActionLabel: suggestion.actionLabel || '',
      },
      {
        timeoutMs: PREMIUM_COPY_TIMEOUT_MS,
        temperature: 0.5,
      }
    );

    const normalizedCopy = normalizePremiumCopyResponse(response.data, fallback);
    await saveCachedPremiumCopy(cacheKey, normalizedCopy);
    return normalizedCopy;
  } catch (error) {
    logger.warn('OpportunityPremiumCopyService', 'Premium copy enrichment failed, using template copy', error);
    return null;
  }
}

export const OpportunityPremiumCopyService = {
  async enhanceSuggestions(inputs: PremiumCopyInput[]): Promise<Suggestion[]> {
    if (inputs.length === 0) {
      return [];
    }

    if (!(await canUsePremiumCopy())) {
      return inputs.map(input => input.suggestion);
    }

    const enhancedSuggestions = await Promise.all(inputs.map(async input => {
      const premiumCopy = await generatePremiumCopy(input.opportunity, input.suggestion);
      if (!premiumCopy) {
        return input.suggestion;
      }

      return {
        ...input.suggestion,
        title: premiumCopy.title,
        subtitle: premiumCopy.subtitle,
        contextSnippet: premiumCopy.contextSnippet,
        actionLabel: premiumCopy.actionLabel || input.suggestion.actionLabel,
        reason: premiumCopy.reason || input.suggestion.reason,
        aiEnriched: true,
      };
    }));

    return enhancedSuggestions;
  },
};
