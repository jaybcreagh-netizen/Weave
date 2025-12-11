import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { SocialSeason } from '@/modules/intelligence';
import { Star, Clock, Bell, Zap } from 'lucide-react-native';

interface SeasonEffectsPanelProps {
    season: SocialSeason;
}

export const SeasonEffectsPanel: React.FC<SeasonEffectsPanelProps> = ({ season }) => {
    const { colors, typography } = useTheme();



    // Helper to format multiplier text
    const getDecayText = () => {
        if (season === 'resting') return 'Friendships hold their warmth longer';
        if (season === 'blooming') return 'Connections need active tending';
        return 'Relationships flow at a natural pace';
    };

    const getScoringText = () => {
        if (season === 'resting') return 'Small gestures have deeper impact';
        if (season === 'blooming') return 'Quality moments spark rapid growth';
        return 'Steady growth from consistency';
    };

    const getNotifText = () => {
        if (season === 'resting') return 'A quieter space to recharge';
        if (season === 'blooming') return 'Abundant inspiration to connect';
        return 'A balanced rhythm of nudges';
    };

    const activeEffects = [
        {
            icon: Clock,
            text: getDecayText(),
            color: season === 'resting' ? '#8B5CF6' : (season === 'blooming' ? '#F59E0B' : colors.foreground),
        },
        {
            icon: Bell,
            text: getNotifText(),
            color: colors.foreground,
        },
        {
            icon: Star,
            text: getScoringText(),
            color: colors.foreground,
        }
    ];

    return (
        <View style={{
            backgroundColor: colors.card,
            borderRadius: 16,
            padding: 16,
            marginTop: 16,
            borderWidth: 1,
            borderColor: colors.border
        }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 }}>
                <Zap size={16} color={colors.primary} fill={colors.primary} />
                <Text style={{
                    color: colors.foreground,
                    fontFamily: typography.fonts.sansSemiBold,
                    fontSize: typography.scale.label.fontSize
                }}>
                    Season Effects
                </Text>
            </View>

            <View style={{ gap: 12 }}>
                {activeEffects.map((effect, index) => (
                    <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <effect.icon size={18} color={effect.color} />
                        <Text style={{
                            color: colors['muted-foreground'],
                            fontFamily: typography.fonts.sans,
                            fontSize: typography.scale.body.fontSize
                        }}>
                            {effect.text}
                        </Text>
                    </View>
                ))}
            </View>
        </View>
    );
};
