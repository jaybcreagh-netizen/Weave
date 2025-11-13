import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Share, Platform } from 'react-native';
import {
  Bug,
  Database,
  Info,
  Trash2,
  Download,
  AlertCircle,
  CheckCircle,
  XCircle,
  ChevronRight,
  Copy,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { database, clearDatabase } from '../db';
import {
  getErrorLogs,
  clearErrorLogs,
  exportErrorLogs,
  getUnseenErrorCount,
  markErrorsAsSeen,
  type ErrorLog,
} from '../lib/error-logger';
import { useTheme } from '../hooks/useTheme';

export function DebugPanel() {
  const { colors } = useTheme();
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [unseenCount, setUnseenCount] = useState(0);
  const [dbStats, setDbStats] = useState<{
    friends: number;
    interactions: number;
    intentions: number;
    achievements: number;
  } | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadDebugData();
  }, []);

  const loadDebugData = async () => {
    // Load error logs
    const logs = await getErrorLogs();
    setErrorLogs(logs);

    const count = await getUnseenErrorCount();
    setUnseenCount(count);

    // Mark errors as seen when viewing debug panel
    if (count > 0) {
      await markErrorsAsSeen();
      setUnseenCount(0);
    }

    // Load database stats
    try {
      const friendsCount = await database.get('friends').query().fetchCount();
      const interactionsCount = await database.get('interactions').query().fetchCount();
      const intentionsCount = await database.get('intentions').query().fetchCount();
      const achievementsCount = await database.get('achievement_unlocks').query().fetchCount();

      setDbStats({
        friends: friendsCount,
        interactions: interactionsCount,
        intentions: intentionsCount,
        achievements: achievementsCount,
      });
    } catch (error) {
      console.error('Failed to load database stats:', error);
    }
  };

  const handleExportDebugData = async () => {
    try {
      const errorLogText = await exportErrorLogs();

      const debugReport = `
╔════════════════════════════════════════════════════════════╗
║              WEAVE DEBUG REPORT                            ║
╚════════════════════════════════════════════════════════════╝

📱 APP INFO
─────────────────────────────────────────────────────────────
Version: ${Constants.expoConfig?.version || 'Unknown'}
Build: ${Constants.expoConfig?.android?.versionCode || Constants.expoConfig?.ios?.buildNumber || 'Unknown'}
Platform: ${Platform.OS} ${Platform.Version}
Device: ${Constants.deviceName || 'Unknown'}
Generated: ${new Date().toLocaleString()}

📊 DATABASE STATS
─────────────────────────────────────────────────────────────
Friends: ${dbStats?.friends || 0}
Interactions: ${dbStats?.interactions || 0}
Intentions: ${dbStats?.intentions || 0}
Achievements: ${dbStats?.achievements || 0}

⚠️ ERROR LOGS
─────────────────────────────────────────────────────────────
${errorLogText}

═════════════════════════════════════════════════════════════
End of Debug Report
`.trim();

      // Share or copy to clipboard
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        await Share.share({
          message: debugReport,
          title: 'Weave Debug Report',
        });
      } else {
        await Clipboard.setStringAsync(debugReport);
        Alert.alert('Copied', 'Debug report copied to clipboard');
      }
    } catch (error) {
      console.error('Failed to export debug data:', error);
      Alert.alert('Error', 'Failed to export debug data');
    }
  };

  const handleClearErrors = () => {
    Alert.alert(
      'Clear Error Logs',
      'Are you sure you want to clear all error logs?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearErrorLogs();
            await loadDebugData();
            Alert.alert('Success', 'Error logs cleared');
          },
        },
      ]
    );
  };

  const handleResetDatabase = () => {
    Alert.alert(
      'Reset All Data',
      '⚠️ WARNING: This will permanently delete ALL your data:\n\n• All friends\n• All interactions\n• All intentions\n• All achievements\n• All settings\n\nThis action cannot be undone!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearDatabase();
              Alert.alert(
                'Success',
                'Database has been reset. Please restart the app.',
                [{ text: 'OK' }]
              );
            } catch (error) {
              console.error('Failed to reset database:', error);
              Alert.alert('Error', 'Failed to reset database. Please try again.');
            }
          },
        },
      ]
    );
  };

  const copyToClipboard = async (text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert('Copied', 'Copied to clipboard');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const ErrorLogItem = ({ log }: { log: ErrorLog }) => {
    const [expanded, setExpanded] = useState(false);

    return (
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        className="bg-neutral-800 rounded-lg p-3 mb-2"
      >
        <View className="flex-row items-start">
          <View className="mr-2 mt-0.5">
            {log.level === 'error' ? (
              <XCircle size={16} color="#ef4444" />
            ) : log.level === 'warning' ? (
              <AlertCircle size={16} color="#f59e0b" />
            ) : (
              <CheckCircle size={16} color="#10b981" />
            )}
          </View>

          <View className="flex-1">
            <Text className="text-white font-medium text-sm mb-1" numberOfLines={expanded ? undefined : 2}>
              {log.message}
            </Text>
            <Text className="text-neutral-500 text-xs">
              {new Date(log.timestamp).toLocaleString()}
            </Text>

            {expanded && log.stack && (
              <View className="mt-2 bg-neutral-900 rounded p-2">
                <Text className="text-red-400 text-xs font-mono">{log.stack}</Text>
              </View>
            )}

            {expanded && log.context && (
              <View className="mt-2 bg-neutral-900 rounded p-2">
                <Text className="text-neutral-400 text-xs font-mono">
                  {JSON.stringify(log.context, null, 2)}
                </Text>
              </View>
            )}

            {expanded && (
              <TouchableOpacity
                onPress={() => copyToClipboard(`${log.message}\n\n${log.stack || ''}`)}
                className="mt-2 flex-row items-center"
              >
                <Copy size={14} color="#a3a3a3" />
                <Text className="text-neutral-400 text-xs ml-1">Copy error</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1">
      {/* App Info */}
      <View className="mb-6">
        <View className="flex-row items-center mb-3">
          <Info size={20} color={colors.text} />
          <Text className="text-white font-semibold text-base ml-2">App Info</Text>
        </View>

        <View className="bg-neutral-800 rounded-lg p-4">
          <InfoRow label="Version" value={Constants.expoConfig?.version || 'Unknown'} />
          <InfoRow
            label="Build"
            value={Constants.expoConfig?.android?.versionCode?.toString() ||
                   Constants.expoConfig?.ios?.buildNumber ||
                   'Unknown'}
          />
          <InfoRow label="Platform" value={`${Platform.OS} ${Platform.Version}`} />
          <InfoRow label="Device" value={Constants.deviceName || 'Unknown'} last />
        </View>
      </View>

      {/* Database Stats */}
      <View className="mb-6">
        <View className="flex-row items-center mb-3">
          <Database size={20} color={colors.text} />
          <Text className="text-white font-semibold text-base ml-2">Database Stats</Text>
        </View>

        <View className="bg-neutral-800 rounded-lg p-4">
          <InfoRow label="Friends" value={dbStats?.friends.toString() || '0'} />
          <InfoRow label="Interactions" value={dbStats?.interactions.toString() || '0'} />
          <InfoRow label="Intentions" value={dbStats?.intentions.toString() || '0'} />
          <InfoRow label="Achievements" value={dbStats?.achievements.toString() || '0'} last />
        </View>
      </View>

      {/* Error Logs */}
      <View className="mb-6">
        <TouchableOpacity
          onPress={() => setShowErrorDetails(!showErrorDetails)}
          className="flex-row items-center justify-between mb-3"
        >
          <View className="flex-row items-center">
            <Bug size={20} color={colors.text} />
            <Text className="text-white font-semibold text-base ml-2">
              Error Logs ({errorLogs.length})
            </Text>
            {unseenCount > 0 && (
              <View className="bg-red-500 rounded-full w-5 h-5 ml-2 items-center justify-center">
                <Text className="text-white text-xs font-bold">{unseenCount}</Text>
              </View>
            )}
          </View>
          <ChevronRight
            size={20}
            color={colors.textSecondary}
            style={{
              transform: [{ rotate: showErrorDetails ? '90deg' : '0deg' }],
            }}
          />
        </TouchableOpacity>

        {showErrorDetails && (
          <View>
            {errorLogs.length === 0 ? (
              <View className="bg-neutral-800 rounded-lg p-6 items-center">
                <CheckCircle size={32} color="#10b981" />
                <Text className="text-neutral-400 mt-2">No errors logged</Text>
              </View>
            ) : (
              <ScrollView className="max-h-96">
                {errorLogs.map((log) => (
                  <ErrorLogItem key={log.id} log={log} />
                ))}
              </ScrollView>
            )}

            {errorLogs.length > 0 && (
              <TouchableOpacity
                onPress={handleClearErrors}
                className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mt-2 flex-row items-center justify-center"
              >
                <Trash2 size={16} color="#ef4444" />
                <Text className="text-red-400 font-semibold ml-2">Clear Error Logs</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Actions */}
      <View className="mb-6">
        <TouchableOpacity
          onPress={handleExportDebugData}
          className="bg-indigo-600 rounded-lg p-4 mb-3 flex-row items-center justify-center"
        >
          <Download size={20} color="white" />
          <Text className="text-white font-semibold ml-2">Export Debug Report</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleResetDatabase}
          className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex-row items-center justify-center"
        >
          <Trash2 size={20} color="#ef4444" />
          <Text className="text-red-400 font-semibold ml-2">Reset All Data</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View className={`flex-row justify-between ${!last ? 'mb-2 pb-2 border-b border-neutral-700' : ''}`}>
      <Text className="text-neutral-400 text-sm">{label}</Text>
      <Text className="text-white text-sm font-medium">{value}</Text>
    </View>
  );
}
