import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import InteractionModel from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import UserProgress from '@/db/models/UserProgress';
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
  }>;
  interactions: Array<{
    id: string;
    interactionDate: string;
    interactionType: string;
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

/**
 * Clear all existing data from the database
 */
export async function clearAllData(): Promise<void> {
  console.log('[DataImport] Clearing all existing data...');

  await database.write(async () => {
    // Delete all interaction_friends first (foreign key constraint)
    const interactionFriends = await database
      .get<InteractionFriend>('interaction_friends')
      .query()
      .fetch();
    for (const if_ of interactionFriends) {
      await if_.markAsDeleted();
    }

    // Delete all interactions
    const interactions = await database.get<InteractionModel>('interactions').query().fetch();
    for (const interaction of interactions) {
      await interaction.markAsDeleted();
    }

    // Delete all friends
    const friends = await database.get<FriendModel>('friends').query().fetch();
    for (const friend of friends) {
      await friend.markAsDeleted();
    }

    // Delete user progress
    const userProgressRecords = await database.get<UserProgress>('user_progress').query().fetch();
    for (const record of userProgressRecords) {
      await record.markAsDeleted();
    }
  });

  console.log('[DataImport] All data cleared');
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
    console.log('[DataImport] Starting data import...');

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

      // Import friends
      console.log(`[DataImport] Importing ${data.friends.length} friends...`);
      for (const friendData of data.friends) {
        try {
          // Check if friend already exists (in merge mode)
          if (!clearExisting) {
            const existing = await friendsCollection.find(friendData.id).catch(() => null);
            if (existing) {
              console.log(`[DataImport] Friend ${friendData.id} already exists, skipping`);
              continue;
            }
          }

          await friendsCollection.create((friend) => {
            friend._raw.id = friendData.id;
            friend.name = friendData.name;
            friend.dunbarTier = friendData.dunbarTier;
            friend.archetype = friendData.archetype as any;
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
          });

          result.friendsImported++;
        } catch (error) {
          result.errors.push(
            `Failed to import friend ${friendData.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      // Import interactions
      console.log(`[DataImport] Importing ${data.interactions.length} interactions...`);
      for (const interactionData of data.interactions) {
        try {
          // Check if interaction already exists (in merge mode)
          if (!clearExisting) {
            const existing = await interactionsCollection.find(interactionData.id).catch(() => null);
            if (existing) {
              console.log(`[DataImport] Interaction ${interactionData.id} already exists, skipping`);
              continue;
            }
          }

          await interactionsCollection.create((interaction) => {
            interaction._raw.id = interactionData.id;
            interaction.interactionDate = new Date(interactionData.interactionDate);
            interaction.interactionType = interactionData.interactionType;
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
        console.log('[DataImport] Importing user progress...');
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

    result.success = true;
    console.log(
      `[DataImport] Import complete: ${result.friendsImported} friends, ${result.interactionsImported} interactions`
    );
  } catch (error) {
    result.errors.push(
      `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    console.error('[DataImport] Import failed:', error);
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
