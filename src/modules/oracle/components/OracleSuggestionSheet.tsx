import React from 'react'
import { View, Text, TouchableOpacity, Modal, ScrollView, SafeAreaView } from 'react-native'
import { OracleSuggestion, OracleLensArchetype } from '../services/types'
import {
    Sparkles,
    Zap,
    Heart,
    Search,
    Feather,
    Moon,
    Sun,
    Crown,
    ArrowRight,
    X,
    Loader2
} from 'lucide-react-native'
import { BlurView } from 'expo-blur'
import { useTheme } from '@/shared/hooks/useTheme'

interface Props {
    visible: boolean
    onClose: () => void
    suggestions: OracleSuggestion[]
    onSelect: (suggestion: OracleSuggestion) => void
}

const ARCHETYPE_CONFIG: Record<OracleLensArchetype, {
    icon: any,
    color: string,
    label: string
}> = {
    THE_HERMIT: {
        icon: Search,
        color: '#4B5563',
        label: 'Inward'
    },
    THE_EMPEROR: {
        icon: Crown,
        color: '#B91C1C',
        label: 'Structure'
    },
    THE_LOVERS: {
        icon: Heart,
        color: '#BE185D',
        label: 'Relational'
    },
    THE_MAGICIAN: {
        icon: Zap,
        color: '#7C3AED',
        label: 'Creative'
    },
    THE_EMPRESS: {
        icon: Feather,
        color: '#059669',
        label: 'Nurture'
    },
    THE_HIGH_PRIESTESS: {
        icon: Moon,
        color: '#4F46E5',
        label: 'Intuitive'
    },
    THE_FOOL: {
        icon: Sparkles,
        color: '#D97706',
        label: 'Spontaneous'
    },
    THE_SUN: {
        icon: Sun,
        color: '#F59E0B',
        label: 'Radiant'
    }
}

export const OracleSuggestionSheet = ({ visible, onClose, suggestions, onSelect }: Props) => {
    const { colors, isDarkMode } = useTheme()

    if (!visible) return null

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <BlurView intensity={isDarkMode ? 30 : 20} style={{ flex: 1 }} tint={isDarkMode ? 'dark' : 'light'}>
                <SafeAreaView className="flex-1 bg-black/5 dark:bg-black/40">
                    {/* Header */}
                    <View className="px-6 pt-6 pb-4 flex-row justify-between items-start">
                        <View className="flex-1 mr-4">
                            <Text
                                className="text-2xl font-bold mb-1"
                                style={{
                                    color: colors.foreground,
                                    fontFamily: 'Lora_700Bold'
                                }}
                            >
                                How shall we weave?
                            </Text>
                            <Text
                                className="text-base"
                                style={{
                                    color: colors.foreground,
                                    opacity: 0.6,
                                    fontFamily: 'Inter_400Regular'
                                }}
                            >
                                Choose a lens to deepen your reflection
                            </Text>
                        </View>

                        <TouchableOpacity
                            onPress={onClose}
                            className="p-2 rounded-full"
                            style={{ backgroundColor: colors.muted + '20' }}
                        >
                            <X size={24} color={colors.foreground} />
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    <ScrollView
                        className="flex-1"
                        contentContainerStyle={{ padding: 24, paddingTop: 10, gap: 16, paddingBottom: 100 }}
                        showsVerticalScrollIndicator={false}
                    >
                        {(!suggestions || suggestions.length === 0) ? (
                            <View className="items-center justify-center py-20 gap-4">
                                <View className="p-4 rounded-full bg-white/50 dark:bg-black/20">
                                    <Loader2 size={32} color={colors.primary} className="animate-spin" />
                                </View>
                                <Text style={{ color: colors.muted, fontFamily: 'Inter_400Regular' }}>
                                    Consulting the threads...
                                </Text>
                            </View>
                        ) : (
                            suggestions.map((suggestion, index) => {
                                const config = ARCHETYPE_CONFIG[suggestion.archetype as OracleLensArchetype] || ARCHETYPE_CONFIG.THE_HERMIT
                                const Icon = config.icon

                                return (
                                    <TouchableOpacity
                                        key={suggestion.id}
                                        onPress={() => onSelect(suggestion)}
                                        activeOpacity={0.7}
                                        className="w-full rounded-2xl overflow-hidden border"
                                        style={{
                                            backgroundColor: colors.card,
                                            borderColor: colors.border,
                                            // Soft shadow for depth
                                            shadowColor: isDarkMode ? '#000' : '#000',
                                            shadowOffset: { width: 0, height: 2 },
                                            shadowOpacity: isDarkMode ? 0.3 : 0.05,
                                            shadowRadius: 8,
                                            elevation: 2
                                        }}
                                    >
                                        <View className="p-5 flex-row gap-4">
                                            {/* Icon Container */}
                                            <View
                                                className="w-12 h-12 rounded-full items-center justify-center shrink-0"
                                                style={{
                                                    backgroundColor: config.color + '15', // 15% opacity tint
                                                }}
                                            >
                                                <Icon size={24} color={config.color} />
                                            </View>

                                            <View className="flex-1 gap-1.5">
                                                {/* Meta Row */}
                                                <View className="flex-row items-center gap-2">
                                                    <Text
                                                        className="text-[10px] font-bold uppercase tracking-widest"
                                                        style={{ color: config.color, fontFamily: 'Inter_700Bold' }}
                                                    >
                                                        {config.label}
                                                    </Text>
                                                </View>

                                                <Text
                                                    className="text-lg font-bold leading-tight"
                                                    style={{
                                                        color: colors.foreground,
                                                        fontFamily: 'Lora_700Bold'
                                                    }}
                                                >
                                                    {suggestion.title}
                                                </Text>

                                                <Text
                                                    className="text-sm leading-relaxed"
                                                    style={{
                                                        color: colors.foreground,
                                                        opacity: 0.7,
                                                        fontFamily: 'Inter_400Regular'
                                                    }}
                                                >
                                                    {suggestion.reasoning}
                                                </Text>
                                            </View>

                                            {/* Arrow */}
                                            <View className="justify-center opacity-30">
                                                <ArrowRight size={20} color={colors.foreground} />
                                            </View>
                                        </View>

                                        {/* Subtle colored accent line at bottom */}
                                        <View style={{ height: 3, width: '100%', backgroundColor: config.color, opacity: 0.3 }} />
                                    </TouchableOpacity>
                                )
                            })
                        )}
                    </ScrollView>
                </SafeAreaView>
            </BlurView>
        </Modal>
    )
}
