/**
 * useMessagingApps Hook
 *
 * Provides information about available messaging apps on the device.
 */

import { useEffect, useState, useCallback } from 'react';
import { MessagingCapabilities, MessagingAppConfig } from '../types';
import { appDetectionService, MESSAGING_APPS } from '../services/app-detection.service';

interface UseMessagingAppsReturn {
  /** Detected messaging capabilities */
  capabilities: MessagingCapabilities | null;
  /** List of available messaging apps */
  availableApps: MessagingAppConfig[];
  /** Whether detection is in progress */
  loading: boolean;
  /** Whether any messaging capability is available */
  hasMessagingCapability: boolean;
  /** Refresh the detected apps */
  refresh: () => Promise<void>;
}

export function useMessagingApps(): UseMessagingAppsReturn {
  const [capabilities, setCapabilities] = useState<MessagingCapabilities | null>(null);
  const [loading, setLoading] = useState(true);

  const detectApps = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      const caps = await appDetectionService.detectInstalledApps(forceRefresh);
      setCapabilities(caps);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Check cached first for instant UI
    const cached = appDetectionService.getCachedCapabilities();
    if (cached) {
      setCapabilities(cached);
      setLoading(false);
    }

    // Always run detection on mount
    detectApps();
  }, [detectApps]);

  const availableApps = capabilities
    ? appDetectionService.getAvailableApps(capabilities)
    : [];

  const refresh = useCallback(async () => {
    await detectApps(true);
  }, [detectApps]);

  return {
    capabilities,
    availableApps,
    loading,
    hasMessagingCapability: availableApps.length > 0,
    refresh,
  };
}
