import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, Modal, ScrollView } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { Database, Upload, Download, RefreshCw, Bug, Wrench, Eye, X } from 'lucide-react-native';
import { ModernSwitch } from '@/shared/ui/ModernSwitch';
import { AutoBackupService, BackupListSheet } from '@/modules/backup';
import { DataWipeService } from '@/modules/data-management';
import { exportAndShareData, getExportStats } from '@/modules/auth';
import { SuggestionDebugService } from '@/modules/interactions/services/suggestion-debug.service';

interface DataSettingsProps {
    onClose: () => void;
}

type SelectorInspectionReport = Awaited<ReturnType<typeof SuggestionDebugService.getSelectorInspection>>;
type SelectorExperimentConfig = Awaited<ReturnType<typeof SuggestionDebugService.getSelectorExperimentConfig>>;
type SelectorInspectionOutcomeFilter = 'all' | 'acted' | 'negative' | 'unresolved';
type SelectorInspectionSlotFilter = 'all' | 'primary' | 'secondary';
type SelectorInspectionSortMode = 'recent' | 'score' | 'outcome';
type SelectorInspectionRequestKindFilter = 'all' | 'automatic' | 'manual_pull' | 'unknown';

function formatVariantLabel(value: string): string {
    if (value === 'why-now') return 'Why Now';
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatQuietReasonLabel(value: string): string {
    switch (value) {
        case 'recently_handled':
            return 'Recently handled';
        case 'resting_pause':
            return 'Resting pause';
        case 'low_battery_pause':
            return 'Low battery pause';
        case 'budget_exhausted':
            return 'Budget exhausted';
        default:
            return formatVariantLabel(value);
    }
}

function formatRequestKindLabel(value: string): string {
    if (value === 'manual_pull') return 'Manual pull';
    return formatVariantLabel(value);
}

function formatOutcomeLabel(outcome: SelectorInspectionReport['items'][number]['outcome']): string {
    switch (outcome) {
        case 'acted':
            return 'Acted';
        case 'dismissed':
            return 'Dismissed';
        case 'snoozed':
            return 'Snoozed';
        case 'expired':
            return 'Expired';
        default:
            return 'Unresolved';
    }
}

function formatScoreBreakdown(
    scoreBreakdown: SelectorInspectionReport['items'][number]['scoreBreakdown']
): string {
    const topSignals = Object.entries(scoreBreakdown)
        .filter(([, value]) => typeof value === 'number' && value > 0)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 2);

    if (topSignals.length === 0) {
        return 'No score breakdown';
    }

    return topSignals
        .map(([key, value]) => `${key}: ${Math.round(value)}`)
        .join('  •  ');
}

function matchesOutcomeFilter(
    outcome: SelectorInspectionReport['items'][number]['outcome'],
    filter: SelectorInspectionOutcomeFilter
): boolean {
    if (filter === 'all') return true;
    if (filter === 'negative') {
        return outcome === 'dismissed' || outcome === 'snoozed' || outcome === 'expired';
    }
    return outcome === filter;
}

function getOutcomeRank(outcome: SelectorInspectionReport['items'][number]['outcome']): number {
    switch (outcome) {
        case 'acted':
            return 0;
        case 'unresolved':
            return 1;
        default:
            return 2;
    }
}

export const DataSettings: React.FC<DataSettingsProps> = ({ onClose }) => {
    const { colors } = useTheme();

    const [isImporting, setIsImporting] = useState(false);
    const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
    const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);
    const [showBackupList, setShowBackupList] = useState(false);
    const [showSelectorInspection, setShowSelectorInspection] = useState(false);
    const [isLoadingSelectorInspection, setIsLoadingSelectorInspection] = useState(false);
    const [selectorInspection, setSelectorInspection] = useState<SelectorInspectionReport | null>(null);
    const [selectorExperimentConfig, setSelectorExperimentConfig] = useState<SelectorExperimentConfig | null>(null);
    const [isSavingSelectorExperiment, setIsSavingSelectorExperiment] = useState(false);
    const [selectorOutcomeFilter, setSelectorOutcomeFilter] = useState<SelectorInspectionOutcomeFilter>('all');
    const [selectorSlotFilter, setSelectorSlotFilter] = useState<SelectorInspectionSlotFilter>('all');
    const [selectorCategoryFilter, setSelectorCategoryFilter] = useState<string>('all');
    const [selectorRequestKindFilter, setSelectorRequestKindFilter] = useState<SelectorInspectionRequestKindFilter>('all');
    const [selectorQuietReasonFilter, setSelectorQuietReasonFilter] = useState<string>('all');
    const [selectorSortMode, setSelectorSortMode] = useState<SelectorInspectionSortMode>('recent');

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

    const handleOpenSelectorInspection = async () => {
        setShowSelectorInspection(true);
        setIsLoadingSelectorInspection(true);

        try {
            const [report, experimentConfig] = await Promise.all([
                SuggestionDebugService.getSelectorInspection(50),
                SuggestionDebugService.getSelectorExperimentConfig(),
            ]);
            setSelectorInspection(report);
            setSelectorExperimentConfig(experimentConfig);
            console.log('Selector inspection:', JSON.stringify(report, null, 2));
        } catch (error) {
            setShowSelectorInspection(false);
            Alert.alert('Error', 'Failed to load selector inspection.');
            console.error(error);
        } finally {
            setIsLoadingSelectorInspection(false);
        }
    };

    const handleUpdateSelectorExperiment = async (
        partial: Partial<Omit<SelectorExperimentConfig, 'updatedAt'>>
    ) => {
        setIsSavingSelectorExperiment(true);
        try {
            const nextConfig = await SuggestionDebugService.saveSelectorExperimentConfig(partial);
            setSelectorExperimentConfig(nextConfig);
        } catch (error) {
            Alert.alert('Error', 'Failed to save selector experiment settings.');
            console.error(error);
        } finally {
            setIsSavingSelectorExperiment(false);
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

    const selectorCategories = selectorInspection
        ? ['all', ...selectorInspection.summary.byCategory.map(item => item.key)]
        : ['all'];
    const selectorRequestKinds = selectorInspection
        ? [
            'all',
            ...new Set<SelectorInspectionRequestKindFilter>(
                [
                    ...selectorInspection.summary.byRequestKind.map(item => item.key),
                    ...selectorInspection.quietEvents.map(event => event.surfaceRequestKind || 'unknown'),
                    ...selectorInspection.items.map(item => item.surfaceRequestKind || 'unknown'),
                ].map(value => (value || 'unknown') as SelectorInspectionRequestKindFilter)
            ),
        ]
        : ['all'];
    const selectorQuietReasons = selectorInspection
        ? ['all', ...selectorInspection.summary.byQuietReason.map(item => item.key)]
        : ['all'];
    const filteredSelectorItems = selectorInspection
        ? [...selectorInspection.items]
            .filter(item =>
                matchesOutcomeFilter(item.outcome, selectorOutcomeFilter)
                && (selectorSlotFilter === 'all' || item.surfaceSlot === selectorSlotFilter)
                && (selectorCategoryFilter === 'all' || item.category === selectorCategoryFilter)
                && (
                    selectorRequestKindFilter === 'all'
                    || (item.surfaceRequestKind || 'unknown') === selectorRequestKindFilter
                )
            )
            .sort((left, right) => {
                if (selectorSortMode === 'score') {
                    return (right.compositeScore || 0) - (left.compositeScore || 0)
                        || right.surfacedAt - left.surfacedAt;
                }

                if (selectorSortMode === 'outcome') {
                    return getOutcomeRank(left.outcome) - getOutcomeRank(right.outcome)
                        || (right.compositeScore || 0) - (left.compositeScore || 0)
                        || right.surfacedAt - left.surfacedAt;
                }

                return right.surfacedAt - left.surfacedAt;
            })
        : [];
    const filteredQuietEvents = selectorInspection
        ? selectorInspection.quietEvents.filter(event =>
            (selectorRequestKindFilter === 'all'
                || (event.surfaceRequestKind || 'unknown') === selectorRequestKindFilter)
            && (selectorQuietReasonFilter === 'all' || (event.quietReason || 'unknown') === selectorQuietReasonFilter)
        )
        : [];

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
                    <TouchableOpacity onPress={handleOpenSelectorInspection} className="px-3 py-2 rounded-md" style={{ backgroundColor: colors.muted }}>
                        <Eye size={18} color={colors.foreground} />
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

            <Modal
                visible={showSelectorInspection}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowSelectorInspection(false)}
            >
                <View className="flex-1" style={{ backgroundColor: colors.background }}>
                    <View
                        className="flex-row items-center justify-between px-5 py-4 border-b"
                        style={{ borderBottomColor: colors.border }}
                    >
                        <View className="flex-1 mr-4">
                            <Text className="text-xl font-inter-bold" style={{ color: colors.foreground }}>
                                Selector Inspection
                            </Text>
                            <Text className="text-sm font-inter-regular mt-1" style={{ color: colors['muted-foreground'] }}>
                                Recent surfaced suggestions, scores, and outcomes
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => setShowSelectorInspection(false)}
                            className="w-10 h-10 items-center justify-center rounded-full"
                            style={{ backgroundColor: colors.muted }}
                        >
                            <X size={20} color={colors.foreground} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="flex-1 px-4 py-4">
                        {isLoadingSelectorInspection ? (
                            <View className="items-center justify-center py-16">
                                <Eye size={40} color={colors['muted-foreground']} />
                                <Text className="text-base font-inter-medium mt-4" style={{ color: colors.foreground }}>
                                    Loading selector telemetry...
                                </Text>
                            </View>
                        ) : !selectorInspection ? (
                            <View className="items-center justify-center py-16">
                                <Bug size={40} color={colors['muted-foreground']} />
                                <Text className="text-base font-inter-medium mt-4" style={{ color: colors.foreground }}>
                                    No selector inspection loaded
                                </Text>
                            </View>
                        ) : (
                            <View className="gap-4">
                                <View className="flex-row flex-wrap gap-3">
                                    <View className="rounded-2xl px-4 py-3 min-w-[110px]" style={{ backgroundColor: colors.card }}>
                                        <Text className="text-xs font-inter-medium uppercase" style={{ color: colors['muted-foreground'] }}>
                                            Surfaced
                                        </Text>
                                        <Text className="text-2xl font-inter-bold mt-1" style={{ color: colors.foreground }}>
                                            {selectorInspection.summary.surfacedCount}
                                        </Text>
                                    </View>
                                    <View className="rounded-2xl px-4 py-3 min-w-[110px]" style={{ backgroundColor: colors.card }}>
                                        <Text className="text-xs font-inter-medium uppercase" style={{ color: colors['muted-foreground'] }}>
                                            Acted Rate
                                        </Text>
                                        <Text className="text-2xl font-inter-bold mt-1" style={{ color: colors.foreground }}>
                                            {Math.round(selectorInspection.summary.actedRate * 100)}%
                                        </Text>
                                    </View>
                                    <View className="rounded-2xl px-4 py-3 min-w-[110px]" style={{ backgroundColor: colors.card }}>
                                        <Text className="text-xs font-inter-medium uppercase" style={{ color: colors['muted-foreground'] }}>
                                            Negative
                                        </Text>
                                        <Text className="text-2xl font-inter-bold mt-1" style={{ color: colors.foreground }}>
                                            {selectorInspection.summary.negativeCount}
                                        </Text>
                                    </View>
                                    <View className="rounded-2xl px-4 py-3 min-w-[110px]" style={{ backgroundColor: colors.card }}>
                                        <Text className="text-xs font-inter-medium uppercase" style={{ color: colors['muted-foreground'] }}>
                                            Avg Score
                                        </Text>
                                        <Text className="text-2xl font-inter-bold mt-1" style={{ color: colors.foreground }}>
                                            {Math.round(selectorInspection.summary.averageCompositeScore)}
                                        </Text>
                                    </View>
                                </View>

                                <View className="rounded-2xl p-4" style={{ backgroundColor: colors.card }}>
                                    <Text className="text-base font-inter-semibold" style={{ color: colors.foreground }}>
                                        Experiment Overrides
                                    </Text>
                                    <Text className="text-sm font-inter-regular mt-1" style={{ color: colors['muted-foreground'] }}>
                                        These apply to future selector surfaces so we can tune thresholds and copy without another code change.
                                    </Text>

                                    <Text className="text-xs font-inter-semibold uppercase mt-4 mb-2" style={{ color: colors['muted-foreground'] }}>
                                        Threshold
                                    </Text>
                                    <View className="flex-row flex-wrap gap-2">
                                        {(['control', 'relaxed', 'strict'] as const).map(variant => {
                                            const isSelected = selectorExperimentConfig?.thresholdVariant === variant;
                                            return (
                                                <TouchableOpacity
                                                    key={variant}
                                                    disabled={isSavingSelectorExperiment}
                                                    onPress={() => handleUpdateSelectorExperiment({ thresholdVariant: variant })}
                                                    className="px-3 py-2 rounded-full"
                                                    style={{ backgroundColor: isSelected ? colors.primary : colors.muted }}
                                                >
                                                    <Text
                                                        className="text-xs font-inter-semibold"
                                                        style={{ color: isSelected ? colors['primary-foreground'] : colors.foreground }}
                                                    >
                                                        {formatVariantLabel(variant)}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>

                                    <Text className="text-xs font-inter-semibold uppercase mt-4 mb-2" style={{ color: colors['muted-foreground'] }}>
                                        Copy Variant
                                    </Text>
                                    <View className="flex-row flex-wrap gap-2">
                                        {(['control', 'concise', 'why-now', 'premium'] as const).map(variant => {
                                            const isSelected = selectorExperimentConfig?.copyVariant === variant;
                                            return (
                                                <TouchableOpacity
                                                    key={variant}
                                                    disabled={isSavingSelectorExperiment}
                                                    onPress={() => handleUpdateSelectorExperiment({ copyVariant: variant })}
                                                    className="px-3 py-2 rounded-full"
                                                    style={{ backgroundColor: isSelected ? colors.primary : colors.muted }}
                                                >
                                                    <Text
                                                        className="text-xs font-inter-semibold"
                                                        style={{ color: isSelected ? colors['primary-foreground'] : colors.foreground }}
                                                    >
                                                        {formatVariantLabel(variant)}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>

                                    {isSavingSelectorExperiment && (
                                        <Text className="text-xs font-inter-regular mt-3" style={{ color: colors['muted-foreground'] }}>
                                            Saving experiment settings...
                                        </Text>
                                    )}
                                </View>

                                <View className="rounded-2xl p-4" style={{ backgroundColor: colors.card }}>
                                    <Text className="text-base font-inter-semibold" style={{ color: colors.foreground }}>
                                        Top Buckets
                                    </Text>
                                    <Text className="text-sm font-inter-regular mt-1" style={{ color: colors['muted-foreground'] }}>
                                        Categories: {selectorInspection.summary.byCategory.slice(0, 3).map(item => `${item.key} (${item.surfaced})`).join(', ') || 'None'}
                                    </Text>
                                    <Text className="text-sm font-inter-regular mt-1" style={{ color: colors['muted-foreground'] }}>
                                        Slots: {selectorInspection.summary.bySurfaceSlot.map(item => `${item.key} (${item.surfaced})`).join(', ') || 'None'}
                                    </Text>
                                </View>

                                <View className="rounded-2xl p-4" style={{ backgroundColor: colors.card }}>
                                    <Text className="text-base font-inter-semibold" style={{ color: colors.foreground }}>
                                        Experiment Performance
                                    </Text>
                                    <Text className="text-sm font-inter-regular mt-1" style={{ color: colors['muted-foreground'] }}>
                                        Threshold: {selectorInspection.summary.byThresholdVariant
                                            .filter(item => item.key !== 'unknown')
                                            .map(item => `${formatVariantLabel(item.key)} ${Math.round(item.actedRate * 100)}% (${item.surfaced})`)
                                            .join(', ') || 'No selector experiment history yet'}
                                    </Text>
                                    <Text className="text-sm font-inter-regular mt-1" style={{ color: colors['muted-foreground'] }}>
                                        Copy: {selectorInspection.summary.byCopyVariant
                                            .filter(item => item.key !== 'unknown')
                                            .map(item => `${formatVariantLabel(item.key)} ${Math.round(item.actedRate * 100)}% (${item.surfaced})`)
                                            .join(', ') || 'No selector experiment history yet'}
                                    </Text>
                                    <Text className="text-sm font-inter-regular mt-1" style={{ color: colors['muted-foreground'] }}>
                                        Request kind: {selectorInspection.summary.byRequestKind
                                            .filter(item => item.key !== 'unknown')
                                            .map(item => `${formatRequestKindLabel(item.key)} ${Math.round(item.actedRate * 100)}% (${item.surfaced})`)
                                            .join(', ') || 'No request-kind history yet'}
                                    </Text>
                                </View>

                                <View className="rounded-2xl p-4" style={{ backgroundColor: colors.card }}>
                                    <Text className="text-base font-inter-semibold" style={{ color: colors.foreground }}>
                                        Pacing Decisions
                                    </Text>
                                    <Text className="text-sm font-inter-regular mt-1" style={{ color: colors['muted-foreground'] }}>
                                        Quiet displays: {selectorInspection.summary.quietCount}
                                    </Text>
                                    <Text className="text-sm font-inter-regular mt-1" style={{ color: colors['muted-foreground'] }}>
                                        Quiet reasons: {selectorInspection.summary.byQuietReason
                                            .map(item => `${formatQuietReasonLabel(item.key)} (${item.count})`)
                                            .join(', ') || 'No quiet decisions logged yet'}
                                    </Text>
                                </View>

                                <View className="rounded-2xl p-4" style={{ backgroundColor: colors.card }}>
                                    <Text className="text-base font-inter-semibold mb-3" style={{ color: colors.foreground }}>
                                        Inspection Filters
                                    </Text>

                                    <Text className="text-xs font-inter-semibold uppercase mb-2" style={{ color: colors['muted-foreground'] }}>
                                        Outcome
                                    </Text>
                                    <View className="flex-row flex-wrap gap-2">
                                        {(['all', 'acted', 'negative', 'unresolved'] as const).map(filter => {
                                            const isSelected = selectorOutcomeFilter === filter;
                                            return (
                                                <TouchableOpacity
                                                    key={filter}
                                                    onPress={() => setSelectorOutcomeFilter(filter)}
                                                    className="px-3 py-2 rounded-full"
                                                    style={{ backgroundColor: isSelected ? colors.primary : colors.muted }}
                                                >
                                                    <Text
                                                        className="text-xs font-inter-semibold"
                                                        style={{ color: isSelected ? colors['primary-foreground'] : colors.foreground }}
                                                    >
                                                        {formatVariantLabel(filter)}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>

                                    <Text className="text-xs font-inter-semibold uppercase mt-4 mb-2" style={{ color: colors['muted-foreground'] }}>
                                        Slot
                                    </Text>
                                    <View className="flex-row flex-wrap gap-2">
                                        {(['all', 'primary', 'secondary'] as const).map(filter => {
                                            const isSelected = selectorSlotFilter === filter;
                                            return (
                                                <TouchableOpacity
                                                    key={filter}
                                                    onPress={() => setSelectorSlotFilter(filter)}
                                                    className="px-3 py-2 rounded-full"
                                                    style={{ backgroundColor: isSelected ? colors.primary : colors.muted }}
                                                >
                                                    <Text
                                                        className="text-xs font-inter-semibold"
                                                        style={{ color: isSelected ? colors['primary-foreground'] : colors.foreground }}
                                                    >
                                                        {formatVariantLabel(filter)}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>

                                    <Text className="text-xs font-inter-semibold uppercase mt-4 mb-2" style={{ color: colors['muted-foreground'] }}>
                                        Category
                                    </Text>
                                    <View className="flex-row flex-wrap gap-2">
                                        {selectorCategories.map(category => {
                                            const isSelected = selectorCategoryFilter === category;
                                            return (
                                                <TouchableOpacity
                                                    key={category}
                                                    onPress={() => setSelectorCategoryFilter(category)}
                                                    className="px-3 py-2 rounded-full"
                                                    style={{ backgroundColor: isSelected ? colors.primary : colors.muted }}
                                                >
                                                    <Text
                                                        className="text-xs font-inter-semibold"
                                                        style={{ color: isSelected ? colors['primary-foreground'] : colors.foreground }}
                                                    >
                                                        {category === 'all' ? 'All' : category}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>

                                    <Text className="text-xs font-inter-semibold uppercase mt-4 mb-2" style={{ color: colors['muted-foreground'] }}>
                                        Request Kind
                                    </Text>
                                    <View className="flex-row flex-wrap gap-2">
                                        {selectorRequestKinds.map(filter => {
                                            const isSelected = selectorRequestKindFilter === filter;
                                            return (
                                                <TouchableOpacity
                                                    key={filter}
                                                    onPress={() => setSelectorRequestKindFilter(filter as SelectorInspectionRequestKindFilter)}
                                                    className="px-3 py-2 rounded-full"
                                                    style={{ backgroundColor: isSelected ? colors.primary : colors.muted }}
                                                >
                                                    <Text
                                                        className="text-xs font-inter-semibold"
                                                        style={{ color: isSelected ? colors['primary-foreground'] : colors.foreground }}
                                                    >
                                                        {filter === 'all' ? 'All' : formatRequestKindLabel(filter)}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>

                                    <Text className="text-xs font-inter-semibold uppercase mt-4 mb-2" style={{ color: colors['muted-foreground'] }}>
                                        Quiet Reason
                                    </Text>
                                    <View className="flex-row flex-wrap gap-2">
                                        {selectorQuietReasons.map(filter => {
                                            const isSelected = selectorQuietReasonFilter === filter;
                                            return (
                                                <TouchableOpacity
                                                    key={filter}
                                                    onPress={() => setSelectorQuietReasonFilter(filter)}
                                                    className="px-3 py-2 rounded-full"
                                                    style={{ backgroundColor: isSelected ? colors.primary : colors.muted }}
                                                >
                                                    <Text
                                                        className="text-xs font-inter-semibold"
                                                        style={{ color: isSelected ? colors['primary-foreground'] : colors.foreground }}
                                                    >
                                                        {filter === 'all' ? 'All' : formatQuietReasonLabel(filter)}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>

                                    <Text className="text-xs font-inter-semibold uppercase mt-4 mb-2" style={{ color: colors['muted-foreground'] }}>
                                        Sort
                                    </Text>
                                    <View className="flex-row flex-wrap gap-2">
                                        {([
                                            ['recent', 'Recent'],
                                            ['score', 'Score'],
                                            ['outcome', 'Outcome'],
                                        ] as const).map(([mode, label]) => {
                                            const isSelected = selectorSortMode === mode;
                                            return (
                                                <TouchableOpacity
                                                    key={mode}
                                                    onPress={() => setSelectorSortMode(mode)}
                                                    className="px-3 py-2 rounded-full"
                                                    style={{ backgroundColor: isSelected ? colors.primary : colors.muted }}
                                                >
                                                    <Text
                                                        className="text-xs font-inter-semibold"
                                                        style={{ color: isSelected ? colors['primary-foreground'] : colors.foreground }}
                                                    >
                                                        {label}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>

                                <View>
                                    <Text className="text-base font-inter-semibold mb-3" style={{ color: colors.foreground }}>
                                        Recent Quiet Decisions ({filteredQuietEvents.length} of {selectorInspection.quietEvents.length})
                                    </Text>

                                    {filteredQuietEvents.length === 0 ? (
                                        <View className="rounded-2xl p-6 items-center" style={{ backgroundColor: colors.card }}>
                                            <Text className="text-base font-inter-medium" style={{ color: colors.foreground }}>
                                                No quiet decisions match these filters
                                            </Text>
                                            <Text className="text-sm font-inter-regular mt-1 text-center" style={{ color: colors['muted-foreground'] }}>
                                                Adjust the filters above or wait for more quiet states to be logged from Focus.
                                            </Text>
                                        </View>
                                    ) : (
                                        <View className="gap-3">
                                            {filteredQuietEvents.map(event => (
                                                <View
                                                    key={`${event.opportunityPoolId}-${event.timestamp}`}
                                                    className="rounded-2xl p-4"
                                                    style={{ backgroundColor: colors.card }}
                                                >
                                                    <View className="flex-row items-start justify-between gap-3">
                                                        <View className="flex-1">
                                                            <Text className="text-base font-inter-semibold" style={{ color: colors.foreground }}>
                                                                {formatQuietReasonLabel(event.quietReason || 'unknown')}
                                                            </Text>
                                                            <Text className="text-sm font-inter-regular mt-1" style={{ color: colors['muted-foreground'] }}>
                                                                {new Date(event.timestamp).toLocaleString()}
                                                            </Text>
                                                        </View>
                                                        <View className="px-3 py-1 rounded-full" style={{ backgroundColor: `${colors.primary}20` }}>
                                                            <Text className="text-xs font-inter-semibold" style={{ color: colors.primary }}>
                                                                Quiet
                                                            </Text>
                                                        </View>
                                                    </View>

                                                    <View className="flex-row flex-wrap gap-2 mt-3">
                                                        {!!event.surfaceRequestKind && (
                                                            <View className="px-3 py-1 rounded-full" style={{ backgroundColor: colors.muted }}>
                                                                <Text className="text-xs font-inter-medium" style={{ color: colors.foreground }}>
                                                                    {formatRequestKindLabel(event.surfaceRequestKind)}
                                                                </Text>
                                                            </View>
                                                        )}
                                                        {!!event.thresholdVariant && (
                                                            <View className="px-3 py-1 rounded-full" style={{ backgroundColor: colors.muted }}>
                                                                <Text className="text-xs font-inter-medium" style={{ color: colors.foreground }}>
                                                                    {formatVariantLabel(event.thresholdVariant)}
                                                                </Text>
                                                            </View>
                                                        )}
                                                            {!!event.copyVariant && (
                                                                <View className="px-3 py-1 rounded-full" style={{ backgroundColor: colors.muted }}>
                                                                    <Text className="text-xs font-inter-medium" style={{ color: colors.foreground }}>
                                                                        {formatVariantLabel(event.copyVariant)}
                                                                    </Text>
                                                            </View>
                                                        )}
                                                    </View>

                                                    {!!event.pacingSnapshot && (
                                                        <Text className="text-xs font-inter-regular mt-3" style={{ color: colors['muted-foreground'] }}>
                                                            {[
                                                                event.pacingSnapshot.season ? `Season ${event.pacingSnapshot.season}` : null,
                                                                typeof event.pacingSnapshot.dailyFreshBudget === 'number'
                                                                    ? `Budget ${event.pacingSnapshot.budgetRemaining}/${event.pacingSnapshot.dailyFreshBudget} left`
                                                                    : null,
                                                                typeof event.pacingSnapshot.actedToday === 'number'
                                                                    ? `Acted ${event.pacingSnapshot.actedToday} today`
                                                                    : null,
                                                                event.pacingSnapshot.adaptiveReasons?.length
                                                                    ? `Adaptive ${event.pacingSnapshot.adaptiveReasons.map(formatVariantLabel).join(', ')}`
                                                                    : null,
                                                            ].filter(Boolean).join('  •  ')}
                                                        </Text>
                                                    )}
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </View>

                                <View>
                                    <Text className="text-base font-inter-semibold mb-3" style={{ color: colors.foreground }}>
                                        Recent Selector Surfaces ({filteredSelectorItems.length} of {selectorInspection.items.length})
                                    </Text>

                                    {filteredSelectorItems.length === 0 ? (
                                        <View className="rounded-2xl p-6 items-center" style={{ backgroundColor: colors.card }}>
                                            <Text className="text-base font-inter-medium" style={{ color: colors.foreground }}>
                                                No selector surfaces match these filters
                                            </Text>
                                            <Text className="text-sm font-inter-regular mt-1 text-center" style={{ color: colors['muted-foreground'] }}>
                                                Adjust the filters above or wait for more Focus and notification surfaces to be logged.
                                            </Text>
                                        </View>
                                    ) : (
                                        <View className="gap-3">
                                            {filteredSelectorItems.map(item => {
                                                const outcomeColor = item.outcome === 'acted'
                                                    ? colors.primary
                                                    : item.outcome === 'unresolved'
                                                        ? colors['muted-foreground']
                                                        : colors.destructive;

                                                return (
                                                    <View
                                                        key={`${item.opportunityPoolId}-${item.surfacedAt}`}
                                                        className="rounded-2xl p-4"
                                                        style={{ backgroundColor: colors.card }}
                                                    >
                                                        <View className="flex-row items-start justify-between gap-3">
                                                            <View className="flex-1">
                                                                <Text className="text-base font-inter-semibold" style={{ color: colors.foreground }}>
                                                                    {item.presentationCopy?.title || item.friendName || item.opportunityId || 'Untitled suggestion'}
                                                                </Text>
                                                                {!!item.presentationCopy?.subtitle && (
                                                                    <Text className="text-sm font-inter-regular mt-1" style={{ color: colors['muted-foreground'] }}>
                                                                        {item.presentationCopy.subtitle}
                                                                    </Text>
                                                                )}
                                                            </View>
                                                            <View
                                                                className="px-3 py-1 rounded-full"
                                                                style={{ backgroundColor: `${outcomeColor}20` }}
                                                            >
                                                                <Text className="text-xs font-inter-semibold" style={{ color: outcomeColor }}>
                                                                    {formatOutcomeLabel(item.outcome)}
                                                                </Text>
                                                            </View>
                                                        </View>

                                                        <View className="flex-row flex-wrap gap-2 mt-3">
                                                            <View className="px-3 py-1 rounded-full" style={{ backgroundColor: colors.muted }}>
                                                                <Text className="text-xs font-inter-medium" style={{ color: colors.foreground }}>
                                                                    {item.surfaceSlot}
                                                                </Text>
                                                            </View>
                                                            {!!item.category && (
                                                                <View className="px-3 py-1 rounded-full" style={{ backgroundColor: colors.muted }}>
                                                                    <Text className="text-xs font-inter-medium" style={{ color: colors.foreground }}>
                                                                        {item.category}
                                                                    </Text>
                                                                </View>
                                                            )}
                                                            {!!item.thresholdVariant && (
                                                                <View className="px-3 py-1 rounded-full" style={{ backgroundColor: colors.muted }}>
                                                                    <Text className="text-xs font-inter-medium" style={{ color: colors.foreground }}>
                                                                        {formatVariantLabel(item.thresholdVariant)}
                                                                    </Text>
                                                                </View>
                                                            )}
                                                            {!!item.copyVariant && (
                                                                <View className="px-3 py-1 rounded-full" style={{ backgroundColor: colors.muted }}>
                                                                    <Text className="text-xs font-inter-medium" style={{ color: colors.foreground }}>
                                                                        {formatVariantLabel(item.copyVariant)}
                                                                    </Text>
                                                                </View>
                                                            )}
                                                            {!!item.surfaceRequestKind && (
                                                                <View className="px-3 py-1 rounded-full" style={{ backgroundColor: colors.muted }}>
                                                                    <Text className="text-xs font-inter-medium" style={{ color: colors.foreground }}>
                                                                        {formatRequestKindLabel(item.surfaceRequestKind)}
                                                                    </Text>
                                                                </View>
                                                            )}
                                                            {typeof item.compositeScore === 'number' && (
                                                                <View className="px-3 py-1 rounded-full" style={{ backgroundColor: colors.muted }}>
                                                                    <Text className="text-xs font-inter-medium" style={{ color: colors.foreground }}>
                                                                        Score {Math.round(item.compositeScore)}
                                                                    </Text>
                                                                </View>
                                                            )}
                                                        </View>

                                                        <Text className="text-xs font-inter-regular mt-3" style={{ color: colors['muted-foreground'] }}>
                                                            {formatScoreBreakdown(item.scoreBreakdown)}
                                                        </Text>

                                                        <Text className="text-xs font-inter-regular mt-2" style={{ color: colors['muted-foreground'] }}>
                                                            Surfaced {new Date(item.surfacedAt).toLocaleString()}
                                                            {item.outcomeAt ? ` • Resolved ${new Date(item.outcomeAt).toLocaleString()}` : ''}
                                                        </Text>

                                                        {!!item.presentationCopy?.reason && (
                                                            <Text className="text-xs font-inter-regular mt-2" style={{ color: colors['muted-foreground'] }}>
                                                                Why shown: {item.presentationCopy.reason}
                                                            </Text>
                                                        )}
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
};
