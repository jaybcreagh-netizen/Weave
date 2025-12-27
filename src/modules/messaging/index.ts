/**
 * Messaging Module
 *
 * Provides functionality for reaching out to friends via messaging apps
 * directly from suggestions and intentions.
 *
 * Features:
 * - Deep link generation for WhatsApp, Telegram, SMS, Email
 * - App detection (which messaging apps are installed)
 * - Contact linking (associate phone/email with friends)
 * - ReachOutButton component for easy integration
 */

// Types
export * from './types';

// Services
export { messagingService } from './services/messaging.service';
export { appDetectionService, MESSAGING_APPS } from './services/app-detection.service';

// Hooks
export { useMessagingApps } from './hooks/useMessagingApps';
export { useReachOut } from './hooks/useReachOut';

// Components
export { ReachOutButton } from './components/ReachOutButton';
export { MessagingAppPicker } from './components/MessagingAppPicker';
export { ContactLinker } from './components/ContactLinker';
