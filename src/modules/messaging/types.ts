/**
 * Messaging Module Types
 *
 * Types for the messaging app integration feature that enables
 * users to "Reach Out" directly from suggestions and intentions.
 */

export type MessagingApp = 'whatsapp' | 'telegram' | 'sms' | 'email';

export interface MessagingAppConfig {
  id: MessagingApp;
  name: string;
  icon: string; // Lucide icon name
  urlScheme: string;
  /** Android package name for app detection */
  packageName?: string;
  /** iOS bundle ID for app detection */
  bundleId?: string;
  /** Whether this app requires a phone number (vs email) */
  requiresPhone: boolean;
}

export interface ReachOutOptions {
  friendId: string;
  friendName: string;
  phoneNumber?: string;
  email?: string;
  preferredApp?: MessagingApp;
  /** Optional pre-filled message suggestion */
  contextMessage?: string;
}

export interface MessagingCapabilities {
  whatsapp: boolean;
  telegram: boolean;
  sms: boolean;
  email: boolean;
}

export interface ReachOutResult {
  success: boolean;
  app?: MessagingApp;
  error?: string;
}
