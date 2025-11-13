import { database } from '../db';
import FriendModel from '../db/models/Friend';
import InteractionModel from '../db/models/Interaction';
import InteractionFriend from '../db/models/InteractionFriend';
import UserProgress from '../db/models/UserProgress';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert, Share } from 'react-native';

interface ExportData {
  exportDate: string;
  appVersion: string;
  platform: string;
  friends: Array<{
    id: string;
    name: string;
    dunbarTier: string;
    archetype: string;
    photoUrl: string;
    notes: string;
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
    note: string;
    vibe: string;
    duration: string;
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

/**
 * Export all user data to JSON
 */
export async function exportAllData(): Promise<string> {
  try {
    console.log('[DataExport] Starting data export...');

    // Fetch all data
    const friends = await database.get<FriendModel>('friends').query().fetch();
    const interactions = await database.get<InteractionModel>('interactions').query().fetch();
    const interactionFriends = await database
      .get<InteractionFriend>('interaction_friends')
      .query()
      .fetch();
    const userProgressRecords = await database.get<UserProgress>('user_progress').query().fetch();

    // Format friends data
    const friendsData = friends.map((f) => ({
      id: f.id,
      name: f.name,
      dunbarTier: f.dunbarTier,
      archetype: f.archetype,
      photoUrl: f.photoUrl,
      notes: f.notes,
      weaveScore: f.weaveScore,
      lastUpdated: f.lastUpdated.toISOString(),
      resilience: f.resilience,
      ratedWeavesCount: f.ratedWeavesCount,
      momentumScore: f.momentumScore,
      momentumLastUpdated: f.momentumLastUpdated.toISOString(),
      isDormant: f.isDormant,
      dormantSince: f.dormantSince?.toISOString() || null,
      birthday: f.birthday?.toISOString() || null,
      anniversary: f.anniversary?.toISOString() || null,
      relationshipType: f.relationshipType,
    }));

    // Format interactions data with linked friends
    const interactionsData = interactions.map((i) => {
      const linkedFriends = interactionFriends
        .filter((if_) => if_.interactionId === i.id)
        .map((if_) => if_.friendId);

      return {
        id: i.id,
        interactionDate: i.interactionDate.toISOString(),
        interactionType: i.interactionType,
        activity: i.activity,
        status: i.status,
        mode: i.mode,
        note: i.note,
        vibe: i.vibe,
        duration: i.duration,
        title: i.title,
        location: i.location,
        eventImportance: i.eventImportance,
        initiator: i.initiator,
        friendIds: linkedFriends,
      };
    });

    // Calculate stats
    const completedInteractions = interactions.filter((i) => i.status === 'completed').length;
    const plannedInteractions = interactions.filter((i) => i.status === 'planned').length;
    const averageWeaveScore =
      friends.length > 0
        ? friends.reduce((sum, f) => sum + f.weaveScore, 0) / friends.length
        : 0;

    const exportData: ExportData = {
      exportDate: new Date().toISOString(),
      appVersion: '1.0.0', // TODO: Get from Constants
      platform: Platform.OS,
      friends: friendsData,
      interactions: interactionsData,
      userProgress: userProgressRecords[0]
        ? {
            totalWeaves: userProgressRecords[0].totalWeaves,
            curatorProgress: userProgressRecords[0].curatorProgress,
          }
        : null,
      stats: {
        totalFriends: friends.length,
        totalInteractions: interactions.length,
        completedInteractions,
        plannedInteractions,
        averageWeaveScore: Math.round(averageWeaveScore * 100) / 100,
      },
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    console.log('[DataExport] Export data prepared, size:', jsonString.length, 'bytes');

    return jsonString;
  } catch (error) {
    console.error('[DataExport] Failed to export data:', error);
    throw error;
  }
}

/**
 * Export data and copy to clipboard or save locally
 */
export async function exportAndShareData(): Promise<void> {
  try {
    const jsonString = await exportAllData();

    // Save to AsyncStorage as backup
    const exportKey = `@weave:export_${Date.now()}`;
    await AsyncStorage.setItem(exportKey, jsonString);
    console.log('[DataExport] Data saved to AsyncStorage:', exportKey);

    // Try to share using native Share API (text only)
    const stats = await getExportStats();
    const shareMessage = `Weave Data Export\n\nFriends: ${stats.totalFriends}\nInteractions: ${stats.totalInteractions}\nSize: ${stats.estimatedSizeKB}KB\n\nData saved to device storage. You can access it through the debug tools or email it to yourself.`;

    const result = await Share.share({
      message: shareMessage,
      title: 'Export Weave Data',
    });

    if (result.action === Share.sharedAction) {
      Alert.alert(
        'Export Successful',
        `Your data has been exported and saved locally.\n\n${stats.totalFriends} friends, ${stats.totalInteractions} interactions\n\nTo retrieve the full JSON data, check AsyncStorage key: ${exportKey}`,
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert(
        'Export Saved',
        `Your data has been saved locally at:\n${exportKey}\n\nYou can retrieve it through the app's debug tools.`,
        [{ text: 'OK' }]
      );
    }

    console.log('[DataExport] Export complete');
  } catch (error) {
    console.error('[DataExport] Failed to export and share data:', error);
    Alert.alert('Export Failed', 'Failed to export data. Please try again.');
    throw error;
  }
}

/**
 * Get export stats without exporting the full data
 */
export async function getExportStats(): Promise<{
  totalFriends: number;
  totalInteractions: number;
  estimatedSizeKB: number;
}> {
  try {
    const friends = await database.get<FriendModel>('friends').query().fetch();
    const interactions = await database.get<InteractionModel>('interactions').query().fetch();

    // Rough estimate: each friend ~500 bytes, each interaction ~300 bytes
    const estimatedSize = friends.length * 500 + interactions.length * 300;

    return {
      totalFriends: friends.length,
      totalInteractions: interactions.length,
      estimatedSizeKB: Math.round(estimatedSize / 1024),
    };
  } catch (error) {
    console.error('[DataExport] Failed to get export stats:', error);
    return {
      totalFriends: 0,
      totalInteractions: 0,
      estimatedSizeKB: 0,
    };
  }
}
