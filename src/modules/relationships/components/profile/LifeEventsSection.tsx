import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Animated from 'react-native-reanimated';
import { Plus } from 'lucide-react-native';
import { differenceInDays } from 'date-fns';
import { useTheme } from '@/shared/hooks/useTheme';
import { LifeEvent } from '@/shared/types/legacy-types';

interface LifeEventsSectionProps {
    lifeEvents: LifeEvent[];
    onAdd: () => void;
    onEdit: (event: LifeEvent) => void;
}

export function LifeEventsSection({
    lifeEvents,
    onAdd,
    onEdit,
}: LifeEventsSectionProps) {
    const { colors } = useTheme();

    return (
        <View className="px-5">
            <Animated.View className="mt-2 mb-2">
                <View className="flex-row justify-between items-center mb-2">
                    <Text className="font-lora-bold text-[15px]" style={{ color: colors.foreground }}>
                        Life Events
                    </Text>
                    <TouchableOpacity
                        onPress={onAdd}
                        className="flex-row items-center gap-1 px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: colors.muted }}
                    >
                        <Plus size={14} color={colors.primary} />
                        <Text className="font-inter-semibold text-xs" style={{ color: colors.primary }}>Add</Text>
                    </TouchableOpacity>
                </View>

                {lifeEvents.length > 0 ? (
                    <View className="gap-1.5">
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
                                    className="flex-row items-center p-2.5 rounded-xl gap-2.5"
                                    style={{
                                        backgroundColor: colors.muted,
                                        borderColor: isUpcoming ? colors.primary : colors.border,
                                        borderWidth: isUpcoming ? 1.5 : 1,
                                    }}
                                >
                                    <Text className="text-xl">{eventIcons[event.eventType]}</Text>
                                    <View className="flex-1">
                                        <Text
                                            className="font-inter-semibold text-[13px] mb-0.5"
                                            style={{ color: colors.foreground }}
                                            numberOfLines={1}
                                        >
                                            {event.title}
                                        </Text>
                                        <Text
                                            className="font-inter-regular text-[11px]"
                                            style={{ color: colors['muted-foreground'] }}
                                        >
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
                    <Text
                        className="text-[13px] italic"
                        style={{ color: colors['muted-foreground'] }}
                    >
                        No active life events. Tap "Add" to create one.
                    </Text>
                )}
            </Animated.View>
        </View>
    );
}
