import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
        <View style={styles.container}>
            {!hideLabel && (
                <Text style={[styles.label, { color: colors.foreground }]}>
                    Who initiated? <Text style={{ color: colors['muted-foreground'] }}>(optional)</Text>
                </Text>
            )}
            <View style={[styles.selectorContainer, { backgroundColor: colors.muted }]}>
                {options.map((option) => {
                    const isSelected = value === option.id;
                    return (
                        <TouchableOpacity
                            key={option.id}
                            onPress={() => onChange(option.id)}
                            style={[
                                styles.option,
                                isSelected && [styles.selectedOption, { backgroundColor: colors.card, borderColor: colors.primary }]
                            ]}
                        >
                            {option.icon}
                            <Text
                                style={[
                                    styles.optionLabel,
                                    { color: isSelected ? colors.primary : colors['muted-foreground'] }
                                ]}
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

const styles = StyleSheet.create({
    container: {
        marginBottom: 24,
    },
    label: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 12,
        fontFamily: 'Lora-Bold',
    },
    selectorContainer: {
        flexDirection: 'row',
        padding: 4,
        borderRadius: 12,
        gap: 4,
    },
    option: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 10,
        gap: 6,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    selectedOption: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    optionLabel: {
        fontSize: 14,
        fontWeight: '600',
        fontFamily: 'Inter-SemiBold',
    },
});
