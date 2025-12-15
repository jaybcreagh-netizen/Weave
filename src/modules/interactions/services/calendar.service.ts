import * as Calendar from 'expo-calendar';
import { Linking, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { database } from '@/db';
import { logger } from '@/shared/services/logger.service';
import Interaction from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import FriendModel from '@/db/models/Friend';
import { Q } from '@nozbe/watermelondb';

const CALENDAR_SETTINGS_KEY = '@weave_calendar_settings';

// --- Types ---

export interface CalendarSettings {
  enabled: boolean;
  calendarId: string | null;
  reminderMinutes: number;
  twoWaySync: boolean;
}

const DEFAULT_SETTINGS: CalendarSettings = {
  enabled: false,
  calendarId: null,
  reminderMinutes: 60,
  twoWaySync: true,
};

export interface CalendarSyncResult {
  synced: number;
  deleted: number;
  errors: number;
  changes: CalendarChange[];
}

export interface CalendarChange {
  interactionId: string;
  friendNames: string;
  changeType: 'updated' | 'deleted';
  fields: string[];
}


// --- Permissions and Settings ---

export async function checkCalendarPermissions(): Promise<{ granted: boolean; canAskAgain: boolean; }> {
  try {
    const { status, canAskAgain } = await Calendar.getCalendarPermissionsAsync();
    return { granted: status === 'granted', canAskAgain: canAskAgain !== false };
  } catch (error) {
    console.error('Error checking calendar permissions:', error);
    return { granted: false, canAskAgain: true };
  }
}

export async function requestCalendarPermissions(): Promise<boolean> {
  try {
    const currentStatus = await checkCalendarPermissions();
    if (currentStatus.granted) return true;

    if (!currentStatus.canAskAgain) {
      Alert.alert(
        'Calendar Permission Required',
        'Please enable calendar access in your device Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    }

    const { status } = await Calendar.requestCalendarPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error requesting calendar permissions:', error);
    return false;
  }
}

export async function getCalendarSettings(): Promise<CalendarSettings> {
  try {
    const settings = await AsyncStorage.getItem(CALENDAR_SETTINGS_KEY);
    return settings ? JSON.parse(settings) : DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Error loading calendar settings:', error);
    return DEFAULT_SETTINGS;
  }
}

export async function saveCalendarSettings(settings: CalendarSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(CALENDAR_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving calendar settings:', error);
  }
}

export async function getAvailableCalendars(): Promise<Calendar.Calendar[]> {
  try {
    const hasPermission = await requestCalendarPermissions();
    if (!hasPermission) return [];

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    return calendars.filter(cal => cal.allowsModifications);
  } catch (error) {
    console.error('Error fetching calendars:', error);
    return [];
  }
}

// --- Event Management ---

/**
 * Validates that a calendar ID still exists and is writable.
 * Returns the calendar if valid, null otherwise.
 */
async function validateCalendarId(calendarId: string): Promise<Calendar.Calendar | null> {
  try {
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const calendar = calendars.find(cal => cal.id === calendarId);

    if (!calendar) {
      logger.warn('CalendarService', `Calendar ${calendarId} no longer exists`);
      return null;
    }

    if (!calendar.allowsModifications) {
      logger.warn('CalendarService', `Calendar ${calendar.title} is read-only`);
      return null;
    }

    return calendar;
  } catch (error) {
    logger.error('CalendarService', 'Error validating calendar:', error);
    return null;
  }
}

async function getDefaultCalendarId(): Promise<string | null> {
  const settings = await getCalendarSettings();

  // If user has a saved calendar, validate it still exists
  if (settings.calendarId) {
    const calendar = await validateCalendarId(settings.calendarId);
    if (calendar) {
      logger.debug('CalendarService', `Using saved calendar: ${calendar.title} (${calendar.source.name})`);
      return settings.calendarId;
    }

    // Saved calendar is invalid - clear it from settings
    logger.warn('CalendarService', 'Saved calendar no longer valid, clearing setting');
    await saveCalendarSettings({ ...settings, calendarId: null });
  }

  // Fall back to finding a default calendar
  const calendars = await getAvailableCalendars();
  if (calendars.length === 0) {
    logger.warn('CalendarService', 'No writable calendars available');
    return null;
  }

  const defaultCal = calendars.find(cal => cal.isPrimary) || calendars[0];
  logger.debug('CalendarService', `Using default calendar: ${defaultCal.title} (${defaultCal.source.name})`);
  return defaultCal.id;
}

export interface CreateEventResult {
  success: boolean;
  eventId: string | null;
  error?: 'disabled' | 'no_permission' | 'no_calendar' | 'create_failed';
  message?: string;
}

export async function createWeaveCalendarEvent(params: {
  title: string;
  friendNames: string;
  category: string;
  date: Date;
  location?: string;
  notes?: string;
}): Promise<string | null> {
  const result = await createWeaveCalendarEventWithResult(params);
  return result.eventId;
}

export async function createWeaveCalendarEventWithResult(params: {
  title: string;
  friendNames: string;
  category: string;
  date: Date;
  location?: string;
  notes?: string;
}): Promise<CreateEventResult> {
  try {
    const settings = await getCalendarSettings();
    if (!settings.enabled) {
      logger.debug('CalendarService', 'Calendar integration disabled');
      return { success: false, eventId: null, error: 'disabled' };
    }

    const hasPermission = await requestCalendarPermissions();
    if (!hasPermission) {
      logger.warn('CalendarService', 'Calendar permissions not granted');
      return { success: false, eventId: null, error: 'no_permission', message: 'Calendar permissions not granted' };
    }

    const calendarId = await getDefaultCalendarId();
    if (!calendarId) {
      logger.warn('CalendarService', 'No calendar available for event creation');
      return { success: false, eventId: null, error: 'no_calendar', message: 'No calendar available. Please select a calendar in Settings.' };
    }

    const startDate = new Date(params.date);
    const hasTime = startDate.getHours() !== 0 || startDate.getMinutes() !== 0;

    // Use custom title as primary if provided, otherwise fall back to standard format
    const eventTitle = params.title
      ? `🧵 ${params.title}`
      : `🧵 ${params.category} with ${params.friendNames}`;

    const eventNotes = [
      `📅 Planned weave with ${params.friendNames}`,
      '',
      `Activity: ${params.category}`,
      params.location ? `Location: ${params.location}` : null,
      '',
      params.notes ? `Notes:\n${params.notes}` : null,
      '',
      '---',
      'Created by Weave'
    ].filter(Boolean).join('\n');

    const eventDetails: Partial<Calendar.Event> = {
      title: eventTitle,
      startDate,
      endDate: hasTime ? new Date(startDate.getTime() + 2 * 60 * 60 * 1000) : startDate,
      notes: eventNotes,
      location: params.location || '',
      allDay: !hasTime,
      alarms: settings.reminderMinutes > 0 && hasTime ? [{ relativeOffset: -settings.reminderMinutes }] : [],
    };

    logger.info('CalendarService', `Creating event "${eventTitle}" on calendar ${calendarId}`);
    const eventId = await Calendar.createEventAsync(calendarId, eventDetails);
    logger.info('CalendarService', `Event created successfully: ${eventId}`);

    return { success: true, eventId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('CalendarService', 'Error creating calendar event:', errorMessage);
    return { success: false, eventId: null, error: 'create_failed', message: `Failed to create event: ${errorMessage}` };
  }
}

export async function updateWeaveCalendarEvent(eventId: string, params: { title?: string; date?: Date; location?: string; notes?: string; }): Promise<boolean> {
  try {
    const settings = await getCalendarSettings();
    if (!settings.enabled) return false;

    const hasPermission = await checkCalendarPermissions();
    if (!hasPermission.granted) return false;

    const updateParams: Partial<Calendar.Event> = {};

    if (params.title !== undefined) {
      // Format title consistently with create
      updateParams.title = params.title ? `🧵 ${params.title}` : undefined;
    }
    if (params.date !== undefined) {
      const hasTime = params.date.getHours() !== 0 || params.date.getMinutes() !== 0;
      updateParams.startDate = params.date;
      updateParams.endDate = hasTime
        ? new Date(params.date.getTime() + 2 * 60 * 60 * 1000)
        : params.date;
      updateParams.allDay = !hasTime;
    }
    if (params.location !== undefined) {
      updateParams.location = params.location || '';
    }
    if (params.notes !== undefined) {
      updateParams.notes = params.notes || '';
    }

    if (Object.keys(updateParams).length > 0) {
      await Calendar.updateEventAsync(eventId, updateParams);
    }
    return true;
  } catch (error) {
    console.error('Error updating calendar event:', error);
    return false;
  }
}

export async function deleteWeaveCalendarEvent(eventId: string): Promise<boolean> {
  try {
    await Calendar.deleteEventAsync(eventId);
    return true;
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    return false;
  }
}

// --- Two-Way Sync ---

function detectChanges(calendarEvent: Calendar.Event, interaction: Interaction): { hasChanges: boolean; fields: string[] } {
  const fields: string[] = [];
  const calEventDate = new Date(calendarEvent.startDate);
  const interactionDate = new Date(interaction.interactionDate);

  if (Math.abs(calEventDate.getTime() - interactionDate.getTime()) > 60000) {
    fields.push('date');
  }
  if ((calendarEvent.location || '').trim() !== (interaction.location || '').trim()) {
    fields.push('location');
  }

  return { hasChanges: fields.length > 0, fields };
}

async function getFriendNamesForInteraction(interactionId: string): Promise<string> {
  const interactionFriends = await database.get<InteractionFriend>('interaction_friends').query(Q.where('interaction_id', interactionId)).fetch();
  const friendIds = interactionFriends.map((f) => f.friendId);
  const friends = await database.get<FriendModel>('friends').query(Q.where('id', Q.oneOf(friendIds))).fetch();
  return friends.map((f) => f.name).join(', ');
}

let isSyncing = false;

export async function syncCalendarChanges(): Promise<CalendarSyncResult> {
  if (isSyncing) {
    logger.debug('CalendarService', 'Sync already in progress, skipping.');
    return { synced: 0, deleted: 0, errors: 0, changes: [] };
  }

  isSyncing = true;
  const result: CalendarSyncResult = { synced: 0, deleted: 0, errors: 0, changes: [] };

  try {
    const settings = await getCalendarSettings();
    if (!settings.enabled || !settings.twoWaySync) return result;

    const hasPermission = await checkCalendarPermissions();
    if (!hasPermission.granted) return result;

    const plannedInteractions = await database.get<Interaction>('interactions').query(
      Q.where('status', Q.oneOf(['planned', 'pending_confirm'])),
      Q.where('calendar_event_id', Q.notEq(null))
    ).fetch();

    const batchOps: any[] = [];

    // Prepare all updates first (outside of write transaction)
    for (const interaction of plannedInteractions) {
      const calendarEventId = interaction.calendarEventId;
      if (!calendarEventId) continue;

      try {
        const calendarEvent = await Calendar.getEventAsync(calendarEventId);
        const { hasChanges, fields } = detectChanges(calendarEvent, interaction);

        if (hasChanges) {
          batchOps.push(interaction.prepareUpdate((i) => {
            if (fields.includes('date')) i.interactionDate = new Date(calendarEvent.startDate);
            if (fields.includes('location')) i.location = calendarEvent.location || '';
          }));

          result.synced++;
          result.changes.push({
            interactionId: interaction.id,
            friendNames: await getFriendNamesForInteraction(interaction.id),
            changeType: 'updated',
            fields,
          });
        }
      } catch (error) {
        // Assuming error means event was deleted
        batchOps.push(interaction.prepareUpdate((i) => { i.status = 'cancelled'; }));

        result.deleted++;
        result.changes.push({
          interactionId: interaction.id,
          friendNames: await getFriendNamesForInteraction(interaction.id),
          changeType: 'deleted',
          fields: [],
        });
      }
    }

    // Execute all updates in a single batch
    if (batchOps.length > 0) {
      await database.write(async () => {
        await database.batch(batchOps);
      });
    }

  } catch (error) {
    console.error('[CalendarService] Error during sync:', error);
    result.errors++;
  } finally {
    isSyncing = false;
  }

  return result;
}
