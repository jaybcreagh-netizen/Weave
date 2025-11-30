import React from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { X, Calendar, Sparkles, CheckCircle2, Lightbulb } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { ListItem } from '@/components/ui/ListItem';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { WidgetHeader } from '@/components/ui/WidgetHeader';
import Interaction from '@/db/models/Interaction';
import { Suggestion } from '@/shared/types/common';
import FriendModel from '@/db/models/Friend';
import { format } from 'date-fns';
import { calculateWeeklySummary } from '@/modules/reflection/services/weekly-stats.service';
import { generateContextualPrompts, selectBestPrompt, ContextualPrompt } from '@/modules/reflection/services/contextual-prompts.service';

interface UpcomingDate {
    friend: FriendModel;
    type: 'birthday' | 'anniversary' | 'life_event';
    daysUntil: number;
    title?: string;
    importance?: 'low' | 'medium' | 'high' | 'critical';
}

interface FocusDetailSheetProps {
    isVisible: boolean;
    onClose: () => void;
    plans: Interaction[];
    suggestions: Suggestion[];
    upcomingDates: UpcomingDate[];
    friends: FriendModel[];
    onConfirmPlan: (id: string) => void;
    onReschedulePlan: (plan: Interaction) => void;
    onSuggestionAction: (suggestion: Suggestion) => void;
}

export const FocusDetailSheet: React.FC<FocusDetailSheetProps> = ({
    isVisible,
    onClose,
    plans,
    suggestions,
    upcomingDates,
    friends,
    onConfirmPlan,
    onReschedulePlan,
    onSuggestionAction,
}) => {
    const { tokens, typography, spacing, isDarkMode } = useTheme();
    const [planFriendIds, setPlanFriendIds] = React.useState<Record<string, string[]>>({});
    const [prompt, setPrompt] = React.useState<ContextualPrompt | null>(null);

    React.useEffect(() => {
        let isMounted = true;
        const loadFriends = async () => {
            const newMap: Record<string, string[]> = {};
            for (const plan of plans) {
                try {
                    const iFriends = await plan.interactionFriends.fetch();
                    newMap[plan.id] = iFriends.map((f: any) => f.friendId);
                } catch (e) {
                    console.error('Error loading plan friends:', e);
                }
            }
            if (isMounted) setPlanFriendIds(newMap);
        };
        loadFriends();
        return () => { isMounted = false; };
    }, [plans]);

    React.useEffect(() => {
        let isMounted = true;
        const loadPrompt = async () => {
            try {
                const summary = await calculateWeeklySummary();
                const prompts = generateContextualPrompts(summary);
                const bestPrompt = selectBestPrompt(prompts);
                if (isMounted) setPrompt(bestPrompt);
            } catch (error) {
                console.error('Error loading reflection prompt:', error);
            }
        };
        if (isVisible) {
            loadPrompt();
        }
        return () => { isMounted = false; };
    }, [isVisible]);

    if (!isVisible) return null;

    const getFriendName = (plan: Interaction) => {
        return plan.title;
    };

    return (
        <Modal
            visible={isVisible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <BlurView intensity={isDarkMode ? 40 : 20} style={StyleSheet.absoluteFill} />
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />

                <View style={[styles.sheet, { backgroundColor: tokens.backgroundElevated }]}>
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: tokens.foreground, fontFamily: typography.fonts.serifBold }]}>
                            Today's Focus
                        </Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <X size={24} color={tokens.foregroundMuted} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={styles.content}>
                        {/* Reflection Prompt */}
                        {prompt && (
                            <View style={[styles.promptContainer, { backgroundColor: tokens.primary + '10', borderColor: tokens.primary + '20' }]}>
                                <View style={styles.promptHeader}>
                                    <Lightbulb size={16} color={tokens.primary} />
                                    <Text style={[styles.promptLabel, { color: tokens.primary, fontFamily: typography.fonts.sansSemiBold }]}>
                                        REFLECTION
                                    </Text>
                                </View>
                                <Text style={[styles.promptText, { color: tokens.foreground, fontFamily: typography.fonts.serif }]}>
                                    {prompt.prompt}
                                </Text>
                            </View>
                        )}

                        {/* Plans Section */}
                        {plans.length > 0 && (
                            <View style={styles.section}>
                                <WidgetHeader title="Plans" icon={<Calendar size={20} color={tokens.primaryMuted} />} />
                                <Card padding="none">
                                    {plans.map((plan, index) => {
                                        const friendIds = planFriendIds[plan.id] || [];
                                        const planFriends = friends.filter(f => friendIds.includes(f.id));
                                        const friendName = planFriends.length > 0 ? planFriends[0].name : '';
                                        const subtitle = `${friendName ? `with ${friendName} • ` : ''}${format(new Date(plan.interactionDate), 'h:mm a')}`;

                                        return (
                                            <View key={plan.id} style={{ paddingHorizontal: 16 }}>
                                                <ListItem
                                                    title={plan.title || 'Untitled Plan'}
                                                    subtitle={subtitle}
                                                    showDivider={index < plans.length - 1}
                                                    trailing={
                                                        <View style={styles.actions}>
                                                            <Button
                                                                label="Confirm"
                                                                size="small"
                                                                onPress={() => onConfirmPlan(plan.id)}
                                                                style={{ marginRight: 8 }}
                                                            />
                                                        </View>
                                                    }
                                                />
                                            </View>
                                        );
                                    })}
                                </Card>
                            </View>
                        )}

                        {/* Suggestions Section */}
                        {suggestions.length > 0 && (
                            <View style={styles.section}>
                                <WidgetHeader title="Suggestions" icon={<Sparkles size={20} color={tokens.primaryMuted} />} />
                                <Card padding="none">
                                    {suggestions.map((suggestion, index) => {
                                        const friend = friends.find(f => f.id === suggestion.friendId);
                                        return (
                                            <View key={suggestion.id} style={{ paddingHorizontal: 16 }}>
                                                <ListItem
                                                    title={friend?.name || 'Friend'}
                                                    subtitle={suggestion.reason}
                                                    showDivider={index < suggestions.length - 1}
                                                    trailing={
                                                        <Button
                                                            label="View"
                                                            variant="secondary"
                                                            size="small"
                                                            onPress={() => onSuggestionAction(suggestion)}
                                                        />
                                                    }
                                                />
                                            </View>
                                        );
                                    })}
                                </Card>
                            </View>
                        )}

                        {/* Upcoming Events Section */}
                        {upcomingDates.length > 0 && (
                            <View style={styles.section}>
                                <WidgetHeader title="Upcoming" icon={<Calendar size={20} color={tokens.primaryMuted} />} />
                                <Card padding="none">
                                    {upcomingDates.map((event, index) => (
                                        <View key={`${event.friend.id}-${event.type}`} style={{ paddingHorizontal: 16 }}>
                                            <ListItem
                                                title={event.friend.name}
                                                subtitle={`${event.type === 'birthday' ? 'Birthday' : event.title} • ${event.daysUntil === 0 ? 'Today' : event.daysUntil === 1 ? 'Tomorrow' : `In ${event.daysUntil} days`}`}
                                                showDivider={index < upcomingDates.length - 1}
                                            />
                                        </View>
                                    ))}
                                </Card>
                            </View>
                        )}

                        {plans.length === 0 && suggestions.length === 0 && upcomingDates.length === 0 && (
                            <View style={styles.emptyState}>
                                <CheckCircle2 size={48} color={tokens.success} />
                                <Text style={[styles.emptyTitle, { color: tokens.foreground, fontFamily: typography.fonts.serifBold }]}>
                                    All Caught Up
                                </Text>
                                <Text style={[styles.emptyText, { color: tokens.foregroundMuted, fontFamily: typography.fonts.sans }]}>
                                    You've handled everything for now. Enjoy your day!
                                </Text>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '85%',
        paddingTop: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
    },
    closeButton: {
        padding: 4,
    },
    content: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    section: {
        marginBottom: 24,
    },
    actions: {
        flexDirection: 'row',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        gap: 16,
    },
    emptyTitle: {
        fontSize: 20,
    },
    emptyText: {
        fontSize: 16,
        textAlign: 'center',
    },
    promptContainer: {
        padding: 16,
        borderRadius: 16,
        marginBottom: 24,
        borderWidth: 1,
    },
    promptHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 6,
    },
    promptLabel: {
        fontSize: 12,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    promptText: {
        fontSize: 16,
        lineHeight: 24,
    },
});
