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

    const options: { id: InitiatorType; label: string; icon: React.ReactNode }[] = [
        {
            id: 'user',
            label: 'Me',
            icon: <User size={16} color={value === 'user' ? colors.primary : colors['muted-foreground']} />
        },
        {
            id: 'mutual',
            label: 'Mutual',
            icon: <ArrowRightLeft size={16} color={value === 'mutual' ? colors.primary : colors['muted-foreground']} />
        },
        {
            id: 'friend',
            label: friendName,
            icon: <Users size={16} color={value === 'friend' ? colors.primary : colors['muted-foreground']} />
        },
    ];

    return (
        <View className="mb-6">
            {!hideLabel && (
                <Text className="text-lg font-lora-bold font-semibold mb-3" style={{ color: colors.foreground }}>
                    Who initiated? <Text style={{ color: colors['muted-foreground'] }}>(optional)</Text>
                </Text>
            )}
            <View className="flex-row p-1 rounded-xl gap-1" style={{ backgroundColor: colors.muted }}>
                {options.map((option) => {
                    const isSelected = value === option.id;
                    return (
                        <TouchableOpacity
                            key={option.id}
                            onPress={() => onChange(option.id)}
                            className="flex-1 flex-row items-center justify-center py-3 px-2 rounded-lg gap-1.5 border"
                            style={[
                                { borderColor: 'transparent' },
                                isSelected && {
                                    backgroundColor: colors.card,
                                    borderColor: colors.primary,
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.05,
                                    shadowRadius: 4,
                                    elevation: 2
                                }
                            ]}
                        >
                            {option.icon}
                            <Text
                                className="text-sm font-inter-semibold font-semibold"
                                style={{ color: isSelected ? colors.primary : colors['muted-foreground'] }}
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
