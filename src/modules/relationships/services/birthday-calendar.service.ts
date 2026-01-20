/**
 * Birthday & Anniversary Calendar Sync Service
 *
 * Manages the synchronization of friend birthdays and anniversaries
 * to the native device calendar as recurring annual events.
 */

import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import { Q } from '@nozbe/watermelondb';
import { logger } from '@/shared/services/logger.service';
import {
  createBirthdayCalendarEvent,
  createAnniversaryCalendarEvent,
  deleteBirthdayCalendarEvent,
  deleteAnniversaryCalendarEvent,
  getCalendarSettings,
} from '@/modules/interactions/services/calendar.service';

// --- Individual Friend Sync ---

/**
 * Syncs a friend's birthday to the calendar
 * Creates a recurring annual event if birthday is set and no event exists
 */
export async function syncBirthdayToCalendar(friend: FriendModel): Promise<void> {
  try {
    // Skip if no birthday set
    if (!friend.birthday) {
      logger.debug('BirthdayCalendar', `No birthday set for ${friend.name}, skipping`);
      return;
    }

    // Skip if already has calendar event
    if (friend.birthdayCalendarEventId) {
      logger.debug('BirthdayCalendar', `Birthday event already exists for ${friend.name}`);
      return;
    }

    const result = await createBirthdayCalendarEvent({
      friendName: friend.name,
      monthDay: friend.birthday,
    });

    if (result.success && result.eventId) {
      await database.write(async () => {
        await friend.update(f => {
          f.birthdayCalendarEventId = result.eventId!;
        });
      });
      logger.info('BirthdayCalendar', `Created birthday event for ${friend.name}: ${result.eventId}`);
    } else if (result.error !== 'disabled') {
      logger.warn('BirthdayCalendar', `Failed to create birthday event for ${friend.name}: ${result.message}`);
    }
  } catch (error) {
    logger.error('BirthdayCalendar', `Error syncing birthday for ${friend.name}:`, error);
  }
}

/**
 * Syncs a friend's anniversary to the calendar
 * Only creates event for partners with anniversary set
 */
export async function syncAnniversaryToCalendar(friend: FriendModel): Promise<void> {
  try {
    // Skip if no anniversary set
    if (!friend.anniversary) {
      logger.debug('BirthdayCalendar', `No anniversary set for ${friend.name}, skipping`);
      return;
    }

    // Only sync anniversaries for partner relationships
    if (friend.relationshipType !== 'partner') {
      logger.debug('BirthdayCalendar', `${friend.name} is not a partner, skipping anniversary sync`);
      return;
    }

    // Skip if already has calendar event
    if (friend.anniversaryCalendarEventId) {
      logger.debug('BirthdayCalendar', `Anniversary event already exists for ${friend.name}`);
      return;
    }

    const result = await createAnniversaryCalendarEvent({
      friendName: friend.name,
      monthDay: friend.anniversary,
    });

    if (result.success && result.eventId) {
      await database.write(async () => {
        await friend.update(f => {
          f.anniversaryCalendarEventId = result.eventId!;
        });
      });
      logger.info('BirthdayCalendar', `Created anniversary event for ${friend.name}: ${result.eventId}`);
    } else if (result.error !== 'disabled') {
      logger.warn('BirthdayCalendar', `Failed to create anniversary event for ${friend.name}: ${result.message}`);
    }
  } catch (error) {
    logger.error('BirthdayCalendar', `Error syncing anniversary for ${friend.name}:`, error);
  }
}

/**
 * Removes a friend's birthday from the calendar
 * Called when birthday is cleared from the friend
 */
export async function removeBirthdayFromCalendar(friend: FriendModel): Promise<void> {
  try {
    if (!friend.birthdayCalendarEventId) {
      return;
    }

    const deleted = await deleteBirthdayCalendarEvent(friend.birthdayCalendarEventId);

    if (deleted) {
      await database.write(async () => {
        await friend.update(f => {
          f.birthdayCalendarEventId = undefined;
        });
      });
      logger.info('BirthdayCalendar', `Removed birthday event for ${friend.name}`);
    }
  } catch (error) {
    logger.error('BirthdayCalendar', `Error removing birthday for ${friend.name}:`, error);
  }
}

/**
 * Removes a friend's anniversary from the calendar
 * Called when anniversary is cleared or relationship type changes from partner
 */
export async function removeAnniversaryFromCalendar(friend: FriendModel): Promise<void> {
  try {
    if (!friend.anniversaryCalendarEventId) {
      return;
    }

    const deleted = await deleteAnniversaryCalendarEvent(friend.anniversaryCalendarEventId);

    if (deleted) {
      await database.write(async () => {
        await friend.update(f => {
          f.anniversaryCalendarEventId = undefined;
        });
      });
      logger.info('BirthdayCalendar', `Removed anniversary event for ${friend.name}`);
    }
  } catch (error) {
    logger.error('BirthdayCalendar', `Error removing anniversary for ${friend.name}:`, error);
  }
}

// --- Bulk Sync ---

export interface BulkSyncResult {
  synced: number;
  skipped: number;
  errors: number;
}

/**
 * Syncs all friend birthdays to the calendar
 * Called when user enables the "Sync Birthdays" setting
 */
export async function syncAllBirthdaysToCalendar(): Promise<BulkSyncResult> {
  const result: BulkSyncResult = { synced: 0, skipped: 0, errors: 0 };

  try {
    const settings = await getCalendarSettings();
    if (!settings.enabled) {
      logger.info('BirthdayCalendar', 'Calendar integration disabled, skipping bulk sync');
      return result;
    }

    // Get all friends with birthdays that don't have calendar events yet
    const friends = await database.get<FriendModel>('friends')
      .query(
        Q.where('birthday', Q.notEq(null)),
        Q.where('birthday_calendar_event_id', Q.eq(null))
      )
      .fetch();

    logger.info('BirthdayCalendar', `Found ${friends.length} friends with birthdays to sync`);

    for (const friend of friends) {
      try {
        const calendarResult = await createBirthdayCalendarEvent({
          friendName: friend.name,
          monthDay: friend.birthday!,
        });

        if (calendarResult.success && calendarResult.eventId) {
          await database.write(async () => {
            await friend.update(f => {
              f.birthdayCalendarEventId = calendarResult.eventId!;
            });
          });
          result.synced++;
        } else {
          result.skipped++;
        }
      } catch (error) {
        logger.error('BirthdayCalendar', `Error syncing birthday for ${friend.name}:`, error);
        result.errors++;
      }
    }

    logger.info('BirthdayCalendar', `Bulk sync complete: ${result.synced} synced, ${result.skipped} skipped, ${result.errors} errors`);
  } catch (error) {
    logger.error('BirthdayCalendar', 'Error during bulk birthday sync:', error);
  }

  return result;
}

/**
 * Syncs all partner anniversaries to the calendar
 * Called when user enables the "Sync Birthdays" setting (includes anniversaries)
 */
export async function syncAllAnniversariesToCalendar(): Promise<BulkSyncResult> {
  const result: BulkSyncResult = { synced: 0, skipped: 0, errors: 0 };

  try {
    const settings = await getCalendarSettings();
    if (!settings.enabled) {
      logger.info('BirthdayCalendar', 'Calendar integration disabled, skipping anniversary sync');
      return result;
    }

    // Get all partner friends with anniversaries that don't have calendar events yet
    const friends = await database.get<FriendModel>('friends')
      .query(
        Q.where('anniversary', Q.notEq(null)),
        Q.where('relationship_type', 'partner'),
        Q.where('anniversary_calendar_event_id', Q.eq(null))
      )
      .fetch();

    logger.info('BirthdayCalendar', `Found ${friends.length} partners with anniversaries to sync`);

    for (const friend of friends) {
      try {
        const calendarResult = await createAnniversaryCalendarEvent({
          friendName: friend.name,
          monthDay: friend.anniversary!,
        });

        if (calendarResult.success && calendarResult.eventId) {
          await database.write(async () => {
            await friend.update(f => {
              f.anniversaryCalendarEventId = calendarResult.eventId!;
            });
          });
          result.synced++;
        } else {
          result.skipped++;
        }
      } catch (error) {
        logger.error('BirthdayCalendar', `Error syncing anniversary for ${friend.name}:`, error);
        result.errors++;
      }
    }

    logger.info('BirthdayCalendar', `Anniversary sync complete: ${result.synced} synced, ${result.skipped} skipped, ${result.errors} errors`);
  } catch (error) {
    logger.error('BirthdayCalendar', 'Error during bulk anniversary sync:', error);
  }

  return result;
}

/**
 * Combined function to sync all birthdays and anniversaries
 * Returns combined stats
 */
export async function syncAllBirthdaysAndAnniversaries(): Promise<BulkSyncResult> {
  const birthdayResult = await syncAllBirthdaysToCalendar();
  const anniversaryResult = await syncAllAnniversariesToCalendar();

  return {
    synced: birthdayResult.synced + anniversaryResult.synced,
    skipped: birthdayResult.skipped + anniversaryResult.skipped,
    errors: birthdayResult.errors + anniversaryResult.errors,
  };
}
