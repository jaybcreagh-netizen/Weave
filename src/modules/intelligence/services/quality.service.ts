// src/modules/intelligence/services/quality.service.ts
import { Duration, Vibe } from '@/components/types';

/**
 * @interface InteractionQualityMetrics
 * @property {number} depthScore - A score from 1-5 based on reflection and notes.
 * @property {number} energyScore - A score from 1-5 based on vibe and duration.
 * @property {number} overallQuality - A composite score from 1-5.
 */
export interface InteractionQualityMetrics {
  depthScore: number; // 1-5 based on reflection + notes
  energyScore: number; // 1-5 based on vibe + duration
  overallQuality: number; // 1-5 composite
}

/**
 * Calculates quality metrics for an interaction to weight scoring.
 * @param interaction - The interaction data.
 * @param {Vibe} [interaction.vibe] - The vibe of the interaction.
 * @param {Duration} [interaction.duration] - The duration of the interaction.
 * @param {string} [interaction.note] - The note for the interaction.
 * @param {string} [interaction.reflectionJSON] - The reflection for the interaction.
 * @returns {InteractionQualityMetrics} The quality metrics for the interaction.
 */
export function calculateInteractionQuality(
  interaction: {
    vibe?: Vibe | null;
    duration?: Duration | null;
    note?: string | null;
    reflectionJSON?: string | null;
  }
): InteractionQualityMetrics {
  // Depth: Did they reflect meaningfully?
  let depthScore = 1; // Base score for just logging
  if (interaction.note && interaction.note.length > 50) depthScore += 1;
  if (interaction.note && interaction.note.length > 150) depthScore += 1;
  if (interaction.reflectionJSON) depthScore += 2; // Structured reflection is valuable

  depthScore = Math.min(5, depthScore); // Cap at 5

  // Energy: How was the vibe + duration?
  let energyScore = 3; // Default neutral
  if (interaction.vibe === 'FullMoon') energyScore = 5;
  else if (interaction.vibe === 'WaxingGibbous') energyScore = 4;
  else if (interaction.vibe === 'FirstQuarter') energyScore = 3;
  else if (interaction.vibe === 'WaxingCrescent') energyScore = 3;
  else if (interaction.vibe === 'NewMoon') energyScore = 2;

  // Duration modifier
  if (interaction.duration === 'Extended') energyScore = Math.min(5, energyScore + 1);
  else if (interaction.duration === 'Quick') energyScore = Math.max(1, energyScore - 1);

  const overallQuality = Math.round((depthScore + energyScore) / 2);

  return { depthScore, energyScore, overallQuality };
}
