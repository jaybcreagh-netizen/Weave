/**
 * Insights Module
 *
 * Handles pattern detection, reciprocity analysis, and relationship insights.
 *
 * @public API
 */

// Services
export * from './services/pattern.service';
export * from './services/reciprocity.service';
export * from './services/trend.service';
export * from './services/portfolio.service';
export * from './services/prediction.service';
export * from './services/effectiveness.service';
export * from './services/pattern-detection.service';
export * from './services/weaving-insights.service';
export * from './services/tier-fit.service';
export * from './services/tier-suggestion-engine.service';
export * from './services/tier-management.service';
export * from './services/verified-insights.service';
export * from './services/archetype-compatibility.service';
export * from './services/drift-detection.service';

// Hooks
export * from './hooks/useEffectiveness';
export * from './hooks/usePortfolio';
export * from './hooks/useReciprocity';
export * from './hooks/useTrendsAndPredictions';
export * from './hooks/useFriendPattern';
export * from './hooks/useTierFit';

// Components
export { TierFitCard } from './components/TierFitCard';
export { TierFitBottomSheet } from './components/TierFitBottomSheet';
export { TierSuggestionAlert } from './components/TierSuggestionAlert';
export { VerifiedReciprocityCard } from './components/VerifiedReciprocityCard';
export { ArchetypeCompatibilityBadge } from './components/ArchetypeCompatibilityBadge';

// Unified Calendar
export { UnifiedCalendar } from './components/UnifiedCalendar';
export { SeasonHeader } from './components/UnifiedCalendar/SeasonHeader';
export { MonthGrid } from './components/UnifiedCalendar/MonthGrid';
export { DriftAlertsSection } from './components/UnifiedCalendar/DriftAlertsSection';
export { DayDetailSheet } from './components/UnifiedCalendar/DayDetailSheet';

// Types
export * from './types';
