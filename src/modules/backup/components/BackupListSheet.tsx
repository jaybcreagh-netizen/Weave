import React, { useState, useEffect, useCallback } from 'react';
import { View, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Text } from '@/shared/ui/Text';
import { StandardBottomSheet } from '@/shared/ui/Sheet/StandardBottomSheet';
import { useTheme } from '@/shared/hooks/useTheme';
import { AutoBackupService } from '../AutoBackupService';
import { getImportPreview, importData } from '@/modules/auth';
import { Clock, CloudDownload, FileText, AlertCircle, Share2, FolderOpen } from 'lucide-react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';

interface BackupItem {
    filename: string;
    date: Date;
    displayDate: string;
    displayTime: string;
}

interface BackupListSheetProps {
    isOpen: boolean;
    onClose: () => void;
    onRestoreComplete: () => void;
}

/**
 * Parse backup filename to extract date
 * Format: weave-backup-2024-12-27T19-48-02-123Z.json
 */
function parseBackupFilename(filename: string): BackupItem | null {
    const match = filename.match(/weave-backup-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})/);
    if (!match) return null;

    const [, year, month, day, hour, minute, second] = match;
    const date = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second)
    );

    return {
        filename,
        date,
        displayDate: date.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        }),
        displayTime: date.toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
        }),
    };
}

export const BackupListSheet: React.FC<BackupListSheetProps> = ({
    isOpen,
    onClose,
    onRestoreComplete,
}) => {
    const { colors } = useTheme();
    const [backups, setBackups] = useState<BackupItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRestoring, setIsRestoring] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadBackups = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const files = await AutoBackupService.getAvailableBackups();
            const parsed = files
                .map(parseBackupFilename)
                .filter((b): b is BackupItem => b !== null)
                .sort((a, b) => b.date.getTime() - a.date.getTime()); // Newest first
            setBackups(parsed);
        } catch (err) {
            setError('Failed to load backups from iCloud');
            console.error('Failed to load backups:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            loadBackups();
        }
    }, [isOpen, loadBackups]);

    const handleSelectBackup = async (backup: BackupItem) => {
        if (isRestoring) return;

        try {
            setIsRestoring(true);

            // Read the backup content
            const content = await AutoBackupService.restoreBackup(backup.filename);

            // Get preview
            const preview = getImportPreview(content);

            if (!preview.valid) {
                Alert.alert('Invalid Backup', preview.error || 'This backup file is corrupted or invalid.');
                setIsRestoring(false);
                return;
            }

            // Show confirmation
            Alert.alert(
                'Restore Backup',
                `Restore from ${backup.displayDate}?\n\n` +
                `Friends: ${preview.preview!.totalFriends}\n` +
                `Interactions: ${preview.preview!.totalInteractions}\n\n` +
                `⚠️ This will DELETE all current data and replace it with this backup.`,
                [
                    {
                        text: 'Cancel',
                        style: 'cancel',
                        onPress: () => setIsRestoring(false),
                    },
                    {
                        text: 'Restore',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                const result = await importData(content, true);

                                if (result.success) {
                                    Alert.alert(
                                        'Restore Complete',
                                        `Successfully restored ${result.friendsImported} friends.`,
                                        [
                                            {
                                                text: 'OK',
                                                onPress: () => {
                                                    onClose();
                                                    onRestoreComplete();
                                                },
                                            },
                                        ]
                                    );
                                } else {
                                    Alert.alert(
                                        'Restore Failed',
                                        `Errors:\n${result.errors.join('\n')}`
                                    );
                                }
                            } catch (err) {
                                console.error('Restore failed:', err);
                                Alert.alert('Restore Failed', 'An error occurred while restoring the backup.');
                            } finally {
                                setIsRestoring(false);
                            }
                        },
                    },
                ]
            );
        } catch (err) {
            setIsRestoring(false);
            console.error('Failed to read backup:', err);
            Alert.alert('Error', 'Failed to read the backup file.');
        }
    };

    const handleShareBackup = async (backup: BackupItem) => {
        try {
            // Read the backup content from iCloud
            const content = await AutoBackupService.restoreBackup(backup.filename);

            // Write to a temporary file that can be shared
            const tempPath = `${FileSystem.cacheDirectory}${backup.filename}`;
            await FileSystem.writeAsStringAsync(tempPath, content);

            // Check if sharing is available
            const isAvailable = await Sharing.isAvailableAsync();
            if (!isAvailable) {
                Alert.alert('Sharing Unavailable', 'Sharing is not available on this device.');
                return;
            }

            // Share the file
            await Sharing.shareAsync(tempPath, {
                mimeType: 'application/json',
                dialogTitle: `Share Weave Backup - ${backup.displayDate}`,
            });
        } catch (err) {
            console.error('Failed to share backup:', err);
            Alert.alert('Error', 'Failed to share the backup file.');
        }
    };

    const handleImportFromFile = async () => {
        if (isRestoring) return;

        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: true,
            });

            if (result.canceled) return;

            const fileUri = result.assets[0].uri;
            const fileContent = await FileSystem.readAsStringAsync(fileUri);

            setIsRestoring(true);

            const preview = getImportPreview(fileContent);

            if (!preview.valid) {
                Alert.alert('Invalid File', preview.error || 'The selected file is not a valid Weave backup.');
                setIsRestoring(false);
                return;
            }

            Alert.alert(
                'Restore from File',
                `Restore from backup?\n\n` +
                `Backup Date: ${new Date(preview.preview!.exportDate).toLocaleDateString()}\n` +
                `Friends: ${preview.preview!.totalFriends}\n` +
                `Interactions: ${preview.preview!.totalInteractions}\n\n` +
                `⚠️ This will DELETE all current data and replace it with this backup.`,
                [
                    {
                        text: 'Cancel',
                        style: 'cancel',
                        onPress: () => setIsRestoring(false),
                    },
                    {
                        text: 'Restore',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                const importResult = await importData(fileContent, true);

                                if (importResult.success) {
                                    Alert.alert(
                                        'Restore Complete',
                                        `Successfully restored ${importResult.friendsImported} friends.`,
                                        [{
                                            text: 'OK',
                                            onPress: () => {
                                                onClose();
                                                onRestoreComplete();
                                            },
                                        }]
                                    );
                                } else {
                                    Alert.alert(
                                        'Restore Failed',
                                        `Errors:\n${importResult.errors.join('\n')}`
                                    );
                                }
                            } catch (err) {
                                console.error('Import failed:', err);
                                Alert.alert('Restore Failed', 'An error occurred while restoring the backup.');
                            } finally {
                                setIsRestoring(false);
                            }
                        },
                    },
                ]
            );
        } catch (err) {
            setIsRestoring(false);
            console.error('Failed to read file:', err);
            Alert.alert('Error', 'Failed to read the selected file.');
        }
    };

    const renderContent = () => {
        if (isLoading) {
            return (
                <View className="items-center justify-center py-12">
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text className="mt-4 text-sm" style={{ color: colors['muted-foreground'] }}>
                        Loading backups from iCloud...
                    </Text>
                </View>
            );
        }

        if (error) {
            return (
                <View className="items-center justify-center py-12 px-4">
                    <AlertCircle size={48} color={colors.destructive} />
                    <Text className="mt-4 text-center" style={{ color: colors['muted-foreground'] }}>
                        {error}
                    </Text>
                    <TouchableOpacity
                        onPress={loadBackups}
                        className="mt-4 px-4 py-2 rounded-lg"
                        style={{ backgroundColor: colors.muted }}
                    >
                        <Text style={{ color: colors.foreground }}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (backups.length === 0) {
            return (
                <View className="items-center justify-center py-12 px-4">
                    <CloudDownload size={48} color={colors['muted-foreground']} />
                    <Text className="mt-4 text-center font-inter-medium" style={{ color: colors.foreground }}>
                        No iCloud Backups Found
                    </Text>
                    <Text className="mt-2 text-center text-sm" style={{ color: colors['muted-foreground'] }}>
                        Enable Auto-Backup to create automatic backups, or import from a file below.
                    </Text>
                </View>
            );
        }

        return (
            <View className="gap-2">
                {backups.map((backup, index) => (
                    <TouchableOpacity
                        key={backup.filename}
                        onPress={() => handleSelectBackup(backup)}
                        disabled={isRestoring}
                        className="flex-row items-center p-4 rounded-xl"
                        style={{
                            backgroundColor: colors.muted,
                            opacity: isRestoring ? 0.5 : 1,
                        }}
                    >
                        <View
                            className="w-10 h-10 rounded-lg items-center justify-center mr-3"
                            style={{ backgroundColor: colors.background }}
                        >
                            <FileText size={20} color={colors.primary} />
                        </View>
                        <View className="flex-1">
                            <Text className="font-inter-medium" style={{ color: colors.foreground }}>
                                {backup.displayDate}
                            </Text>
                            <View className="flex-row items-center mt-1">
                                <Clock size={12} color={colors['muted-foreground']} />
                                <Text className="ml-1 text-xs" style={{ color: colors['muted-foreground'] }}>
                                    {backup.displayTime}
                                </Text>
                                {index === 0 && (
                                    <View
                                        className="ml-2 px-2 py-0.5 rounded"
                                        style={{ backgroundColor: colors.primary + '20' }}
                                    >
                                        <Text className="text-xs" style={{ color: colors.primary }}>
                                            Latest
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>
                        <TouchableOpacity
                            onPress={(e) => {
                                e.stopPropagation();
                                handleShareBackup(backup);
                            }}
                            className="p-2 rounded-lg ml-2"
                            style={{ backgroundColor: colors.background }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Share2 size={18} color={colors['muted-foreground']} />
                        </TouchableOpacity>
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    return (
        <StandardBottomSheet
            visible={isOpen}
            onClose={onClose}
            title="Restore Backup"
            scrollable
            height="form"
        >
            <View className="px-4 pb-8">
                <Text className="text-sm text-center mb-4" style={{ color: colors['muted-foreground'] }}>
                    Select an iCloud backup to restore
                </Text>
                {renderContent()}

                {/* Separator and Import from File option */}
                <View className="mt-6 pt-4" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                    <TouchableOpacity
                        onPress={handleImportFromFile}
                        disabled={isRestoring}
                        className="flex-row items-center justify-center gap-2 py-3 rounded-lg"
                        style={{ backgroundColor: colors.muted, opacity: isRestoring ? 0.5 : 1 }}
                    >
                        <FolderOpen size={18} color={colors['muted-foreground']} />
                        <Text className="text-sm font-inter-medium" style={{ color: colors['muted-foreground'] }}>
                            Import from Files
                        </Text>
                    </TouchableOpacity>
                    <Text className="text-xs text-center mt-2" style={{ color: colors['muted-foreground'] }}>
                        Restore from a backup file saved elsewhere
                    </Text>
                </View>
            </View>
        </StandardBottomSheet>
    );
};
