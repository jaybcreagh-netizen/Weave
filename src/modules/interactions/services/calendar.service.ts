import * as Calendar from 'expo-calendar';
import { Platform, Linking, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { database } from '@/db';
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

async function getDefaultCalendarId(): Promise<string | null> {
    const settings = await getCalendarSettings();
    if (settings.calendarId) return settings.calendarId;

    const calendars = await getAvailableCalendars();
    if (calendars.length === 0) return null;

    const defaultCal = calendars.find(cal => cal.isPrimary) || calendars[0];
    return defaultCal.id;
}

export async function createWeaveCalendarEvent(params: {
  title: string;
  friendNames: string;
  category: string;
  date: Date;
  location?: string;
  notes?: string;
}): Promise<string | null> {
  try {
    const settings = await getCalendarSettings();
    if (!settings.enabled) return null;

    const hasPermission = await requestCalendarPermissions();
    if (!hasPermission) return null;

    const calendarId = await getDefaultCalendarId();
    if (!calendarId) return null;

    const startDate = new Date(params.date);
    const hasTime = startDate.getHours() !== 0 || startDate.getMinutes() !== 0;

    let eventTitle = `🧵 Weave with ${params.friendNames} - ${params.title || params.category}`;
    let eventNotes = `📅 Planned weave with ${params.friendNames}\n\nActivity: ${params.category}\nLocation: ${params.location || 'N/A'}\n\nNotes:\n${params.notes || ''}\n\n---\nCreated by Weave`;

    const eventDetails: Calendar.Event = {
      title: eventTitle,
      startDate,
      endDate: hasTime ? new Date(startDate.getTime() + 2 * 60 * 60 * 1000) : startDate,
      notes: eventNotes,
      location: params.location,
      allDay: !hasTime,
      alarms: settings.reminderMinutes > 0 && hasTime ? [{ relativeOffset: -settings.reminderMinutes }] : [],
    };

    const eventId = await Calendar.createEventAsync(calendarId, eventDetails);
    return eventId;
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return null;
  }
}

export async function updateWeaveCalendarEvent(eventId: string, params: { title?: string; date?: Date; location?: string; notes?: string; }): Promise<boolean> {
  try {
    const settings = await getCalendarSettings();
    if (!settings.enabled) return false;

    await Calendar.updateEventAsync(eventId, params);
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

export async function syncCalendarChanges(): Promise<CalendarSyncResult> {
  const result: CalendarSyncResult = { synced: 0, deleted: 0, errors: 0, changes: [] };
  const settings = await getCalendarSettings();
  if (!settings.enabled || !settings.twoWaySync) return result;

  const hasPermission = await checkCalendarPermissions();
  if (!hasPermission.granted) return result;

  const plannedInteractions = await database.get<Interaction>('interactions').query(
    Q.where('status', Q.oneOf(['planned', 'pending_confirm'])),
    Q.where('calendar_event_id', Q.notEq(null))
  ).fetch();

  for (const interaction of plannedInteractions) {
    const calendarEventId = interaction.calendarEventId;
    if (!calendarEventId) continue;

    try {
      const calendarEvent = await Calendar.getEventAsync(calendarEventId);
      const { hasChanges, fields } = detectChanges(calendarEvent, interaction);

      if (hasChanges) {
        await database.write(async () => {
            await interaction.update((i) => {
              if (fields.includes('date')) i.interactionDate = new Date(calendarEvent.startDate);
              if (fields.includes('location')) i.location = calendarEvent.location || '';
            });
        });
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
      await database.write(async () => {
          await interaction.update((i) => { i.status = 'cancelled'; });
      });
      result.deleted++;
      result.changes.push({
        interactionId: interaction.id,
        friendNames: await getFriendNamesForInteraction(interaction.id),
        changeType: 'deleted',
        fields: [],
      });
    }
  }

  return result;
}
