
/**
 * Notification Types
 * Shared definitions for the notification system
 */

export type NotificationType =
    | 'battery-checkin'
    | 'weekly-reflection'
    | 'event-reminder'
    | 'deepening-nudge'
    | 'friend-suggestion'
    | 'memory-nudge'
    | 'event-suggestion'
    | 'life-event'
    | 'portfolio-insight'
    | 'evening-digest';

export interface ScheduledNotification {
    id: string;
    type: NotificationType;
    scheduledFor: Date;
    data: Record<string, any>;
}

export interface NotificationPreferences {
    frequency: 'light' | 'moderate' | 'proactive'; // How often to notify
    quietHoursStart: number; // Hour (0-23) when quiet hours start (e.g., 22 for 10 PM)
    quietHoursEnd: number; // Hour (0-23) when quiet hours end (e.g., 8 for 8 AM)

    respectBattery: boolean; // Whether to reduce notifications when battery is low
    digestEnabled: boolean;
    digestTime: string; // "HH:MM"
    maxDailySuggestions?: number; // Override for max daily suggestions in UI
}

export type NotificationChannel = {
    /** Schedule a specific notification */
    schedule: (...args: any[]) => Promise<any>;
    /** Cancel a specific notification or all for this channel */
    cancel: (id?: string) => Promise<void>;
    /** Handle tap action */
    handleTap: (data: any, router: any) => void;
    /** Ensure notification is scheduled (idempotent/repair) - Optional */
    ensureScheduled?: () => Promise<void>;
};

// =============================================================================
// Stored Data Types
// These interfaces define the shape of data persisted in AsyncStorage
// =============================================================================

/**
 * Deepening nudge stored for tracking scheduled nudges
 */
export interface StoredDeepeningNudge {
    interactionId: string;
    scheduledAt: number;
    notificationId: string;
}

/**
 * Pending event stored for evening digest batching
 */
export interface StoredPendingEvent {
    eventId: string;
    title: string;
    friendNames: string;
    eventDate: string;
    friendIds: string[];
    suggestedCategory?: string;
}

/**
 * Daily budget tracking
 */
export interface DailyBudgetData {
    date: string;
    used: number;
}

/**
 * Smart notification count per day
 */
export interface SmartNotificationStats {
    date: string;
    count: number;
}

/**
 * Scheduled smart notification IDs per day
 */
export interface ScheduledSmartNotifications {
    date: string;
    ids: string[];
}

/**
 * Ignore counts per notification type
 */
export interface IgnoreCounts {
    [type: string]: number;
}

/**
 * Pending events wrapper with date
 */
export interface PendingEventsData {
    date: string;
    events: StoredPendingEvent[];
}
