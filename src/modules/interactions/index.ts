// Components
export { QuickWeaveOverlay } from './components/QuickWeaveOverlay';
export { PlanWizard } from './components/PlanWizard';

// Hooks
export { useInteractions } from './hooks/useInteractions';
export { usePlans } from './hooks/usePlans';
export { usePlanSuggestion } from './hooks/usePlanSuggestion';
export { useSuggestions } from './hooks/useSuggestions';
export { useQuickWeave } from './hooks/useQuickWeave';

// Services
export * as WeaveLoggingService from './services/weave-logging.service';
export * as PlanService from './services/plan.service';
export * as CalendarService from './services/calendar.service';
export * from './services/smart-defaults.service';
export * from './services/suggestion-engine.service';
export * as suggestionEngine from './services/suggestion-engine.service';
export * from './services/event-suggestion-learning.service';
export * from './services/event-scanner';
export * as SuggestionTrackerService from './services/suggestion-tracker.service';
export * as SuggestionStorageService from './services/suggestion-storage.service';

// Stores
export * from './store';
export * from './store/event-suggestion.store';

// Types
export * from './types';

// Constants
export { itemPositions, HIGHLIGHT_THRESHOLD, SELECTION_THRESHOLD } from './constants';
