/**
 * Intelligence Module
 *
 * Handles scoring calculations, decay, and quality assessment.
 * This is the "brain" of Weave's relationship scoring system.
 *
 * @public API
 */

// Services
export { processWeaveScoring, calculateCurrentScore } from './services/orchestrator.service';
export { calculateInteractionQuality } from './services/quality.service';

// Types
export * from './types';
