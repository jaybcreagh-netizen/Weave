/**
 * App Detection Service
 *
 * Detects which messaging apps are installed on the device
 * using React Native Linking's canOpenURL capability.
 */

import { Linking } from 'react-native';
import { MessagingCapabilities, MessagingAppConfig, MessagingApp } from '../types';

export const MESSAGING_APPS: MessagingAppConfig[] = [
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: 'MessageCircle',
    urlScheme: 'whatsapp://',
    packageName: 'com.whatsapp',
    bundleId: 'net.whatsapp.WhatsApp',
    requiresPhone: true,
  },
  {
    id: 'telegram',
    name: 'Telegram',
    icon: 'Send',
    urlScheme: 'tg://',
    packageName: 'org.telegram.messenger',
    bundleId: 'ph.telegra.Telegraph',
    requiresPhone: true,
  },
  {
    id: 'sms',
    name: 'Messages',
    icon: 'MessageSquare',
    urlScheme: 'sms:',
    requiresPhone: true,
  },
  {
    id: 'email',
    name: 'Email',
    icon: 'Mail',
    urlScheme: 'mailto:',
    requiresPhone: false,
  },
];

class AppDetectionService {
  private cachedCapabilities: MessagingCapabilities | null = null;
  private lastDetectionTime: number = 0;
  private readonly CACHE_DURATION_MS = 60 * 1000; // 1 minute cache

  /**
   * Detect which messaging apps are installed on the device.
   * Results are cached for 1 minute to avoid repeated async calls.
   */
  async detectInstalledApps(forceRefresh = false): Promise<MessagingCapabilities> {
    const now = Date.now();

    // Return cached results if still valid
    if (
      !forceRefresh &&
      this.cachedCapabilities &&
      now - this.lastDetectionTime < this.CACHE_DURATION_MS
    ) {
      return this.cachedCapabilities;
    }

    // SMS and Email are always available on mobile devices
    const capabilities: MessagingCapabilities = {
      whatsapp: false,
      telegram: false,
      sms: true,
      email: true,
    };

    // Check WhatsApp
    try {
      capabilities.whatsapp = await Linking.canOpenURL('whatsapp://send');
    } catch {
      capabilities.whatsapp = false;
    }

    // Check Telegram
    try {
      capabilities.telegram = await Linking.canOpenURL('tg://resolve');
    } catch {
      capabilities.telegram = false;
    }

    this.cachedCapabilities = capabilities;
    this.lastDetectionTime = now;

    return capabilities;
  }

  /**
   * Get cached capabilities without triggering async detection.
   * Returns null if no cached data is available.
   */
  getCachedCapabilities(): MessagingCapabilities | null {
    return this.cachedCapabilities;
  }

  /**
   * Get the list of apps that are available based on detected capabilities.
   */
  getAvailableApps(capabilities: MessagingCapabilities): MessagingAppConfig[] {
    return MESSAGING_APPS.filter((app) => capabilities[app.id]);
  }

  /**
   * Get the config for a specific messaging app.
   */
  getAppConfig(appId: MessagingApp): MessagingAppConfig | undefined {
    return MESSAGING_APPS.find((app) => app.id === appId);
  }

  /**
   * Filter apps that can be used with the given contact info.
   */
  getUsableApps(
    capabilities: MessagingCapabilities,
    hasPhone: boolean,
    hasEmail: boolean
  ): MessagingAppConfig[] {
    return MESSAGING_APPS.filter((app) => {
      // Must be installed/available
      if (!capabilities[app.id]) return false;

      // Must have required contact info
      if (app.requiresPhone && !hasPhone) return false;
      if (!app.requiresPhone && !hasEmail) return false;

      return true;
    });
  }

  /**
   * Clear the cache (useful for testing or after app install)
   */
  clearCache(): void {
    this.cachedCapabilities = null;
    this.lastDetectionTime = 0;
  }
}

export const appDetectionService = new AppDetectionService();
