import * as Calendar from 'expo-calendar';
import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import { Q } from '@nozbe/watermelondb';
import {
  classifyEvent,
  extractNamesFromTitle,
  matchHolidayDate,
  type EventType,
  type EventImportance,
} from '@/modules/reflection/services/keyword-dictionary';
import { checkCalendarPermissions, getCalendarSettings } from './calendar.service';
import { type InteractionCategory } from '@/shared/types/legacy-types';
import Logger from '@/shared/utils/Logger';

/**
 * Scanned calendar event with classification and friend matches
 */
export interface ScannedEvent {
  // Original calendar event data
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  notes?: string;
  allDay: boolean;

  // Classification
  eventType: EventType;
  importance: EventImportance;
  confidence: number; // 0-1 confidence score for classification

  // Friend matching
  matchedFriends: FriendMatch[];
  extractedNames: string[]; // Names found in title that didn't match friends

  // Suggestions
  suggestedCategory?: InteractionCategory;

  // Holiday matching
  holidayName?: string;
}

/**
 * Friend matched from event title or attendees
 */
export interface FriendMatch {
  friend: FriendModel;
  matchType: 'exact' | 'fuzzy' | 'attendee' | 'manual';
  confidence: number; // 0-1
}

/**
 * Options for scanning calendar events
 */
export interface ScanOptions {
  startDate: Date;
  endDate: Date;
  calendarIds?: string[]; // Specific calendars to scan (optional)
  minImportance?: EventImportance; // Filter by minimum importance
  includeWeaveEvents?: boolean; // Include events created by Weave (default: false)
}

/**
 * Result of a calendar scan operation
 */
export interface ScanResult {
  events: ScannedEvent[];
  totalScanned: number;
  matchedEvents: number; // Events with friend matches
  errors: number;
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy name matching
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1].toLowerCase() === str2[j - 1].toLowerCase()) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity between two strings (0-1, where 1 is exact match)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  return maxLength === 0 ? 1 : 1 - distance / maxLength;
}

/**
 * Match friend names from extracted names in event title
 * Returns friends with confidence scores
 */
async function matchFriends(extractedNames: string[], friends: FriendModel[]): Promise<FriendMatch[]> {
  if (extractedNames.length === 0) {
    return [];
  }

  const matches: FriendMatch[] = [];

  for (const name of extractedNames) {
    const nameLower = name.toLowerCase();

    for (const friend of friends) {
      const friendName = friend.name.toLowerCase();
      const friendFirstName = friend.name.split(' ')[0].toLowerCase();

      // Exact match (full name or first name)
      if (friendName === nameLower || friendFirstName === nameLower) {
        matches.push({
          friend,
          matchType: 'exact',
          confidence: 1.0,
        });
        continue;
      }

      // Fuzzy match (using similarity threshold)
      const fullNameSimilarity = calculateSimilarity(nameLower, friendName);
      const firstNameSimilarity = calculateSimilarity(nameLower, friendFirstName);
      const maxSimilarity = Math.max(fullNameSimilarity, firstNameSimilarity);

      // Threshold: 0.8 similarity required for fuzzy match
      if (maxSimilarity >= 0.8) {
        matches.push({
          friend,
          matchType: 'fuzzy',
          confidence: maxSimilarity,
        });
      }
    }
  }

  // Remove duplicate matches (keep highest confidence)
  const uniqueMatches = new Map<string, FriendMatch>();
  for (const match of matches) {
    const existing = uniqueMatches.get(match.friend.id);
    if (!existing || match.confidence > existing.confidence) {
      uniqueMatches.set(match.friend.id, match);
    }
  }

  return Array.from(uniqueMatches.values());
}

/**
 * Match friends from calendar event attendees (Android only)
 * Matches attendee email or name against friend data
 */
async function matchAttendeesWithFriends(eventId: string, friends: FriendModel[]): Promise<FriendMatch[]> {
  try {
    // Get attendees (only works on Android)
    const attendees = await Calendar.getAttendeesForEventAsync(eventId);
    if (!attendees || attendees.length === 0) {
      return [];
    }

    const matches: FriendMatch[] = [];

    for (const attendee of attendees) {
      // Skip if no identifiable info
      if (!attendee.email && !attendee.name) continue;

      for (const friend of friends) {
        let matched = false;

        // Try to match email (if friend has contact info)
        // Note: Current Friend model doesn't store email, but this is future-proof
        // if (attendee.email && friend.email === attendee.email) {
        //   matched = true;
        // }

        // Match by name
        if (attendee.name) {
          const attendeeNameLower = attendee.name.toLowerCase();
          const friendNameLower = friend.name.toLowerCase();
          const similarity = calculateSimilarity(attendeeNameLower, friendNameLower);

          if (similarity >= 0.8) {
            matched = true;
          }
        }

        if (matched) {
          matches.push({
            friend,
            matchType: 'attendee',
            confidence: 0.9, // High confidence for attendee matches
          });
        }
      }
    }

    return matches;
  } catch (error) {
    // Attendee API not available (iOS) or error occurred
    Logger.debug('[EventScanner] Could not fetch attendees:', error);
    return [];
  }
}

/**
 * Scan calendar events in a date range
 * Classifies events and matches friends
 */
export async function scanCalendarEvents(options: ScanOptions): Promise<ScanResult> {
  const result: ScanResult = {
    events: [],
    totalScanned: 0,
    matchedEvents: 0,
    errors: 0,
  };

  try {
    // Check if calendar integration is enabled
    const settings = await getCalendarSettings();
    if (!settings.enabled) {
      Logger.debug('[EventScanner] Calendar integration disabled');
      return result;
    }

    // Check permissions
    const hasPermission = await checkCalendarPermissions();
    if (!hasPermission.granted) {
      Logger.debug('[EventScanner] No calendar permissions');
      return result;
    }

    // Determine which calendars to scan
    let calendarIds = options.calendarIds;
    if (!calendarIds || calendarIds.length === 0) {
      // Scan all calendars
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      calendarIds = calendars.map((cal) => cal.id);
    }

    // Fetch events from all calendars in date range
    const events = await Calendar.getEventsAsync(calendarIds, options.startDate, options.endDate);

    Logger.debug(`[EventScanner] Found ${events.length} events in date range`);
    result.totalScanned = events.length;

    // OPTIMIZATION: Fetch all friends once instead of in the loop
    const allFriends = await database
      .get<FriendModel>('friends')
      .query(Q.where('is_dormant', false))
      .fetch();

    Logger.debug(`[EventScanner] Loaded ${allFriends.length} friends for matching`);

    // Process each event
    for (const event of events) {
      try {
        // Skip Weave-created events unless explicitly included
        if (!options.includeWeaveEvents && event.title?.startsWith('🧵')) {
          continue;
        }

        // Classify the event
        const classification = classifyEvent(event.title || '');
        if (!classification) {
          // Couldn't classify - skip
          continue;
        }

        // Filter by importance if specified
        if (options.minImportance) {
          const importanceOrder: EventImportance[] = ['low', 'medium', 'high', 'critical'];
          const minIndex = importanceOrder.indexOf(options.minImportance);
          const eventIndex = importanceOrder.indexOf(classification.importance);
          if (eventIndex < minIndex) {
            continue; // Event importance too low
          }
        }

        // Extract names from title
        const extractedNames = extractNamesFromTitle(event.title || '');

        // Match friends from title
        const friendMatches = await matchFriends(extractedNames, allFriends);

        // Try to match attendees (Android only)
        const attendeeMatches = await matchAttendeesWithFriends(event.id, allFriends);

        // Combine matches (remove duplicates)
        const allMatches = [...friendMatches, ...attendeeMatches];
        const uniqueMatches = new Map<string, FriendMatch>();
        for (const match of allMatches) {
          const existing = uniqueMatches.get(match.friend.id);
          if (!existing || match.confidence > existing.confidence) {
            uniqueMatches.set(match.friend.id, match);
          }
        }

        const matchedFriends = Array.from(uniqueMatches.values());

        // Check for holiday match
        const holidayMatch = matchHolidayDate(new Date(event.startDate));

        // Create scanned event
        const scannedEvent: ScannedEvent = {
          id: event.id,
          title: event.title || '',
          startDate: new Date(event.startDate),
          endDate: new Date(event.endDate),
          location: event.location,
          notes: event.notes,
          allDay: event.allDay || false,
          eventType: classification.type,
          importance: classification.importance,
          confidence: classification.confidence,
          matchedFriends,
          extractedNames: extractedNames.filter(
            (name) => !matchedFriends.some((m) => m.friend.name.toLowerCase().includes(name.toLowerCase()))
          ),
          suggestedCategory: classification.suggestedCategory,
          holidayName: holidayMatch?.name,
        };

        result.events.push(scannedEvent);

        if (matchedFriends.length > 0) {
          result.matchedEvents++;
        }
      } catch (error) {
        Logger.error('[EventScanner] Error processing event:', error);
        result.errors++;
      }
    }

    // Deduplicate events based on Title + StartTime
    // This handles cases where the same event exists on multiple calendars (e.g., Personal + Work)
    const uniqueEvents = new Map<string, ScannedEvent>();

    for (const event of result.events) {
      const key = `${event.title}|${event.startDate.getTime()}`;
      if (!uniqueEvents.has(key)) {
        uniqueEvents.set(key, event);
      } else {
        // Keep the one with more matched friends, or just the first one if equal
        const existing = uniqueEvents.get(key)!;
        if (event.matchedFriends.length > existing.matchedFriends.length) {
          uniqueEvents.set(key, event);
        }
      }
    }

    result.events = Array.from(uniqueEvents.values());

    Logger.info(
      `[EventScanner] Scan complete: ${result.events.length} classified (unique), ${result.matchedEvents} with friend matches`
    );
    return result;
  } catch (error) {
    Logger.error('[EventScanner] Fatal error during scan:', error);
    return result;
  }
}

/**
 * Quick scan for upcoming events (next 30 days)
 * Convenience wrapper for common use case
 */
export async function scanUpcomingEvents(): Promise<ScanResult> {
  const now = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 30);

  return scanCalendarEvents({
    startDate: now,
    endDate,
    includeWeaveEvents: false,
    minImportance: 'medium', // Skip low-importance events
  });
}

/**
 * Quick scan for recent past events (last 7 days)
 * Convenience wrapper for post-event suggestions
 */
export async function scanRecentPastEvents(): Promise<ScanResult> {
  const now = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);

  return scanCalendarEvents({
    startDate,
    endDate: now,
    includeWeaveEvents: false,
    minImportance: 'medium', // Skip low-importance events
  });
}
