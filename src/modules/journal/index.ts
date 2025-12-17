/**
 * Journal Module
 * 
 * Exports all journal-related services and types.
 */

// Context Engine - the brains
export * from './services/journal-context-engine';

// Prompts - contextual question generation
export * from './services/journal-prompts';

// Components
export { WeaveReflectPrompt, useWeaveReflectPrompt } from './components/WeaveReflectPrompt';
export * from './components/MemoryMomentModal';
