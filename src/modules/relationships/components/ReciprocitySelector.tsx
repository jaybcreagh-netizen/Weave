import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { User, Users, ArrowRightLeft } from 'lucide-react-native';

export type InitiatorType = 'user' | 'friend' | 'mutual';

export interface ReciprocitySelectorProps {
    value?: InitiatorType;
    onChange: (value: InitiatorType) => void;
    friendName?: string;
    hideLabel?: boolean;
}

export function ReciprocitySelector({ value, onChange, friendName = 'Them', hideLabel = false }: ReciprocitySelectorProps) {
    const { colors } = useTheme();

    const options: { id: InitiatorType; label: string; icon: React.ElementType }[] = [
        {
            id: 'user',
            label: 'Me',
            icon: User
        },
        {
            id: 'mutual',
            label: 'Mutual',
            icon: ArrowRightLeft
        },
        {
            id: 'friend',
            label: friendName,
            icon: Users
        },
    ];

    return (
        <View className="mb-2">
            {!hideLabel && (
                <Text className="text-lg font-lora-bold font-semibold mb-2" style={{ color: colors.foreground }}>
                    Who initiated? <Text style={{ color: colors['muted-foreground'] }}>(optional)</Text>
                </Text>
            )}
            <View className="flex-row p-0.5 rounded-lg gap-1" style={{ backgroundColor: colors.muted }}>
                {options.map((option) => {
                    const isSelected = value === option.id;
                    const IconComponent = option.icon;
                    const iconColor = isSelected ? colors.foreground : colors['muted-foreground'];

                    return (
                        <TouchableOpacity
                            key={option.id}
                            onPress={() => onChange(option.id)}
                            className="flex-1 flex-row items-center justify-center py-2 px-2 rounded-md gap-1.5"
                            style={[
                                isSelected && {
                                    backgroundColor: colors.card,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 1 },
                                    shadowOpacity: 0.1,
                                    shadowRadius: 2,
                                    elevation: 2
                                }
                            ]}
                        >
                            <IconComponent size={14} color={iconColor} />
                            <Text
                                className="text-xs font-inter-semibold font-semibold"
                                style={{ color: isSelected ? colors.foreground : colors['muted-foreground'] }}
                                numberOfLines={1}
                            >
                                {option.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}
