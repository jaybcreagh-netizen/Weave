import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/shared/hooks/useTheme';
import {
    Sparkles,
    Trophy,
    Database,
    Trash2,
    Shield,
    RefreshCw,
    Moon,
    ChevronRight,
    Bell
} from 'lucide-react-native';
import { NotificationOrchestrator } from '@/modules/notifications';
import { SettingsItem } from './SettingsItem';
import { useUIStore } from '@/shared/stores/uiStore';
import { DiagnosticService } from '@/shared/services/diagnostic.service';
import { EveningDigestChannel } from '@/modules/notifications';
import { generateStressTestData, clearStressTestData, getDataStats } from '@/db/seeds/stress-test-seed-data';

interface TestingSettingsProps {
    onClose: () => void;
}

export const TestingSettings: React.FC<TestingSettingsProps> = ({ onClose }) => {
    const { colors } = useTheme();
    const { openWeeklyReflection, openReflectionPrompt } = useUIStore();
    const [isScanning, setIsScanning] = useState(false);

    const handleGenerateStressTest = () => {
        Alert.alert(
            'Generate Stress Test Data',
            'This will create realistic test data including friends, interactions, journal entries, and groups. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Generate',
                    onPress: async () => {
                        try {
                            await generateStressTestData(100, 10);
                            const stats = await getDataStats();
                            Alert.alert(
                                'Stress Test Data Generated',
                                `Created ${stats.stressTestFriends} test friends!\n\n` +
                                `Total friends: ${stats.totalFriends}\n` +
                                `Total interactions: ${stats.totalInteractions}\n` +
                                `Total journal entries: ${stats.totalJournalEntries}\n` +
                                `Total groups: ${stats.totalGroups}`,
                                [{ text: 'OK' }]
                            );
                        } catch (error) {
                            console.error('Failed to generate stress test data:', error);
                            Alert.alert('Error', 'Failed to generate stress test data.');
                        }
                    },
                },
            ]
        );
    };

    const handleClearStressTest = async () => {
        try {
            const stats = await getDataStats();
            if (stats.stressTestFriends === 0) {
                Alert.alert('No Stress Test Data', 'There is no stress test data to clear.');
                return;
            }

            Alert.alert(
                'Clear Stress Test Data',
                `This will remove ${stats.stressTestFriends} test friends and their interactions. Continue?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Clear',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                await clearStressTestData();
                                Alert.alert('Cleared', 'Stress test data has been removed.', [{ text: 'OK' }]);
                            } catch (error) {
                                console.error('Failed to clear stress test data:', error);
                                Alert.alert('Error', 'Failed to clear stress test data.');
                            }
                        },
                    },
                ]
            );
        } catch (error) {
            console.error('Failed to check stress test data:', error);
            Alert.alert('Error', 'Failed to check stress test data.');
        }
    };

    const handleRunDiagnostics = async () => {
        setIsScanning(true);
        // Tiny delay to allow UI to update and user to perceive action
        await new Promise(resolve => setTimeout(resolve, 800));

        try {
            const report = await DiagnosticService.runScan();
            setIsScanning(false);

            const issueSummary = report.issues.length > 0
                ? report.issues.map(i => `• [${i.severity.toUpperCase()}] ${i.description}`).join('\n')
                : 'No issues found.';

            Alert.alert(
                'Diagnostic Report',
                `Scan complete in ${report.scanDurationMs}ms.\n\nIssues Found: ${report.totalIssues}\n\n${issueSummary}`,
                [
                    { text: 'OK' },
                    report.totalIssues > 0 ? {
                        text: 'Attempt Fix',
                        onPress: () => {
                            Alert.alert('Fix Orphans', 'Attempting to remove orphaned links...', [
                                {
                                    text: 'Proceed',
                                    style: 'destructive',
                                    onPress: async () => {
                                        const fixed = await DiagnosticService.fixOrphans(report.issues);
                                        Alert.alert('Fix Complete', `Removed ${fixed} orphaned records.`);
                                    }
                                },
                                { text: 'Cancel', style: 'cancel' }
                            ]);
                        }
                    } : { text: '' } // no-op if no issues
                ].filter(b => b.text)
            );
        } catch (error) {
            setIsScanning(false);
            console.error('Diagnostic run failed:', error);
            Alert.alert('Error', 'Diagnostic scan failed.');
        }
    };

    const handleTestEveningDigest = async () => {
        try {
            await EveningDigestChannel.handleTap({ isTest: true }, router);
            onClose();
        } catch (error) {
            console.error('Failed to open digest:', error);
            Alert.alert('Error', 'Failed to open digest sheet');
        }
    };

    const handleResetScheduler = async () => {
        Alert.alert(
            'Reset Scheduler',
            'This will cancel ALL scheduled notifications and re-run startup checks. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reset',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await NotificationOrchestrator.cancelAll();
                            await NotificationOrchestrator.runStartupChecks();
                            Alert.alert('Success', 'Notification scheduler reset complete.');
                        } catch (error) {
                            console.error('Failed to reset scheduler:', error);
                            Alert.alert('Error', 'Failed to reset scheduler.');
                        }
                    }
                }
            ]
        );
    };

    return (
        <View className="gap-4">
            {/* Debug Section Title */}
            <Text className="text-xs font-inter-semibold uppercase tracking-wide mb-2" style={{ color: colors['muted-foreground'] }}>
                Debug Tools
            </Text>

            {/* Test Actions */}

            <SettingsItem
                icon={Sparkles}
                title="Test Weekly Reflection"
                subtitle="Trigger the weekly check-in flow"
                onPress={() => {
                    onClose();
                    setTimeout(() => openWeeklyReflection(), 300);
                }}
            />

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            <SettingsItem
                icon={Bell}
                title="Reset Scheduler"
                subtitle="Nuke and rebuild notifications"
                onPress={handleResetScheduler}
            />

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            <SettingsItem
                icon={Trophy}
                title="Test Badge Popup"
                subtitle="Trigger a fake badge unlock"
                onPress={() => {
                    useUIStore.getState().queueBadgeUnlocks([{
                        badge: {
                            id: 'test_badge',
                            name: 'Test Badge',
                            icon: '🧪',
                            description: 'This is a test badge to verify the popup animation.',
                            threshold: 1,
                            tier: 1,
                            rarity: 'epic',
                            flavorText: 'Science requires experimentation!',
                        },
                        friendId: 'test_friend',
                        friendName: 'Test Friend',
                        categoryType: 'special',
                    }]);
                    onClose();
                }}
            />

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            <SettingsItem
                icon={Database}
                title="Generate Test Data"
                subtitle="Create 100 test friends"
                onPress={handleGenerateStressTest}
            />

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            <SettingsItem
                icon={Trash2}
                title="Clear Test Data"
                subtitle="Remove stress test friends"
                onPress={handleClearStressTest}
            />

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            {/* Diagnostic Scan */}
            <TouchableOpacity
                className="flex-row items-center justify-between"
                onPress={handleRunDiagnostics}
                disabled={isScanning}
            >
                <View className="flex-row items-center gap-3">
                    <View className="w-10 h-10 rounded-lg items-center justify-center" style={{ backgroundColor: isScanning ? colors.muted : colors.muted }}>
                        {isScanning ? (
                            <RefreshCw color={colors.foreground} size={20} className="animate-spin" />
                        ) : (
                            <Shield color={colors.foreground} size={20} />
                        )}
                    </View>
                    <View>
                        <Text className="text-base font-inter-medium" style={{ color: isScanning ? colors['muted-foreground'] : colors.foreground }}>
                            {isScanning ? 'Scanning Database...' : 'Scan Database'}
                        </Text>
                        <Text className="text-sm font-inter-regular" style={{ color: colors['muted-foreground'] }}>Check for data anomalies</Text>
                    </View>
                </View>
            </TouchableOpacity>

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            <SettingsItem
                icon={Moon}
                title="Test Evening Digest"
                subtitle="Trigger digest sheet immediately"
                onPress={handleTestEveningDigest}
            />
        </View>
    );
};
