/**
 * Intelligence Module
 *
 * Handles scoring calculations, decay, and quality assessment.
 * This is the "brain" of Weave's relationship scoring system.
 *
 * @public API
 */

// Services
export { processWeaveScoring, calculateCurrentScore, calculateWeightedNetworkHealth } from './services/orchestrator.service';
export * as orchestrator from './services/orchestrator.service';
export { calculateInteractionQuality } from './services/quality.service';

// Types
export * from './types';
