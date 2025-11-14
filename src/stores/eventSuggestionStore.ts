import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { scanUpcomingEvents, scanRecentPastEvents, type ScannedEvent } from '../lib/event-scanner';

const DISMISSED_SUGGESTIONS_KEY = '@weave:dismissed_event_suggestions';
const LAST_SCAN_KEY = '@weave:last_event_scan';

/**
 * Suggestion type
 */
export type SuggestionType = 'upcoming' | 'past';

/**
 * Event suggestion with metadata
 */
export interface EventSuggestion {
  event: ScannedEvent;
  type: SuggestionType;
  suggestedAt: Date;
}

interface EventSuggestionStore {
  // Upcoming events (birthdays, holidays, etc.)
  upcomingEvents: EventSuggestion[];
  // Past events that might be weaves
  pastEvents: EventSuggestion[];
  // Currently showing past event modal
  showingPastEvent: EventSuggestion | null;
  // Loading state
  isScanning: boolean;
  // Last scan time
  lastScanTime: Date | null;

  // Actions
  scanForSuggestions: () => Promise<void>;
  dismissUpcomingEvent: (eventId: string) => Promise<void>;
  dismissPastEvent: (eventId: string) => Promise<void>;
  showPastEventModal: (suggestion: EventSuggestion) => void;
  hidePastEventModal: () => void;
  clearAllSuggestions: () => void;
}

/**
 * Storage for dismissed suggestions
 */
interface DismissedSuggestions {
  eventIds: string[];
  timestamp: number;
}

/**
 * Load dismissed suggestions from storage
 */
async function loadDismissedSuggestions(): Promise<Set<string>> {
  try {
    const data = await AsyncStorage.getItem(DISMISSED_SUGGESTIONS_KEY);
    if (!data) return new Set();

    const parsed: DismissedSuggestions = JSON.parse(data);

    // Clear dismissed suggestions older than 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    if (parsed.timestamp < thirtyDaysAgo) {
      await AsyncStorage.removeItem(DISMISSED_SUGGESTIONS_KEY);
      return new Set();
    }

    return new Set(parsed.eventIds);
  } catch (error) {
    console.error('[EventSuggestionStore] Error loading dismissed suggestions:', error);
    return new Set();
  }
}

/**
 * Save dismissed suggestion to storage
 */
async function saveDismissedSuggestion(eventId: string): Promise<void> {
  try {
    const dismissed = await loadDismissedSuggestions();
    dismissed.add(eventId);

    const data: DismissedSuggestions = {
      eventIds: Array.from(dismissed),
      timestamp: Date.now(),
    };

    await AsyncStorage.setItem(DISMISSED_SUGGESTIONS_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('[EventSuggestionStore] Error saving dismissed suggestion:', error);
  }
}

/**
 * Check if we should scan (throttle to once per hour)
 */
async function shouldScan(): Promise<boolean> {
  try {
    const lastScan = await AsyncStorage.getItem(LAST_SCAN_KEY);
    if (!lastScan) return true;

    const lastScanTime = parseInt(lastScan, 10);
    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    return lastScanTime < oneHourAgo;
  } catch (error) {
    return true;
  }
}

/**
 * Update last scan time
 */
async function updateLastScanTime(): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_SCAN_KEY, Date.now().toString());
  } catch (error) {
    console.error('[EventSuggestionStore] Error updating last scan time:', error);
  }
}

export const useEventSuggestionStore = create<EventSuggestionStore>((set, get) => ({
  upcomingEvents: [],
  pastEvents: [],
  showingPastEvent: null,
  isScanning: false,
  lastScanTime: null,

  scanForSuggestions: async () => {
    const state = get();
    if (state.isScanning) {
      console.log('[EventSuggestionStore] Scan already in progress');
      return;
    }

    // Check if we should scan (throttle)
    const should = await shouldScan();
    if (!should) {
      console.log('[EventSuggestionStore] Scan throttled (scanned recently)');
      return;
    }

    set({ isScanning: true });

    try {
      console.log('[EventSuggestionStore] Scanning for event suggestions...');

      // Load dismissed suggestions
      const dismissed = await loadDismissedSuggestions();

      // Scan upcoming events (next 30 days)
      const upcomingResult = await scanUpcomingEvents();
      console.log(`[EventSuggestionStore] Found ${upcomingResult.events.length} upcoming events`);

      // Scan recent past events (last 7 days)
      const pastResult = await scanRecentPastEvents();
      console.log(`[EventSuggestionStore] Found ${pastResult.events.length} past events`);

      // Filter out dismissed events and events without friend matches
      const now = new Date();

      const upcomingSuggestions: EventSuggestion[] = upcomingResult.events
        .filter((event) => !dismissed.has(event.id))
        .filter((event) => event.matchedFriends.length > 0) // Only show events with friend matches
        .map((event) => ({
          event,
          type: 'upcoming' as SuggestionType,
          suggestedAt: now,
        }));

      const pastSuggestions: EventSuggestion[] = pastResult.events
        .filter((event) => !dismissed.has(event.id))
        .filter((event) => event.matchedFriends.length > 0) // Only show events with friend matches
        .map((event) => ({
          event,
          type: 'past' as SuggestionType,
          suggestedAt: now,
        }));

      set({
        upcomingEvents: upcomingSuggestions,
        pastEvents: pastSuggestions,
        isScanning: false,
        lastScanTime: now,
      });

      // Update last scan time
      await updateLastScanTime();

      console.log(
        `[EventSuggestionStore] Scan complete: ${upcomingSuggestions.length} upcoming, ${pastSuggestions.length} past`
      );
    } catch (error) {
      console.error('[EventSuggestionStore] Error scanning for suggestions:', error);
      set({ isScanning: false });
    }
  },

  dismissUpcomingEvent: async (eventId: string) => {
    await saveDismissedSuggestion(eventId);
    set((state) => ({
      upcomingEvents: state.upcomingEvents.filter((s) => s.event.id !== eventId),
    }));
  },

  dismissPastEvent: async (eventId: string) => {
    await saveDismissedSuggestion(eventId);
    set((state) => ({
      pastEvents: state.pastEvents.filter((s) => s.event.id !== eventId),
      showingPastEvent: state.showingPastEvent?.event.id === eventId ? null : state.showingPastEvent,
    }));
  },

  showPastEventModal: (suggestion: EventSuggestion) => {
    set({ showingPastEvent: suggestion });
  },

  hidePastEventModal: () => {
    set({ showingPastEvent: null });
  },

  clearAllSuggestions: () => {
    set({
      upcomingEvents: [],
      pastEvents: [],
      showingPastEvent: null,
    });
  },
}));
