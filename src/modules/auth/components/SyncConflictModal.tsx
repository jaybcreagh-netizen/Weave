import React from 'react';
import { Modal, View, Text, TouchableOpacity, SafeAreaView, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { useSyncConflictStore } from '../store/sync-conflict.store';
import { AlertTriangle, Check, X, Server, Smartphone } from 'lucide-react-native';

export function SyncConflictModal() {
    const { colors } = useTheme();
    const { conflicts, isModalOpen, resolveConflict } = useSyncConflictStore();

    if (!isModalOpen || conflicts.length === 0) {
        return null;
    }

    const currentConflict = conflicts[0];
    const { localRecord, serverRecord, tableName } = currentConflict;

    const handleKeepLocal = async () => {
        await currentConflict.resolve('keep_local');
        resolveConflict(currentConflict.id);
    };

    const handleKeepServer = async () => {
        await currentConflict.resolve('keep_server');
        resolveConflict(currentConflict.id);
    };

    // Helper to compare fields
    const getDiffFields = () => {
        const diffs: { key: string; local: any; server: any }[] = [];
        const localRaw = (localRecord as any)._raw;

        // Simple snake_case to camelCase conversion for comparison if needed, 
        // but here we compare based on what we know.
        // Actually, let's just iterate server keys and compare with local
        // We need to handle the snake_case vs camelCase mapping if we want to be precise,
        // but for now let's just show the raw values that differ.

        // A better approach might be to just show the relevant fields.
        // Let's try to map server keys to local keys using a simple heuristic or just display them side-by-side.

        Object.keys(serverRecord).forEach(key => {
            if (['id', 'user_id', 'created_at', 'updated_at', 'server_updated_at', 'sync_status', 'synced_at'].includes(key)) {
                return;
            }

            // Convert snake to camel for local lookup
            const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
            const localValue = localRaw[camelKey] !== undefined ? localRaw[camelKey] : localRaw[key]; // Fallback
            const serverValue = serverRecord[key];

            if (JSON.stringify(localValue) !== JSON.stringify(serverValue)) {
                diffs.push({
                    key: camelKey, // Use readable key
                    local: localValue,
                    server: serverValue
                });
            }
        });

        return diffs;
    };

    const diffs = getDiffFields();

    return (
        <Modal
            visible={isModalOpen}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => { }} // Prevent closing without resolution
        >
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.header}>
                    <View style={[styles.iconContainer, { backgroundColor: colors.destructive + '20' }]}>
                        <AlertTriangle size={24} color={colors.destructive} />
                    </View>
                    <Text style={[styles.title, { color: colors.foreground }]}>
                        Sync Conflict Detected
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.muted }]}>
                        Table: {tableName} • ID: {currentConflict.id.substring(0, 8)}...
                    </Text>
                </View>

                <ScrollView style={styles.content}>
                    <Text style={[styles.instruction, { color: colors.foreground }]}>
                        The server has a newer version of this record than your device. Which version would you like to keep?
                    </Text>

                    {diffs.length > 0 ? (
                        diffs.map((diff) => (
                            <View key={diff.key} style={[styles.diffRow, { borderColor: colors.border }]}>
                                <Text style={[styles.diffLabel, { color: colors.muted }]}>{diff.key}</Text>
                                <View style={styles.diffValues}>
                                    <View style={styles.diffValueContainer}>
                                        <View style={styles.diffHeader}>
                                            <Smartphone size={12} color={colors.primary} />
                                            <Text style={[styles.diffHeaderLabel, { color: colors.primary }]}>Local</Text>
                                        </View>
                                        <Text style={[styles.diffValue, { color: colors.foreground }]}>
                                            {JSON.stringify(diff.local)}
                                        </Text>
                                    </View>
                                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                                    <View style={styles.diffValueContainer}>
                                        <View style={styles.diffHeader}>
                                            <Server size={12} color={colors.secondary} />
                                            <Text style={[styles.diffHeaderLabel, { color: colors.secondary }]}>Server</Text>
                                        </View>
                                        <Text style={[styles.diffValue, { color: colors.foreground }]}>
                                            {JSON.stringify(diff.server)}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        ))
                    ) : (
                        <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 20 }}>
                            No visible differences found (metadata only).
                        </Text>
                    )}
                </ScrollView>

                <View style={[styles.footer, { borderTopColor: colors.border }]}>
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
                        onPress={handleKeepLocal}
                    >
                        <Smartphone size={20} color={colors.foreground} style={{ marginRight: 8 }} />
                        <Text style={[styles.buttonText, { color: colors.foreground }]}>Keep Mine</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: colors.primary }]}
                        onPress={handleKeepServer}
                    >
                        <Server size={20} color={colors['primary-foreground']} style={{ marginRight: 8 }} />
                        <Text style={[styles.buttonText, { color: colors['primary-foreground'] }]}>Accept Theirs</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.queueInfo}>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                        {conflicts.length > 1 ? `${conflicts.length - 1} more conflicts waiting` : 'Last conflict'}
                    </Text>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        alignItems: 'center',
        padding: 20,
        paddingBottom: 10,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    instruction: {
        fontSize: 16,
        marginBottom: 24,
        textAlign: 'center',
        lineHeight: 22,
    },
    diffRow: {
        marginBottom: 16,
        borderWidth: 1,
        borderRadius: 12,
        overflow: 'hidden',
    },
    diffLabel: {
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: 1,
        padding: 8,
        paddingLeft: 12,
        backgroundColor: 'rgba(0,0,0,0.03)',
    },
    diffValues: {
        flexDirection: 'row',
    },
    diffValueContainer: {
        flex: 1,
        padding: 12,
    },
    diffHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    diffHeaderLabel: {
        fontSize: 10,
        fontWeight: 'bold',
        marginLeft: 4,
    },
    diffValue: {
        fontSize: 14,
    },
    divider: {
        width: 1,
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
        flexDirection: 'row',
        gap: 12,
    },
    button: {
        flex: 1,
        flexDirection: 'row',
        height: 50,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    queueInfo: {
        alignItems: 'center',
        paddingBottom: 10,
    }
});
