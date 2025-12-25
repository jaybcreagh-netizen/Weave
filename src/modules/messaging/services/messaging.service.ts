/**
 * Messaging Service
 *
 * Handles generating deep links and opening messaging apps
 * with pre-filled contact information.
 */

import { Linking, Alert } from 'react-native';
import { MessagingApp, ReachOutOptions, ReachOutResult } from '../types';
import { appDetectionService } from './app-detection.service';

class MessagingService {
  /**
   * Clean and normalize a phone number for use in deep links.
   * Removes spaces, dashes, parentheses, etc.
   */
  private cleanPhoneNumber(phoneNumber: string): string {
    // Remove all non-numeric characters except the leading +
    const cleaned = phoneNumber.replace(/[^\d+]/g, '');

    // Ensure it starts with + for international format
    // If no country code, assume it needs one (can't guess, so leave as-is)
    return cleaned;
  }

  /**
   * Generate a deep link URL for a specific messaging app.
   */
  generateDeepLink(
    app: MessagingApp,
    phoneNumber?: string,
    email?: string,
    message?: string
  ): string | null {
    const cleanPhone = phoneNumber ? this.cleanPhoneNumber(phoneNumber) : undefined;

    switch (app) {
      case 'whatsapp': {
        if (!cleanPhone) return null;
        // WhatsApp expects phone without the + prefix in the URL
        const waPhone = cleanPhone.startsWith('+') ? cleanPhone.slice(1) : cleanPhone;
        let url = `whatsapp://send?phone=${waPhone}`;
        if (message) {
          url += `&text=${encodeURIComponent(message)}`;
        }
        return url;
      }

      case 'telegram': {
        if (!cleanPhone) return null;
        // Telegram can use phone number to resolve contact
        return `tg://resolve?phone=${cleanPhone}`;
      }

      case 'sms': {
        if (!cleanPhone) return null;
        let url = `sms:${cleanPhone}`;
        if (message) {
          // iOS uses &body=, Android uses ?body=
          // Using ? for broader compatibility
          url += `?body=${encodeURIComponent(message)}`;
        }
        return url;
      }

      case 'email': {
        if (!email) return null;
        let url = `mailto:${email}`;
        if (message) {
          url += `?body=${encodeURIComponent(message)}`;
        }
        return url;
      }

      default:
        return null;
    }
  }

  /**
   * Determine the best messaging app to use based on:
   * 1. User's explicit preference (friend-level or global)
   * 2. Available contact info (phone vs email)
   * 3. Installed apps
   */
  async determineBestApp(
    preferredApp: MessagingApp | undefined,
    hasPhone: boolean,
    hasEmail: boolean
  ): Promise<MessagingApp | null> {
    const capabilities = await appDetectionService.detectInstalledApps();

    // If user has a preference and it's available, use it
    if (preferredApp) {
      const canUse =
        capabilities[preferredApp] &&
        ((preferredApp === 'email' && hasEmail) ||
          (preferredApp !== 'email' && hasPhone));

      if (canUse) return preferredApp;
    }

    // Fall back to best available option
    if (hasPhone) {
      // Prefer WhatsApp > Telegram > SMS
      if (capabilities.whatsapp) return 'whatsapp';
      if (capabilities.telegram) return 'telegram';
      if (capabilities.sms) return 'sms';
    }

    if (hasEmail && capabilities.email) {
      return 'email';
    }

    return null;
  }

  /**
   * Open a messaging app to reach out to a friend.
   * This is the main entry point for the feature.
   */
  async reachOut(options: ReachOutOptions): Promise<ReachOutResult> {
    const { friendName, phoneNumber, email, preferredApp, contextMessage } = options;

    const hasPhone = !!phoneNumber;
    const hasEmail = !!email;

    // Check if we have any contact info
    if (!hasPhone && !hasEmail) {
      return {
        success: false,
        error: 'no_contact_info',
      };
    }

    // Determine which app to use
    const targetApp = await this.determineBestApp(preferredApp, hasPhone, hasEmail);

    if (!targetApp) {
      return {
        success: false,
        error: 'no_available_app',
      };
    }

    // Generate the deep link
    const url = this.generateDeepLink(targetApp, phoneNumber, email, contextMessage);

    if (!url) {
      return {
        success: false,
        app: targetApp,
        error: 'missing_contact_for_app',
      };
    }

    // Try to open the URL
    try {
      const canOpen = await Linking.canOpenURL(url);

      if (!canOpen) {
        return {
          success: false,
          app: targetApp,
          error: 'cannot_open_url',
        };
      }

      await Linking.openURL(url);

      return {
        success: true,
        app: targetApp,
      };
    } catch (error) {
      return {
        success: false,
        app: targetApp,
        error: 'open_failed',
      };
    }
  }

  /**
   * Show an error alert with appropriate messaging.
   */
  showErrorAlert(error: string, friendName: string): void {
    switch (error) {
      case 'no_contact_info':
        Alert.alert(
          'No Contact Info',
          `${friendName} doesn't have a phone number or email linked. Would you like to add one?`,
          [{ text: 'OK' }]
        );
        break;

      case 'no_available_app':
        Alert.alert(
          'No Messaging App',
          'No compatible messaging app is available for this contact.',
          [{ text: 'OK' }]
        );
        break;

      case 'missing_contact_for_app':
        Alert.alert(
          'Missing Contact Info',
          'The required contact information is missing for the selected app.',
          [{ text: 'OK' }]
        );
        break;

      case 'cannot_open_url':
      case 'open_failed':
      default:
        Alert.alert('Error', 'Failed to open messaging app. Please try again.', [
          { text: 'OK' },
        ]);
        break;
    }
  }
}

export const messagingService = new MessagingService();
