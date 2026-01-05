import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { Database, Upload, Download, RefreshCw, Bug, Wrench } from 'lucide-react-native';
import { ModernSwitch } from '@/shared/ui/ModernSwitch';
import { AutoBackupService, BackupListSheet } from '@/modules/backup';
import { DataWipeService } from '@/modules/data-management';
import { exportAndShareData, getExportStats } from '@/modules/auth';
import { SuggestionDebugService } from '@/modules/interactions/services/suggestion-debug.service';

interface DataSettingsProps {
    onClose: () => void;
}

export const DataSettings: React.FC<DataSettingsProps> = ({ onClose }) => {
    const { colors } = useTheme();

    const [isImporting, setIsImporting] = useState(false);
    const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
    const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);
    const [showBackupList, setShowBackupList] = useState(false);

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


    const handleRunDiagnostics = async () => {
        try {
            const result = await SuggestionDebugService.runDiagnostics();
            Alert.alert(
                'Diagnostics Complete',
                `Found ${result.result.count} suggestions (Limit: 3).\n\n` +
                `Context: ${result.context.candidates} candidates from ${result.context.friends} friends.\n\n` +
                `Types: ${result.result.types.join(', ')}\n` +
                `Categories: ${JSON.stringify(result.result.categories)}`,
                [{ text: 'OK' }]
            );
            console.log('Diagnostics:', JSON.stringify(result, null, 2));
        } catch (error) {
            Alert.alert('Error', 'Diagnostics failed');
            console.error(error);
        }
    };

    const handleClearDismissed = async () => {
        await SuggestionDebugService.clearDismissed();
        Alert.alert('Success', 'Dismissed suggestions history cleared. New suggestions will be generated on next refresh.');
    };

    const handleFixData = async () => {
        Alert.alert(
            'Recalculate Scores',
            'This will recalculate weave scores for all friends and update the database. This ensures candidates are correctly identified.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Run Fix',
                    onPress: async () => {
                        try {
                            const res = await SuggestionDebugService.fixDataIntegrity();
                            Alert.alert('Complete', `Scanned ${res.processed} friends.\nUpdated ${res.updated} stale scores.`);
                        } catch (e) {
                            Alert.alert('Error', 'Fix failed');
                        }
                    }
                }
            ]
        );
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
            {/* Backup & Restore Card */}
            <View className="rounded-xl p-4" style={{ backgroundColor: colors.muted }}>
                <View className="flex-row items-center gap-3 mb-4">
                    <View className="w-10 h-10 rounded-lg items-center justify-center" style={{ backgroundColor: colors.background }}>
                        <Database color={colors.primary} size={20} />
                    </View>
                    <View className="flex-1">
                        <Text className="text-base font-inter-medium" style={{ color: colors.foreground }}>Backup & Restore</Text>
                        <Text className="text-xs font-inter-regular" style={{ color: colors['muted-foreground'] }}>
                            Save your data to iCloud Drive
                        </Text>
                    </View>
                </View>

                {/* Last Backup Info */}
                {lastBackupTime && (
                    <View className="flex-row items-center gap-2 mb-4 px-2 py-2 rounded-lg" style={{ backgroundColor: colors.background }}>
                        <RefreshCw size={14} color={colors['muted-foreground']} />
                        <Text className="text-xs font-inter-regular" style={{ color: colors['muted-foreground'] }}>
                            Last backup: {new Date(lastBackupTime).toLocaleDateString()} at {new Date(lastBackupTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </Text>
                    </View>
                )}

                {/* Action Buttons */}
                <View className="flex-row gap-3 mb-4">
                    <TouchableOpacity
                        onPress={handleExportData}
                        disabled={isImporting}
                        className="flex-1 flex-row items-center justify-center gap-2 py-3 rounded-lg"
                        style={{ backgroundColor: colors.background, opacity: isImporting ? 0.5 : 1 }}
                    >
                        <Upload size={16} color={colors.foreground} />
                        <Text className="text-sm font-inter-medium" style={{ color: colors.foreground }}>Create Backup</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setShowBackupList(true)}
                        disabled={isImporting}
                        className="flex-1 flex-row items-center justify-center gap-2 py-3 rounded-lg"
                        style={{ backgroundColor: colors.primary, opacity: isImporting ? 0.5 : 1 }}
                    >
                        <Download size={16} color={colors['primary-foreground']} />
                        <Text className="text-sm font-inter-medium" style={{ color: colors['primary-foreground'] }}>Restore</Text>
                    </TouchableOpacity>
                </View>

                {/* Auto-Backup Toggle */}
                <View className="flex-row items-center justify-between pt-3" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                    <View className="flex-1 mr-3">
                        <Text className="text-sm font-inter-medium" style={{ color: colors.foreground }}>Auto-Backup Daily</Text>
                        <Text className="text-xs font-inter-regular" style={{ color: colors['muted-foreground'] }}>
                            Saves to iCloud Drive automatically
                        </Text>
                    </View>
                    <ModernSwitch
                        value={autoBackupEnabled}
                        onValueChange={handleToggleAutoBackup}
                    />
                </View>
            </View>

            <BackupListSheet
                isOpen={showBackupList}
                onClose={() => setShowBackupList(false)}
                onRestoreComplete={onClose}
            />

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            {/* Debug Tools */}
            <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                    <View className="w-10 h-10 rounded-lg items-center justify-center" style={{ backgroundColor: colors.primary + '1A' }}>
                        <Bug color={colors.primary} size={20} />
                    </View>
                    <View>
                        <Text className="text-base font-inter-medium" style={{ color: colors.foreground }}>Suggestion Diagnostics</Text>
                        <Text className="text-sm font-inter-regular" style={{ color: colors['muted-foreground'] }}>Fix missing suggestions/insights</Text>
                    </View>
                </View>
                <View className="flex-row gap-2">
                    <TouchableOpacity onPress={handleFixData} className="px-3 py-2 rounded-md" style={{ backgroundColor: colors.muted }}>
                        <Wrench size={18} color={colors.foreground} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleClearDismissed} className="px-3 py-2 rounded-md" style={{ backgroundColor: colors.muted }}>
                        <RefreshCw size={18} color={colors.foreground} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleRunDiagnostics} className="px-3 py-2 rounded-md" style={{ backgroundColor: colors.muted }}>
                        <Bug size={18} color={colors.foreground} />
                    </TouchableOpacity>
                </View>
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
