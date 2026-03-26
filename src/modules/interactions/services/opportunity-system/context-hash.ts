import * as Crypto from 'expo-crypto';
import { OPPORTUNITY_PRESENTATION_COPY_VERSION } from './OpportunityCopyEnricher';
import type { Opportunity } from './types';

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(item => stableSerialize(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nestedValue]) => `"${key}":${stableSerialize(nestedValue)}`);
    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
}

function buildHashPayload(opportunity: Opportunity): Record<string, unknown> {
  return {
    id: opportunity.id,
    friendId: opportunity.friendId,
    friendName: opportunity.friendName,
    friendTier: opportunity.friendTier,
    category: opportunity.category,
    generatorSource: opportunity.generatorSource,
    urgency: opportunity.urgency,
    confidence: opportunity.confidence,
    effortLevel: opportunity.effortLevel,
    estimatedDurationMinutes: opportunity.estimatedDurationMinutes,
    momentumScore: opportunity.momentumScore,
    intentionId: opportunity.intentionId,
    intentionBoost: opportunity.intentionBoost,
    explanation: opportunity.explanation,
    timeRelevance: opportunity.timeRelevance,
    copyContext: opportunity.copyContext,
    suggestionPayload: opportunity.suggestionPayload,
    presentationCopyVersion: OPPORTUNITY_PRESENTATION_COPY_VERSION,
  };
}

export async function buildOpportunityContextHash(opportunity: Opportunity): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    stableSerialize(buildHashPayload(opportunity))
  );
}
