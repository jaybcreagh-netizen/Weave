import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { database } from '@/db';
import JournalEntry from '@/db/models/JournalEntry';
import JournalEntryFriend from '@/db/models/JournalEntryFriend';
import { Q } from '@nozbe/watermelondb';
import { Calendar, Heart, UserPlus, Sparkles, ArrowRight } from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';

import { SmartAction } from '@/modules/oracle/services/types';
import { trackEvent, AnalyticsEvents } from '@/shared/services/analytics.service';
import { useActionExecutor } from '@/modules/oracle/hooks/useActionExecutor';
import { useOracleSheet } from '@/modules/oracle/hooks/useOracleSheet';

// ============================================================================
// COMPONENT
// ============================================================================

const QuickActionsView = () => {
    const { colors } = useTheme();
    const { executeAction } = useActionExecutor();
    const { params } = useOracleSheet();

    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch entries - filtered by friend if in friend context
    useEffect(() => {
        const fetchEntries = async () => {
            setIsLoading(true);
            try {
                let journalEntries: JournalEntry[];

                if (params.context === 'friend' && params.friendId) {
                    // Filter by friend: 2-step query via join table
                    const links = await database
                        .get<JournalEntryFriend>('journal_entry_friends')
                        .query(Q.where('friend_id', params.friendId))
                        .fetch();

                    const entryIds = links.map(link => link.journalEntryId);

                    if (entryIds.length > 0) {
                        journalEntries = await database
                            .get<JournalEntry>('journal_entries')
                            .query(
                                Q.where('id', Q.oneOf(entryIds)),
                                Q.sortBy('entry_date', Q.desc),
                                Q.take(50)
                            )
                            .fetch();
                    } else {
                        journalEntries = [];
                    }
                } else {
                    // No friend context - fetch all recent entries
                    journalEntries = await database
                        .get<JournalEntry>('journal_entries')
                        .query(
                            Q.sortBy('entry_date', Q.desc),
                            Q.take(50)
                        )
                        .fetch();
                }

                setEntries(journalEntries);
            } catch (error) {
                console.error('[QuickActionsView] Failed to fetch entries:', error);
                setEntries([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchEntries();
    }, [params.context, params.friendId]);

    // Extract and flatten actions from fetched entries
    const allActions = useMemo(() => {
        const actions: { action: SmartAction; entry: JournalEntry }[] = [];

        entries.forEach(entry => {
            try {
                const smartActions = entry.smartActions;
                if (smartActions && Array.isArray(smartActions)) {
                    smartActions.forEach((action: SmartAction) => {
                        // Filter out low confidence if needed, for now show all > 0.6
                        if (action.confidence > 0.6) {
                            actions.push({ action, entry });
                        }
                    });
                }
            } catch (e) {
                // Ignore parsing errors
            }
        });

        // Sort by date desc (recent entries first)
        return actions.sort((a, b) => b.entry.entryDate - a.entry.entryDate);
    }, [entries]);

    React.useEffect(() => {
        // Track only when actions are loaded.
        // We use a timeout to avoid spamming if data fluctuates rapidly on strict mode mount
        const timer = setTimeout(() => {
            if (allActions.length > 0) {
                trackEvent(AnalyticsEvents.ORACLE_ACTION_DETECTED, {
                    source: 'quick_actions',
                    action_count: allActions.length,
                    types: allActions.map(a => a.action.type)
                });
            }
        }, 1000);
        return () => clearTimeout(timer);
    }, [allActions.length]);

    const handleActionPress = (item: { action: SmartAction; entry: JournalEntry }) => {
        executeAction(item.action);
    };

    const getActionIcon = (type: string) => {
        switch (type) {
            case 'mimic_plan':
            case 'schedule_event':
                return <Calendar size={20} color={colors.primary} />;
            case 'create_intention':
                return <Sparkles size={20} color={colors.primary} />;
            case 'reach_out':
                return <Heart size={20} color={colors.primary} />;
            case 'add_memory':
            case 'update_profile':
                return <UserPlus size={20} color={colors.primary} />;
            default:
                return <Sparkles size={20} color={colors.primary} />;
        }
    };

    if (isLoading) {
        return (
            <View className="flex-1 items-center justify-center p-8">
                <ActivityIndicator size="large" color={colors.primary} />
                <Text
                    className="text-center mt-4 text-sm"
                    style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                >
                    Loading actions...
                </Text>
            </View>
        );
    }

    if (allActions.length === 0) {
        const friendContext = params.context === 'friend' && params.friendName;
        return (
            <View className="flex-1 items-center justify-center p-8">
                <Sparkles size={48} color={colors.muted + '80'} />
                <Text
                    className="text-center mt-4 text-base font-medium"
                    style={{ color: colors['muted-foreground'], fontFamily: 'Inter_500Medium' }}
                >
                    No actions detected{friendContext ? ` for ${params.friendName}` : ''}.
                </Text>
                <Text
                    className="text-center mt-2 text-sm"
                    style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                >
                    {friendContext
                        ? `Journal about ${params.friendName} to generate quick actions.`
                        : 'Journal about your friends to generate quick actions.'}
                </Text>
            </View>
        );
    }

    return (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
            {allActions.map((item, index) => (
                <TouchableOpacity
                    key={`${item.entry.id}-${index}`}
                    onPress={() => handleActionPress(item)}
                    className="flex-row items-center p-4 mb-3 rounded-2xl border"
                    style={{
                        backgroundColor: colors.card,
                        borderColor: colors.border
                    }}
                >
                    <View
                        className="p-3 rounded-full mr-4"
                        style={{ backgroundColor: colors.primary + '15' }}
                    >
                        {getActionIcon(item.action.type)}
                    </View>

                    <View className="flex-1">
                        <Text
                            className="text-base font-semibold mb-1"
                            style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}
                        >
                            {item.action.label}
                        </Text>
                        <Text
                            className="text-xs"
                            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                        >
                            From: {item.entry.title || item.entry.content.substring(0, 30) + '...'} • {formatDistanceToNow(item.entry.entryDate, { addSuffix: true })}
                        </Text>
                    </View>

                    <ArrowRight size={16} color={colors['muted-foreground']} />
                </TouchableOpacity>
            ))}
        </ScrollView>
    );
};

export default QuickActionsView;
