/**
 * Journal Components
 * 
 * Full journal feature redesign with three modes:
 * 1. Quick Capture - minimal friction entry
 * 2. Guided Reflection - unified sheet flow
 * 3. Memory Browser - friendship arcs and patterns
 */

// Entry Points
export { JournalHome } from './JournalHome';
export { QuickCaptureSheet } from './QuickCaptureSheet';
export { GuidedReflectionSheet } from './GuidedReflection/GuidedReflectionSheet';

// Browsing
export { FriendshipArcView } from './FriendshipArcView';

// Integration
export { WeaveReflectPrompt, useWeaveReflectPrompt } from './WeaveReflectPrompt';
export { JournalEntryModal } from './JournalEntryModal';
export { JournalEntryDetailSheet } from './JournalEntryDetailSheet';
