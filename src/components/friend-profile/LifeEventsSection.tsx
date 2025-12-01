import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Plus } from 'lucide-react-native';
import { differenceInDays } from 'date-fns';
import { useTheme } from '@/shared/hooks/useTheme';
import { LifeEvent } from '@/components/types';

interface LifeEventsSectionProps {
    lifeEvents: LifeEvent[];
    buttonsOpacity: SharedValue<number>;
    onAdd: () => void;
    onEdit: (event: LifeEvent) => void;
}

export function LifeEventsSection({
    lifeEvents,
    buttonsOpacity,
    onAdd,
    onEdit,
}: LifeEventsSectionProps) {
    const { colors } = useTheme();

    const buttonsAnimatedStyle = useAnimatedStyle(() => ({
        opacity: buttonsOpacity.value,
    }));

    if (lifeEvents.length === 0 && false) { // Logic from original file: always show?
        // Original: activeLifeEvents.length > 0 || true
        // So it always renders.
    }

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.lifeEventsSection, buttonsAnimatedStyle]}>
                <View style={styles.lifeEventsSectionHeader}>
                    <Text style={[styles.lifeEventsSectionTitle, { color: colors.foreground }]}>
                        Life Events
                    </Text>
                    <TouchableOpacity
                        onPress={onAdd}
                        style={[styles.addLifeEventButton, { backgroundColor: colors.muted }]}
                    >
                        <Plus size={14} color={colors.primary} />
                        <Text style={[styles.addLifeEventText, { color: colors.primary }]}>Add</Text>
                    </TouchableOpacity>
                </View>

                {lifeEvents.length > 0 ? (
                    <View style={styles.lifeEventsList}>
                        {lifeEvents.map((event) => {
                            const daysUntil = differenceInDays(event.date, new Date());
                            const isPastEvent = daysUntil < 0;
                            const isUpcoming = daysUntil >= 0 && daysUntil <= 30;

                            const eventIcons: Record<string, string> = {
                                new_job: '💼', moving: '📦', wedding: '💒', baby: '👶',
                                loss: '🕊️', health_event: '🏥', graduation: '🎓',
                                celebration: '🎉', birthday: '🎂', anniversary: '💝', other: '✨'
                            };

                            return (
                                <TouchableOpacity
                                    key={event.id}
                                    onPress={() => onEdit(event)}
                                    style={[
                                        styles.lifeEventCard,
                                        {
                                            backgroundColor: colors.muted,
                                            borderColor: isUpcoming ? colors.primary : colors.border,
                                            borderWidth: isUpcoming ? 1.5 : 1,
                                        }
                                    ]}
                                >
                                    <Text style={styles.lifeEventIcon}>{eventIcons[event.eventType]}</Text>
                                    <View style={styles.lifeEventContent}>
                                        <Text style={[styles.lifeEventTitle, { color: colors.foreground }]} numberOfLines={1}>
                                            {event.title}
                                        </Text>
                                        <Text style={[styles.lifeEventDate, { color: colors['muted-foreground'] }]}>
                                            {isPastEvent
                                                ? `${Math.abs(daysUntil)}d ago`
                                                : daysUntil === 0
                                                    ? 'Today'
                                                    : daysUntil === 1
                                                        ? 'Tomorrow'
                                                        : `${daysUntil}d`}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                ) : (
                    <Text style={[styles.noLifeEvents, { color: colors['muted-foreground'] }]}>
                        No active life events. Tap "Add" to create one.
                    </Text>
                )}
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { paddingHorizontal: 20 },
    lifeEventsSection: {
        marginTop: 8,
        marginBottom: 8,
    },
    lifeEventsSectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    lifeEventsSectionTitle: {
        fontFamily: 'Lora_700Bold',
        fontSize: 15,
    },
    addLifeEventButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
    },
    addLifeEventText: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 12,
    },
    lifeEventsList: {
        gap: 6,
    },
    lifeEventCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 10,
        gap: 10,
        marginBottom: 0,
    },
    lifeEventIcon: {
        fontSize: 20,
    },
    lifeEventContent: {
        flex: 1,
    },
    lifeEventTitle: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 13,
        marginBottom: 1,
    },
    lifeEventDate: {
        fontFamily: 'Inter_400Regular',
        fontSize: 11,
    },
    noLifeEvents: {
        fontSize: 13,
        fontStyle: 'italic',
    },
});
