
import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { database } from '@/db';
import JournalEntry from '@/db/models/JournalEntry';
import { Q } from '@nozbe/watermelondb';
import { withObservables } from '@nozbe/watermelondb/react';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Calendar, Heart, UserPlus, Sparkles, ArrowRight } from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';

import { SmartAction } from '@/modules/oracle/services/types';
import { trackEvent, AnalyticsEvents } from '@/shared/services/analytics.service';
import { useActionExecutor } from '@/modules/oracle/hooks/useActionExecutor';

interface QuickActionsViewProps {
    entries: JournalEntry[];
}

// ============================================================================
// COMPONENT
// ============================================================================

const QuickActionsView = ({ entries }: QuickActionsViewProps) => {
    const { colors } = useTheme();
    const router = useRouter();
    const { executeAction } = useActionExecutor();

    // Extract and flatten actions from recent entries
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
            case 'update_profile':
                return <UserPlus size={20} color={colors.primary} />;
            default:
                return <Sparkles size={20} color={colors.primary} />;
        }
    };

    if (allActions.length === 0) {
        return (
            <View className="flex-1 items-center justify-center p-8">
                <Sparkles size={48} color={colors.muted + '80'} />
                <Text
                    className="text-center mt-4 text-base font-medium"
                    style={{ color: colors['muted-foreground'], fontFamily: 'Inter_500Medium' }}
                >
                    No manual actions detected yet.
                </Text>
                <Text
                    className="text-center mt-2 text-sm"
                    style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                >
                    Journal about your friends to generate quick actions.
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

// Enhance with WatermelonDB Observables
const enhance = withObservables([], () => ({
    entries: database.get<JournalEntry>('journal_entries')
        .query(
            // Fetch entries that MIGHT have smart actions (optimization: check mostly recent ones?)
            // For now, fetch last 20 entries to scan for actions
            Q.sortBy('entry_date', Q.desc),
            Q.take(50)
        ),
}));

export default enhance(QuickActionsView);
