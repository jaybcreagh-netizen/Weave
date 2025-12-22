/**
 * Intelligence Module
 *
 * Handles scoring calculations, decay, and quality assessment.
 * This is the "brain" of Weave's relationship scoring system.
 *
 * @public API
 */

// Services
export { processWeaveScoring, calculateCurrentScore, calculateWeightedNetworkHealth, recalculateScoreOnEdit, recalculateScoreOnDelete, logNetworkHealth } from './services/orchestrator.service';
export * as orchestrator from './services/orchestrator.service';
export { calculateInteractionQuality } from './services/quality.service';
export * from './services/deepening.service';
export * from './services/decay.service';
export * from './services/season-aware-streak.service';
export * from './services/focus-generator';
export * from './services/social-season.service';

// Listeners
export * from './listeners/intelligence.listener';

// Types
export * from './types';

// Constants
export * from './constants';

// Social Season Services
export * from './services/social-season/season-types';
export * from './services/social-season/season-calculator';
export * from './services/social-season/season-content';
export * from './services/social-season/season-decay.service';
export * from './services/social-season/season-suggestions.service';
export * from './services/social-season/season-scoring.service';
export * from './services/social-season/season-manager.service';
export * from './services/social-season/season-analytics.service';

// Calendar Season Services (Holidays & Seasonal Prompts)
export * from './services/calendar-season';
export * from './services/intelligent-status-line';
export * from './services/status-line-cache';

// Components
export { ArchetypeCard } from './components/archetypes/ArchetypeCard';
export { ArchetypeCarouselPicker } from './components/archetypes/ArchetypeCarouselPicker';
export { ArchetypeDetailModal } from './components/archetypes/ArchetypeDetailModal';
export { ArchetypeIcon } from './components/archetypes/ArchetypeIcon';
export { ArchetypeLibrary } from './components/archetypes/ArchetypeLibrary';
export { SeasonEffectsPanel } from './components/social-season/SeasonEffectsPanel';
export { SeasonExplanationModal } from './components/social-season/SeasonExplanationModal';
export { SeasonIcon } from './components/social-season/SeasonIcon';
export { SeasonOverrideModal } from './components/social-season/SeasonOverrideModal';
export { SocialSeasonDetailSheet } from './components/social-season/SocialSeasonDetailSheet';
export { MoonPhaseSelector } from './components/MoonPhaseSelector';
export { YearInMoonsModal } from './components/social-season/YearInMoons/YearInMoonsModal';
export { MoonPhaseIllustration } from './components/social-season/YearInMoons/MoonPhaseIllustration';
