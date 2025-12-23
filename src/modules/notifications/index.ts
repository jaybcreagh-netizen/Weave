
/**
 * Notifications Module Entry Point
 */

// Types
export * from './types';

// Services
export { NotificationOrchestrator } from './services/notification-orchestrator';
export { notificationStore } from './services/notification-store';
export { notificationAnalytics } from './services/notification-analytics';

// Hooks
export { useNotificationPermissions } from './hooks/useNotificationPermissions';
export { useNotificationResponseHandler } from './services/notification-response-handler';

// Channels (optional export if needed directly)
export * from './services/channels/battery-checkin';
export * from './services/channels/weekly-reflection';
export * from './services/channels/event-reminder';
export * from './services/channels/memory-nudge';
export * from './services/channels/evening-digest';
export * from './services/channels/smart-suggestions';
export * from './services/channels/event-suggestion';
export * from './services/channels/deepening-nudge';
// ... others as needed, simpler to just rely on Orchestrator for most things
// but ResponseHandler uses them internally.

// Re-export Permissions Service for compat if needed, 
// but try to use the hook or Orchestrator methods.
export * from './services/permission.service';
export * from './services/notification-grace-periods';

// Components
export { NotificationPermissionModal } from './components/NotificationPermissionModal';
