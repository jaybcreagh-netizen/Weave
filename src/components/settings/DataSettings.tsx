import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { Database, Upload, Download, RefreshCw } from 'lucide-react-native';
import { ModernSwitch } from '@/components/ui/ModernSwitch';
import { SettingsItem } from './SettingsItem';
import { AutoBackupService } from '@/modules/backup/AutoBackupService';
import { DataWipeService } from '@/modules/data-management/DataWipeService';
import {
    exportAndShareData,
    getExportStats,
    getImportPreview,
    importData,
} from '@/modules/auth';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

interface DataSettingsProps {
    onClose: () => void;
}

export const DataSettings: React.FC<DataSettingsProps> = ({ onClose }) => {
    const { colors } = useTheme();

    const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
    const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);

    useEffect(() => {
        loadAutoBackupSettings();
    }, []);

    const loadAutoBackupSettings = async () => {
        const enabled = await AutoBackupService.isEnabled();
        const lastTime = await AutoBackupService.getLastBackupTime();
        setAutoBackupEnabled(enabled);
        setLastBackupTime(lastTime);
    };

    const handleToggleAutoBackup = async (enabled: boolean) => {
        if (enabled) {
            // Verify iCloud access before enabling
            const initialized = await AutoBackupService.init();
            if (!initialized) {
                Alert.alert(
                    'iCloud Access Failed',
                    'Could not access iCloud Drive. Please ensure you are signed in to iCloud and have iCloud Drive enabled.',
                    [{ text: 'OK' }]
                );
                return;
            }
        }

        setAutoBackupEnabled(enabled);
        await AutoBackupService.setEnabled(enabled);
        if (enabled) {
            // Try to backup immediately if enabling
            AutoBackupService.checkAndBackup().then(() => {
                loadAutoBackupSettings();
            });
        }
    };

    const handleExportData = async () => {
        try {
            const stats = await getExportStats();
            Alert.alert(
                'Backup Data',
                `Create a backup of your data to save to iCloud Drive or another safe location.\n\nFriends: ${stats.totalFriends}\nInteractions: ${stats.totalInteractions}\nEstimated size: ${stats.estimatedSizeKB}KB`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Create Backup',
                        onPress: async () => {
                            try {
                                await exportAndShareData();
                            } catch (error) {
                                console.error('Export failed:', error);
                            }
                        },
                    },
                ]
            );
        } catch (error) {
            console.error('Failed to prepare export:', error);
            Alert.alert('Error', 'Failed to prepare data export.');
        }
    };

    const handleImportData = async () => {
        try {
            // Pick a document
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: true,
            });

            if (result.canceled) {
                return;
            }

            const fileUri = result.assets[0].uri;

            // Read the file
            const fileContent = await FileSystem.readAsStringAsync(fileUri);

            // Get preview
            const preview = getImportPreview(fileContent);

            if (!preview.valid) {
                Alert.alert('Invalid File', preview.error || 'The selected file is not a valid Weave export.');
                return;
            }

            // Show confirmation with preview
            Alert.alert(
                'Restore Data',
                `This will restore your data from a backup file:\n\n` +
                `Backup Date: ${new Date(preview.preview!.exportDate).toLocaleDateString()}\n` +
                `Friends: ${preview.preview!.totalFriends}\n` +
                `Interactions: ${preview.preview!.totalInteractions}\n\n` +
                `⚠️ WARNING: This will DELETE all your current data and replace it with the backup.`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Restore',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                Alert.alert('Importing...', 'Please wait while we restore your data.');

                                const result = await importData(fileContent, true);

                                if (result.success) {
                                    Alert.alert(
                                        'Import Successful!',
                                        `Your data has been restored:\n\n` +
                                        `${result.friendsImported} friends imported\n` +
                                        `${result.interactionsImported} interactions imported\n\n` +
                                        `Please restart the app to see your restored data.`,
                                        [
                                            {
                                                text: 'OK',
                                                onPress: () => {
                                                    onClose();
                                                },
                                            },
                                        ]
                                    );
                                } else {
                                    Alert.alert(
                                        'Import Failed',
                                        `Failed to import data:\n\n${result.errors.join('\n')}`,
                                        [{ text: 'OK' }]
                                    );
                                }
                            } catch (error) {
                                console.error('Import failed:', error);
                                Alert.alert('Import Failed', 'An error occurred while importing data.');
                            }
                        },
                    },
                ]
            );
        } catch (error) {
            console.error('Failed to import data:', error);
            Alert.alert('Error', 'Failed to read the selected file.');
        }
    };

    const handleResetDatabase = () => {
        Alert.alert(
            "Erase All Data",
            "Are you sure? This will delete EVERYTHING:\n\n• All friends and interactions\n• All settings and preferences\n• All cloud backups\n• Your account session\n\nThis action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Erase Everything",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            onClose();
                            setTimeout(async () => {
                                await DataWipeService.wipeAllData();
                            }, 500);
                        } catch (error) {
                            console.error('Failed to erase data:', error);
                            Alert.alert('Error', 'Failed to erase data.');
                        }
                    },
                },
            ]
        );
    };

    return (
        <View className="gap-4">
            <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                    <View className="w-10 h-10 rounded-lg items-center justify-center" style={{ backgroundColor: colors.muted }}>
                        <Database color={colors.foreground} size={20} />
                    </View>
                    <View>
                        <Text className="text-base font-inter-medium" style={{ color: colors.foreground }}>Backup & Restore</Text>
                        <Text className="text-sm font-inter-regular" style={{ color: colors['muted-foreground'] }}>Save data to iCloud Drive</Text>
                    </View>
                </View>
                <View className="flex-row gap-2">
                    <TouchableOpacity
                        onPress={handleExportData}
                        className="px-3 py-2 rounded-md"
                        style={{ backgroundColor: colors.muted }}
                    >
                        <Upload size={18} color={colors.foreground} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleImportData}
                        className="px-3 py-2 rounded-md"
                        style={{ backgroundColor: colors.muted }}
                    >
                        <Download size={18} color={colors.foreground} />
                    </TouchableOpacity>
                </View>
            </View>

            <View className="flex-row items-center justify-between pl-13 mt-3">
                <View className="flex-1">
                    <Text className="text-sm font-inter-medium" style={{ color: colors.foreground }}>Auto-Backup to iCloud</Text>
                    <Text className="text-xs font-inter-regular" style={{ color: colors['muted-foreground'] }}>
                        Automatically backup to "Weave/Backups" daily
                        {lastBackupTime && `\nLast: ${new Date(lastBackupTime).toLocaleDateString()} ${new Date(lastBackupTime).toLocaleTimeString()}`}
                    </Text>
                </View>
                <ModernSwitch
                    value={autoBackupEnabled}
                    onValueChange={handleToggleAutoBackup}
                />
            </View>

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                    <View className="w-10 h-10 rounded-lg items-center justify-center" style={{ backgroundColor: colors.destructive + '1A' }}>
                        <RefreshCw color={colors.destructive} size={20} />
                    </View>
                    <View>
                        <Text className="text-base font-inter-medium" style={{ color: colors.foreground }}>Reset Database</Text>
                        <Text className="text-sm font-inter-regular" style={{ color: colors['muted-foreground'] }}>Clear all data and start fresh</Text>
                    </View>
                </View>
                <TouchableOpacity onPress={handleResetDatabase} className="py-2 px-4 rounded-lg border" style={{ borderColor: colors.destructive + '33' }}>
                    <Text className="font-inter-medium" style={{ color: colors.destructive }}>Reset</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};
