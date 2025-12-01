import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import InteractionModel from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import UserProgress from '@/db/models/UserProgress';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert, Share } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Application from 'expo-application';

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
      photoUrl: f.photoUrl || null,
      notes: f.notes || null,
      weaveScore: f.weaveScore,
      lastUpdated: f.lastUpdated.toISOString(),
      resilience: f.resilience,
      ratedWeavesCount: f.ratedWeavesCount,
      momentumScore: f.momentumScore,
      momentumLastUpdated: f.momentumLastUpdated.toISOString(),
      isDormant: f.isDormant,
      dormantSince: f.dormantSince?.toISOString() || null,
      birthday: f.birthday || null,
      anniversary: f.anniversary || null,
      relationshipType: f.relationshipType || null,
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
        note: i.note || null,
        vibe: i.vibe || null,
        duration: i.duration || null,
        title: i.title || null,
        location: i.location || null,
        eventImportance: i.eventImportance || null,
        initiator: i.initiator || null,
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
      appVersion: Application.nativeApplicationVersion || '1.0.0',
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
 * Export data and save as file, then share
 */
export async function exportAndShareData(): Promise<void> {
  try {
    const jsonString = await exportAllData();

    // Save to AsyncStorage as backup
    const exportKey = `@weave:export_${Date.now()}`;
    await AsyncStorage.setItem(exportKey, jsonString);
    console.log('[DataExport] Data saved to AsyncStorage:', exportKey);

    // Save to file system
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `weave-export-${timestamp}.json`;
    const fileUri = FileSystem.documentDirectory + fileName;

    await FileSystem.writeAsStringAsync(fileUri, jsonString);

    console.log('[DataExport] Data saved to file:', fileUri);

    // Share the file
    const stats = await getExportStats();
    const shareMessage = `Weave Data Export\n\nFriends: ${stats.totalFriends}\nInteractions: ${stats.totalInteractions}\nExport Date: ${new Date().toLocaleDateString()}\n\nThis file contains all your Weave data and can be used to restore your profile.`;

    try {
      const result = await Share.share({
        message: shareMessage,
        url: fileUri,
        title: 'Export Weave Data',
      });

      if (result.action === Share.sharedAction) {
        Alert.alert(
          'Export Successful',
          `Your data has been exported successfully!\n\n${stats.totalFriends} friends\n${stats.totalInteractions} interactions\n\nFile saved to: ${fileName}`,
          [{ text: 'OK' }]
        );
      } else if (result.action === Share.dismissedAction) {
        Alert.alert(
          'Export Saved',
          `Your data has been saved to:\n${fileName}\n\nYou can find it in your app's documents folder.`,
          [{ text: 'OK' }]
        );
      }
    } catch (shareError) {
      // If sharing fails, at least the file is saved
      Alert.alert(
        'Export Saved',
        `Your data has been saved to:\n${fileName}\n\nLocation: ${fileUri}\n\nYou can access this file through your device's file manager.`,
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
