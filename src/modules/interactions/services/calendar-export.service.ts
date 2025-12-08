import { Share, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { database } from '@/db';
import Interaction from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import FriendModel from '@/db/models/Friend';
import { Q } from '@nozbe/watermelondb';

// Dynamically import expo-sharing if available
let Sharing: any = null;
try {
  Sharing = require('expo-sharing');
} catch (error) {
  console.log('expo-sharing not available, using fallback Share API');
}

/**
 * ICS Calendar Export Service
 *
 * Generates .ics (iCalendar) files from Weave interactions for sharing
 * via SMS, WhatsApp, Email, or any other app.
 */

// --- Types ---

export interface ICSEvent {
  title: string;
  description: string;
  location?: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
}

// --- Helper Functions ---

/**
 * Formats a date for ICS format: YYYYMMDDTHHmmssZ
 * ICS spec requires UTC times in this exact format
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
    .replace(/\\/g, '\\\\')  // Escape backslashes
    .replace(/;/g, '\\;')    // Escape semicolons
    .replace(/,/g, '\\,')    // Escape commas
    .replace(/\n/g, '\\n');  // Escape newlines
}

/**
 * Folds long lines to 75 characters (ICS spec requirement)
 * Lines should be broken with CRLF + space
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
  const friends = await database
    .get<FriendModel>('friends')
    .query(Q.where('id', Q.oneOf(friendIds)))
    .fetch();

  return friends.map((f) => f.name);
}

// --- Core ICS Generation ---

/**
 * Generates ICS file content from an event object
 */
function generateICSContent(event: ICSEvent): string {
  const uid = generateUID();
  const now = formatICSDate(new Date());
  const startDate = formatICSDate(event.startDate, event.allDay);
  const endDate = formatICSDate(event.endDate, event.allDay);

  // Build the ICS content line by line
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Weave//Weave Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
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

  // Add optional fields
  if (event.location) {
    lines.push(foldICSLine(`LOCATION:${escapeICSText(event.location)}`));
  }

  lines.push('STATUS:CONFIRMED');
  lines.push('SEQUENCE:0');
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
  const friendsText = friendNames.join(', ');

  // Determine if this is an all-day event
  const startDate = new Date(interaction.interactionDate);
  const hasTime = startDate.getHours() !== 0 || startDate.getMinutes() !== 0;
  const allDay = !hasTime;

  // Calculate end time (2 hours later for timed events, same day for all-day)
  const endDate = allDay
    ? new Date(startDate)
    : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

  // Build title
  const title = interaction.title
    ? `🧵 Weave: ${interaction.title}`
    : `🧵 Weave with ${friendsText} - ${interaction.activity}`;

  // Build description
  let description = `Planned weave with ${friendsText}\n\n`;
  description += `Activity: ${interaction.activity}\n`;

  if (interaction.location) {
    description += `Location: ${interaction.location}\n`;
  }

  if (interaction.note) {
    description += `\nNotes:\n${interaction.note}\n`;
  }

  description += '\n---\nCreated by Weave';

  // Generate ICS
  return generateICSContent({
    title,
    description,
    location: interaction.location || undefined,
    startDate,
    endDate,
    allDay,
  });
}

// --- Sharing Functions ---

/**
 * Shares an interaction as an ICS file via the native share sheet
 * Works on both iOS and Android
 */
export async function shareInteractionAsICS(interaction: Interaction): Promise<boolean> {
  try {
    // Generate ICS content
    const icsContent = await generateICSFromInteraction(interaction);

    // Get friend names for the filename
    const friendNames = await getFriendNamesForInteraction(interaction.id);
    const friendsSlug = friendNames.join('-').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
    const dateSlug = interaction.interactionDate.toISOString().split('T')[0];
    const filename = `weave-${friendsSlug}-${dateSlug}.ics`;

    // Check if expo-sharing is available and can share
    const canUseExpoSharing = Sharing && await Sharing.isAvailableAsync();

    if (canUseExpoSharing) {
      // Use Expo Sharing API (better for files)
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, icsContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/calendar',
        dialogTitle: 'Share Weave Plan',
        UTI: 'public.calendar-event', // iOS UTI for calendar events
      });

      return true;
    } else {
      // Fallback to React Native Share API
      // On iOS we can share the ICS content directly
      // On Android we share a formatted text version
      const result = await Share.share(
        Platform.OS === 'ios'
          ? {
              message: icsContent,
              title: 'Share Weave Plan',
            }
          : {
              message: `Here's our plan:\n\n${interaction.title || interaction.activity}\nDate: ${interaction.interactionDate.toLocaleDateString()}\n${interaction.location ? `Location: ${interaction.location}\n` : ''}`,
              title: 'Share Weave Plan',
            }
      );

      return result.action === Share.sharedAction;
    }
  } catch (error) {
    console.error('Error sharing interaction as ICS:', error);
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
    const friendsSlug = friendNames.join('-').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
    const dateSlug = interaction.interactionDate.toISOString().split('T')[0];
    const filename = `weave-${friendsSlug}-${dateSlug}.ics`;

    const fileUri = `${FileSystem.cacheDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(fileUri, icsContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    return fileUri;
  } catch (error) {
    console.error('Error generating ICS file:', error);
    return null;
  }
}
