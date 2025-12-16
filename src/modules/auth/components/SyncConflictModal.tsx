import React from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { useSyncConflict } from '../context/SyncConflictContext';
import { AlertTriangle, Server, Smartphone } from 'lucide-react-native';
import { StandardBottomSheet } from '@/shared/ui/Sheet';
import { Text } from '@/shared/ui/Text';

export function SyncConflictModal() {
    const { colors } = useTheme();
    const { conflicts, isModalOpen, resolveConflict } = useSyncConflict();

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

    // Note: onClose is empty to prevent closing without resolution
    return (
        <StandardBottomSheet
            visible={isModalOpen}
            onClose={() => { }} // Prevent closing without resolution
            height="full"
            title="Sync Conflict Detected"
        >
            <View className="items-center p-5 pb-2.5">
                <View
                    className="w-12 h-12 rounded-full items-center justify-center mb-3"
                    style={{ backgroundColor: colors.destructive + '20' }}
                >
                    <AlertTriangle size={24} color={colors.destructive} />
                </View>
                <Text variant="caption" className="text-muted-foreground">
                    Table: {tableName} • ID: {currentConflict.id.substring(0, 8)}...
                </Text>
            </View>

            <ScrollView className="flex-1 p-5">
                <Text variant="body" className="text-center mb-6 leading-6">
                    The server has a newer version of this record than your device. Which version would you like to keep?
                </Text>

                {diffs.length > 0 ? (
                    diffs.map((diff) => (
                        <View key={diff.key} className="mb-4 border border-border rounded-xl overflow-hidden">
                            <Text
                                variant="caption"
                                className="uppercase tracking-widest p-2 pl-3 bg-muted/30 text-muted-foreground"
                            >
                                {diff.key}
                            </Text>
                            <View className="flex-row">
                                <View className="flex-1 p-3">
                                    <View className="flex-row items-center mb-1">
                                        <Smartphone size={12} color={colors.primary} />
                                        <Text variant="caption" className="font-bold ml-1 text-primary">Local</Text>
                                    </View>
                                    <Text variant="body" className="text-sm">
                                        {JSON.stringify(diff.local)}
                                    </Text>
                                </View>
                                <View className="w-px bg-border" />
                                <View className="flex-1 p-3">
                                    <View className="flex-row items-center mb-1">
                                        <Server size={12} color={colors.secondary} />
                                        <Text variant="caption" className="font-bold ml-1 text-secondary">Server</Text>
                                    </View>
                                    <Text variant="body" className="text-sm">
                                        {JSON.stringify(diff.server)}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    ))
                ) : (
                    <Text variant="body" className="text-muted-foreground text-center mt-5">
                        No visible differences found (metadata only).
                    </Text>
                )}
            </ScrollView>

            <View className="p-5 border-t border-border flex-row gap-3">
                <TouchableOpacity
                    className="flex-1 flex-row h-[50px] rounded-xl items-center justify-center bg-card border border-border"
                    onPress={handleKeepLocal}
                >
                    <Smartphone size={20} color={colors.foreground} style={{ marginRight: 8 }} />
                    <Text variant="body" className="font-semibold">Keep Mine</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    className="flex-1 flex-row h-[50px] rounded-xl items-center justify-center"
                    style={{ backgroundColor: colors.primary }}
                    onPress={handleKeepServer}
                >
                    <Server size={20} color={colors['primary-foreground']} style={{ marginRight: 8 }} />
                    <Text variant="body" className="font-semibold text-primary-foreground">Accept Theirs</Text>
                </TouchableOpacity>
            </View>

            <View className="items-center pb-2.5">
                <Text variant="caption" className="text-muted-foreground text-xs">
                    {conflicts.length > 1 ? `${conflicts.length - 1} more conflicts waiting` : 'Last conflict'}
                </Text>
            </View>
        </StandardBottomSheet>
    );
}
