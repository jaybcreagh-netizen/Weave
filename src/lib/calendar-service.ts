import * as Calendar from 'expo-calendar';
import { Platform, Linking, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CALENDAR_SETTINGS_KEY = '@weave_calendar_settings';

export interface CalendarSettings {
  enabled: boolean;
  calendarId: string | null;
  reminderMinutes: number; // Minutes before event to remind (default: 60)
}

const DEFAULT_SETTINGS: CalendarSettings = {
  enabled: false,
  calendarId: null,
  reminderMinutes: 60,
};

/**
 * Check current calendar permission status
 */
export async function checkCalendarPermissions(): Promise<{
  granted: boolean;
  canAskAgain: boolean;
}> {
  try {
    const { status, canAskAgain } = await Calendar.getCalendarPermissionsAsync();
    return {
      granted: status === 'granted',
      canAskAgain: canAskAgain !== false, // canAskAgain may be undefined
    };
  } catch (error) {
    console.error('Error checking calendar permissions:', error);
    return { granted: false, canAskAgain: true };
  }
}

/**
 * Request calendar permissions with smart handling
 */
export async function requestCalendarPermissions(): Promise<boolean> {
  try {
    // First check current status
    const currentStatus = await checkCalendarPermissions();

    if (currentStatus.granted) {
      return true;
    }

    // If we can't ask again, permissions were denied - need to go to settings
    if (!currentStatus.canAskAgain) {
      Alert.alert(
        'Calendar Permission Required',
        'Calendar access was previously denied. Please enable it in your device Settings to use this feature.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => {
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              } else {
                Linking.openSettings();
              }
            },
          },
        ]
      );
      return false;
    }

    // Request permissions
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error requesting calendar permissions:', error);
    return false;
  }
}

/**
 * Get calendar settings from storage
 */
export async function getCalendarSettings(): Promise<CalendarSettings> {
  try {
    const settings = await AsyncStorage.getItem(CALENDAR_SETTINGS_KEY);
    return settings ? JSON.parse(settings) : DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Error loading calendar settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save calendar settings to storage
 */
export async function saveCalendarSettings(settings: CalendarSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(CALENDAR_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving calendar settings:', error);
  }
}

/**
 * Get list of available calendars
 */
export async function getAvailableCalendars(): Promise<Calendar.Calendar[]> {
  try {
    const hasPermission = await requestCalendarPermissions();
    if (!hasPermission) return [];

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);

    // Filter to writable calendars only
    return calendars.filter(cal =>
      cal.allowsModifications &&
      cal.source.type !== 'subscribed' &&
      cal.source.type !== 'birthdayCalendar'
    );
  } catch (error) {
    console.error('Error fetching calendars:', error);
    return [];
  }
}

/**
 * Create or get the dedicated Weave calendar
 * Falls back to default calendar if creation not allowed
 */
export async function getOrCreateWeaveCalendar(): Promise<string | null> {
  try {
    const hasPermission = await requestCalendarPermissions();
    if (!hasPermission) return null;

    // Check if Weave calendar already exists
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const weaveCalendar = calendars.find(cal => cal.title === 'Weave');

    if (weaveCalendar) {
      return weaveCalendar.id;
    }

    // Try to create new Weave calendar
    try {
      // Get a writable calendar source (prefer local over iCloud)
      const writableSources = calendars
        .filter(cal => cal.allowsModifications && cal.source.type !== 'subscribed')
        .map(cal => cal.source);

      // Prefer local source, fallback to first writable source
      const defaultSource = writableSources.find(src => src.type === 'local') ||
                           writableSources.find(src => src.type === 'caldav') ||
                           writableSources[0];

      if (!defaultSource) {
        console.warn('No writable calendar source available');
        return null;
      }

      const newCalendarId = await Calendar.createCalendarAsync({
        title: 'Weave',
        color: '#8B7FD6', // Purple/lavender color for Weave
        entityType: Calendar.EntityTypes.EVENT,
        sourceId: defaultSource.id,
        source: defaultSource,
        name: 'Weave',
        ownerAccount: defaultSource.name,
        accessLevel: Calendar.CalendarAccessLevel.OWNER,
      });

      console.log('Created Weave calendar:', newCalendarId);
      return newCalendarId;
    } catch (createError: any) {
      // Calendar creation failed (account doesn't allow it)
      // This is common with iCloud accounts
      console.warn('Could not create Weave calendar (account restriction):', createError.message);
      return null; // Will fall back to default calendar
    }
  } catch (error) {
    console.error('Error in getOrCreateWeaveCalendar:', error);
    return null;
  }
}

/**
 * Get the default calendar to use (from settings, Weave calendar, or device default)
 */
export async function getDefaultCalendar(): Promise<string | null> {
  try {
    const settings = await getCalendarSettings();

    // Use saved calendar if set
    if (settings.calendarId) {
      return settings.calendarId;
    }

    // Try to use or create Weave calendar
    const weaveCalendarId = await getOrCreateWeaveCalendar();
    if (weaveCalendarId) {
      // Save it as default
      await saveCalendarSettings({ ...settings, calendarId: weaveCalendarId });
      return weaveCalendarId;
    }

    // Fallback to device default
    const calendars = await getAvailableCalendars();
    if (calendars.length === 0) return null;

    // Try to find a "personal" or primary calendar
    const defaultCal = calendars.find(cal =>
      cal.isPrimary ||
      cal.title.toLowerCase().includes('personal') ||
      cal.title.toLowerCase().includes('primary')
    );

    return defaultCal?.id || calendars[0].id;
  } catch (error) {
    console.error('Error getting default calendar:', error);
    return null;
  }
}

/**
 * Create a calendar event for a planned weave
 */
export async function createWeaveCalendarEvent(params: {
  title: string;
  friendNames: string; // Changed from friendName to friendNames
  category: string;
  date: Date;
  location?: string;
  notes?: string;
}): Promise<string | null> {
  try {
    const settings = await getCalendarSettings();
    if (!settings.enabled) {
      console.log('Calendar integration disabled');
      return null;
    }

    const hasPermission = await requestCalendarPermissions();
    if (!hasPermission) {
      console.log('Calendar permission not granted');
      return null;
    }

    const calendarId = await getDefaultCalendar();
    if (!calendarId) {
      console.log('No calendar available');
      return null;
    }

    // Create event details
    const startDate = new Date(params.date);

    // Check if time was specified (not midnight)
    const hasTime = startDate.getHours() !== 0 || startDate.getMinutes() !== 0;

    // Create stylized title with emoji and details
    let eventTitle = '🧵 Weave';

    // Add friend names
    if (params.friendNames) {
      eventTitle += ` with ${params.friendNames}`;
    }

    // Add category/title
    if (params.title && params.title.trim()) {
      eventTitle += ` - ${params.title.trim()}`;
    } else if (params.category) {
      eventTitle += ` - ${params.category}`;
    }

    // Build detailed notes
    let eventNotes = `📅 Planned weave with ${params.friendNames}\n`;

    if (params.category) {
      eventNotes += `\n🎯 Activity: ${params.category}`;
    }

    if (params.location) {
      eventNotes += `\n📍 Location: ${params.location}`;
    }

    if (params.notes && params.notes.trim()) {
      eventNotes += `\n\n💭 Notes:\n${params.notes.trim()}`;
    }

    eventNotes += '\n\n🧵 Created by Weave';

    const eventDetails: Calendar.Event = {
      title: eventTitle,
      startDate,
      endDate: hasTime
        ? new Date(startDate.getTime() + (2 * 60 * 60 * 1000)) // 2 hours if time specified
        : new Date(startDate.getTime() + (24 * 60 * 60 * 1000)), // Next day if all-day
      notes: eventNotes,
      location: params.location,
      allDay: !hasTime, // Make all-day if no time specified
      // timeZone removed - uses device default automatically
      alarms: settings.reminderMinutes > 0 && hasTime ? [{
        relativeOffset: -settings.reminderMinutes,
        method: Calendar.AlarmMethod.ALERT,
      }] : undefined, // Only set alarm if time specified
    };

    const eventId = await Calendar.createEventAsync(calendarId, eventDetails);
    console.log('Created calendar event:', eventId);
    return eventId;
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return null;
  }
}

/**
 * Update an existing calendar event
 */
export async function updateWeaveCalendarEvent(
  eventId: string,
  params: {
    title?: string;
    date?: Date;
    location?: string;
    notes?: string;
  }
): Promise<boolean> {
  try {
    const settings = await getCalendarSettings();
    if (!settings.enabled) return false;

    const hasPermission = await requestCalendarPermissions();
    if (!hasPermission) return false;

    const updateData: Partial<Calendar.Event> = {};

    if (params.title) {
      updateData.title = params.title;
    }

    if (params.date) {
      const startDate = new Date(params.date);
      const endDate = new Date(startDate.getTime() + (2 * 60 * 60 * 1000));
      updateData.startDate = startDate;
      updateData.endDate = endDate;
    }

    if (params.location !== undefined) {
      updateData.location = params.location;
    }

    if (params.notes) {
      updateData.notes = params.notes;
    }

    await Calendar.updateEventAsync(eventId, updateData);
    console.log('Updated calendar event:', eventId);
    return true;
  } catch (error) {
    console.error('Error updating calendar event:', error);
    return false;
  }
}

/**
 * Delete a calendar event
 */
export async function deleteWeaveCalendarEvent(eventId: string): Promise<boolean> {
  try {
    const hasPermission = await requestCalendarPermissions();
    if (!hasPermission) return false;

    await Calendar.deleteEventAsync(eventId);
    console.log('Deleted calendar event:', eventId);
    return true;
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    return false;
  }
}

/**
 * Enable/disable calendar integration
 */
export async function toggleCalendarIntegration(enabled: boolean): Promise<void> {
  const settings = await getCalendarSettings();
  settings.enabled = enabled;
  await saveCalendarSettings(settings);
}

/**
 * Set which calendar to use
 */
export async function setPreferredCalendar(calendarId: string): Promise<void> {
  const settings = await getCalendarSettings();
  settings.calendarId = calendarId;
  await saveCalendarSettings(settings);
}

/**
 * Set reminder time (in minutes before event)
 */
export async function setReminderTime(minutes: number): Promise<void> {
  const settings = await getCalendarSettings();
  settings.reminderMinutes = minutes;
  await saveCalendarSettings(settings);
}
