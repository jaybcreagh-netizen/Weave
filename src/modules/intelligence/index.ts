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

// Social Season
export * from './services/social-season/season-types';
export * from './services/social-season/season-calculator';
export * from './services/social-season/season-content';
export * from './services/intelligent-status-line';
export * from './services/status-line-cache';
