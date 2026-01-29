import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Animated from 'react-native-reanimated';
import {
    Plus, Briefcase, Package, Church, Baby, Feather, Hospital,
    GraduationCap, PartyPopper, Cake, Heart, Sparkles, Plane, type LucideIcon
} from 'lucide-react-native';
import { differenceInDays } from 'date-fns';
import { useTheme } from '@/shared/hooks/useTheme';
import { LifeEvent } from '@/shared/types/legacy-types';

// Life event icon mapping
const LIFE_EVENT_ICONS: Record<string, LucideIcon> = {
    new_job: Briefcase,
    moving: Package,
    wedding: Church,
    baby: Baby,
    loss: Feather,
    health_event: Hospital,
    graduation: GraduationCap,
    celebration: PartyPopper,
    birthday: Cake,
    anniversary: Heart,
    travel: Plane,
    other: Sparkles,
};

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
                            const now = new Date();
                            const startDate = event.date;
                            const endDate = event.endDate;

                            let daysUntil = differenceInDays(startDate, now);
                            let isPastEvent = false;
                            let isUpcoming = false;
                            let isCurrent = false;

                            if (endDate) {
                                const endDiff = differenceInDays(endDate, now);
                                const startDiff = differenceInDays(now, startDate);
                                // Check if we are physically ON the start or end day or between them
                                // differenceInDays returns full days, so we might need more precise check or just trust the day diff
                                if (startDiff >= 0 && endDiff >= 0) {
                                    isCurrent = true;
                                } else if (daysUntil > 0 && daysUntil <= 30) {
                                    isUpcoming = true;
                                } else if (endDiff < 0) {
                                    isPastEvent = true;
                                    daysUntil = endDiff; // For "X days ago" logic based on end date
                                }
                            } else {
                                isPastEvent = daysUntil < 0;
                                isUpcoming = daysUntil >= 0 && daysUntil <= 30;
                            }

                            const IconComponent = LIFE_EVENT_ICONS[event.eventType] || Sparkles;

                            // Date display string
                            let dateDisplay = '';
                            if (isCurrent) {
                                dateDisplay = 'Happening now';
                                if (endDate) {
                                    const daysLeft = differenceInDays(endDate, now);
                                    dateDisplay += daysLeft > 0 ? ` (${daysLeft}d left)` : ' (Ends today)';
                                }
                            } else if (isPastEvent) {
                                dateDisplay = `${Math.abs(daysUntil)}d ago`;
                            } else if (daysUntil === 0) {
                                dateDisplay = 'Today';
                            } else if (daysUntil === 1) {
                                dateDisplay = 'Tomorrow';
                            } else {
                                dateDisplay = `${daysUntil}d`;
                            }

                            // Visualize range in date string if useful? 
                            // e.g. "Jan 1 - Jan 5" is better than "Happening now" maybe?
                            // Let's stick to status for now as requested "ends automatically" implies dynamic status.

                            return (
                                <TouchableOpacity
                                    key={event.id}
                                    onPress={() => onEdit(event)}
                                    className="flex-row items-center p-2.5 rounded-xl gap-2.5"
                                    style={{
                                        backgroundColor: colors.muted,
                                        borderColor: isCurrent ? colors.primary : (isUpcoming ? colors.border : 'transparent'), // Highlight current
                                        borderWidth: (isUpcoming || isCurrent) ? 1.5 : 0, // Border only for active/upcoming
                                    }}
                                >
                                    <IconComponent size={20} color={isCurrent ? colors.primary : (isUpcoming ? colors.foreground : colors['muted-foreground'])} />
                                    <View className="flex-1">
                                        <Text
                                            className="font-inter-semibold text-[13px] mb-0.5"
                                            style={{ color: colors.foreground }}
                                            numberOfLines={1}
                                        >
                                            {event.title}
                                        </Text>
                                        <View className="flex-row items-center justify-between">
                                            <Text
                                                className="font-inter-regular text-[11px]"
                                                style={{ color: isCurrent ? colors.primary : colors['muted-foreground'] }}
                                            >
                                                {dateDisplay}
                                            </Text>
                                            {endDate && (
                                                <Text className="font-inter-regular text-[10px]" style={{ color: colors.border }}>
                                                    {startDate.getDate()}/{startDate.getMonth() + 1} - {endDate.getDate()}/{endDate.getMonth() + 1}
                                                </Text>
                                            )}
                                        </View>
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
