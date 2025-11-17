import * as Calendar from 'expo-calendar';
import { database } from '../db';
import Interaction from '../db/models/Interaction';
import InteractionFriend from '../db/models/InteractionFriend';
import FriendModel from '../db/models/Friend';
import { Q } from '@nozbe/watermelondb';
import { getCalendarSettings, checkCalendarPermissions } from './calendar-service';

/**
 * Result of a calendar sync operation
 */
export interface CalendarSyncResult {
  synced: number; // Number of interactions synced
  deleted: number; // Number of interactions marked as cancelled due to deleted events
  errors: number; // Number of errors encountered
  changes: CalendarChange[]; // Detailed list of changes
}

/**
 * Details about a specific sync change
 */
export interface CalendarChange {
  interactionId: string;
  friendNames: string;
  changeType: 'updated' | 'deleted';
  fields: string[]; // Which fields changed (e.g., ['date', 'location'])
}

/**
 * Fetch a single calendar event by ID
 * Returns null if event doesn't exist or is inaccessible
 */
export async function getCalendarEvent(eventId: string): Promise<Calendar.Event | null> {
  try {
    const hasPermission = await checkCalendarPermissions();
    if (!hasPermission.granted) return null;

    const event = await Calendar.getEventAsync(eventId);
    return event;
  } catch (error) {
    console.warn(`[CalendarSync] Event ${eventId} not found or inaccessible:`, error);
    return null;
  }
}

/**
 * Compare a calendar event with an interaction to detect changes
 * Returns which fields have changed
 */
export function detectChanges(
  calendarEvent: Calendar.Event,
  interaction: Interaction
): { hasChanges: boolean; fields: string[] } {
  const fields: string[] = [];

  // Compare date (within 1 minute tolerance for rounding/timezone)
  const calEventDate = new Date(calendarEvent.startDate);
  const interactionDate = new Date(interaction.interactionDate);
  const timeDiff = Math.abs(calEventDate.getTime() - interactionDate.getTime());

  if (timeDiff > 60000) {
    // More than 1 minute difference
    fields.push('date');
  }

  // Compare location
  const calLocation = (calendarEvent.location || '').trim();
  const intLocation = (interaction.location || '').trim();
  if (calLocation !== intLocation) {
    fields.push('location');
  }

  // Compare notes
  // Calendar event notes contain formatted text from Weave
  // Extract user notes section (after "💭 Notes:")
  const calNotes = calendarEvent.notes || '';
  const intNotes = interaction.note || '';

  const notesMatch = calNotes.match(/💭 Notes:\n(.+?)(?:\n\n|$)/s);
  const calUserNotes = notesMatch ? notesMatch[1].trim() : '';

  if (calUserNotes !== intNotes.trim()) {
    fields.push('notes');
  }

  return { hasChanges: fields.length > 0, fields };
}

/**
 * Update an interaction from calendar event changes
 */
async function updateInteractionFromCalendarEvent(
  interaction: Interaction,
  calendarEvent: Calendar.Event,
  changedFields: string[]
): Promise<void> {
  await database.write(async () => {
    await interaction.update((i) => {
      if (changedFields.includes('date')) {
        i.interactionDate = new Date(calendarEvent.startDate);
      }

      if (changedFields.includes('location')) {
        i.location = calendarEvent.location || '';
      }

      if (changedFields.includes('notes')) {
        // Extract user notes from formatted calendar notes
        const calNotes = calendarEvent.notes || '';
        const notesMatch = calNotes.match(/💭 Notes:\n(.+?)(?:\n\n|$)/s);
        const userNotes = notesMatch ? notesMatch[1].trim() : '';
        i.note = userNotes;
      }
    });
  });
}

/**
 * Mark an interaction as cancelled due to deleted calendar event
 */
async function markInteractionAsCancelled(interaction: Interaction): Promise<void> {
  await database.write(async () => {
    await interaction.update((i) => {
      i.status = 'cancelled';
    });
  });
}

/**
 * Get friend names for an interaction (for reporting)
 */
async function getFriendNamesForInteraction(interactionId: string): Promise<string> {
  try {
    const interactionFriends = await database
      .get<InteractionFriend>('interaction_friends')
      .query(Q.where('interaction_id', interactionId))
      .fetch();

    const friendIds = interactionFriends.map((f) => f.friendId);
    const friends = await database
      .get<FriendModel>('friends')
      .query(Q.where('id', Q.oneOf(friendIds)))
      .fetch();

    return friends.map((f) => f.name).join(', ');
  } catch (error) {
    console.error('[CalendarSync] Error getting friend names:', error);
    return 'Unknown';
  }
}

/**
 * Main sync function - syncs all calendar-linked interactions
 * Should be called on:
 * - App launch
 * - App resume from background
 * - Manual refresh (pull-to-refresh)
 * - Periodic checks while app is active
 */
export async function syncCalendarChanges(): Promise<CalendarSyncResult> {
  const result: CalendarSyncResult = {
    synced: 0,
    deleted: 0,
    errors: 0,
    changes: [],
  };

  try {
    // Check if calendar integration is enabled
    const settings = await getCalendarSettings();
    if (!settings.enabled) {
      console.log('[CalendarSync] Calendar integration disabled, skipping sync');
      return result;
    }

    // Check if two-way sync is enabled
    if (!settings.twoWaySync) {
      console.log('[CalendarSync] Two-way sync disabled, skipping sync');
      return result;
    }

    // Check permissions
    const hasPermission = await checkCalendarPermissions();
    if (!hasPermission.granted) {
      console.log('[CalendarSync] No calendar permissions, skipping sync');
      return result;
    }

    // Get all planned interactions with calendar event IDs
    const plannedInteractions = await database
      .get<Interaction>('interactions')
      .query(
        Q.where('status', Q.oneOf(['planned', 'pending_confirm'])),
        Q.where('calendar_event_id', Q.notEq(null))
      )
      .fetch();

    console.log(
      `[CalendarSync] Found ${plannedInteractions.length} planned interactions with calendar events`
    );

    // Process each interaction
    for (const interaction of plannedInteractions) {
      const calendarEventId = interaction.calendarEventId;
      if (!calendarEventId) continue;

      try {
        // Fetch calendar event
        const calendarEvent = await getCalendarEvent(calendarEventId);

        if (!calendarEvent) {
          // Event was deleted from calendar
          await markInteractionAsCancelled(interaction);
          result.deleted++;

          const friendNames = await getFriendNamesForInteraction(interaction.id);

          result.changes.push({
            interactionId: interaction.id,
            friendNames,
            changeType: 'deleted',
            fields: [],
          });

          console.log(`[CalendarSync] Marked interaction ${interaction.id} as cancelled (event deleted)`);
          continue;
        }

        // Compare and detect changes
        const { hasChanges, fields } = detectChanges(calendarEvent, interaction);

        if (hasChanges) {
          await updateInteractionFromCalendarEvent(interaction, calendarEvent, fields);
          result.synced++;

          const friendNames = await getFriendNamesForInteraction(interaction.id);

          result.changes.push({
            interactionId: interaction.id,
            friendNames,
            changeType: 'updated',
            fields,
          });

          console.log(`[CalendarSync] Synced changes for interaction ${interaction.id}:`, fields);
        }
      } catch (error) {
        console.error(`[CalendarSync] Error syncing interaction ${interaction.id}:`, error);
        result.errors++;
      }
    }

    console.log(`[CalendarSync] Sync complete:`, result);
    return result;
  } catch (error) {
    console.error('[CalendarSync] Fatal error during sync:', error);
    return result;
  }
}
