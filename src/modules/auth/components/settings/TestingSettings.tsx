import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Modal, ScrollView } from 'react-native';
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
    Bell,
    Calendar,
    Clock,
    X,
    Repeat,
    Play
} from 'lucide-react-native';
import { NotificationOrchestrator } from '@/modules/notifications';
import { SettingsItem } from './SettingsItem';
import { useUIStore } from '@/shared/stores/uiStore';
import { useTutorialStore } from '@/shared/stores/tutorialStore';
import { DiagnosticService } from '@/shared/services/diagnostic.service';
import { EveningDigestChannel } from '@/modules/notifications';
import { generateStressTestData, clearStressTestData, getDataStats } from '@/db/seeds/stress-test-seed-data';
import * as Notifications from 'expo-notifications';

interface TestingSettingsProps {
    onClose: () => void;
}

export const TestingSettings: React.FC<TestingSettingsProps> = ({ onClose }) => {
    const { colors } = useTheme();
    const { openWeeklyReflection, openReflectionPrompt } = useUIStore();
    const [isScanning, setIsScanning] = useState(false);
    const [showNotificationViewer, setShowNotificationViewer] = useState(false);
    const [scheduledNotifications, setScheduledNotifications] = useState<Notifications.NotificationRequest[]>([]);

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
            // Close modal first to prevent navigation context race conditions
            onClose();

            // Allow time for modal to dismiss before navigating
            setTimeout(async () => {
                await EveningDigestChannel.handleTap({ isTest: true }, router);
            }, 500);
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

                            // Force schedule critical notifications directly
                            // (in case runStartupChecks has issues)
                            const { WeeklyReflectionChannel } = await import('@/modules/notifications/services/channels/weekly-reflection');
                            const { EveningDigestChannel } = await import('@/modules/notifications/services/channels/evening-digest');

                            await WeeklyReflectionChannel.schedule();
                            await EveningDigestChannel.schedule();

                            Alert.alert('Success', 'Notification scheduler reset complete. Weekly Reflection & Evening Digest scheduled.');
                        } catch (error) {
                            console.error('Failed to reset scheduler:', error);
                            Alert.alert('Error', 'Failed to reset scheduler.');
                        }
                    }
                }
            ]
        );
    };

    const handleViewScheduledNotifications = async () => {
        try {
            const scheduled = await Notifications.getAllScheduledNotificationsAsync();
            setScheduledNotifications(scheduled);
            setShowNotificationViewer(true);
        } catch (error) {
            console.error('Failed to get scheduled notifications:', error);
            Alert.alert('Error', 'Failed to retrieve scheduled notifications.');
        }
    };

    // Helper functions for the notification viewer
    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'weekly-reflection': return '🪞';
            case 'evening-digest': return '🌙';
            case 'memory-nudge': return '💭';
            case 'smart-suggestions': return '💡';
            case 'daily-battery-checkin': return '🔋';
            case 'deepening-nudge': return '🌱';
            case 'event-reminder': return '📅';
            default: return '🔔';
        }
    };

    const formatTriggerInfo = (trigger: any): { schedule: string; isRepeating: boolean } => {
        if (!trigger) return { schedule: 'No trigger', isRepeating: false };

        try {
            // expo-notifications triggers have different structures based on type
            const triggerType = trigger.type;

            // Weekly/Calendar trigger (type: 'calendar' or has weekday)
            if (triggerType === 'calendar' || trigger.weekday !== undefined) {
                const dateComponents = trigger.dateComponents || trigger;
                const days = ['', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                const weekday = dateComponents.weekday;
                const hour = dateComponents.hour;
                const minute = dateComponents.minute ?? 0;

                if (weekday !== undefined && hour !== undefined) {
                    const day = days[weekday] || `Day ${weekday}`;
                    return {
                        schedule: `${day} at ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
                        isRepeating: trigger.repeats ?? dateComponents.repeats ?? false
                    };
                }

                // Daily at specific time
                if (hour !== undefined) {
                    return {
                        schedule: `Daily at ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
                        isRepeating: trigger.repeats ?? dateComponents.repeats ?? false
                    };
                }
            }

            // Date-based trigger (type: 'date' or has date/value)
            if (triggerType === 'date' || trigger.date || trigger.value) {
                const timestamp = trigger.value || trigger.date;
                if (timestamp) {
                    const date = new Date(timestamp);
                    if (!isNaN(date.getTime())) {
                        return {
                            schedule: date.toLocaleString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            }),
                            isRepeating: false
                        };
                    }
                }
            }

            // Interval/seconds-based trigger
            if (trigger.seconds !== undefined) {
                const hours = Math.floor(trigger.seconds / 3600);
                const mins = Math.floor((trigger.seconds % 3600) / 60);
                if (hours > 0) {
                    return {
                        schedule: `Every ${hours}h${mins > 0 ? ` ${mins}m` : ''}`,
                        isRepeating: trigger.repeats ?? true
                    };
                }
                return {
                    schedule: `Every ${mins}m`,
                    isRepeating: trigger.repeats ?? true
                };
            }

            // Direct hour/minute (legacy format)
            if (trigger.hour !== undefined) {
                const hour = trigger.hour.toString().padStart(2, '0');
                const minute = (trigger.minute ?? 0).toString().padStart(2, '0');
                return {
                    schedule: `Daily at ${hour}:${minute}`,
                    isRepeating: trigger.repeats ?? false
                };
            }

            // Fallback: show raw trigger info for debugging
            const keys = Object.keys(trigger).filter(k => trigger[k] !== undefined && trigger[k] !== null);
            if (keys.length > 0) {
                const preview = keys.slice(0, 3).map(k => `${k}: ${trigger[k]}`).join(', ');
                return { schedule: preview, isRepeating: trigger.repeats ?? false };
            }

            return { schedule: 'Unknown', isRepeating: false };
        } catch (e) {
            return { schedule: 'Parse error', isRepeating: false };
        }
    };

    const getTypeLabel = (type: string): string => {
        return type
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    return (
        <View className="gap-4">
            {/* Debug Section Title */}
            <Text className="text-xs font-inter-semibold uppercase tracking-wide mb-2" style={{ color: colors['muted-foreground'] }}>
                Debug Tools
            </Text>

            {/* Test Actions */}

            <SettingsItem
                icon={Play}
                title="Test Onboarding"
                subtitle="Reset and restart onboarding flow"
                onPress={() => {
                    Alert.alert(
                        'Test Onboarding',
                        'This will reset your onboarding state and restart the flow. Continue?',
                        [
                            { text: 'Cancel', style: 'cancel' },
                            {
                                text: 'Reset & Start',
                                onPress: async () => {
                                    try {
                                        await useTutorialStore.getState().resetTutorials();
                                        onClose();
                                        router.replace('/onboarding');
                                    } catch (error) {
                                        console.error('Failed to reset tutorials:', error);
                                        Alert.alert('Error', 'Failed to reset onboarding state.');
                                    }
                                }
                            }
                        ]
                    );
                }}
            />

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

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
                icon={Calendar}
                title="View Scheduled Notifications"
                subtitle="See all pending notifications"
                onPress={handleViewScheduledNotifications}
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
                icon={Sparkles}
                title="Force Generate Insights"
                subtitle="Run the daily oracle job now"
                onPress={() => {
                    Alert.alert(
                        'Generate Insights',
                        'This will trigger the daily insight generation job. It uses LLM tokens. Continue?',
                        [
                            { text: 'Cancel', style: 'cancel' },
                            {
                                text: 'Generate',
                                onPress: async () => {
                                    try {
                                        // Dynamic import to avoid cycles
                                        const { InsightGenerator } = await import('@/modules/oracle/services/insight-generator');
                                        await InsightGenerator.generateDailyInsights();
                                        Alert.alert('Success', 'Insights generated! Check the logs or home screen.');
                                    } catch (error) {
                                        console.error('Failed to generate insights:', error);
                                        Alert.alert('Error', 'Failed to generate insights.');
                                    }
                                }
                            }
                        ]
                    );
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

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            <SettingsItem
                icon={Sparkles}
                title="Test RQS Calculation"
                subtitle="Calculate quality score for a friend"
                onPress={() => {
                    Alert.alert(
                        'Test RQS',
                        'This will calculate Relationship Quality Score for a random friend. Continue?',
                        [
                            { text: 'Cancel', style: 'cancel' },
                            {
                                text: 'Calculate',
                                onPress: async () => {
                                    try {
                                        const { database } = await import('@/db');
                                        const { relationshipQualityService } = await import('@/modules/intelligence');

                                        // Get a random friend
                                        const friends = await database.get('friends').query().fetch();
                                        if (friends.length === 0) {
                                            Alert.alert('No Friends', 'Add some friends first!');
                                            return;
                                        }

                                        const friend = friends[Math.floor(Math.random() * friends.length)] as any;
                                        const rqs = await relationshipQualityService.calculateRQS(friend.id);

                                        Alert.alert(
                                            `RQS: ${friend.name}`,
                                            `Texture: ${rqs.texture.summary}\n\n` +
                                            `Trajectory: ${rqs.trajectory}\n` +
                                            `Composite: ${rqs.composite}\n\n` +
                                            `Components:\n` +
                                            `• Depth: ${rqs.components.depth}\n` +
                                            `• Consistency: ${rqs.components.consistency}\n` +
                                            `• Reciprocity: ${rqs.components.reciprocity.toFixed(2)}\n` +
                                            `• Growth: ${rqs.components.growth}\n` +
                                            `• Resilience: ${rqs.components.resilience}`
                                        );
                                    } catch (error) {
                                        console.error('RQS calculation failed:', error);
                                        Alert.alert('Error', `RQS calculation failed: ${error}`);
                                    }
                                }
                            }
                        ]
                    );
                }}
            />

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            <SettingsItem
                icon={Sparkles}
                title="Test Reciprocity Analysis"
                subtitle="Analyze initiation balance for a friend"
                onPress={() => {
                    Alert.alert(
                        'Test Reciprocity',
                        'This will calculate reciprocity metrics for a random friend. Continue?',
                        [
                            { text: 'Cancel', style: 'cancel' },
                            {
                                text: 'Calculate',
                                onPress: async () => {
                                    try {
                                        const { database } = await import('@/db');
                                        const { reciprocityService } = await import('@/modules/intelligence');

                                        const friends = await database.get('friends').query().fetch();
                                        if (friends.length === 0) {
                                            Alert.alert('No Friends', 'Add some friends first!');
                                            return;
                                        }

                                        const friend = friends[Math.floor(Math.random() * friends.length)] as any;
                                        const analysis = await reciprocityService.calculateReciprocity(friend.id);
                                        const summary = reciprocityService.generateSummary(analysis);

                                        Alert.alert(
                                            `Reciprocity: ${friend.name}`,
                                            `${summary}\n\n` +
                                            `Ratio: ${(analysis.initiationRatio * 100).toFixed(0)}% you initiate\n` +
                                            `Trend: ${analysis.trend} (${analysis.trendMagnitude})\n\n` +
                                            `Windows:\n` +
                                            `• 30 days: ${analysis.windows.last30Days.yourInitiations}/${analysis.windows.last30Days.totalInteractions} you\n` +
                                            `• 90 days: ${analysis.windows.last90Days.yourInitiations}/${analysis.windows.last90Days.totalInteractions} you\n` +
                                            `• Lifetime: ${analysis.windows.lifetime.yourInitiations}/${analysis.windows.lifetime.totalInteractions} you\n\n` +
                                            `Flags:\n` +
                                            `• Healthy: ${analysis.flags.healthyBalance ? '✓' : '✗'}\n` +
                                            `• One carrying: ${analysis.flags.onePersonCarrying ? '⚠️' : '✓'}\n` +
                                            `• Recent shift: ${analysis.flags.recentShift ? '⚠️' : '—'}`
                                        );
                                    } catch (error) {
                                        console.error('Reciprocity calculation failed:', error);
                                        Alert.alert('Error', `Reciprocity calculation failed: ${error}`);
                                    }
                                }
                            }
                        ]
                    );
                }}
            />

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            <SettingsItem
                icon={Sparkles}
                title="Test Insight Generation"
                subtitle="Generate an insight from existing data"
                onPress={() => {
                    Alert.alert(
                        'Test Insights',
                        'This will check active insights and try to generate new ones. Continue?',
                        [
                            { text: 'Cancel', style: 'cancel' },
                            {
                                text: 'Run',
                                onPress: async () => {
                                    try {
                                        const { database } = await import('@/db');
                                        const { insightOrchestratorService } = await import('@/modules/intelligence');

                                        // Check active insights
                                        const activeInsights = await insightOrchestratorService.getActiveInsights();

                                        if (activeInsights.length > 0) {
                                            const insight = activeInsights[0];
                                            Alert.alert(
                                                'Active Insight Found',
                                                `${insight.opener}\n\n${insight.message}\n\n` +
                                                `Type: ${insight.insightType}\n` +
                                                `Tone: ${insight.tone}\n` +
                                                `Friend: ${insight.friendName || 'Network-wide'}`
                                            );
                                        } else {
                                            // Try to trigger generation by processing last interaction
                                            const interactions = await database.get('interactions').query().fetch();
                                            if (interactions.length > 0) {
                                                const lastInteraction = interactions[interactions.length - 1] as any;
                                                await insightOrchestratorService.processInteraction(lastInteraction.id);

                                                // Check again
                                                const newInsights = await insightOrchestratorService.getActiveInsights();
                                                if (newInsights.length > 0) {
                                                    const insight = newInsights[0];
                                                    Alert.alert(
                                                        'Insight Generated!',
                                                        `${insight.opener}\n\n${insight.message}`
                                                    );
                                                } else {
                                                    Alert.alert(
                                                        'No Insight Generated',
                                                        'Insufficient signals or rate-limited. Try again later or log more interactions.'
                                                    );
                                                }
                                            } else {
                                                Alert.alert('No Interactions', 'Log some weaves first!');
                                            }
                                        }
                                    } catch (error) {
                                        console.error('Insight test failed:', error);
                                        Alert.alert('Error', `Insight test failed: ${error}`);
                                    }
                                }
                            }
                        ]
                    );
                }}
            />

            {/* Notification Viewer Modal */}
            <Modal
                visible={showNotificationViewer}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowNotificationViewer(false)}
            >
                <View className="flex-1" style={{ backgroundColor: colors.background }}>
                    {/* Header */}
                    <View
                        className="flex-row items-center justify-between px-5 py-4 border-b"
                        style={{ borderBottomColor: colors.border }}
                    >
                        <View>
                            <Text className="text-xl font-inter-bold" style={{ color: colors.foreground }}>
                                Scheduled Notifications
                            </Text>
                            <Text className="text-sm font-inter-regular mt-1" style={{ color: colors['muted-foreground'] }}>
                                {scheduledNotifications.length} notification{scheduledNotifications.length !== 1 ? 's' : ''} pending
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => setShowNotificationViewer(false)}
                            className="w-10 h-10 items-center justify-center rounded-full"
                            style={{ backgroundColor: colors.muted }}
                        >
                            <X size={20} color={colors.foreground} />
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    <ScrollView className="flex-1 px-4 py-4">
                        {scheduledNotifications.length === 0 ? (
                            <View className="items-center justify-center py-12">
                                <Bell size={48} color={colors['muted-foreground']} />
                                <Text
                                    className="text-lg font-inter-medium mt-4"
                                    style={{ color: colors['muted-foreground'] }}
                                >
                                    No notifications scheduled
                                </Text>
                                <Text
                                    className="text-sm font-inter-regular mt-1 text-center px-8"
                                    style={{ color: colors['muted-foreground'] }}
                                >
                                    Use "Reset Scheduler" to reschedule all notifications
                                </Text>
                            </View>
                        ) : (
                            <View className="gap-3">
                                {scheduledNotifications.map((notification) => {
                                    const type = (notification.content.data?.type as string) || 'unknown';
                                    const { schedule, isRepeating } = formatTriggerInfo(notification.trigger);
                                    const icon = getNotificationIcon(type);

                                    return (
                                        <View
                                            key={notification.identifier}
                                            className="rounded-2xl p-4"
                                            style={{ backgroundColor: colors.card }}
                                        >
                                            <View className="flex-row items-start gap-3">
                                                {/* Icon */}
                                                <View
                                                    className="w-12 h-12 rounded-xl items-center justify-center"
                                                    style={{ backgroundColor: colors.muted }}
                                                >
                                                    <Text className="text-2xl">{icon}</Text>
                                                </View>

                                                {/* Content */}
                                                <View className="flex-1">
                                                    <View className="flex-row items-center gap-2">
                                                        <Text
                                                            className="text-base font-inter-semibold flex-1"
                                                            style={{ color: colors.foreground }}
                                                        >
                                                            {getTypeLabel(type)}
                                                        </Text>
                                                        {isRepeating && (
                                                            <View
                                                                className="flex-row items-center gap-1 px-2 py-1 rounded-full"
                                                                style={{ backgroundColor: colors.primary + '20' }}
                                                            >
                                                                <Repeat size={12} color={colors.primary} />
                                                                <Text
                                                                    className="text-xs font-inter-medium"
                                                                    style={{ color: colors.primary }}
                                                                >
                                                                    Repeating
                                                                </Text>
                                                            </View>
                                                        )}
                                                    </View>

                                                    {/* Time - More Prominent */}
                                                    <View
                                                        className="flex-row items-center gap-2 mt-2 px-3 py-2 rounded-lg"
                                                        style={{ backgroundColor: colors.muted }}
                                                    >
                                                        <Clock size={18} color={colors.foreground} />
                                                        <Text
                                                            className="text-base font-inter-semibold"
                                                            style={{ color: colors.foreground }}
                                                        >
                                                            {schedule}
                                                        </Text>
                                                    </View>

                                                    <Text
                                                        className="text-xs font-inter-regular mt-2 font-mono"
                                                        style={{ color: colors['muted-foreground'], opacity: 0.7 }}
                                                        numberOfLines={1}
                                                    >
                                                        ID: {notification.identifier}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        )}
                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
};
