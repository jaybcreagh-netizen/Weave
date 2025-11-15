/**
 * Widget Bridge Module
 * Shares Today's Focus data with iOS home screen widget
 */

import { NativeModules } from 'react-native';

const { WidgetBridgeModule } = NativeModules;

export interface WidgetFocusData {
  state: 'pressing-event' | 'todays-plan' | 'streak-risk' | 'friend-fading' | 'upcoming-plan' | 'quick-weave' | 'all-clear';
  title: string;
  subtitle: string;
  friendName?: string;
  daysInfo?: string;
  deepLink: string;
  timestamp: number;
}

export const WidgetBridge = {
  /**
   * Update widget with new focus data
   * Writes to shared UserDefaults and triggers widget refresh
   */
  updateWidget: async (data: WidgetFocusData): Promise<void> => {
    if (!WidgetBridgeModule) {
      console.warn('[WidgetBridge] Module not available - iOS only');
      return;
    }

    try {
      await WidgetBridgeModule.updateWidget(data);
    } catch (error) {
      console.error('[WidgetBridge] Error updating widget:', error);
    }
  },

  /**
   * Clear widget data
   */
  clearWidget: async (): Promise<void> => {
    if (!WidgetBridgeModule) {
      return;
    }

    try {
      await WidgetBridgeModule.clearWidget();
    } catch (error) {
      console.error('[WidgetBridge] Error clearing widget:', error);
    }
  },
};
