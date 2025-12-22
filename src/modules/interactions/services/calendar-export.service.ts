import { Share, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { logger } from '@/shared/services/logger.service';
import { database } from '@/db';
import Interaction from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import FriendModel from '@/db/models/Friend';
import { Q } from '@nozbe/watermelondb';

/**
 * ICS Calendar Export Service
 *
 * Generates .ics (iCalendar) files from Weave interactions for sharing
 * via SMS, WhatsApp, Email, or any other app.
 *
 * RFC 5545 compliant: https://tools.ietf.org/html/rfc5545
 */

// --- Types ---

export interface ICSEvent {
  title: string;
  description: string;
  location?: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  reminderMinutes?: number; // Minutes before event to trigger reminder
}

// --- Helper Functions ---

/**
 * Formats a date for ICS format
 * - Timed events: YYYYMMDDTHHmmssZ (UTC)
 * - All-day events: YYYYMMDD (VALUE=DATE format)
 */
function formatICSDate(date: Date, allDay: boolean = false): string {
  if (allDay) {
    // All-day events use VALUE=DATE format: YYYYMMDD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  // Convert to UTC for timed events
  const utcDate = new Date(date.getTime());
  const year = utcDate.getUTCFullYear();
  const month = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utcDate.getUTCDate()).padStart(2, '0');
  const hours = String(utcDate.getUTCHours()).padStart(2, '0');
  const minutes = String(utcDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(utcDate.getUTCSeconds()).padStart(2, '0');

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Escapes text for ICS format
 * Special characters like newlines, commas, and semicolons must be escaped
 */
function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/;/g, '\\;')    // Escape semicolons
    .replace(/,/g, '\\,')    // Escape commas
    .replace(/\n/g, '\\n');  // Escape newlines
}

/**
 * Folds long lines to 75 characters (ICS spec requirement)
 * Lines should be broken with CRLF + space/tab for continuation
 */
function foldICSLine(line: string): string {
  if (line.length <= 75) return line;

  const lines: string[] = [];
  let currentLine = line;

  while (currentLine.length > 75) {
    lines.push(currentLine.substring(0, 75));
    currentLine = ' ' + currentLine.substring(75); // Continuation lines start with space
  }
  lines.push(currentLine);

  return lines.join('\r\n');
}

/**
 * Generates a unique UID for the event
 * Format: timestamp-randomhex@weave.app
 */
function generateUID(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${random}@weave.app`;
}

/**
 * Gets friend names for an interaction from the database
 */
async function getFriendNamesForInteraction(interactionId: string): Promise<string[]> {
  const interactionFriends = await database
    .get<InteractionFriend>('interaction_friends')
    .query(Q.where('interaction_id', interactionId))
    .fetch();

  const friendIds = interactionFriends.map((f) => f.friendId);

  if (friendIds.length === 0) {
    return [];
  }

  const friends = await database
    .get<FriendModel>('friends')
    .query(Q.where('id', Q.oneOf(friendIds)))
    .fetch();

  return friends.map((f) => f.name);
}

/**
 * Adds days to a date (for all-day event end date calculation)
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// --- Core ICS Generation ---

/**
 * Generates ICS file content from an event object
 * Compliant with RFC 5545 iCalendar specification
 */
function generateICSContent(event: ICSEvent): string {
  const uid = generateUID();
  const now = formatICSDate(new Date());
  const startDate = formatICSDate(event.startDate, event.allDay);

  // For all-day events, DTEND is exclusive (next day)
  // For a single all-day event on Dec 22, you need DTEND of Dec 23
  const endDate = event.allDay
    ? formatICSDate(addDays(event.endDate, 1), true)
    : formatICSDate(event.endDate);

  // Build the ICS content line by line
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Weave//Weave Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST', // REQUEST is better for invitations than PUBLISH
    'X-WR-CALNAME:Weave Plans',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
  ];

  // Add date fields with proper format
  if (event.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${startDate}`);
    lines.push(`DTEND;VALUE=DATE:${endDate}`);
  } else {
    lines.push(`DTSTART:${startDate}`);
    lines.push(`DTEND:${endDate}`);
  }

  // Add required fields
  lines.push(foldICSLine(`SUMMARY:${escapeICSText(event.title)}`));
  lines.push(foldICSLine(`DESCRIPTION:${escapeICSText(event.description)}`));

  // Add optional location
  if (event.location) {
    lines.push(foldICSLine(`LOCATION:${escapeICSText(event.location)}`));
  }

  // Status and transparency
  lines.push('STATUS:CONFIRMED');
  lines.push('TRANSP:OPAQUE'); // Show as busy
  lines.push('SEQUENCE:0');
  lines.push('CLASS:PRIVATE');

  // Add reminder/alarm if specified (default 30 minutes)
  const reminderMinutes = event.reminderMinutes ?? 30;
  lines.push('BEGIN:VALARM');
  lines.push('ACTION:DISPLAY');
  lines.push(foldICSLine(`DESCRIPTION:${escapeICSText(event.title)}`));
  lines.push(`TRIGGER:-PT${reminderMinutes}M`); // e.g., -PT30M = 30 minutes before
  lines.push('END:VALARM');

  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');

  // ICS files must use CRLF line endings
  return lines.join('\r\n');
}

/**
 * Generates ICS content from a Weave Interaction
 */
export async function generateICSFromInteraction(interaction: Interaction): Promise<string> {
  // Get friend names
  const friendNames = await getFriendNamesForInteraction(interaction.id);
  const friendsText = friendNames.length > 0 ? friendNames.join(', ') : 'Friend';

  // Determine if this is an all-day event
  // We check if time is midnight AND there's no specific time context
  const startDate = new Date(interaction.interactionDate);
  const hasTime = startDate.getHours() !== 0 || startDate.getMinutes() !== 0;
  const allDay = !hasTime;

  // Calculate end time
  // - All-day: same day (the ICS generator will add 1 day for DTEND)
  // - Timed: 2 hours later as a reasonable default
  const endDate = allDay
    ? new Date(startDate)
    : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

  // Build title - use custom title if available, otherwise generate one
  const activityLabel = interaction.activity || 'Hangout';
  const title = interaction.title
    ? `🧵 ${interaction.title}`
    : `🧵 Weave with ${friendsText}`;

  // Build description with all relevant details
  const descriptionParts: string[] = [];

  descriptionParts.push(`Planned hangout with ${friendsText}`);
  descriptionParts.push('');
  descriptionParts.push(`📍 Activity: ${activityLabel}`);

  if (interaction.location) {
    descriptionParts.push(`📌 Location: ${interaction.location}`);
  }

  if (interaction.note) {
    descriptionParts.push('');
    descriptionParts.push(`📝 Notes:`);
    descriptionParts.push(interaction.note);
  }

  descriptionParts.push('');
  descriptionParts.push('---');
  descriptionParts.push('Created with Weave 🧵');

  const description = descriptionParts.join('\n');

  // Generate ICS
  return generateICSContent({
    title,
    description,
    location: interaction.location || undefined,
    startDate,
    endDate,
    allDay,
    reminderMinutes: 30, // 30 minute reminder by default
  });
}

// --- Sharing Functions ---

/**
 * Writes ICS content to a temporary file and returns the URI
 */
async function writeICSFile(icsContent: string, filename: string): Promise<string> {
  const fileUri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(fileUri, icsContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return fileUri;
}

/**
 * Shares an interaction as an ICS file via the native share sheet
 * Works on both iOS and Android with proper file sharing
 */
export async function shareInteractionAsICS(interaction: Interaction): Promise<boolean> {
  try {
    // Generate ICS content
    const icsContent = await generateICSFromInteraction(interaction);

    // Get friend names for the filename
    const friendNames = await getFriendNamesForInteraction(interaction.id);
    const friendsSlug = friendNames.length > 0
      ? friendNames.join('-').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase()
      : 'friend';
    const dateSlug = interaction.interactionDate.toISOString().split('T')[0];
    const filename = `weave-${friendsSlug}-${dateSlug}.ics`;

    // Write the ICS file to cache directory
    const fileUri = await writeICSFile(icsContent, filename);

    // Check if expo-sharing is available
    const isAvailable = await Sharing.isAvailableAsync();

    if (isAvailable) {
      // Use Expo Sharing API for proper file sharing
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/calendar',
        dialogTitle: 'Share Weave Plan',
        UTI: 'public.calendar-event', // iOS UTI for calendar events
      });
      return true;
    } else {
      // Fallback for platforms where Sharing isn't available
      // On iOS, Share.share with a file URL can work
      // On Android, we need to use the message as a fallback

      if (Platform.OS === 'ios') {
        // iOS can handle file URLs in Share API
        const result = await Share.share({
          url: fileUri,
          title: 'Share Weave Plan',
        });
        return result.action === Share.sharedAction;
      } else {
        // Android fallback: share human-readable text
        // The ICS file approach is preferred, but this is a last resort
        const friendsText = friendNames.length > 0 ? friendNames.join(', ') : 'friend';
        const dateStr = interaction.interactionDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        const timeStr = interaction.interactionDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });

        const message = [
          `🧵 Weave Plan`,
          ``,
          `📅 ${dateStr} at ${timeStr}`,
          `👥 With: ${friendsText}`,
          interaction.activity ? `📍 Activity: ${interaction.activity}` : '',
          interaction.location ? `📌 Location: ${interaction.location}` : '',
          interaction.note ? `📝 ${interaction.note}` : '',
          ``,
          `Add to your calendar!`,
        ].filter(Boolean).join('\n');

        const result = await Share.share({
          message,
          title: 'Share Weave Plan',
        });
        return result.action === Share.sharedAction;
      }
    }
  } catch (error) {
    logger.error('CalendarExport', 'Error sharing interaction as ICS:', error);
    return false;
  }
}

/**
 * Generates and returns the ICS file URI for an interaction
 * Useful if you want to store or process the file separately
 */
export async function generateICSFile(interaction: Interaction): Promise<string | null> {
  try {
    const icsContent = await generateICSFromInteraction(interaction);

    const friendNames = await getFriendNamesForInteraction(interaction.id);
    const friendsSlug = friendNames.length > 0
      ? friendNames.join('-').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase()
      : 'friend';
    const dateSlug = interaction.interactionDate.toISOString().split('T')[0];
    const filename = `weave-${friendsSlug}-${dateSlug}.ics`;

    return await writeICSFile(icsContent, filename);
  } catch (error) {
    logger.error('CalendarExport', 'Error generating ICS file:', error);
    return null;
  }
}
