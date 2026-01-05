/**
 * Journal Module
 * 
 * Exports all journal-related services and types.
 */

// Context Engine - the brains
export * from './services/journal-context-engine';

// Prompts - contextual question generation
export * from './services/journal-prompts';

// Smart Prompts - LLM-powered prompts with fallback
export * from './services/prompt-context-builder';
export * from './services/smart-prompt-generator';
export { useSmartPrompt } from './services/useSmartPrompt';

// Signal Extraction - LLM-powered insights
export * from './services/signal-extractor';
export * from './services/journal-intelligence.service';

// Thread Extraction - conversation topic tracking
export * from './services/thread-extractor';
export * from './services/followup-generator';

// Oracle - MOVED to @/modules/oracle
// export * from './services/oracle/oracle-service';
// export * from './services/oracle/insight-generator';

// Components
export { WeaveReflectPrompt, useWeaveReflectPrompt } from './components/WeaveReflectPrompt';
export * from './components/MemoryMomentModal';
