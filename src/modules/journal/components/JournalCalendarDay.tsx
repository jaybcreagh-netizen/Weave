import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { DateData } from 'react-native-calendars';
import { DayState } from 'react-native-calendars/src/types';
import { Sparkles, Gift, Heart } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';

interface JournalCalendarDayProps {
    date: DateData;
    state: DayState;
    marking?: any;
    onPress: (date: DateData) => void;
}

export function JournalCalendarDay({ date, state, marking, onPress }: JournalCalendarDayProps) {
    const { colors } = useTheme();
    const isSelected = marking?.selected;
    const isToday = state === 'today';
    const isDisabled = state === 'disabled';

    // Metadata from marking
    const friendAvatars = marking?.friendAvatars || [];
    const isMilestone = marking?.isMilestone;
    const isThrowback = marking?.isThrowback;
    const hasEntry = marking?.marked;

    const handlePress = () => {
        onPress(date);
    };

    return (
        <TouchableOpacity
            onPress={handlePress}
            className="w-full h-[54px] items-center justify-start pt-1"
            activeOpacity={0.7}
        >
            {/* Selection Circle */}
            {isSelected && (
                <View
                    className="absolute top-0 w-8 h-8 rounded-full"
                    style={{ backgroundColor: colors.primary }}
                />
            )}

            {/* Today Indicator (if not selected) */}
            {isToday && !isSelected && (
                <View
                    className="absolute top-0 w-8 h-8 rounded-full border"
                    style={{ borderColor: colors.primary }}
                />
            )}

            {/* Date Number */}
            <Text
                className="text-sm mb-0.5"
                style={{
                    fontFamily: isSelected || isToday ? 'Inter_600SemiBold' : 'Inter_400Regular',
                    color: isSelected
                        ? colors['primary-foreground']
                        : isDisabled
                            ? colors.muted
                            : isToday
                                ? colors.primary
                                : colors.foreground
                }}
            >
                {date.day}
            </Text>

            {/* Markers Container */}
            <View className="flex-row items-center justify-center h-4 w-full">
                {/* Milestone Icon */}
                {isMilestone && (
                    <View className="mr-1">
                        <Gift size={10} color={colors.primary} />
                    </View>
                )}

                {/* Throwback Icon */}
                {isThrowback && !isMilestone && (
                    <View className="mr-1">
                        <Sparkles size={10} color="#F59E0B" />
                    </View>
                )}

                {/* Friend Avatars */}
                {friendAvatars.length > 0 ? (
                    <View className="flex-row">
                        {friendAvatars.slice(0, 3).map((url: string | null, index: number) => (
                            <View
                                key={index}
                                className="w-3.5 h-3.5 rounded-full border border-white -ml-1 first:ml-0 overflow-hidden bg-gray-200 items-center justify-center"
                                style={{ borderColor: colors.card }}
                            >
                                {url ? (
                                    <Image source={{ uri: url }} className="w-full h-full" />
                                ) : (
                                    <View className="w-full h-full bg-indigo-100" />
                                )}
                            </View>
                        ))}
                        {friendAvatars.length > 3 && (
                            <View
                                className="w-3.5 h-3.5 rounded-full border border-white -ml-1 bg-gray-100 items-center justify-center"
                                style={{ borderColor: colors.card }}
                            >
                                <Text style={{ fontSize: 6, color: colors.foreground }}>+</Text>
                            </View>
                        )}
                    </View>
                ) : hasEntry && !isSelected ? (
                    // Simple dot if no avatars but has entry
                    <View
                        className="w-1 h-1 rounded-full"
                        style={{ backgroundColor: colors.primary }}
                    />
                ) : null}
            </View>
        </TouchableOpacity>
    );
}
