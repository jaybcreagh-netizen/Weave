import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import InteractionModel from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import UserProgress from '@/db/models/UserProgress';
import SocialBatteryLog from '@/db/models/SocialBatteryLog';
import JournalEntry from '@/db/models/JournalEntry';
import JournalEntryFriend from '@/db/models/JournalEntryFriend';
import WeeklyReflection from '@/db/models/WeeklyReflection';
import { Q } from '@nozbe/watermelondb';

interface ExportData {
  exportDate: string;
  appVersion: string;
  platform: string;
  friends: Array<{
    id: string;
    name: string;
    dunbarTier: string;
    archetype: string;
    photoUrl: string | null;
    notes: string | null;
    weaveScore: number;
    lastUpdated: string;
    resilience: number;
    ratedWeavesCount: number;
    momentumScore: number;
    momentumLastUpdated: string;
    isDormant: boolean;
    dormantSince: string | null;
    birthday: string | null;
    anniversary: string | null;
    relationshipType: string | null;
    // NEW: Required reciprocity fields (v25+)
    outcomeCount?: number;
    initiationRatio?: number;
    consecutiveUserInitiations?: number;
    totalUserInitiations?: number;
    totalFriendInitiations?: number;
    // NEW: Adaptive decay fields (v21+)
    typicalIntervalDays?: number;
    toleranceWindowDays?: number;
    categoryEffectiveness?: string;
  }>;
  interactions: Array<{
    id: string;
    interactionDate: string;
    interactionType: string;
    interactionCategory?: string; // NEW: Added missing category field
    activity: string;
    status: string;
    mode: string;
    note: string | null;
    vibe: string | null;
    duration: string | null;
    title: string | null;
    location: string | null;
    eventImportance: string | null;
    initiator: string | null;
    friendIds: string[];
  }>;
  socialBatteryLogs?: Array<{
    userId: string | undefined;
    value: number;
    timestamp: number;
  }>;
  journalEntries?: Array<{
    id: string;
    entryDate: number;
    title: string | null;
    content: string;
    storyChips: string | null;
    friendIds: string | null;
    createdAt: number;
    updatedAt: number;
  }>;
  journalEntryFriends?: Array<{
    journalEntryId: string;
    friendId: string;
  }>;
  weeklyReflections?: Array<{
    id: string;
    weekStartDate: number;
    weekEndDate: number;
    totalWeaves: number;
    friendsContacted: number;
    topActivity: string;
    topActivityCount: number;
    missedFriendsCount: number;
    gratitudeText: string | null;
    gratitudePrompt: string | null;
    promptContext: string | null;
    storyChips: string | null;
    completedAt: number;
    createdAt: number;
  }>;
  userProgress: {
    totalWeaves: number;
    curatorProgress: number;
  } | null;
  stats: {
    totalFriends: number;
    totalInteractions: number;
    completedInteractions: number;
    plannedInteractions: number;
    averageWeaveScore: number;
  };
}

export interface ImportResult {
  success: boolean;
  friendsImported: number;
  interactionsImported: number;
  userProgressImported: boolean;
  errors: string[];
}

/**
 * Validate imported JSON data
 */
export function validateImportData(jsonString: string): {
  valid: boolean;
  data?: ExportData;
  error?: string;
} {
  try {
    const data = JSON.parse(jsonString) as ExportData;

    // Check required fields
    if (!data.exportDate || !data.friends || !data.interactions) {
      return {
        valid: false,
        error: 'Invalid export format: missing required fields',
      };
    }

    // Validate friends array
    if (!Array.isArray(data.friends)) {
      return {
        valid: false,
        error: 'Invalid export format: friends must be an array',
      };
    }

    // Validate interactions array
    if (!Array.isArray(data.interactions)) {
      return {
        valid: false,
        error: 'Invalid export format: interactions must be an array',
      };
    }

    // Check each friend has required fields
    for (const friend of data.friends) {
      if (!friend.id || !friend.name || !friend.dunbarTier || !friend.archetype) {
        return {
          valid: false,
          error: 'Invalid friend data: missing required fields',
        };
      }
    }

    // Check each interaction has required fields
    for (const interaction of data.interactions) {
      if (
        !interaction.id ||
        !interaction.interactionDate ||
        !interaction.interactionType ||
        !interaction.status
      ) {
        return {
          valid: false,
          error: 'Invalid interaction data: missing required fields',
        };
      }
    }

    return { valid: true, data };
  } catch (error) {
    return {
      valid: false,
      error: `Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

import schema from '@/db/schema';

/**
 * Clear all existing data from the database
 */
export async function clearAllData(): Promise<void> {
  await database.write(async () => {
    // 1. Iterate over all tables in the schema
    const tableNames = Object.keys(schema.tables);

    for (const tableName of tableNames) {
      const collection = database.get(tableName);

      // A. Destroy all visible (active) records
      const allRecords = await collection.query().fetch();
      for (const record of allRecords) {
        await record.destroyPermanently();
      }

      // B. Destroy all soft-deleted records (ghosts)
      // This is crucial to avoid "UNIQUE constraint failed" errors when re-importing same IDs
      try {
        // @ts-ignore - adapter is strictly typed but we know these methods exist on SQLiteAdapter
        const deletedResult = await database.adapter.getDeletedRecords(tableName);

        if (Array.isArray(deletedResult) && deletedResult.length > 0) {
          // @ts-ignore
          await database.adapter.destroyDeletedRecords(tableName, deletedResult);
        }
      } catch (error) {
        console.warn(`[DataImport] Failed to clear deleted records for table ${tableName}:`, error);
      }
    }
  });
}

/**
 * Import data from JSON export
 * @param jsonString - The exported JSON data
 * @param clearExisting - If true, clears all existing data before import
 */
export async function importData(
  jsonString: string,
  clearExisting: boolean = true
): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    friendsImported: 0,
    interactionsImported: 0,
    userProgressImported: false,
    errors: [],
  };

  try {


    // Validate data
    const validation = validateImportData(jsonString);
    if (!validation.valid || !validation.data) {
      result.errors.push(validation.error || 'Invalid data');
      return result;
    }

    const data = validation.data;

    // Clear existing data if requested
    if (clearExisting) {
      try {
        await clearAllData();
      } catch (error) {
        result.errors.push(`Failed to clear existing data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return result;
      }
    }

    // Import in a single transaction
    await database.write(async () => {
      const friendsCollection = database.get<FriendModel>('friends');
      const interactionsCollection = database.get<InteractionModel>('interactions');
      const interactionFriendsCollection = database.get<InteractionFriend>('interaction_friends');
      const userProgressCollection = database.get<UserProgress>('user_progress');
      const batteryLogsCollection = database.get<SocialBatteryLog>('social_battery_logs');
      const journalEntriesCollection = database.get<JournalEntry>('journal_entries');
      const journalEntryFriendsCollection = database.get<JournalEntryFriend>('journal_entry_friends');
      const weeklyReflectionsCollection = database.get<WeeklyReflection>('weekly_reflections');

      // Import social battery logs
      if (data.socialBatteryLogs && Array.isArray(data.socialBatteryLogs)) {
        for (const logData of data.socialBatteryLogs) {
          try {
            await batteryLogsCollection.create(log => {
              log.userId = logData.userId || 'user'; // Fallback
              log.value = logData.value;
              log.timestamp = logData.timestamp;
            });
          } catch (error) {
            console.warn('[DataImport] Failed to import battery log:', error);
          }
        }
      }

      // Import journal entries
      if (data.journalEntries && Array.isArray(data.journalEntries)) {
        for (const entryData of data.journalEntries) {
          try {
            await journalEntriesCollection.create(entry => {
              entry._raw.id = entryData.id;
              entry.entryDate = entryData.entryDate;
              entry.title = entryData.title || undefined;
              entry.content = entryData.content;
              entry.storyChipsRaw = entryData.storyChips || undefined;
              entry.linkedWeaveId = entryData.friendIds || undefined; // Mapping friendIds to linkedWeaveId based on usage in export
              // Note: createdAt/updatedAt are readonly/managed, but we can set them via _raw if needed or let them trigger?
              // Models usually override these on save. But for restore we want original dates.
              // _raw manipulation is safer for timestamps.
              entry._raw._status = 'created';
              // Set timestamps via _raw if model ignores setter
              // @ts-ignore
              entry._raw.created_at = entryData.createdAt;
              // @ts-ignore
              entry._raw.updated_at = entryData.updatedAt;
            });
          } catch (error) {
            console.warn('[DataImport] Failed to import journal entry:', error);
          }
        }
      }

      // Import journal entry friends relationships
      if (data.journalEntryFriends && Array.isArray(data.journalEntryFriends)) {
        for (const relation of data.journalEntryFriends) {
          try {
            await journalEntryFriendsCollection.create(jef => {
              jef.journalEntryId = relation.journalEntryId;
              jef.friendId = relation.friendId;
            });
          } catch (error) {
            console.warn('[DataImport] Failed to import journal entry friend:', error);
          }
        }
      }

      // Import weekly reflections
      if (data.weeklyReflections && Array.isArray(data.weeklyReflections)) {
        for (const reflectionData of data.weeklyReflections) {
          try {
            await weeklyReflectionsCollection.create(ref => {
              ref._raw.id = reflectionData.id;
              ref.weekStartDate = reflectionData.weekStartDate;
              ref.weekEndDate = reflectionData.weekEndDate;
              ref.totalWeaves = reflectionData.totalWeaves;
              ref.friendsContacted = reflectionData.friendsContacted;
              ref.topActivity = reflectionData.topActivity;
              ref.topActivityCount = reflectionData.topActivityCount;
              ref.missedFriendsCount = reflectionData.missedFriendsCount;
              ref.gratitudeText = reflectionData.gratitudeText || undefined;
              ref.gratitudePrompt = reflectionData.gratitudePrompt || undefined;
              ref.promptContext = reflectionData.promptContext || undefined;
              ref.storyChipsRaw = reflectionData.storyChips || undefined;
              // Set timestamps
              // @ts-ignore
              ref._raw.completed_at = reflectionData.completedAt;
              // @ts-ignore
              ref._raw.created_at = reflectionData.createdAt;
            });
          } catch (error) {
            console.warn('[DataImport] Failed to import weekly reflection:', error);
          }
        }
      }

      // Import friends

      for (const friendData of data.friends) {
        try {
          // Check if friend already exists (in merge mode)
          if (!clearExisting) {
            const existing = await friendsCollection.find(friendData.id).catch(() => null);
            if (existing) {

              continue;
            }
          }

          await friendsCollection.create((friend) => {
            friend._raw.id = friendData.id;
            friend.name = friendData.name;
            friend.dunbarTier = friendData.dunbarTier;
            friend.archetype = friendData.archetype as any; // Cast in case of new archetypes like Lovers
            friend.photoUrl = friendData.photoUrl || '';
            friend.notes = friendData.notes || '';
            friend.weaveScore = friendData.weaveScore;
            friend.lastUpdated = new Date(friendData.lastUpdated);
            friend.resilience = friendData.resilience;
            friend.ratedWeavesCount = friendData.ratedWeavesCount;
            friend.momentumScore = friendData.momentumScore;
            friend.momentumLastUpdated = new Date(friendData.momentumLastUpdated);
            friend.isDormant = friendData.isDormant;
            friend.dormantSince = friendData.dormantSince ? new Date(friendData.dormantSince) : undefined;
            friend.birthday = friendData.birthday || undefined;
            friend.anniversary = friendData.anniversary || undefined;
            friend.relationshipType = friendData.relationshipType || undefined;
            // CRITICAL FIX: Set required reciprocity fields with defaults
            friend.outcomeCount = friendData.outcomeCount ?? 0;
            friend.initiationRatio = friendData.initiationRatio ?? 0.5;
            friend.consecutiveUserInitiations = friendData.consecutiveUserInitiations ?? 0;
            friend.totalUserInitiations = friendData.totalUserInitiations ?? 0;
            friend.totalFriendInitiations = friendData.totalFriendInitiations ?? 0;
            // Optional adaptive decay fields
            friend.typicalIntervalDays = friendData.typicalIntervalDays;
            friend.toleranceWindowDays = friendData.toleranceWindowDays;
            friend.categoryEffectiveness = friendData.categoryEffectiveness || undefined;
          });

          result.friendsImported++;
        } catch (error) {
          result.errors.push(
            `Failed to import friend ${friendData.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      // Import interactions

      for (const interactionData of data.interactions) {
        try {
          // Check if interaction already exists (in merge mode)
          if (!clearExisting) {
            const existing = await interactionsCollection.find(interactionData.id).catch(() => null);
            if (existing) {

              continue;
            }
          }

          await interactionsCollection.create((interaction) => {
            interaction._raw.id = interactionData.id;
            interaction.interactionDate = new Date(interactionData.interactionDate);
            interaction.interactionType = interactionData.interactionType;
            // CRITICAL FIX: Include interactionCategory
            interaction.interactionCategory = interactionData.interactionCategory || undefined;
            interaction.activity = interactionData.activity || '';
            interaction.status = interactionData.status;
            interaction.mode = interactionData.mode || '';
            interaction.note = interactionData.note || '';
            interaction.vibe = interactionData.vibe || '';
            interaction.duration = interactionData.duration || '';
            interaction.title = interactionData.title || undefined;
            interaction.location = interactionData.location || undefined;
            interaction.eventImportance = interactionData.eventImportance || undefined;
            interaction.initiator = interactionData.initiator || undefined;
          });

          // Create interaction-friend links
          for (const friendId of interactionData.friendIds) {
            await interactionFriendsCollection.create((link) => {
              link.interactionId = interactionData.id;
              link.friendId = friendId;
            });
          }

          result.interactionsImported++;
        } catch (error) {
          result.errors.push(
            `Failed to import interaction ${interactionData.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      // Import user progress
      if (data.userProgress) {

        try {
          // Check if user progress exists
          const existingProgress = await userProgressCollection.query().fetch();

          if (existingProgress.length > 0 && !clearExisting) {
            // Update existing record
            await existingProgress[0].update((progress) => {
              progress.totalWeaves = data.userProgress!.totalWeaves;
              progress.curatorProgress = data.userProgress!.curatorProgress;
            });
          } else {
            // Create new record
            await userProgressCollection.create((progress) => {
              progress.totalWeaves = data.userProgress!.totalWeaves;
              progress.curatorProgress = data.userProgress!.curatorProgress;
            });
          }

          result.userProgressImported = true;
        } catch (error) {
          result.errors.push(
            `Failed to import user progress: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }
    });

    // Success is true only if no errors occurred
    result.success = result.errors.length === 0;

  } catch (error) {
    result.errors.push(
      `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    console.error('[DataImport] Import failed:', error);
    result.success = false;
  }

  return result;
}

/**
 * Get preview of import data without importing
 */
export function getImportPreview(jsonString: string): {
  valid: boolean;
  preview?: {
    exportDate: string;
    totalFriends: number;
    totalInteractions: number;
    platform: string;
    appVersion: string;
  };
  error?: string;
} {
  const validation = validateImportData(jsonString);

  if (!validation.valid || !validation.data) {
    return {
      valid: false,
      error: validation.error,
    };
  }

  const data = validation.data;

  return {
    valid: true,
    preview: {
      exportDate: data.exportDate,
      totalFriends: data.friends.length,
      totalInteractions: data.interactions.length,
      platform: data.platform,
      appVersion: data.appVersion,
    },
  };
}
